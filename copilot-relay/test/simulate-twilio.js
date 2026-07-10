#!/usr/bin/env node
/**
 * Simulates a Twilio Media Stream against the relay so the full pipeline
 * (Twilio protocol -> Deepgram -> Claude -> cockpit -> Base44) can be tested
 * without a real phone call.
 *
 * Usage:
 *   node test/simulate-twilio.js [options]
 *
 * Options:
 *   --url ws://localhost:8090          relay base URL (default)
 *   --landlord-file path/to/audio.wav  audio for the inbound (landlord) track
 *   --agent-file path/to/audio.wav     audio for the outbound (agent) track
 *   --call-log-id test-call-123        custom parameter (default: test-<ts>)
 *   --landlord-id L-001
 *   --agent-email agent@erudite-estate.com
 *   --no-cockpit                       don't open a cockpit connection
 *
 * Audio files: 16-bit PCM WAV (any sample rate, mono; resampled to 8 kHz and
 * mulaw-encoded here) or raw mulaw 8 kHz (.ulaw/.raw). Without a file, a
 * synthetic tone pattern is streamed — it exercises the audio path but won't
 * produce meaningful transcripts.
 *
 * The cockpit connection needs SHARED_SECRET in the environment (or .env).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import WebSocket from "ws";
import "dotenv/config";

// ---- args ------------------------------------------------------------------

const args = process.argv.slice(2);
function argVal(name, dflt = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const BASE_URL = argVal("--url", "ws://localhost:8090");
const CALL_LOG_ID = argVal("--call-log-id", `test-${Date.now()}`);
const LANDLORD_ID = argVal("--landlord-id", "landlord-test-001");
const AGENT_EMAIL = argVal("--agent-email", "agent@erudite-estate.com");
const LANDLORD_FILE = argVal("--landlord-file");
const AGENT_FILE = argVal("--agent-file");
const WITH_COCKPIT = !args.includes("--no-cockpit");

// ---- audio helpers -----------------------------------------------------------

/** Linear PCM16 sample -> 8-bit mulaw. */
function linearToMulaw(sample) {
  const MULAW_MAX = 0x1fff;
  const BIAS = 0x84;
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  sample = Math.min(sample + BIAS, MULAW_MAX + BIAS);
  let exponent = 7;
  for (let mask = 0x1000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Minimal RIFF WAV reader -> {sampleRate, channels, samples: Int16Array}. */
function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${file}: not a RIFF/WAVE file`);
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + size);
    if (id === "fmt ") fmt = body;
    if (id === "data") data = body;
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${file}: missing fmt/data chunk`);
  const format = fmt.readUInt16LE(0);
  const channels = fmt.readUInt16LE(2);
  const sampleRate = fmt.readUInt32LE(4);
  const bits = fmt.readUInt16LE(14);
  if (format !== 1 || bits !== 16) {
    throw new Error(`${file}: need 16-bit PCM WAV (got format=${format}, bits=${bits})`);
  }
  // Downmix to mono
  const frames = data.length / 2 / channels;
  const samples = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) acc += data.readInt16LE((i * channels + c) * 2);
    samples[i] = acc / channels;
  }
  return { sampleRate, samples };
}

/** Naive linear resample to 8 kHz. */
function resampleTo8k(samples, fromRate) {
  if (fromRate === 8000) return samples;
  const ratio = fromRate / 8000;
  const out = new Int16Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = pos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

/** Load a file as mulaw 8 kHz bytes. */
function loadMulaw(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".ulaw" || ext === ".raw" || ext === ".mulaw") {
    return fs.readFileSync(file);
  }
  const { sampleRate, samples } = readWav(file);
  const pcm8k = resampleTo8k(samples, sampleRate);
  const out = Buffer.alloc(pcm8k.length);
  for (let i = 0; i < pcm8k.length; i++) out[i] = linearToMulaw(pcm8k[i]);
  return out;
}

/** 30s synthetic "speech-like" pattern: bursts of tone separated by silence. */
function syntheticAudio(seconds = 30, freq = 440) {
  const out = Buffer.alloc(seconds * 8000);
  for (let i = 0; i < out.length; i++) {
    const t = i / 8000;
    const speaking = Math.floor(t / 3) % 2 === 0; // 3s on, 3s off
    const sample = speaking ? Math.round(Math.sin(2 * Math.PI * freq * t) * 8000) : 0;
    out[i] = linearToMulaw(sample);
  }
  return out;
}

// ---- cockpit listener ---------------------------------------------------------

function openCockpit() {
  const secret = process.env.SHARED_SECRET;
  if (!secret) {
    console.log("[cockpit] SHARED_SECRET not set — skipping cockpit connection");
    return null;
  }
  const url = `${BASE_URL}/cockpit?call_log_id=${encodeURIComponent(CALL_LOG_ID)}&token=${encodeURIComponent(secret)}`;
  const ws = new WebSocket(url);
  ws.on("open", () => console.log("[cockpit] connected"));
  ws.on("message", (data) => {
    try {
      const ev = JSON.parse(data.toString());
      if (ev.type === "transcript" && !ev.is_final) return; // too chatty
      console.log(`[cockpit] ${JSON.stringify(ev)}`);
    } catch {
      console.log(`[cockpit] ${data}`);
    }
  });
  ws.on("close", () => console.log("[cockpit] closed"));
  ws.on("error", (err) => console.error("[cockpit] error:", err.message));
  return ws;
}

// ---- twilio stream simulation ---------------------------------------------------

const FRAME_BYTES = 160; // 20ms of mulaw @ 8kHz
const FRAME_MS = 20;

async function main() {
  const landlordAudio = LANDLORD_FILE ? loadMulaw(LANDLORD_FILE) : syntheticAudio(30, 440);
  const agentAudio = AGENT_FILE ? loadMulaw(AGENT_FILE) : syntheticAudio(30, 660);
  const totalFrames = Math.ceil(Math.max(landlordAudio.length, agentAudio.length) / FRAME_BYTES);

  console.log(`[sim] call_log_id=${CALL_LOG_ID}`);
  console.log(`[sim] landlord audio: ${(landlordAudio.length / 8000).toFixed(1)}s, agent audio: ${(agentAudio.length / 8000).toFixed(1)}s`);

  if (WITH_COCKPIT) openCockpit();

  const streamSid = `MZ${Math.random().toString(36).slice(2, 14)}`;
  const ws = new WebSocket(`${BASE_URL}/twilio`);
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  console.log("[sim] twilio socket connected");

  let seq = 1;
  const send = (obj) => ws.send(JSON.stringify(obj));

  send({ event: "connected", protocol: "Call", version: "1.0.0" });
  send({
    event: "start",
    sequenceNumber: String(seq++),
    streamSid,
    start: {
      accountSid: "ACtest",
      callSid: `CAtest${Date.now()}`,
      streamSid,
      tracks: ["inbound", "outbound"],
      mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      customParameters: {
        call_log_id: CALL_LOG_ID,
        landlord_id: LANDLORD_ID,
        agent_email: AGENT_EMAIL,
      },
    },
  });

  let frame = 0;
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (frame >= totalFrames || ws.readyState !== WebSocket.OPEN) {
        clearInterval(timer);
        resolve();
        return;
      }
      const offset = frame * FRAME_BYTES;
      for (const [track, audio] of [
        ["inbound", landlordAudio],
        ["outbound", agentAudio],
      ]) {
        if (offset < audio.length) {
          send({
            event: "media",
            sequenceNumber: String(seq++),
            streamSid,
            media: {
              track,
              chunk: String(frame),
              timestamp: String(frame * FRAME_MS),
              payload: audio.subarray(offset, offset + FRAME_BYTES).toString("base64"),
            },
          });
        }
      }
      frame++;
      if (frame % 250 === 0) console.log(`[sim] streamed ${(frame * FRAME_MS) / 1000}s`);
    }, FRAME_MS);
  });

  console.log("[sim] audio done — sending stop");
  send({
    event: "stop",
    sequenceNumber: String(seq++),
    streamSid,
    stop: { accountSid: "ACtest", callSid: "CAtest" },
  });

  // Leave time for summary + callComplete + cockpit call_ended, then exit.
  setTimeout(() => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    console.log("[sim] done");
    process.exit(0);
  }, 15000);
}

main().catch((err) => {
  console.error("[sim] fatal:", err);
  process.exit(1);
});
