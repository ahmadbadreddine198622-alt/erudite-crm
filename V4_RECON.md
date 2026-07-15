# V4_RECON.md — BRAIN V4 (AURORA CORTEX) Phase 0 gap map

Compiled 2026-07-14 from a full read of the LIVE system (Base44 app `69cabceaeeb8bb5e3a62ead3`;
the repo tree was synced byte-identical to the live sandbox first — commit "pre-V4 baseline").
Line numbers below refer to that baseline.

---

## A. System as-is (verified live)

- **The brain**: `base44/functions/landlordOrchestrator/entry.ts` (1,296 lines). Two tiers —
  full (`claude-opus-4-8`, tool-forced single call, `max_tokens: 4096`) and cold
  (`claude-haiku-4-5-20251001`). 17 entity reads + 4 gathered packs (MARKET PACK dispatcher
  `gatherProjectMarketPack` :672 with P3 :382 / P5-family :611 / generalized :523 paths;
  PROJECT INTEL SOURCES :716; PROJECT BRIEF :748; OWNER PORTFOLIO :779). Info-aware 6h
  debounce (:877-907, 8 limit-1 probes). 16 numbered prompt directives (:1082-1097).
  Persistence: one core `Landlord.update` (:1230), separate non-fatal memoryUpdate for
  thesis/open-questions (:1237-1260), append-only `LandlordScoreSnapshot` (:1269-1290).
  **Stage writes are fully DISABLED** (:1223-1227) — the AI never writes `stage`.
- **Forge**: `forgeApproachDrafts` (424 ln) — 5-channel drafts, identity engine
  (`buildWriter`/`buildCredibilityBlock` :112-161, duplicated in `draftLandlordEmail` :50-106),
  mode/situation auto-detect (:246-260), angle rotation (:292-300), opening-line history
  (rolling 12, :395-396, banned-openings :375), `forged_for` stamp + identity-change re-forge
  (:227-232), 6h debounce with activity override (:212-234).
- **Call script**: `generateLandlordCallScript` (370 ln) — gated on `ai_processed_at` (409 if
  missing), 6h debounce, flat `discovery_questions: string[]` (3-8), own portfolio + deed-comp
  similarity ranking (`simScore` :269-276). UI `AICallScript.jsx` auto-re-forges when
  `ai_processed_at > forged_at` (:82-90).
- **Card open cascade**: `LandlordDetailPage.jsx` hook wrapper :1929-1954 — orchestrator (no
  force, smart debounce) → refetch if ran → `forgeApproachDrafts {force: brainRan}`.
- **KEEP-IN-SYNC ×3**: `resolveTier` + score-snapshot blocks duplicated in
  `backfillLandlordBrainV2` (:26-36, :322-350) and `backfillLandlordAIAnalysis` (:21-31,
  :174-202). **Verified: zero unintended drift today.** Only documented divergences: payload
  var name (`update` vs `updatePayload`) and orchestrator-only `daysInStage` fallback.
- **Heartbeat**: `landlordHeartbeat` — 48h staleness, batch 10, cap 80, platform-cron-wired.
  `enforceFourteenDayLaw` — daily; creates ONE bare Followup (`title='14-Day Law — schedule
  next touch'`, per-agent cap 10, workday stagger). `morningPowerSchedule` — read-only digest.
- **Snapshot history**: 500 snapshots in the last 5 days alone across 450 landlords (accruing
  since 2026-06-24) — P3 LEARN's raw material exists.

### Live-state facts that differ from the master prompt (do not trust the prompt on these)
1. `composerCommit.jsx` (nudgeBrain on note/task/followup) is **DORMANT — never imported**.
   Live saveNote/saveTask/saveFollowup (:578/:619/:670) do NOT nudge the brain. Only
   AppointmentComposer `onBooked` (:1681) and the card-open cascade nudge it.
2. **SMS from the live page does not send**: `onSend` (:547) has no `'SMS'` case. The only
   functional SMS path is the off-router `LandlordSMSPanel` → `twilioSendSMS`.
3. `FollowUps.jsx` renders the **`Reminder`** entity, `TaskCenter.jsx` renders `Reminder` +
   `LeadActivity` — neither queries `Followup`/`LandlordTask`.
4. WhatsApp live send = `sendMultiChannelWhatsApp` (NOT `sendWhatsAppMessageFromCRM`/
   `sendEvolutionMessage`); Telegram live send = `sendTelegramMessage` (relay, NOT `sendTelegram`).
5. `sendTelegramMessage` and `twilioSendSMS` write **no `Message` mirror** — the brain is
   blind to those sends today.
6. `auroraOrchestrator`/`auroraHeartbeat` are the **Deal-side** brain (different entity), not
   the landlord brain. Don't touch.

---

## B. Gap map per V4 pillar

| Pillar | Exists today | Build |
|---|---|---|
| 1 Agent loop | Single-shot `callClaude` (:223-240), packs pre-fetched | Bounded tool-use loop (≤6 calls, wall-clock budget), 6 read-only tools, self-critique in final emission, `max_tokens` 4096→8192 (full) |
| 2 Outcome Ledger | `Message` rows carry `ai_source/ai_draft_text/ai_disposition` (WhatsApp only); `CallQualification` = call ground truth; NO OutcomeEvent | `OutcomeEvent` entity + `recordOutcomeEvent` fn + hooks in 5 send fns, 6 inbound webhooks, `processCallQualifications`, `parseFormA` + history backfill |
| 2 Calibration | 500+ snapshots w/ `mandate_win_probability`; no outcomes joined | `PlaybookPrior` + `BrainCalibration` + `compileBrainPriors` nightly (aggregates, deciles, Brier, went_dark/appointment/terminal-event derivation sweep) |
| 3 Cohort intel | Sibling data queryable but never aggregated | `lookup_cohort_prior` + `lookup_pipeline_context` tools (aggregates only, no cross-owner leakage) |
| 4 Campaign plan | `ai_suggested_followups` (0-4 one-shot suggestions) | `Landlord.ai_campaign_plan` in FULL_SCHEMA + code-side quiet-hours clamp + AI-card timeline strip |
| 5 Delta tier | Info-aware debounce always escalates to a FULL run | `ai_working_memory` + `tier:'delta'` Haiku path + escalate_full + debounce rewire + heartbeat awareness |
| 6 Council | Nothing | Post-run trigger (commission>100k ∨ win∈[.35,.65] ∨ needs_review ∨ stuck>14d), 1/48h guard, second Opus call, `ai_council`, thesis absorption |
| 7 Confidence | Score rationales exist; `ScorePill` component built but **never rendered** (AIIntelligenceCard.jsx:55-85 dead code) | `ai_confidence`, `ai_highest_leverage_unknown`, ranked open questions, revive ScorePill w/ confidence bands |
| 8 ACT | `created_from_ai`/`ai_source` provenance on Followup(partial)/LandlordTask; enforceFourteenDayLaw creates bare Followups | `origin`+`proposal_status` fields, orchestrator materializes proposals, Aurora-proposes strip (landlord card), autonomy dial in CompanySettings, dismiss→OutcomeEvent |
| 9 Trace | Nothing | `ai_reasoning_trace` in FULL_SCHEMA + "Why?" expandable on AI card |
| 10 Ops/evals | `counterfactualReplay` (Deal-side, one-shot, no persistence) | `BrainRunLog` + writes in every orchestrator path + BrainOps section in AISyncHub + `brainEvalHarness` (eval_mode orchestrator + invariant assertions) |

---

## C. KEEP-IN-SYNC sites V4 touches

1. `resolveTier` — landlordOrchestrator:94, backfillLandlordBrainV2:29, backfillLandlordAIAnalysis:24.
   V4 adds the `delta` tier INSIDE landlordOrchestrator only, as routing that happens BEFORE
   resolveTier (delta never applies to backfills) — `resolveTier` itself stays byte-identical ×3.
2. Score-snapshot block — landlordOrchestrator:1269, backfillLandlordBrainV2:329, backfillLandlordAIAnalysis:181.
   V4 does NOT change its fields. (Delta runs do NOT snapshot — snapshots stay full/cold-run-only.)
3. Status-correctness gate (`isValidRun`) — BrainV2:308, AIAnalysis:159, orchestrator implicit. Unchanged.
4. Identity engine — forgeApproachDrafts:112-161 ≡ draftLandlordEmail:50-106 (two copies). Unchanged by V4
   (priors injection goes elsewhere in the forge prompt).
5. NEW (V4): `natBucket` nationality bucketing — compileBrainPriors ≡ landlordOrchestrator ≡
   forgeApproachDrafts (V4 sync group #3).

---

## D. OutcomeEvent wiring (Phase 1) — all hooks BACKEND, fire-and-forget invoke of `recordOutcomeEvent`

| Channel | Send fn + insertion | Rows written today | Draft attribution at that point |
|---|---|---|---|
| WhatsApp (all lines) | `sendMultiChannelWhatsApp` ~:431 (after Message mirror) | WhatsAppMessage + Message(+ai provenance) | `ai_source`/`ai_draft_text` passed by UI; angle/mode/situation recovered server-side from `ai_approach_drafts` |
| iMessage | `sendIMessage` ~:293 (inside `if(landlord_id)`, once per send not per handle) | IMessage + Message mirror | none passed — fuzzy-match vs `ai_approach_drafts.imessage.body_native` (strip signature/CTA) |
| Telegram | `sendTelegramMessage` ~:110 (after TelegramMessage.create) | TelegramMessage only (**no Message mirror**) | fuzzy-match vs `.telegram.body_native` |
| SMS | `twilioSendSMS` ~:88 (after Twilio 200) | CallLog (landlord) / Activity (lead) — **no Message mirror** | fuzzy-match vs `.sms.body_native` |
| Email | `sendLandlordEmail` ~:245 (after Email.create) | Email + Message mirror | fuzzy-match vs `.email.{subject,body_native}` (strip signature) |

Inbound (kind=`reply_received`, 72h link computed inside recordOutcomeEvent):
- `evolutionWebhook` :718 (after legacy Message.create) — all Evolution lines
- `metaWhatsAppWebhook` :224 — Meta business line (SEPARATE path, never reaches routeWhatsAppMessage)
- `telegramWebhook` :99 · `handleGmailWebhook` :168 (guard `!isOutbound`) · `syncIMessages` :171
  (batch: per inbound row) · `twilioWebhook` :118 (landlord matched by last-9 digits)
- `processCallQualifications` ~:231-240 → kind=`qualification_logged` (both creation paths converge here)
- `parseFormA` :282-288 → `mandate_signed` / `mandate_lost` (expired/cancelled)

Terminal/derived events (`deal_closed`, `mandate_signed/lost` catch-all, `went_dark`,
`appointment_kept/noshow`): derived idempotently by the nightly `compileBrainPriors` sweep
from current entity state (once-per-landlord dedupe) — avoids touching 9 scattered UI
stage-writers. `Landlords.jsx:371` / `LandlordDetailPage.jsx:885` / `ListingProduction.jsx:416`
remain the human stage writers, untouched. (`listing_published` deferred — PFListing has no
direct landlord_id.)

Backfill: `backfillOutcomeEvents` (dry-run default) targets DISTINCT landlord_ids found in the
four message tables (the book is 5000+ rows after bulk registry imports — never scan it all);
dedup by `source_ref` + (kind, channel, text_head ±10min) fuzzy fingerprint; chronological
outbound→inbound pairing per landlord+channel; rows marked `backfilled: true`.

Direction/timestamp normalization (inconsistent across the family): Message
`incoming/outgoing`+`timestamp`; IMessage/Telegram `inbound/outbound`+`sent_at`; Email
`inbound/outbound`+`received_at`; CallQualification `call_date`.

## E. Attribution gap in the UI (server-side matching is the uniform answer)

`ApproachDraftStrip.onLoad(d)` passes ONLY `{subject?, body_native, body_english_gloss}` —
`angle_used/mode/situation/forged_for` never reach the composer (ApproachDraftStrip.jsx:104).
Server-side containment matching in `recordOutcomeEvent` is the uniform fallback; WhatsApp
additionally forwards `ai_source`/`ai_draft_text` already (`sendChat` :757-767).

## F. UI integration points

- **AI card** (`AIIntelligenceCard.jsx`): confidence bands → revive dead `ScorePill` (:55-85)
  using `scorePillMeta` tri-band (:35-40), render in header slot :189 or after Summary :199.
  Campaign timeline → after Trajectory (:259), model on TrendCell idiom. Council block →
  violet "Strategy"-box idiom (:202-210). "Why?" → ScorePill tooltip pattern per section label.
  Card fetches nothing itself — parent builds `ai` VM at LandlordDetailPage:959-978, snapshots
  query at :2009, `deriveScoreTrend`/`deriveOpenQuestions` in `landlordAiFields.jsx`.
- **Aurora proposes strip**: landlord card left sidebar between AIIntelligenceCard and
  AICallScript (:1808-1810). FollowUps/TaskCenter pages need NEW queries on
  Followup/LandlordTask if surfaced there (they render `Reminder` today) — landlord-card strip
  is the Phase 6 primary; TaskCard's `aiAgentBadge` (TaskCenter.jsx:28-41) is the badge idiom.
- **BrainOps**: AISyncHub.jsx after `SmartOperationsWindow` (:604), `glass-card` idiom (:652),
  `useMutation`+`invoke` pattern (:251-273).
- UI SDK: `import { base44 } from '@/api/base44Client'`; TanStack Query, 30s staleTime;
  `base44.functions.invoke(name, payload)` → `{data}`.

## G. Platform conventions

- Functions: single `entry.ts` per dir, `Deno.serve`, `createClientFromRequest` →
  `base44.asServiceRole`; cross-invoke `svc.functions.invoke(name, payload)`; scheduled calls
  authenticate by catch-on-no-user; time budgets ~150s w/ handoff counters; crons wired in
  the Base44 platform (NOT in repo) — document new crons in the runbook table.
- Schema: dual-write — apply live schema via MCP (`create/update_entity_schema`; the FULL
  schema each time; rls preserved when omitted). Base44 then auto-generates the matching
  `.jsonc` in the sandbox tree (pure JSON, no comments despite the extension) — pull that
  canonical copy back into the repo. Unknown fields on write are dropped/rejected.
- `Message.channel` enum is `business/personal` in schema but mirrors write
  `imessage`/`email` — enum not enforced on write; do not "fix" (mirrors depend on it).
- Anthropic: `ANTHROPIC_API_KEY`, tool-forced structured output. No deno in sandbox — verify
  functions with `esbuild --bundle --external:npm:*`, frontend with `vite build`.
- Sandbox file writes deploy to the live functions runtime within seconds (verified:
  recordOutcomeEvent was invocable at its public URL immediately after write_file).
- `Landlord.list('-updated_date', 5000)` genuinely returns 5000 rows (probeListCap) — but the
  book is now 5000+ rows after bulk registry imports; sweep functions must TARGET, not scan.

## H. Landmines (do not break)

1. Stage writes stay disabled (:1223-1227). V4 never writes `Landlord.stage`. Proposals never send.
2. `ai_deal_thesis`/`ai_open_questions` stay in the SEPARATE non-fatal update; new V4 Landlord
   fields (`ai_campaign_plan`, `ai_working_memory`, `ai_council`, `ai_confidence`,
   `ai_highest_leverage_unknown`, `ai_reasoning_trace`) follow the SAME pattern — separate
   non-fatal update(s), so a missing live field never bricks the core write.
3. `matchProjectName` Peninsula-5 exact-match guard (:461-464) — never "simplify".
4. P3 pack delegation frozen (:677-680); `P3_PORTAL_ASK` literals are dated hardcodes.
5. Snapshot `days_in_stage` divergence between writers is INTENTIONAL.
6. Module caches (10-min) persist across warm invocations; packs degrade to '' silently.
7. `existingTaskKeys`/`existingFollowupKeys` dedupe keys off `ai_source` — proposals must
   write `ai_source = template_key` to stay dedupe-visible.
8. `max_tokens: 4096` already tight for FULL_SCHEMA — V4 raises it with the schema growth.
9. `[THESIS-DIAG]` temp logs (:1155-1160, :1248-1258) — proven; removed as part of the V4 rewrite.
10. iMessage sends fan out per handle — one OutcomeEvent per send, not per handle
    (recordOutcomeEvent's 10-min text-fingerprint guard).
11. `twilioSendSMS` writes CallLog `status:'completed'` which `tickOutreachFromData` can
    misread as a completed call — pre-existing; do not compound it.
12. Degrade-safe `.catch(() => [])` reads can mask transient throttling — bulk sweeps must be
    idempotent and re-runnable (verified in practice during the Phase 1 backfill).

## I. V4 architecture decisions (locked)

- **recordOutcomeEvent** = deployed function; all hooks non-fatal fire-and-forget
  `svc.functions.invoke('recordOutcomeEvent', …).catch(…)`. It enriches (landlord snapshot
  fields, hour_dubai), fuzzy-matches drafts (normalized containment after signature strip),
  links replies to the latest prior outbound ≤72h (OutcomeEvent first, channel-table
  fallback), and is idempotent by `(kind, source_ref)` + a 10-min text-fingerprint fan-out guard.
- **Agent loop** lives in the orchestrator full tier: investigation tools
  `lookup_comps`, `lookup_owner_portfolio`, `lookup_cohort_prior`, `lookup_outcome_history`,
  `lookup_pipeline_context`, `check_calendar_conflicts` — all read-only, all degrade-safe,
  ≤6 calls, ~60s tool budget, then forced `emit_orchestrator`. Self-critique = required
  `self_critique` field in the emission schema (weakest two claims + adjustments), not a
  second Opus call. Packs stay pre-fetched; tools go deeper.
- **Delta tier**: routed before resolveTier when (<24h since last full) ∧ (wake is
  note/task/followup/appointment/comment) ∧ (no new inbound/qual/stage since last run).
  Haiku, small schema: working-memory revision + momentum + nba_freshness + escalate_full.
  Writes `ai_working_memory` (+momentum) only; no snapshot; BrainRunLog row; escalation
  chains a full run in-process.
- **Council**: after a full run persists, trigger check + 48h guard (`ai_council.convened_at`),
  second Opus call (4 voices + verdict + dissent + thesis_revision + extra open questions),
  non-fatal separate update; logged as its own BrainRunLog row (`tier:'council'`).
- **Campaign plan**: emitted by the full tier in FULL_SCHEMA; code clamps touch hours to
  09:00–21:00 Asia/Dubai and day_offsets to 0-30; plan collapses/replans on the next full run
  after any reply (prompt law).
- **Proposals (Phase 6)**: full tier materializes validated `suggested_followups` (and
  campaign touch #1) as `Followup{origin:'brain_proposed', proposal_status, ai_source:
  template_key, created_from_ai:true}` — `proposal_status='approved'` auto only when
  `CompanySettings.brain_autonomy==='auto_schedule_followups'`; UI strip approves/dismisses;
  dismiss → status:'cancelled' + OutcomeEvent(proposal_dismissed). enforceFourteenDayLaw
  upgraded to create the correct cadence proposal. Proposed-not-approved rows count for
  dedupe but NOT as a scheduled touch for the 14-Day Law.
- **Evals**: `landlordOrchestrator` gains `eval_mode: true` (skips ALL writes, returns result +
  meta); `brainEvalHarness` replays a pinned golden set through it and asserts: schema shape,
  doctrine (violation ⇒ schedule_next_touch + cadence key), no-fabrication (numeric tokens in
  drafts ⊆ pack/context numbers), state-awareness (no dupe suggestions), quiet-hours safety.

## Phase order (each independently shippable)

P1 LEARN foundation → P2 priors+calibration → P3 cortex (loop/confidence/trace/RunLog/evals)
→ P4 working memory+delta → P5 campaign+council → P6 ACT. Ship gate per phase: esbuild-clean,
vite build green, live-DB verification queries, eval green (from P3), git pushed, CEO paragraph.

HOLD THE LINE.
