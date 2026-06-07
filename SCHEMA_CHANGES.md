# SCHEMA_CHANGES.md — apply these in Base44 (Data → entities)

> This repo does **not** push schema. Apply each change in the Base44 entity editor.
> Deploy order per phase: **apply schema first, then deploy the functions** (a function
> writing an unknown field will have that field dropped/rejected by Base44).

---

## PHASE 1 — Bulletproof webhook

### 1. `Message` entity — ADD fields
The webhook (`evolutionWebhook`) and `processInboundMedia` write these. All optional.

| Field | Type | Notes |
|---|---|---|
| `msg_type` | string | Baileys type: `conversation`, `imageMessage`, `audioMessage`, `documentMessage`, `locationMessage`, `contactMessage`, `stickerMessage`, … |
| `caption` | string | Caption on image/video/document |
| `reply_to_wa_id` | string | `wa_message_id` this message is quoting/replying to |
| `reaction` | string | Emoji reaction applied to this message (set when a reaction event targets it) |
| `is_deleted` | boolean (default `false`) | Set true when sender revokes the message |
| `location_json` | string | JSON `{ lat, lng, name }` for location messages |
| `contacts_json` | string | JSON array `[{ name, vcard }]` for shared contacts |
| `media_type` | string | enum: `image` \| `video` \| `audio` \| `document` \| `sticker` |
| `media_mime` | string | e.g. `audio/ogg`, `image/jpeg` |
| `media_duration` | number | seconds (audio/video) |
| `media_filename` | string | original filename (documents) |
| `is_voice_note` | boolean (default `false`) | PTT voice note (drives Phase 2 transcription) |
| `media_url` | string | persisted Base44 storage URL after download |
| `media_status` | string | enum: `pending` \| `ready` \| `download_failed` \| `upload_failed` |
| `media_retry_count` | number (default `0`) | download/upload attempts used |
| `media_error` | string | last media error (truncated) |

### 2. `Message.status` enum — ADD value
Current: `sent`, `delivered`, `read`, `received`. **Add `failed`** (the status pipeline maps Baileys ERROR → `failed`).

### 3. NEW entity `WebhookDeadLetter`
Holds any webhook payload that threw during processing, for inspection/replay.

| Field | Type | Notes |
|---|---|---|
| `source` | string | e.g. `evolution` |
| `event` | string | e.g. `messages.upsert` |
| `instance` | string | `erudite` / `erudite_whatsapp` |
| `wa_message_id` | string | if known |
| `stage` | string | `parse_body` / `process` |
| `error` | string | error message/stack (truncated) |
| `raw_payload` | object | full original payload for replay |
| `resolved` | boolean (default `false`) | mark true after manual replay |

Required: none (best-effort log).

---

## PHASE 2 — Voice intelligence  ✅ APPLY NOW (function `transcribeVoiceMessage` is built)

### `Message` entity — ADD fields
| Field | Type | Notes |
|---|---|---|
| `transcript` | string | Whisper transcript of a voice note (original language) |
| `transcript_lang` | string | ISO-639-1 detected language (`ar`/`en`/`ru`/`fr`/…) |
| `translated_text` | string | English translation (only when `transcript_lang` ≠ `en`) |
| `transcript_status` | string | enum: `pending` \| `done` \| `failed` |
| `transcript_retry_count` | number (default `0`) | inline attempts used; lets a sweep retry |
| `transcript_error` | string | last transcription error (truncated) |

> Apply these **before** pasting `transcribeVoiceMessage` (Base44 drops unknown fields).
> No new entity. `processInboundMedia` already fires `transcribeVoiceMessage` after a
> voice note's audio is downloaded — no change to Phase 1 functions needed.

---

## PHASE 3 — AI conversation layer  *(fields listed now; functions land in Phase 3)*

### `Lead` entity — ADD fields (for one-click confirm of extracted leads)
| Field | Type | Notes |
|---|---|---|
| `ai_suggested` | boolean (default `false`) | this Lead is an AI draft awaiting confirm |
| `ai_intent` | string | enum: `buy` \| `sell` \| `rent` \| `landlord` \| `unknown` |
| `ai_budget` | string | free-text budget the AI extracted |
| `ai_property_interest` | string | project/area/unit mentioned |
| `ai_language` | string | ISO-639-1 preferred language |
| `ai_extracted_from_phone` | string | digits-only source number |
| `ai_confidence` | number | 0–1 |

> `ConversationInsight` already exists and covers the landlord summarizer (3.1).
> For non-landlord contacts the summary is stored on the Lead via the fields above.

---

## PHASE 4 — Outbound engine
`ScheduledMessage` already exists and covers scheduled sends + 24h-window statuses
(`blocked_window`, `queued_quiet`) → **no new entity needed for 4.3**.
Rate-limit/queue state (4.4) is handled in-function; no schema change required.

---

## PHASE 5 — Reliability & observability

### NEW entity `SystemHealthCheck`
| Field | Type | Notes |
|---|---|---|
| `checked_at` | string (date-time) | |
| `erudite_state` | string | connection state of business instance |
| `erudite_whatsapp_state` | string | connection state of personal (Baileys) instance |
| `webhook_reachable` | boolean | |
| `last_inbound_at` | string (date-time) | most recent inbound across channels |
| `details_json` | string | raw fetchInstances summary |
| `alert_sent` | boolean (default `false`) | |
