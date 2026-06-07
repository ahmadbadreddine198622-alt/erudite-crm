# TESTING.md — manual verification against the two live Evolution instances

Instances: `erudite` (business / Meta Cloud) and `erudite_whatsapp` (personal / Baileys).
Webhook URL: `https://dubai-estate-pro.base44.app/functions/evolutionWebhook?secret=<EVOLUTION_WEBHOOK_SECRET>`

Prereq secrets (Base44 → Secrets): `EVOLUTION_API_URL` ✅, `EVOLUTION_API_KEY` ✅,
`EVOLUTION_WEBHOOK_SECRET` ✅, `OPENAI_API_KEY` ❌ (needed for Phase 2).

---

## PHASE 1 — Bulletproof webhook

**Deploy order:** apply `SCHEMA_CHANGES.md` Phase 1 (Message fields + `failed` status +
`WebhookDeadLetter` entity) → deploy `evolutionWebhook` + `processInboundMedia`.

### 1.1 Text (sanity / regression)
- From a non-group number, WhatsApp “hello” to the **personal** line.
- Expect: a `Message` row, `direction=incoming`, `channel=personal`, `msg_type=conversation`,
  `status=received`. If the number matches a Landlord, it appears in their thread.

### 1.2 Media types (one each, to the personal line)
Send: a **photo w/ caption**, a **video**, a **PDF document**, a **location pin**, a **shared contact**.
- Expect for each: a `Message` with the right `media_type`, `media_mime`, `caption` (where applicable),
  `media_status` transitions `pending → ready`, and `media_url` populated (downloaded via Evolution).
- Location → `location_json` set; contact → `contacts_json` set.

### 1.3 Voice note
- Send a **voice note (PTT)**.
- Expect: `Message` with `media_type=audio`, `is_voice_note=true`, `media_status=ready`, `media_url` set.
  Transcription stays `pending` until Phase 2 + `OPENAI_API_KEY`.

### 1.4 Reply / reaction / deletion
- **Reply** to one of your earlier messages → new `Message` has `reply_to_wa_id` = the quoted id.
- **React** 👍 to a message → the *target* `Message` gets `reaction=👍` (no new row).
- **Delete for everyone** → the target `Message` gets `is_deleted=true`.

### 1.5 Direction correctness
- Send a message **from** the personal line (fromMe) → webhook returns `skipped_outgoing`, no dupe row.

### 1.6 Status pipeline
- Watch a message you sent via `sendEvolutionMessage`: as the contact’s phone delivers/reads it,
  Evolution emits `messages.update`; the matching `Message.status` should move `sent → delivered → read`.
- ⚠️ Requires the Evolution instance to be subscribed to **MESSAGES_UPDATE** events (see Evolution config below).

### 1.7 Group / broadcast ignored
- A group message → webhook returns `skipped_group`; a status broadcast → `skipped_broadcast`. No rows created.

### 1.8 Idempotency
- Re-POST the same payload (same `wa_message_id`) → returns `duplicate`, no second row.

### 1.9 Dead-letter (resilience)
- POST a malformed body (valid secret, body = `{"event":"messages.upsert","instance":"erudite_whatsapp","data":{"key":{"remoteJid":"x@s.whatsapp.net","id":"X"},"message":{"imageMessage":null}}}` or arbitrary junk).
- Expect: HTTP 200 with `status: dead_lettered`, and a `WebhookDeadLetter` row holding the payload — **never a silent drop**.

#### Quick synthetic webhook test (no phone needed)
```bash
curl -s -X POST "https://dubai-estate-pro.base44.app/functions/evolutionWebhook?secret=<SECRET>" \
  -H "Content-Type: application/json" -d '{
    "event":"messages.upsert","instance":"erudite_whatsapp",
    "data":{"key":{"remoteJid":"<DIGITS>@s.whatsapp.net","fromMe":false,"id":"TEST-'$(date +%s)'"},
            "message":{"conversation":"phase1 synthetic test"},"messageTimestamp":'$(date +%s)'}}'
```
Expect `{"status":"ok",...}` and a new `Message`. Re-run with the same `id` → `{"status":"duplicate"}`.

---

## Evolution / Meta dashboard configuration to verify

- **Evolution event subscription** (per instance, Manager UI or API `POST /webhook/set/{instance}`):
  ensure these events are enabled so Phase 1 fully works:
  `MESSAGES_UPSERT`, `MESSAGES_UPDATE` (status), `MESSAGES_DELETE`, `MESSAGES_REACTION` (if separate),
  `SEND_MESSAGE`. Webhook URL must include `?secret=<EVOLUTION_WEBHOOK_SECRET>`.
- **Meta Cloud API (business `erudite`)**: for delivery/read receipts, the WhatsApp webhook subscription
  must include the **`messages`** field with **status** updates. If status isn’t arriving for the business
  line, subscribe the `messages` field in Meta → WhatsApp → Configuration → Webhooks.
- **Media download** uses `POST {EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instance}` — confirm
  this endpoint is enabled on your Evolution version (v2). If your build differs, tell me and I’ll adjust.

---

## PHASE 2 — Voice intelligence

**Prereq:** `OPENAI_API_KEY` set ✅. Apply `SCHEMA_CHANGES.md` Phase 2 (Message transcript fields),
then deploy `transcribeVoiceMessage`. The chain is automatic: webhook → `processInboundMedia`
(downloads audio, sets `media_url`) → fires `transcribeVoiceMessage`.

### 2.1 English voice note
- Send a voice note in English to the personal line.
- Expect on the `Message` row within ~30s: `transcript` populated, `transcript_lang=en`,
  `transcript_status=done`, `translated_text` empty, and `text` becomes `🎤 <transcript>`.

### 2.2 Non-English voice note (auto-detect + translation)
- Send a voice note in **Arabic**, **Russian**, and **French** (one each).
- Expect: `transcript` in the original language, `transcript_lang` = `ar`/`ru`/`fr`,
  `translated_text` = English translation, `transcript_status=done`, and `text` shows
  `🎤 <original>` then a second line `— <english>`.

### 2.3 Graceful degradation / retry
- The message must already exist as a voice note (Phase 1) regardless of transcription outcome.
- Simulate failure (e.g. temporarily wrong audio) → `transcript_status=failed`,
  `transcript_retry_count` increments, `transcript_error` set; the message + `media_url` remain intact.
- Re-invoke `transcribeVoiceMessage` with `{ message_id }` → it retries and reaches `done`.

### 2.4 Idempotency
- Re-invoke on an already-done message → returns `{ status: 'already_done' }`, no duplicate work.

### Cost note
Whisper ≈ $0.006/min; a month of voice notes is a few dollars. Translation uses `gpt-4o-mini` (cents).

---

## PHASE 3–5 — (added as each phase is built/verified)
