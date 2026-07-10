import WebSocket from "ws";
import { config } from "./config.js";

const KEEPALIVE_MS = 7000;
const MAX_RECONNECTS = 5;

const DG_URL = (() => {
  const params = new URLSearchParams({
    model: "nova-3",
    encoding: "mulaw",
    sample_rate: "8000",
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    punctuate: "true",
    // Multilingual code-switching (covers English + Russian; Arabic support
    // depends on Deepgram's current nova-3 language matrix — see README).
    language: "multi",
    endpointing: "300",
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
})();

/**
 * One Deepgram streaming connection for a single Twilio track.
 * Buffers audio while (re)connecting so no frames are dropped, sends
 * keepalives during silence, and reconnects with backoff on failure.
 * All failures are reported via onError — never thrown.
 */
export class DeepgramTrack {
  /**
   * @param {object} opts
   * @param {"agent"|"landlord"} opts.speaker
   * @param {(result: {speaker: string, text: string, isFinal: boolean, speechFinal: boolean, start: number, duration: number}) => void} opts.onTranscript
   * @param {(err: Error) => void} opts.onError
   */
  constructor({ speaker, onTranscript, onError }) {
    this.speaker = speaker;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.ws = null;
    this.open = false;
    this.closed = false; // closed by us (call ended)
    this.dead = false; // gave up after too many reconnects
    this.buffer = [];
    this.reconnects = 0;
    this.keepaliveTimer = null;
    this.reconnectTimer = null;
    this.connect();
  }

  connect() {
    if (this.closed || this.dead) return;

    // A failing attempt emits both 'error' and 'close' — count it once, or
    // every failure double-schedules a reconnect and the retry cap never binds.
    let failed = false;
    const failOnce = (err) => {
      if (failed) return;
      failed = true;
      this.handleFailure(err);
    };

    try {
      this.ws = new WebSocket(DG_URL, {
        headers: { Authorization: `Token ${config.deepgramApiKey}` },
      });
    } catch (err) {
      failOnce(err);
      return;
    }

    this.ws.on("open", () => {
      this.open = true;
      this.reconnects = 0;
      // Flush audio buffered while connecting.
      for (const chunk of this.buffer.splice(0)) this.ws.send(chunk);
      this.keepaliveTimer = setInterval(() => {
        if (this.open) {
          try {
            this.ws.send(JSON.stringify({ type: "KeepAlive" }));
          } catch {
            /* socket already dying; close handler takes over */
          }
        }
      }, KEEPALIVE_MS);
    });

    this.ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type !== "Results") return;
      const alt = msg.channel?.alternatives?.[0];
      const text = (alt?.transcript || "").trim();
      if (!text) return;
      try {
        this.onTranscript({
          speaker: this.speaker,
          text,
          isFinal: Boolean(msg.is_final),
          speechFinal: Boolean(msg.speech_final),
          start: msg.start ?? 0,
          duration: msg.duration ?? 0,
        });
      } catch (err) {
        this.onError(err);
      }
    });

    this.ws.on("error", (err) => failOnce(err));
    this.ws.on("close", () => {
      this.open = false;
      clearInterval(this.keepaliveTimer);
      failOnce(new Error("Deepgram socket closed unexpectedly"));
    });
  }

  handleFailure(err) {
    this.open = false;
    clearInterval(this.keepaliveTimer);
    if (this.closed || this.dead) return;
    this.onError(err);
    if (this.reconnects >= MAX_RECONNECTS) {
      this.dead = true;
      this.buffer = [];
      this.onError(new Error(`Deepgram (${this.speaker}): giving up after ${MAX_RECONNECTS} reconnects`));
      return;
    }
    const delay = Math.min(500 * 2 ** this.reconnects, 8000);
    this.reconnects += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /** @param {Buffer} chunk raw mulaw 8kHz audio */
  sendAudio(chunk) {
    if (this.closed || this.dead) return;
    if (this.open && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(chunk);
      } catch (err) {
        this.onError(err);
      }
    } else {
      this.buffer.push(chunk);
      // Cap the reconnect buffer at ~30s of audio (8000 B/s) so a dead
      // Deepgram connection can't grow memory unbounded on a long call.
      if (this.buffer.length > 1500) this.buffer.shift();
    }
  }

  close() {
    this.closed = true;
    clearInterval(this.keepaliveTimer);
    clearTimeout(this.reconnectTimer);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
        this.ws.close();
      } catch {
        /* ignore */
      }
    } else if (this.ws) {
      try {
        this.ws.terminate();
      } catch {
        /* ignore */
      }
    }
  }
}
