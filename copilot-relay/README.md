# Erudite Call Copilot Relay

Real-time relay server that sits between **Twilio Media Streams**, **Deepgram** (streaming STT), **Claude** (live sales copilot), and the **Base44 CRM** at `app.erudite-estate.com`.

> ⚠️ This server runs on the **Mac mini**, not inside Base44. This folder lives in the app repo so it's versioned with the CRM, but you deploy it by copying it to the Mac mini and running it with Node under launchd (below).

```
Twilio call ──(Media Streams WS)──▶ /twilio ──▶ Deepgram nova-3 (per track)
                                      │              │ transcripts
                                      │              ▼
                                      │         Copilot brain
                                      │      Haiku (live loop, ≤1.5s debounce)
                                      │      Sonnet (strategic escalations)
                                      │              │
CRM browser ◀──(WS events)── /cockpit ◀──────────────┘
                                      │
Base44  ◀── copilotContextPack (call start) / copilotCallComplete (call end)
```

## What it does

- **`/twilio`** — receives Twilio Media Streams (dual-channel: `inbound` track = landlord, `outbound` track = agent). Parses `connected`/`start`/`media`/`stop`, decodes base64 mulaw 8 kHz audio, and reads `customParameters` from the TwiML `<Stream>`: `call_log_id`, `landlord_id`, `agent_email`.
- **Deepgram** — each track gets its own nova-3 streaming connection (`mulaw`, 8 kHz, `interim_results`, `smart_format`, `language=multi` for code-switching). Each transcript segment is tagged `speaker: "agent" | "landlord"`. Per-track connections are used instead of one multichannel stream because Twilio's two tracks aren't sample-aligned on the wire.
- **`/cockpit`** — the CRM browser connects with `?call_log_id=X&token=SHARED_SECRET`. Receives JSON events (see protocol below). Reconnection-safe: on connect, the full call so far is replayed. The cockpit may also connect *before* the call starts; it's parked until Twilio's `start` arrives.
- **Copilot brain** — on call start the landlord *context pack* is fetched from `POST {BASE44}/functions/copilotContextPack` (header `api_key`). After every final landlord utterance (1.5 s debounce) a **Claude Haiku** streaming call returns strict JSON: `{say_next, objection, signals, qualify_updates}` (schema-enforced via structured outputs). If an objection is detected **or** price/mandate/commission talk appears (en/ar/ru keywords), one **Claude Sonnet** call produces a deeper move, pushed as `{type:"suggestion", tier:"strategic"}`. Sonnet escalations have a 20 s cooldown.
- **Call end** — on Twilio `stop` (or socket drop): a Haiku call writes the summary, then the full diarized transcript + qualify updates + signals + summary are POSTed to `{BASE44}/functions/copilotCallComplete`.
- **Talk ratio** — agent vs landlord speaking seconds, pushed as `{type:"signal", talk_ratio}` every 30 s.
- **Never crashes** — Deepgram/Anthropic/Base44 failures push `{type:"error"}` to the cockpit and the call carries on (Media Streams is listen-only, so call audio is never affected either way). `uncaughtException`/`unhandledRejection` are logged, not fatal. Deepgram connections reconnect with backoff and buffer audio while down.
- **Session logs** — every call is written to `./logs/{call_log_id}.json` (flushed every 30 s and on end).
- Handles **multiple concurrent calls** (session map keyed by Twilio `streamSid`).

## Cockpit event protocol

All events carry `call_log_id` and `ts`. Pushed as JSON text frames:

| type | payload |
|---|---|
| `replay` | `{events: [...], started_at, talk_ratio}` — sent once on (re)connect |
| `status` | `{state: "waiting_for_call" \| "context_ready"}` |
| `transcript` | `{speaker: "agent"\|"landlord", text, is_final}` |
| `suggestion` | `{tier: "live", say_next, objection: {detected, type, rebuttal} \| null}` |
| `suggestion` | `{tier: "strategic", say_next, play, risk, trigger}` |
| `qualify` | `{updates: [{field_key, value, quote}]}` — auto-fills the Brain Qualify form |
| `signal` | `{signals: [...]}` or `{talk_ratio: {agent_pct, landlord_pct, agent_seconds, landlord_seconds}}` |
| `error` | `{source, message}` |
| `call_ended` | `{reason, summary, talk_ratio, signals}` |

## Setup (on the Mac mini)

```bash
cd copilot-relay
npm install
cp .env.example .env   # fill in DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, BASE44_API_KEY, SHARED_SECRET
npm start              # listens on :8090 (PORT to override)
curl localhost:8090/health
```

Node ≥ 18.17 required (uses global `fetch`).

> **Language note:** Deepgram's `language=multi` on nova-3 handles English/Russian code-switching well. Check Deepgram's current nova-3 multilingual matrix for Arabic coverage; if Arabic-heavy calls under-transcribe, set a dedicated Deepgram project key with `language=ar` routing or ask Deepgram support to enable it.

## TwiML

Start a listen-only dual-track stream alongside the dial (the relay never injects audio, so `<Start><Stream>` is the right verb):

```xml
<Response>
  <Start>
    <Stream url="wss://copilot.peninsulabusinessbay.com/twilio" track="both_tracks">
      <Parameter name="call_log_id" value="{{CALL_LOG_ID}}" />
      <Parameter name="landlord_id" value="{{LANDLORD_ID}}" />
      <Parameter name="agent_email" value="{{AGENT_EMAIL}}" />
    </Stream>
  </Start>
  <Dial callerId="{{AGENT_NUMBER}}">{{LANDLORD_NUMBER}}</Dial>
</Response>
```

## Cockpit client (CRM side)

```js
const ws = new WebSocket(
  `wss://copilot.peninsulabusinessbay.com/cockpit?call_log_id=${callLogId}&token=${SHARED_SECRET}`
);
ws.onmessage = (e) => {
  const ev = JSON.parse(e.data);
  switch (ev.type) {
    case "replay":      ev.events.forEach(render); break;
    case "transcript":  renderTranscript(ev); break;   // ev.is_final
    case "suggestion":  renderSuggestion(ev); break;   // ev.tier: live | strategic
    case "qualify":     ev.updates.forEach(fillQualifyField); break;
    case "signal":      ev.talk_ratio ? renderTalkRatio(ev) : renderSignals(ev); break;
    case "error":       toast(`${ev.source}: ${ev.message}`); break;
    case "call_ended":  showSummary(ev.summary); break;
  }
};
```

## Cloudflare Tunnel — `copilot.peninsulabusinessbay.com`

The Mac mini already runs a `cloudflared` tunnel serving BlueBubbles at `bb.peninsulabusinessbay.com`. Add the copilot hostname to the **same tunnel**:

1. Edit the tunnel config (usually `~/.cloudflared/config.yml`):

   ```yaml
   tunnel: <YOUR_TUNNEL_ID>
   credentials-file: /Users/erudite/.cloudflared/<YOUR_TUNNEL_ID>.json

   ingress:
     - hostname: bb.peninsulabusinessbay.com
       service: http://localhost:1234        # existing BlueBubbles entry — keep as-is
     - hostname: copilot.peninsulabusinessbay.com
       service: http://localhost:8090        # <-- the relay
     - service: http_status:404
   ```

   Cloudflare proxies WebSocket upgrades over plain `http://` service entries automatically — no extra flags needed.

2. Create the DNS route for the new hostname (once):

   ```bash
   cloudflared tunnel route dns <YOUR_TUNNEL_NAME_OR_ID> copilot.peninsulabusinessbay.com
   ```

3. Restart cloudflared:

   ```bash
   # if it runs as a LaunchDaemon (typical for the BlueBubbles setup):
   sudo launchctl kickstart -k system/com.cloudflare.cloudflared
   # or, if user-level:
   launchctl kickstart -k gui/$(id -u)/com.cloudflare.cloudflared
   ```

4. Verify end to end:

   ```bash
   curl https://copilot.peninsulabusinessbay.com/health
   ```

Twilio then streams to `wss://copilot.peninsulabusinessbay.com/twilio`, and the CRM connects to `wss://copilot.peninsulabusinessbay.com/cockpit?...`. In the Cloudflare dashboard, make sure WebSockets are enabled for the zone (Network → WebSockets — on by default).

## Auto-start on the Mac mini (launchd)

1. Edit `com.erudite.copilot-relay.plist`: set the `node` path (`which node`) and `WorkingDirectory`/log paths to where this folder lives.
2. Install and load:

   ```bash
   mkdir -p logs
   cp com.erudite.copilot-relay.plist ~/Library/LaunchAgents/
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.erudite.copilot-relay.plist
   ```

3. Manage it:

   ```bash
   launchctl kickstart -k gui/$(id -u)/com.erudite.copilot-relay   # restart
   launchctl bootout   gui/$(id -u)/com.erudite.copilot-relay      # stop/uninstall
   tail -f logs/relay.out.log logs/relay.err.log
   ```

`KeepAlive` restarts the relay on any crash; `RunAtLoad` starts it at login. Secrets stay in `copilot-relay/.env` (dotenv), not in the plist.

## Testing without a real call

```bash
# Full pipeline with a recorded call (any 16-bit PCM WAV; resampled + mulaw-encoded automatically):
node test/simulate-twilio.js \
  --landlord-file recordings/landlord.wav \
  --agent-file recordings/agent.wav \
  --call-log-id test-call-1

# No audio file handy? Streams a synthetic tone pattern (exercises the Twilio
# protocol, Deepgram connections, talk-ratio, call-complete flow — but no real words):
node test/simulate-twilio.js
```

The simulator speaks the exact Twilio Media Streams protocol (`connected` → `start` with `customParameters` → paced 20 ms `media` frames on both tracks → `stop`) and also opens a cockpit connection (using `SHARED_SECRET` from `.env`) so you watch every event the CRM would receive. Check `logs/test-call-1.json` afterwards.

Tip: generate test WAVs with `say` on macOS — `say -o landlord.aiff "I want two million for the apartment" && ffmpeg -i landlord.aiff -ar 8000 -ac 1 landlord.wav`.

## Operational notes

- **Health check:** `GET /health` → `{ok, active_calls, uptime_s}`.
- **Graceful shutdown:** SIGTERM/SIGINT finalizes in-flight calls (summary + `copilotCallComplete` + log flush) before exit.
- **Cockpit auth:** constant-time comparison of `token` against `SHARED_SECRET`; unauthorized upgrades get a 401 before the WebSocket handshake completes.
- **Late cockpit joins:** a session stays resolvable by `call_log_id` for 5 minutes after the call ends, so a reconnecting cockpit still gets the replay + summary.
