import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const REQUIRED = [
  "DEEPGRAM_API_KEY",
  "ANTHROPIC_API_KEY",
  "BASE44_API_KEY",
  "SHARED_SECRET",
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  // Refuse to boot without credentials — a half-configured relay silently
  // dropping calls is worse than a loud failure at startup.
  console.error(`[config] missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT || 8090),

  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  base44ApiKey: process.env.BASE44_API_KEY,
  sharedSecret: process.env.SHARED_SECRET,

  base44BaseUrl:
    process.env.BASE44_BASE_URL || "https://app.erudite-estate.com",

  // Models. Haiku drives the low-latency live loop + summary; Sonnet handles
  // the strategic escalation when the money conversation starts.
  haikuModel: process.env.HAIKU_MODEL || "claude-haiku-4-5",
  sonnetModel: process.env.SONNET_MODEL || "claude-sonnet-5",

  // Debounce after the last final landlord utterance before calling the brain.
  brainDebounceMs: Number(process.env.BRAIN_DEBOUNCE_MS || 1500),
  // Minimum gap between two Sonnet strategic escalations on the same call.
  escalationCooldownMs: Number(process.env.ESCALATION_COOLDOWN_MS || 20000),
  // Talk-ratio push interval.
  talkRatioIntervalMs: Number(process.env.TALK_RATIO_INTERVAL_MS || 30000),

  logsDir: process.env.LOGS_DIR || path.join(ROOT, "logs"),
};
