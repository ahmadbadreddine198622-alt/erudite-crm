import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { DeepgramTrack } from "./deepgram.js";
import { fetchContextPack, postCallComplete } from "./base44.js";
import { liveBrainTick, strategicEscalation, summarizeCall } from "./brain.js";

// Money talk in en/ar/ru triggers the Sonnet escalation even when Haiku
// didn't flag a formal objection.
const MONEY_TALK =
  /price|commission|mandate|exclusiv|fee|percent|valuation|worth|asking|listing agreement|سعر|عمولة|توكيل|حصري|цена|комисси|эксклюзив|мандат/i;

/**
 * One live call: owns the Twilio stream state, both Deepgram tracks, the
 * copilot brain loop, cockpit fan-out, talk-ratio tracking, and the local
 * session log. Every external failure is contained here — the audio path
 * (Twilio -> Deepgram) and the relay process must never die because Base44
 * or Anthropic did.
 */
export class CallSession {
  constructor({ streamSid, callSid, customParameters }) {
    this.streamSid = streamSid;
    this.callSid = callSid;
    this.callLogId = customParameters.call_log_id || `unknown-${streamSid}`;
    this.landlordId = customParameters.landlord_id || null;
    this.agentEmail = customParameters.agent_email || null;

    this.startedAt = new Date().toISOString();
    this.endedAt = null;
    this.ended = false;

    this.contextPack = null;
    this.transcript = []; // final utterances: {speaker, text, ts}
    this.signals = new Set();
    this.qualifyUpdates = []; // accumulated {field_key, value, quote}
    this.suggestions = [];
    this.errors = [];
    this.summary = null;

    this.talkTime = { agent: 0, landlord: 0 }; // seconds of speech

    /** @type {Set<import('ws').WebSocket>} */
    this.cockpits = new Set();
    this.eventHistory = []; // everything pushed, for reconnect replay

    // Brain loop state
    this.brainTimer = null;
    this.brainInFlight = false;
    this.brainPending = false;
    this.lastEscalationAt = 0;
    this.escalationInFlight = false;

    this.tracks = {
      landlord: new DeepgramTrack({
        speaker: "landlord",
        onTranscript: (r) => this.onTranscript(r),
        onError: (e) => this.reportError("deepgram:landlord", e),
      }),
      agent: new DeepgramTrack({
        speaker: "agent",
        onTranscript: (r) => this.onTranscript(r),
        onError: (e) => this.reportError("deepgram:agent", e),
      }),
    };

    this.talkRatioTimer = setInterval(
      () => this.pushTalkRatio(),
      config.talkRatioIntervalMs,
    );
    this.logFlushTimer = setInterval(() => this.writeLog(), 30000);

    this.loadContextPack();
  }

  log(...args) {
    console.log(`[${this.callLogId}]`, ...args);
  }

  async loadContextPack() {
    try {
      this.contextPack = await fetchContextPack({
        call_log_id: this.callLogId,
        landlord_id: this.landlordId,
        agent_email: this.agentEmail,
      });
      this.log("context pack loaded");
      this.pushEvent({
        type: "status",
        state: "context_ready",
        landlord_id: this.landlordId,
      });
    } catch (err) {
      this.reportError("base44:contextPack", err);
      // Degrade: brain runs without landlord intelligence rather than not at all.
      this.contextPack = {
        warning: "context pack unavailable — copilot running without landlord intelligence",
        landlord_id: this.landlordId,
      };
    }
  }

  // ---- Audio path -------------------------------------------------------

  /** @param {"inbound"|"outbound"} track @param {Buffer} payload mulaw audio */
  onMedia(track, payload) {
    // Twilio: inbound = landlord (far end), outbound = agent.
    const speaker = track === "inbound" ? "landlord" : "agent";
    this.tracks[speaker].sendAudio(payload);
  }

  // ---- Transcripts ------------------------------------------------------

  onTranscript({ speaker, text, isFinal, duration }) {
    if (this.ended) return;

    this.pushEvent(
      { type: "transcript", speaker, text, is_final: isFinal },
      { record: isFinal }, // only replay finals on reconnect
    );

    if (!isFinal) return;

    this.transcript.push({ speaker, text, ts: new Date().toISOString() });
    this.talkTime[speaker] += duration || 0;

    if (speaker === "landlord") {
      this.scheduleBrain();
      if (MONEY_TALK.test(text)) {
        this.maybeEscalate(`money talk detected in landlord utterance: "${text.slice(0, 120)}"`);
      }
    }
  }

  // ---- Brain loop -------------------------------------------------------

  scheduleBrain() {
    clearTimeout(this.brainTimer);
    this.brainTimer = setTimeout(() => this.runBrain(), config.brainDebounceMs);
  }

  async runBrain() {
    if (this.ended) return;
    if (this.brainInFlight) {
      this.brainPending = true;
      return;
    }
    if (this.transcript.length === 0) return;
    this.brainInFlight = true;
    try {
      const result = await liveBrainTick({
        contextPack: this.contextPack,
        transcript: this.transcript,
      });
      if (!this.ended) this.applyBrainResult(result);
    } catch (err) {
      this.reportError("anthropic:live", err);
    } finally {
      this.brainInFlight = false;
      if (this.brainPending) {
        this.brainPending = false;
        this.scheduleBrain();
      }
    }
  }

  applyBrainResult(result) {
    const suggestion = {
      type: "suggestion",
      tier: "live",
      say_next: result.say_next,
      objection: result.objection ?? null,
    };
    this.suggestions.push({ ...suggestion, ts: new Date().toISOString() });
    this.pushEvent(suggestion, { record: true });

    if (Array.isArray(result.signals) && result.signals.length > 0) {
      for (const s of result.signals) this.signals.add(s);
      this.pushEvent(
        { type: "signal", signals: [...this.signals] },
        { record: true },
      );
    }

    if (Array.isArray(result.qualify_updates) && result.qualify_updates.length > 0) {
      this.qualifyUpdates.push(...result.qualify_updates);
      this.pushEvent(
        { type: "qualify", updates: result.qualify_updates },
        { record: true },
      );
    }

    if (result.objection?.detected) {
      this.maybeEscalate(`objection detected: ${result.objection.type}`);
    }
  }

  async maybeEscalate(trigger) {
    if (this.ended || this.escalationInFlight) return;
    const now = Date.now();
    if (now - this.lastEscalationAt < config.escalationCooldownMs) return;
    this.lastEscalationAt = now;
    this.escalationInFlight = true;
    try {
      const result = await strategicEscalation({
        contextPack: this.contextPack,
        transcript: this.transcript,
        trigger,
      });
      if (this.ended) return;
      const suggestion = {
        type: "suggestion",
        tier: "strategic",
        say_next: result.say_next,
        play: result.play,
        risk: result.risk,
        trigger,
      };
      this.suggestions.push({ ...suggestion, ts: new Date().toISOString() });
      this.pushEvent(suggestion, { record: true });
    } catch (err) {
      this.reportError("anthropic:strategic", err);
    } finally {
      this.escalationInFlight = false;
    }
  }

  // ---- Cockpit ----------------------------------------------------------

  attachCockpit(ws) {
    this.cockpits.add(ws);
    ws.on("close", () => this.cockpits.delete(ws));
    // Replay so a mid-call reconnect sees the full picture.
    const replay = {
      type: "replay",
      call_log_id: this.callLogId,
      started_at: this.startedAt,
      events: this.eventHistory,
      talk_ratio: this.talkRatio(),
    };
    try {
      ws.send(JSON.stringify(replay));
    } catch {
      this.cockpits.delete(ws);
    }
  }

  pushEvent(event, { record = true } = {}) {
    const payload = { ...event, call_log_id: this.callLogId, ts: new Date().toISOString() };
    if (record) this.eventHistory.push(payload);
    const json = JSON.stringify(payload);
    for (const ws of this.cockpits) {
      try {
        if (ws.readyState === ws.OPEN) ws.send(json);
      } catch {
        this.cockpits.delete(ws);
      }
    }
  }

  talkRatio() {
    const { agent, landlord } = this.talkTime;
    const total = agent + landlord;
    return {
      agent_seconds: Math.round(agent),
      landlord_seconds: Math.round(landlord),
      agent_pct: total > 0 ? Math.round((agent / total) * 100) : 0,
      landlord_pct: total > 0 ? Math.round((landlord / total) * 100) : 0,
    };
  }

  pushTalkRatio() {
    if (this.ended) return;
    this.pushEvent({ type: "signal", talk_ratio: this.talkRatio() }, { record: false });
  }

  reportError(source, err) {
    const message = err?.message || String(err);
    console.error(`[${this.callLogId}] [${source}]`, message);
    this.errors.push({ source, message, ts: new Date().toISOString() });
    try {
      this.pushEvent({ type: "error", source, message }, { record: false });
    } catch {
      /* never let error reporting take the session down */
    }
  }

  // ---- End of call ------------------------------------------------------

  async end(reason = "twilio_stop") {
    if (this.ended) return;
    this.ended = true;
    this.endedAt = new Date().toISOString();
    this.log(`call ended (${reason})`);

    clearTimeout(this.brainTimer);
    clearInterval(this.talkRatioTimer);
    clearInterval(this.logFlushTimer);
    this.tracks.landlord.close();
    this.tracks.agent.close();

    // Summary is best-effort; the CRM post must go out either way.
    try {
      this.summary = await summarizeCall({
        contextPack: this.contextPack,
        transcript: this.transcript,
        signals: [...this.signals],
        qualifyUpdates: this.qualifyUpdates,
      });
    } catch (err) {
      this.reportError("anthropic:summary", err);
      this.summary = null;
    }

    const payload = {
      call_log_id: this.callLogId,
      landlord_id: this.landlordId,
      agent_email: this.agentEmail,
      transcript: this.transcript,
      qualify_updates: this.qualifyUpdates,
      signals: [...this.signals],
      talk_ratio: this.talkRatio(),
      summary: this.summary,
      started_at: this.startedAt,
      ended_at: this.endedAt,
    };

    try {
      await postCallComplete(payload);
      this.log("copilotCallComplete posted");
    } catch (err) {
      this.reportError("base44:callComplete", err);
    }

    this.pushEvent(
      {
        type: "call_ended",
        reason,
        summary: this.summary,
        talk_ratio: this.talkRatio(),
        signals: [...this.signals],
      },
      { record: true },
    );

    this.writeLog();

    // Give the cockpit a moment to read the final events, then close.
    setTimeout(() => {
      for (const ws of this.cockpits) {
        try {
          ws.close(1000, "call ended");
        } catch {
          /* ignore */
        }
      }
    }, 5000);
  }

  writeLog() {
    try {
      fs.mkdirSync(config.logsDir, { recursive: true });
      const file = path.join(
        config.logsDir,
        `${this.callLogId.replace(/[^\w.-]/g, "_")}.json`,
      );
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            call_log_id: this.callLogId,
            landlord_id: this.landlordId,
            agent_email: this.agentEmail,
            stream_sid: this.streamSid,
            call_sid: this.callSid,
            started_at: this.startedAt,
            ended_at: this.endedAt,
            transcript: this.transcript,
            suggestions: this.suggestions,
            qualify_updates: this.qualifyUpdates,
            signals: [...this.signals],
            talk_ratio: this.talkRatio(),
            summary: this.summary,
            errors: this.errors,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      console.error(`[${this.callLogId}] failed to write session log:`, err.message);
    }
  }
}
