# V3 + Infra Rollout Runbook

Merge → schema → publish → verify sequence for the branches built in the 2026-06-24 session.
All changes are **additive and degrade-safe**: each one no-ops (not breaks) until its schema/env
prerequisites exist. Order below is by risk/breadth (safest first) and dependency.

> ⚠️ Two things only a human can do: **(1)** create the live Base44 schema (entities/fields marked
> below); **(2)** run a real build — there was no local Node toolchain, so everything is verified by
> code review, not `npm run build`. Let Base44's build gate the backend functions before publish.

---

## 1. `feature/global-query-staletime` — ship first, alone
- **Files**: `src/lib/query-client.js` (one line: global `staleTime: 30_000`).
- **Schema/env**: none.
- **Verify**: navigate between pages within 30s → no refetch spinner; WhatsApp inbox still updates on
  its 15s poll; Dashboard still feels live (it opts out with `staleTime: 0`).
- **Risk**: app-wide but trivially reversible. Only changes refetch-on-navigation.

## 2. `feature/landlord-loading-sync-perf` — frontend perf
- **Files**: `LandlordDetailPage.jsx`, `Landlords.jsx`, `Pipeline.jsx`, `SalesAnalytics.jsx`,
  `WhatsAppInbox.jsx`.
- **Schema/env**: none.
- **Verify**: open a landlord (conversation loads), the inbox, and both boards — all render, nothing
  missing.
- **⚠️ Overlap**: also edits `LandlordDetailPage.jsx` (different region than #6). Merge #2 or #6 first,
  then rebase the other — trivial conflict (perf touches the 3 async query fns; phase2 adds a snapshot
  query + AI-card props).

## 3. `feature/email-message-mirror` — brain sees outbound emails
- **Files**: `base44/functions/sendLandlordEmail`. **No new schema** (`Message` entity already live).
- **Verify**: send a landlord an email → a `Message` row (`channel: 'email'`, `direction: 'outgoing'`)
  appears for that `landlord_id`.

## 4. `feature/business-voice-transcription` — brain hears business voice
- **Deploy**: NEW function **`metaDownloadVoice`** + modified `metaWhatsAppWebhook`.
  Deploy `metaDownloadVoice` **before/with** the webhook.
- **Env (confirm set)**: `WHATSAPP_ACCESS_TOKEN`, `OPENAI_API_KEY` (both already used elsewhere).
- **Verify**: a landlord sends a voice note to the business number → its `Message.media_status` goes
  `pending_download → ready` and `text` becomes the transcript.
- **Risk**: touches a live webhook but degrade-safe — if `metaDownloadVoice` isn't deployed, the
  webhook keeps the `🎤` placeholder. Eventually-consistent: the *next* orchestrator run reads the
  transcript.

## 5. `feature/v3-departments` — V3 RECORD across departments + Deals triage
- **Create 3 live entities FIRST** (schemas in `base44/entities/`):
  - `DealScoreSnapshot`
  - `LeadScoreSnapshot`
  - `ClosingDealScoreSnapshot`
- **Then publish**: `auroraOrchestrator`, `calculateLeadScore`, `closingDealOrchestrator`,
  `src/pages/AuroraPipeline.jsx`.
- **Verify**: run each orchestrator twice on one record → 2 snapshot rows; the Aurora pipeline now
  floats `needs_human_review` / high-risk deals to the top of list views.
- **Note**: writes are degrade-safe, so publishing before creating the entities won't break anything —
  it just won't capture history until they exist.

## 6. `feature/v3-phase2-heartbeat` — V3 P2 (REMEMBER) for Landlords
- **Add 2 Landlord fields FIRST** (live schema):
  - `ai_deal_thesis` (string)
  - `ai_open_questions` (array of `{ question, why }`)
- **Then publish**: `landlordOrchestrator`, NEW `landlordHeartbeat`, `LandlordDetailPage.jsx`,
  `AIIntelligenceCard.jsx`.
- **Activate**: wire a Base44 **schedule → `landlordHeartbeat`** (e.g. hourly) — it is inert until then.
- **Verify**: run the orchestrator twice on a landlord → `ai_deal_thesis` *evolves* (doesn't reset);
  the AI card shows the trajectory strip once ≥2 `LandlordScoreSnapshot`s exist; "Needs your input"
  appears when the brain is uncertain.

---

## Also still pending (pre-session — rebase + re-verify before merging)
- `feature/v3-phase1-triage` and `feature/landlord-ui-phase2-3` — **both edit `Landlords.jsx`
  `filteredGroups`; merge together.**
- `feature/backfill-v2-orchestrator`.
- `feature/notify-hardening` — needs a `NotificationLog` live entity to activate dedup.
- `feature/message-feed-fixes` — run `backfillMessageLandlordIds` (dry-run then real) after publish.

## New live-schema objects to create (consolidated)
| Object | Type | For branch |
|---|---|---|
| `DealScoreSnapshot` | entity | v3-departments |
| `LeadScoreSnapshot` | entity | v3-departments |
| `ClosingDealScoreSnapshot` | entity | v3-departments |
| `Landlord.ai_deal_thesis` | field (string) | v3-phase2-heartbeat |
| `Landlord.ai_open_questions` | field (array `{question, why}`) | v3-phase2-heartbeat |
| `NotificationLog` | entity | notify-hardening (pending) |

## Schedules to wire (Base44 cron)
| Schedule | Target | Notes |
|---|---|---|
| hourly (suggested) | `landlordHeartbeat` | inert until wired |
| hourly (suggested) | `auroraHeartbeat` | already built; wire to activate |

## V3 phase coverage after this rollout
| Dept | P0 RECORD | P1 SEE | P2 REMEMBER |
|---|---|---|---|
| Landlords | ✅ | ✅ | ✅ (this rollout) |
| Deals/Aurora | ✅ (this rollout) | ✅ (this rollout) | heartbeat built; thesis = next |
| Leads | ✅ (this rollout) | next | next |
| Closing | ✅ (this rollout) | next | next |

P3 LEARN / P4 ACT remain globally gated: they need accrued snapshot history (starts only after this
rollout), the 6 strategy answers, and each department's send-guardrails.
