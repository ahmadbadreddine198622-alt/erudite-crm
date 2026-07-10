import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// Strict schema for the live Haiku loop — structured outputs guarantee the
// response parses, so the cockpit never receives malformed suggestions.
const LIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    say_next: {
      type: "string",
      description:
        "One line the agent should say next, Grant Cardone voice, grounded in this landlord's real data.",
    },
    objection: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            detected: { type: "boolean" },
            type: { type: "string" },
            rebuttal: { type: "string" },
          },
          required: ["detected", "type", "rebuttal"],
        },
      ],
    },
    signals: { type: "array", items: { type: "string" } },
    qualify_updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field_key: { type: "string" },
          value: { type: "string" },
          quote: { type: "string" },
        },
        required: ["field_key", "value", "quote"],
      },
    },
  },
  required: ["say_next", "objection", "signals", "qualify_updates"],
};

const STRATEGIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    say_next: { type: "string" },
    play: {
      type: "string",
      description: "The strategic move in 1-2 sentences: why this line, what it sets up.",
    },
    risk: { type: "string" },
  },
  required: ["say_next", "play", "risk"],
};

function liveSystemPrompt(contextPack) {
  // The context pack is fixed for the whole call — it sits in the system
  // prompt with a cache breakpoint so every brain tick reads it from cache.
  return [
    {
      type: "text",
      text: `You are the live Call Copilot for Erudite Real Estate (Dubai). An agent is on a live phone call with a landlord. You whisper into the agent's ear.

Voice: Grant Cardone — direct, confident, always advancing the deal. Never generic. Every suggestion must be grounded in THIS landlord's real data from the context pack below (trust score, urgency, deal thesis, valuation, founder directive, Cardone stage, rolling summary).

Rules:
- say_next: exactly ONE line the agent can say out loud right now. Short enough to deliver naturally. Reference concrete numbers/facts from the context pack when relevant.
- objection: if the landlord's last utterances contain an objection (price, commission, exclusivity/mandate, timing, trust, competitor), set detected=true, classify the type, and give a one-line rebuttal in the same voice. Otherwise null.
- signals: short snake_case tags for anything material you detect (e.g. "relocating", "price_sensitive", "has_other_agent", "urgent_sale", "tenant_in_place").
- qualify_updates: when the landlord's words answer one of the Brain Qualify questions, emit {field_key, value, quote} using the exact field_key from the context pack and the landlord's verbatim quote as evidence. Only include answers actually stated on this call.
- The landlord may speak English, Arabic, or Russian. Always respond in English; quotes stay verbatim in the original language.

LANDLORD CONTEXT PACK:
${JSON.stringify(contextPack, null, 2)}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function transcriptText(entries, maxTurns = 60) {
  return entries
    .slice(-maxTurns)
    .map((t) => `${t.speaker === "agent" ? "AGENT" : "LANDLORD"}: ${t.text}`)
    .join("\n");
}

/**
 * Live loop: Haiku, streaming, strict JSON.
 * @returns {Promise<object>} parsed LIVE_SCHEMA object
 */
export async function liveBrainTick({ contextPack, transcript }) {
  const stream = anthropic.messages.stream({
    model: config.haikuModel,
    max_tokens: 1024,
    system: liveSystemPrompt(contextPack),
    output_config: { format: { type: "json_schema", schema: LIVE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Rolling call transcript (most recent last):\n\n${transcriptText(transcript)}\n\nProduce the copilot JSON for this moment in the call.`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  return parseJsonContent(msg);
}

/**
 * Strategic escalation: one Sonnet call for a deeper move when an objection
 * is detected or price/mandate/commission is on the table.
 */
export async function strategicEscalation({ contextPack, transcript, trigger }) {
  const stream = anthropic.messages.stream({
    model: config.sonnetModel,
    max_tokens: 2048,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: STRATEGIC_SCHEMA },
    },
    system: liveSystemPrompt(contextPack),
    messages: [
      {
        role: "user",
        content: `Rolling call transcript (most recent last):\n\n${transcriptText(transcript)}\n\nEscalation trigger: ${trigger}.\n\nThe call has reached a decisive moment. Give the agent the single strongest strategic move: what to say (say_next), the play behind it, and the risk if it lands wrong. Grant Cardone voice, grounded in this landlord's real numbers (valuation, deal thesis, urgency, Cardone stage).`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  return parseJsonContent(msg);
}

/** One Haiku call to summarize the finished call for the CRM. */
export async function summarizeCall({ contextPack, transcript, signals, qualifyUpdates }) {
  const stream = anthropic.messages.stream({
    model: config.haikuModel,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: "You write tight post-call summaries for a real-estate CRM. 4-7 sentences: what the landlord said, their position on price/mandate/timing, objections raised and how they were handled, and the concrete next step. No fluff.",
      },
    ],
    messages: [
      {
        role: "user",
        content: `Landlord context: ${JSON.stringify({
          deal_thesis: contextPack?.deal_thesis,
          cardone_stage: contextPack?.cardone_stage,
          rolling_summary: contextPack?.rolling_summary,
        })}\n\nSignals detected: ${JSON.stringify(signals)}\nQualify answers captured: ${JSON.stringify(qualifyUpdates)}\n\nFull diarized transcript:\n${transcriptText(transcript, 400)}\n\nWrite the summary.`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  const block = msg.content.find((b) => b.type === "text");
  return block?.text?.trim() || "";
}

function parseJsonContent(msg) {
  if (msg.stop_reason === "refusal") {
    throw new Error("model refused the request");
  }
  const block = msg.content.find((b) => b.type === "text");
  if (!block) throw new Error("no text content in model response");
  return JSON.parse(block.text);
}
