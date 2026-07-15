# BRAIN V4 — MASTER DEVELOPMENT PROMPT (for Claude)

> Paste this entire document as the opening prompt of a Claude Code session on the `erudite-crm`
> repo. It contains everything the developing Claude must know: what LANDLORD AURORA V3 is today,
> the non-negotiable laws of this codebase, and the full V4 specification. Written 2026-07-14 from
> a live read of the deployed system (Base44 app `69cabceaeeb8bb5e3a62ead3`, app.erudite-estate.com).

---

## 0 · YOUR ROLE & MISSION

You are the lead engineer developing **BRAIN V4 — AURORA CORTEX**: the next generation of the
landlord intelligence brain for Erudite Real Estate's CRM. V3 completed phases **P0 RECORD →
P1 SEE → P2 REMEMBER**. Your mission is to ship **P3 LEARN** and **P4 ACT**, and to upgrade the
brain from a one-shot analyst into an **agentic, self-calibrating, outcome-learning strategist**
— extremely smart, but disciplined: every conclusion grounded in verified data, every action
gated by the doctrine, and nothing ever auto-sent to a landlord.

Work autonomously end-to-end. Verify everything in the live DB yourself; never trust a builder
success report. When done, the CEO (Ahmad) opens a landlord card and the difference is obvious.

---

## 1 · OPERATING LAWS OF THIS CODEBASE (violating any of these is a failed build)

1. **Read the live system FIRST.** Before any work: `list_entity_schemas` + `query_entities`
   against the live app. Never build from assumption or from this document alone — re-verify.
2. **Git discipline.** Base44 auto-commits builder/sandbox changes to `origin/main`. In Claude
   Code: `git fetch` + hard reset/rebase onto `origin/main` before ANY task, and again before
   any push.
3. **Schema dual-write.** The repo's `base44/entities/*.jsonc` files sync to the live schema and
   can REVERT live-only schema changes. Every schema change must be made in BOTH places: the
   `.jsonc` file AND the live schema (`update_entity_schema` with the FULL schema — omitted
   fields are deleted; RLS preserved when omitted). This was learned the hard way.
4. **Stage writes are BANNED.** The AI must NEVER write `Landlord.stage`. It may recommend
   (`new_stage` surfaced in UI); only a human moves stages. Root cause of a past regression.
5. **NEVER auto-send.** No function may send a message to a landlord without a human pressing
   Send. Drafts, proposals, and scheduled *suggestions* only. This law survives V4's ACT phase.
6. **Tri-writer sync.** Tier routing (`resolveTier`) and the score-snapshot block are duplicated
   across `landlordOrchestrator`, `backfillLandlordBrainV2`, `backfillLandlordAIAnalysis` —
   marked `KEEP IN SYNC`. Any change to those blocks goes to all three.
7. **Degrade-safe everything.** Every read `.catch(() => [])`; every new write in its own
   non-fatal try/catch; a missing entity/field no-ops, never bricks the run (V3 pattern —
   see the `memoryUpdate` block).
8. **Identity engine is law.** Drafting functions write as the LOGGED-IN user (`buildWriter` /
   `buildCredibilityBlock` in `forgeApproachDrafts` + `draftLandlordEmail`): CEO voice only for
   the two CEO emails; agents in their own name + `User.position`; CEO credentials third-person
   only; drafts stamped `forged_for` and re-forged on identity change. V4 must preserve this.
9. **No fabrication.** Only figures present in the market packs / call script / credibility
   block exist. An invented comp, buyer, or number is a catastrophe.
10. **Anthropic API**: `ANTHROPIC_API_KEY` env, tool-forced structured output
    (`tool_choice: {type:'tool'}`). Models: `claude-opus-4-8` (full), `claude-haiku-4-5-20251001`
    (cold). Deno functions in `base44/functions/<name>/entry.ts`, `Deno.serve`,
    `createClientFromRequest` → `base44.asServiceRole` for RLS-bypassing reads.
11. **Cost is routed, not ignored.** Engagement-wins tiering exists for a reason. New spend
    tiers must be justified and proportional to real activity. Confirm with the CEO before any
    new PAID infrastructure (new APIs, vendors); model-call architecture within the existing
    Anthropic account is yours to design.
12. **Quiet hours** 21:00–09:00 Asia/Dubai for anything time-scheduled toward landlords.

---

## 2 · THE SYSTEM AS IT IS — V3 CONTEXT PACK (verified live, 2026-07-14)

### 2.1 The brain: `base44/functions/landlordOrchestrator/entry.ts` (~1,300 lines)
- Persona: **LANDLORD AURORA** — "autonomous AI co-pilot for a Dubai real-estate agent pursuing
  landlord mandates."
- **Reads 17+ sources per run** (all `landlord_id`-scoped, degrade-safe): LandlordProperty,
  Message(60), LandlordNote(30, human notes weighted heavily), LandlordTask(50),
  LandlordAppointment, Followup, Call, Meeting, Viewing, CallQualification(10),
  MandateNegotiation, LandlordStakeholder, Activity(`lead_id`), DocumentChecklistItem,
  BrandVoice(active), LandlordDirective(20), ActivityComment(30) — plus gathered packs:
  **MARKET PACK** (deed comps per project/type from MarketReport/MarketTransaction; strict
  never-mix rules for the Peninsula 5 family and unit types), **PROJECT INTELLIGENCE SOURCES**
  (`ProjectIntelSource.auto_inject`), **PROJECT BRIEF** (Project.notes playbook), **OWNER
  PORTFOLIO** (OwnerPortfolioUnit matched by email/phone-last9/name-tokens).
- **Sales Doctrine** (`DOCTRINE_RULES`, injected into every prompt): one ask per message; next
  step always scheduled; value before price; follow up until signed or definitive no; **the
  14-Day Law** (no active landlord goes 14 days without a scheduled next touch — violation
  forces `schedule_next_touch`); the **Rule-of-5 cadence** template keys
  (`rule5_day2_value_drop`, `rule5_day5_call`, `rule5_day9_voice_note`, `rule5_day14_snapshot`,
  `law14_nurture`, `unsold_competitor_watch_30`).
- **Tier routing** (`resolveTier`, KEEP-IN-SYNC ×3): forceCold → cold; any engagement (stage
  beyond initial_contact, rapport beyond cold, any inbound, any activity) → full (Opus 4.8);
  else caller hint. Cold tier = Haiku, minimal output, personal cold-open drafts.
- **Full-tier output** (`FULL_SCHEMA`, 16 numbered directives in the system prompt):
  new_stage(recommend-only) + sub_stage; trust/responsiveness/urgency (0-100) +
  mandate_win_probability (0-1), each with one-line rationale; estimated_commission_aed;
  rapport_level; red_flags[]; buying_signals[]; ai_objections[]; ai_rolling_summary
  (state-aware — reflects what's already scheduled); ai_coaching_for_agent;
  ai_next_best_action {action, priority, scheduled_for, draft_message, reasoning, confidence};
  suggested_tasks (0-5, enum `TASK_TEMPLATE_KEYS`, state-aware idempotent — never re-suggests
  existing open/done); suggested_followups (0-4, enum `FOLLOWUP_TEMPLATE_KEYS`, cadence-aware);
  ai_suggested_messages (2-3 send-ready reply drafts, landlord's language, doctrine + Brand
  Voice compliant); ai_momentum enum; ai_strike_now; needs_human_review + review_reason;
  **ai_deal_thesis (P2 REMEMBER — prior thesis fed back, EVOLVES, never resets)**;
  **ai_open_questions (0-3 ask-the-agent uncertainties, honest — empty is valid)**.
- **Persistence**: one `Landlord.update` for core; a SEPARATE non-fatal update for
  thesis/open-questions; append-only `LandlordScoreSnapshot` per successful run (feeds the AI
  card's trajectory strip); stamps `ai_processed_at`, `ai_model_used`,
  `last_orchestrator_run_at`.
- **Debounce (upgraded 2026-07-14)**: 6h, but **information-aware** — a limit-1 newest probe
  across LandlordTask/LandlordNote/LandlordAppointment/Followup/Activity/ActivityComment/
  Message/CallQualification breaks the debounce when anything was created after the last run.

### 2.2 Triggers (all live)
- Inbound WhatsApp → `routeWhatsAppMessage` → orchestrator (full).
- Record creation → cold run. Stage change + new CallQualification → full.
- **Card open** (`src/pages/LandlordDetailPage.jsx`, function wrapper): brain-first cascade —
  invoke orchestrator (smart debounce decides) → if it ran: refetch → `AICallScript` auto
  re-forges when `ai_processed_at > ai_call_script_at` → `forgeApproachDrafts` runs with
  `force: brainRan`.
- **Creation nudges**: `composerCommit.jsx` (`nudgeBrain`) on note/task/followup;
  AppointmentComposer `onBooked` on the page.
- `landlordHeartbeat` (staleness sweep, 48h default, batched/capped, cron-wired).

### 2.3 Downstream consumers that MUST keep working (backwards compatibility surface)
- `AIIntelligenceCard.jsx` (scores, rationales, trajectory from snapshots, "Needs your input"
  from ai_open_questions, momentum/strike), `AICallScript.jsx` + `generateLandlordCallScript`
  (Opus, 6h debounce, consumes the orchestrator's outputs + portfolio + deed packs →
  `ai_call_script`), **`forgeApproachDrafts`** (five-channel Approach/Follow-Up drafts:
  mode auto-detect approach|followup, situations first_contact | owner_replied_last |
  awaiting_first_reply | active_thread_pending | after_call, angle rotation, banned-openings
  anti-repetition, identity-aware, `ai_approach_drafts` + `_at`), `draftLandlordEmail`
  (manual ✦ drafts, modes/psychologies, identity-aware), `SuggestedMessages`/composers,
  `landlordWhisper`, `landlordConversationCoach`, `BrainQualifyFlow`, Live Call Copilot
  (`copilotContextPack`), `simulateDealFuture`, `counterfactualReplay`,
  `computePricingPressure`, `scanPortfolio`, `detectLandlordStakeholders`, `valuationSweep`,
  Pipeline/Kanban chips, `enforceFourteenDayLaw`, `morningPowerSchedule`, TaskCenter,
  FollowUps. **Every existing Landlord ai_* field keeps its name, type, and meaning.**

### 2.4 The landlord vCard (`LandlordDetailPage.jsx`, ~2,550 lines, class VM + hook wrapper)
Layout: `LandlordIdentityHeader` (identity, channel availability badges) →
`FounderDirectiveStrip` (CEO gold directives — obeyed by every AI output) →
`AIIntelligenceCard` → `AICallScript` → `LandlordMockTabs` (Outreach checklist ticked by real
sends, Qualify, Units/valuation, Negotiation, Intelligence, Owner history, Docs, Calls,
Activity) → composer deck: Note/Task/Follow-up/Appointment + **five telecommunication channels**
(WhatsApp dual-line, iMessage/BlueBubbles, Telegram userbot, SMS/Twilio, Email/Gmail), each
carrying the gold **Approach/Follow-Up Draft strip** (LOAD/↻, voice chip, situation chip) —
plus CommandCenter, PortfolioRadar, CoalitionMap, PricingPressureMeter, WhisperPanel.

### 2.5 What V3 explicitly left for V4 (from `V3_RUNBOOK.md`)
> "P3 LEARN / P4 ACT remain globally gated: they need accrued snapshot history (started
> 2026-06-24), the 6 strategy answers, and each department's send-guardrails."
Snapshot history has now been accruing for ~3 weeks across the landlord book. **V4 = P3 + P4 +
the cortex upgrade below.**

---

## 3 · V4 VISION — AURORA CORTEX

One sentence: **V3 sees and remembers; V4 investigates, learns from outcomes, calibrates
itself, plans campaigns in time, argues with itself on big deals, and proposes actions humans
approve with one tap — while every word it writes cites the evidence it stands on.**

### PILLAR 1 — Agentic investigation loop (replaces the one-shot call, full tier)
Convert the full-tier run into a bounded agent loop (Anthropic tool use, max ~6 tool calls,
hard wall-clock budget): give the model READ-ONLY tools —
`lookup_comps(project, unit_type, months)`, `lookup_owner_portfolio()`,
`lookup_cohort_prior(archetype, project, nationality)` (Pillar 3),
`lookup_outcome_history(landlord_id)` (Pillar 2), `lookup_pipeline_context()` (competing
listings, sibling landlords in same tower), `check_calendar_conflicts(agent_email)` — so the
brain PULLS exactly what its hypothesis needs instead of receiving one static dump. Finish with
a mandatory **self-critique pass** (same call, final instruction): list the two weakest claims
in your own output and adjust scores/confidence accordingly. Cold tier stays one-shot Haiku.
Preserve all V3 packs as pre-fetched context; the tools go DEEPER, never replace the doctrine.

### PILLAR 2 — P3 LEARN: the Outcome Ledger + self-calibration
The brain starts learning from what actually happened.
- New entity **`OutcomeEvent`** — append-only ground truth:
  `{landlord_id, kind: draft_sent | reply_received | call_connected | qualification_logged |
  appointment_kept | appointment_noshow | mandate_signed | mandate_lost | listing_published |
  deal_closed | went_dark, channel, angle_used, mode, situation, writer_email, sent_at,
  responded_at, latency_hours, source_ref}`. Writers: composer `onLogged/onSent` handlers
  (attribute the draft that was loaded: angle/mode from `ai_approach_drafts` when the sent text
  matches a loaded draft), inbound webhooks (reply attribution to the last outbound within
  72h), mandate_status transitions, stage `deal_closed`.
- New entity **`PlaybookPrior`** — nightly-compiled aggregates (new scheduled function
  `compileBrainPriors`): per `{archetype × project × nationality_bucket × channel × angle}`:
  attempts, replies, reply_rate, median_latency, mandates, sample_size, updated_at. Small-N
  guard: priors with n<8 are marked `low_confidence` and the brain must say so when citing them.
- **Calibration report**: `compileBrainPriors` also bins historical
  `LandlordScoreSnapshot.mandate_win_probability` vs realized outcomes into a
  `BrainCalibration` record (predicted-vs-actual per decile + Brier score). Inject the current
  calibration line into the orchestrator prompt: *"Your 0.6–0.8 predictions have historically
  converted at 0.41 — correct accordingly."* The brain adjusts itself every run.
- Orchestrator + forge prompts receive the matching priors: *"For relocating Russian owners in
  Peninsula towers, WhatsApp value_drop at 10:00 has a 34% reply rate (n=22); email direct
  opens 9% (n=31)."* Drafting angles and channel/hour suggestions must honor them (and say
  when they deviate and why).

### PILLAR 3 — Cohort intelligence (cross-landlord priors)
`lookup_cohort_prior` reads `PlaybookPrior` + live sibling stats (same tower: how many owners
in pipeline, stage distribution, competitor listing counts from PFListing) so the brain reasons
like the whole brokerage, not one record. Aggregates only — never leak another owner's name,
unit, price, or conversation into this landlord's outputs.

### PILLAR 4 — The Campaign Plan (temporal strategy, not just next action)
New Landlord field **`ai_campaign_plan`** (object): a 14–30 day multi-touch plan —
`{objective, touches: [{day_offset, channel, angle, template_key|freeform_intent, hour,
success_criteria}], exit_conditions, generated_at}` — doctrine-cadence-native (Rule-of-5 baked
in), engagement-decay-aware, quiet-hours-safe, and REPLANNED whenever an outcome invalidates it
(reply received → plan collapses to the reply branch). The NBA becomes "touch #1 of the plan."
UI: render the plan as a compact timeline strip inside `AIIntelligenceCard` (collapsible);
each touch one-tap convertible into a real Followup (see Pillar 8).

### PILLAR 5 — Incremental brain: working memory + delta updates
New Landlord field **`ai_working_memory`** (object, capped ~2KB): the brain's scratchpad —
open hypotheses, pending confirmations, last-event digest. New cheap path in the orchestrator:
`tier:'delta'` (Haiku) — on each wake-nudge, if the change is small (one note/task), run a
delta update that ONLY revises working memory + momentum + NBA freshness and decides
`escalate_full: boolean`; full Opus synthesis runs when the delta path escalates, on
inbound replies, qualifications, stage moves, or >24h accumulation. Net effect: the brain is
ALWAYS current at Haiku cost, deeply re-synthesized at Opus cost only when it matters.
(Rewire `nudgeBrain` + the info-aware debounce to prefer the delta tier.)

### PILLAR 6 — THE COUNCIL (adversarial multi-perspective pass)
For high-stakes runs only — trigger when `estimated_commission_aed > 100k` OR
`mandate_win_probability ∈ [0.35,0.65]` (genuinely contested) OR `needs_human_review` OR
stuck >14d in stage: a second structured Opus call where four voices debate the same facts —
**Strategist** (path to signature), **Skeptic** (attacks every assumption; hunts red flags),
**Closer** (Cardone urgency: what collapses the timeline), **Analyst** (deed data only) — then
a synthesis that records material disagreements as risks/open questions. Output → new Landlord
field **`ai_council`** `{verdict, dissent[], convened_at}`; the deal thesis must absorb the
verdict. Named for THE COUNCIL chamber of the Napoleon Hill Academy — same philosophy, now in
the deal brain. Budget guard: max one council per landlord per 48h.

### PILLAR 7 — Calibrated confidence + value-of-information
Every score gains a confidence: new Landlord field **`ai_confidence`**
`{trust, urgency, win_prob, overall: 0-1}` rendered as subtle bands on the AI card. The brain
must also emit **`ai_highest_leverage_unknown`** — the ONE fact that would most change its
conclusion — and rank `ai_open_questions` + the call script's discovery questions by expected
information value. Low confidence + high stakes ⇒ the coaching line says "qualify before you
pitch."

### PILLAR 8 — P4 ACT: guarded autonomy (propose → approve → execute)
The brain may now CREATE real records — as proposals only:
- Add `origin: 'brain_proposed'` + `proposal_status: 'proposed'|'approved'|'dismissed'` fields
  to `Followup` and `LandlordTask` (jsonc + live, dual-write law). The orchestrator/campaign
  planner materializes its suggested cadence as `proposed` rows instead of ephemeral JSON.
- UI: a slim gold **"Aurora proposes"** strip on the card (and in FollowUps/TaskCenter):
  ✓ approve (activates the record) / ✕ dismiss (logged to OutcomeEvent as training signal).
- Autonomy dial: `CompanySettings.brain_autonomy` = `suggest` (today) | `propose` (default V4)
  | `auto_schedule_followups` (proposals self-approve for follow-ups ONLY — still never sends).
  CEO-only setting. **Message sending remains 100% human forever.**
- `enforceFourteenDayLaw` upgraded to consume proposals: a doctrine violation auto-creates the
  correct cadence proposal instead of only flagging.

### PILLAR 9 — Explainability: the reasoning trace
New Landlord field **`ai_reasoning_trace`** (array, last run only, capped): each major output
(NBA, win_prob, chosen angle, campaign touch #1) with `{claim, grounds: [deed:MT-xxxx |
doctrine:rule5 | prior:PlaybookPrior-id | note:2026-07-12 | council:skeptic]}`. Rendered as an
expandable "Why?" under the AI card sections. If a claim has no citable ground, the brain must
weaken or drop it. This is the fabrication firewall made visible.

### PILLAR 10 — Self-monitoring + eval harness
- New entity **`BrainRunLog`**: one row per run —
  `{landlord_id, tier, model, tokens_in/out, duration_ms, tools_used[], escalated, council,
  error, triggered_by}`. New page section (AISyncHub) or lightweight `BrainOps` view: runs/day,
  cost estimate, delta:full ratio, failure list, calibration trend.
- **Golden-set evals**: extend `counterfactualReplay` into `brainEvalHarness` — replay 15
  hand-picked landlord histories (frozen fixtures) through V4 on demand; assert doctrine
  compliance (one ask, 14-Day Law, no fabricated figures vs pack), schema validity, and
  no-regression on the golden expectations. Run it before declaring any phase done.

---

## 4 · DATA MODEL — ADDITIONS ONLY (dual-write: jsonc + live; never rename/remove V3 fields)

| Object | Type | Pillar |
|---|---|---|
| `OutcomeEvent` | entity | 2 |
| `PlaybookPrior` | entity | 2/3 |
| `BrainCalibration` | entity | 2 |
| `BrainRunLog` | entity | 10 |
| `Landlord.ai_campaign_plan` | object | 4 |
| `Landlord.ai_working_memory` | object | 5 |
| `Landlord.ai_council` | object | 6 |
| `Landlord.ai_confidence` | object | 7 |
| `Landlord.ai_highest_leverage_unknown` | string | 7 |
| `Landlord.ai_reasoning_trace` | array | 9 |
| `Followup.origin` + `proposal_status` | fields | 8 |
| `LandlordTask.origin` + `proposal_status` | fields | 8 |
| `CompanySettings.brain_autonomy` | field (enum) | 8 |

New/changed functions: `landlordOrchestrator` (agent loop, delta tier, calibration line,
priors, council trigger, trace, campaign plan, proposals), `compileBrainPriors` (nightly cron),
`brainEvalHarness`, `recordOutcomeEvent` (shared write helper invoked from send handlers +
webhooks), upgrades to `enforceFourteenDayLaw`, `forgeApproachDrafts` (consume priors +
campaign plan), `generateLandlordCallScript` (consume confidence + leverage-unknown to rank
discovery questions), `landlordHeartbeat` (delta-tier aware).

---

## 5 · BUILD PHASES (each phase independently shippable, degrade-safe, verified live)

**Phase 0 — Recon (no writes).** Live-read schemas + the exact files in §2; produce a gap map
vs this spec; list every KEEP-IN-SYNC site you will touch. Output: `V4_RECON.md` in repo.

**Phase 1 — LEARN foundation.** `OutcomeEvent` + `recordOutcomeEvent` + wire senders/webhooks
+ backfill what's derivable from existing Message/Email/IMessage/Telegram history (dry-run
first). ✅ Accept: send a WhatsApp from a card → OutcomeEvent row with correct angle
attribution; a reply within 72h links back.

**Phase 2 — Priors + calibration.** `PlaybookPrior`, `BrainCalibration`, `compileBrainPriors`
(cron), inject into orchestrator + forge prompts. ✅ Accept: run on a P3 relocating-Russian
landlord → the prompt contains its cohort prior; low-N priors flagged; calibration line present
once ≥50 resolved predictions exist.

**Phase 3 — Cortex.** Agent loop + tools + self-critique + `ai_confidence` +
`ai_highest_leverage_unknown` + `ai_reasoning_trace` + AI-card "Why?" rendering. ✅ Accept: a
full run shows ≤6 tool calls in BrainRunLog, a populated trace where every claim has a ground,
and confidence bands on the card.

**Phase 4 — Working memory + delta tier.** `ai_working_memory`, `tier:'delta'`, rewire nudges
+ debounce + heartbeat. ✅ Accept: adding one note runs delta (Haiku, <5s), full run only on
escalation; BrainRunLog shows the delta:full split.

**Phase 5 — Campaign plan + COUNCIL.** `ai_campaign_plan` + card timeline strip; council
trigger + `ai_council` + thesis absorption. ✅ Accept: a stuck >14d high-value landlord convenes
the council exactly once/48h; dissent appears in open questions; plan touches respect quiet
hours + cadence keys.

**Phase 6 — ACT.** Proposal fields (dual-write), Aurora-proposes strip, autonomy dial,
`enforceFourteenDayLaw` proposal upgrade, dismiss→OutcomeEvent. ✅ Accept: a 14-Day violation
produces a `proposed` Followup visible on the card; approve activates it; **grep proves zero
new send paths exist.**

**Ship gate per phase:** esbuild-clean, live-DB verification queries pasted into the phase
report, `brainEvalHarness` green (from Phase 3 on), git clean + pushed, and a one-paragraph
report to the CEO ending with HOLD THE LINE.

---

## 6 · DEFINITION OF "EXTREMELY SMART" (the acceptance bar, in the CEO's language)

Open any landlord card and AURORA CORTEX can answer, with receipts: *What do I know, how sure
am I, what's the one thing I don't know that matters most, what exactly happened with owners
like this one before, what's the full plan for the next 14 days, who disagrees inside the brain
and why — and here is the proposal, one tap to approve.* Every figure traceable to a deed,
every move traceable to doctrine or measured outcome, every word in the right person's voice,
and not a single message ever sent by a machine.

HOLD THE LINE.
