# BUYER BRAIN V1 — AURORA BUYER — MASTER DEVELOPMENT PROMPT (for Claude Code)

> Open a Claude Code session on the `erudite-crm` repo and execute this document end-to-end.
> Written 2026-07-15 from a live read of the deployed system (Base44 app
> `69cabceaeeb8bb5e3a62ead3`, app.erudite-estate.com). This is the buyer-side twin of the
> landlord brain. Its architectural bible is `BRAIN_V4_MASTER_PROMPT.md` (repo root) and its
> reference implementation is `base44/functions/landlordOrchestrator/entry.ts` — read BOTH
> in full before writing a single line.

---

## 0 · MISSION

Build **BUYER AURORA** — `base44/functions/buyerOrchestrator/entry.ts` — the buyer-side
intelligence brain, mirroring the landlord brain's V4-era architecture but with a buyer
mindset. One brain per side. **SEPARATE BRAINS, BY DESIGN**: no shared writes, no cross-brain
reads, no merged prompts. A future "bridge" (same human appearing as both lead and landlord,
or a ClosingDeal linking both sides) is explicitly OUT OF SCOPE for V1 — do not build it,
do not pre-wire it beyond leaving the code readable enough to add later.

Definition of done: the CEO (Ahmad) opens any lead in the Lead Command Center
(`/lead/:id`) and the difference is obvious — scores with rationales, a living rolling
summary, a concrete next best action, coaching, drafts in the composer, proposals to
approve. Work autonomously end-to-end; verify everything in the live DB yourself; never
trust a builder success report.

## 1 · READ-FIRST PROTOCOL (mandatory, in this order)

1. `git fetch && git reset --hard origin/main` — Base44 auto-commits builder changes; today
   alone shipped the Lead Command Center, buyer pipeline mirror, and pulse systems.
2. `BRAIN_V4_MASTER_PROMPT.md` — the 12 operating laws, V3 context, V4 LEARN/ACT spec.
3. `base44/functions/landlordOrchestrator/entry.ts` (~1,300 lines) — the reference brain:
   source-gathering, packs, doctrine injection, tier routing, tool-forced output, writes.
4. Live schema: `list_entity_schemas` + `query_entities` on Lead, LeadScore,
   LeadScoreSnapshot, Viewing, Offer, Deal, ClosingDeal, PFListing, MarketReport,
   MarketTransaction, Reminder, Note, LeadActivity, ContactHistory — never build from this
   document alone; re-verify every field name live.
5. `src/pages/LeadCommandCenter.jsx` (822 lines) — the UI this brain must light up.

## 2 · OPERATING LAWS (inherited from Brain V4 — violating any is a failed build)

All 12 laws in `BRAIN_V4_MASTER_PROMPT.md §1` apply verbatim. The ones that bite hardest here:
- **Stage writes are BANNED.** The AI never writes `Lead.stage`. Recommend only
  (`new_stage` surfaced in UI); only a human moves stages.
- **NEVER auto-send.** Drafts, suggestions, proposals only. A human presses Send. Always.
- **Schema dual-write.** Any new Lead field goes in BOTH `base44/entities/Lead.jsonc` AND
  the live schema via `update_entity_schema` with the FULL schema (omitted fields are
  deleted; preserve RLS). Verify live after writing.
- **Degrade-safe everything.** Every read `.catch(() => [])`; every write in its own
  non-fatal try/catch. A missing entity no-ops, never bricks the run.
- **No fabrication.** Only figures present in the packs exist. An invented comp, listing,
  or number is a catastrophe. If data is thin: low/neutral scores +
  `insufficient_contact_data` in red flags.
- **Identity engine.** Any draft is written as the LOGGED-IN agent (mirror
  `forgeApproachDrafts`' `buildWriter`/`buildCredibilityBlock`): CEO voice only for the two
  CEO emails; agents in their own name + position; drafts stamped and re-forged on
  identity change.
- **Anthropic API pattern**: `ANTHROPIC_API_KEY` env, tool-forced structured output
  (`tool_choice: {type:'tool'}`), `claude-opus-4-8` full tier / `claude-haiku-4-5-20251001`
  cold tier. Deno function, `Deno.serve`, `createClientFromRequest` → `asServiceRole`.
- **Cost is routed.** Engagement-wins tiering. No new paid infrastructure without CEO
  confirmation; model-call architecture within the existing Anthropic account is yours.
- **Quiet hours** 21:00–09:00 Asia/Dubai for anything time-scheduled toward leads.
- **KEEP-IN-SYNC discipline.** If you create a backfill/sweep twin of the orchestrator,
  mark the shared tier-routing and snapshot blocks `KEEP IN SYNC` exactly as the landlord
  trio does, and keep them synchronized.

## 3 · THE BUYER MINDSET — SEMANTIC TRANSLATION TABLE

| Landlord brain | Buyer brain |
|---|---|
| Win the mandate (Form A) | Win the deal: qualified → viewing → offer → close |
| `mandate_win_probability` | `ai_conversion_probability` (0–1, exists) |
| Asking price discipline | Budget + requirements discipline (budget_min/max, beds, projects, timeline, finance status) |
| MARKET PACK (defend the price) | BUYER MARKET PACK (justify value + urgency: comps for TARGET projects/unit types, same never-mix rules for the Peninsula family) |
| OWNER PORTFOLIO | BUYER JOURNEY: viewings held, offers made, listings viewed/rejected + why |
| Landlord archetype | Buyer archetype: end-user, investor, first-time, cash, mortgage, relocating, tenant-to-buyer (use existing `ai_persona` field) |
| Urgency = seller motivation | Urgency = churn risk + inventory scarcity (a matched unit can be SOLD tomorrow) |
| Strike now = mandate window open | Strike now = hot signals + matched inventory + finance ready |
| 14-Day Law | Applies identically — no active lead goes 14 days untouched |
| Rule-of-5 cadence | Adapted: day-2 matched-listing drop, day-5 call, day-9 voice note, day-14 market snapshot, nurture |
| Value before price | Unchanged. One ask per message. Next step always scheduled. Unchanged. |

## 4 · SOURCES PER RUN (all lead-scoped, degrade-safe — every one verified to carry `lead_id`)

Lead record · WhatsAppMessage(60, lead_id + phone-last9 fallback) · IMessage ·
TelegramMessage · Email(lead_id + address match) · Message · CallLog + AircallCall ·
Note(`linked_lead_id`, human notes weighted heavily) · Reminder(tasks) · LeadActivity +
Activity + ContactHistory · Viewing · Offer · Deal/ClosingDeal · LeadScore +
LeadScoreSnapshot(trend) · linked PFListing(s) · BrandVoice(active). Plus packs:

- **BUYER MARKET PACK** — deed comps from MarketReport/MarketTransaction for the lead's
  target projects + unit types (reuse the landlord pack builder's never-mix rules).
- **INVENTORY PACK** — live PFListings matching budget/beds/projects: the "what can we
  show them TODAY" list; feeds urgency and every suggested message. Cap it; never dump.
- **PROJECT INTELLIGENCE SOURCES + PROJECT BRIEF** — reuse the landlord builders verbatim
  for the lead's target projects (`ProjectIntelSource.auto_inject`, `Project.notes`).

## 5 · OUTPUT — WRITE ON Lead (tool-forced schema, one write per run)

**FILL THE 22 FIELDS THAT ALREADY EXIST** (verified live in `Lead.jsonc`):
`ai_lead_score` + `ai_lead_score_breakdown` + `ai_score_trend`, `ai_conversion_probability`,
`ai_estimated_close_date`, `ai_estimated_deal_value`, `ai_lifetime_value_estimate`,
`ai_churn_prediction`, `ai_persona`, `ai_recommended_property_ids`, `ai_recommendations`,
`ai_next_best_actions`, `ai_engagement_level`, `ai_best_contact_time`, `ai_buying_signals`,
`ai_red_flags`, `ai_objections_summary`, `ai_journey_stage`, `ai_rolling_summary`
(state-aware — reflects what is already scheduled), `ai_similar_lead_ids`,
`ai_coaching_for_agent`, `ai_processed_at`, `ai_model_used`, `ai_processing_status`.

**ADD (dual-write, mirroring the landlord names):** `ai_strike_now`, `ai_momentum`,
`ai_deal_thesis`, `ai_suggested_messages` (2–3 drafts: tone/intent/rationale/channel, in
`preferred_language`, identity-engine voiced), `ai_suggested_tasks`, `ai_suggested_followups`,
`ai_approach_drafts`, `new_stage` recommendation (recommend-only), score rationales
(one line each), `estimated_commission_aed` — computed ONLY from a real basis (linked
Offer/Deal value, or budget × the commission convention already used by
PipelineSummaryCard — read it, reuse it, never invent one).

## 6 · TIER ROUTING & TRIGGERS

`resolveTier` mirrored from the landlord trio: any engagement (stage beyond first, any
inbound, any activity/viewing/offer) → **full tier, Opus 4.8**; brand-new/cold → **Haiku
cold tier** (minimal output: score + urgency + persona guess + rolling summary + next best
action + 2–3 personal cold-open drafts tailored to their search — never generic).
Triggers: (a) on Lead Command Center open (mirror how `LandlordDetailPage` invokes
`landlordOrchestrator` + `forgeApproachDrafts` once per visit), (b) `backfillBuyerBrain`
sweep daemon over classified leads — tiered, batched, cost-conscious, quiet-hours-safe.

## 7 · UI WIRING (the brain must be VISIBLE)

- Lead Command Center AI panel renders: scores + rationales, rolling summary, deal thesis,
  next best action, coaching, red flags/buying signals/objections, strike-now banner,
  score trend from LeadScoreSnapshot.
- `ai_suggested_messages` feed the ModernComposerField suggestion row per channel.
- Proposals: brain may create Reminder/Followup rows with `origin='aurora'`,
  `proposal_status='proposed'` — surfaced with approve/dismiss exactly like the landlord's
  Aurora proposals (approve = human decision; dismiss records the outcome).
- Buyer Pulse (already live on the pipeline) automatically strengthens as `ai_strike_now`
  and the probability fields populate — verify the chips light up after a sweep.

## 8 · NOTIFICATIONS

Extend `morningPowerSchedule` with a BUYER section mirroring the landlord one: strike-now
buyers, LAW-14 breaches, hot leads (≥0.7), yesterday's new signals. Email to agents/CEO
only — never to leads. Respect quiet hours.

## 9 · PHASES (ship in order, verify each in the live DB before the next)

- **B0 — ENGINE**: schema additions (dual-write) + `buyerOrchestrator` full & cold tiers
  live; run on 3 real leads (one cold, one engaged, one hot) and verify every field via
  `query_entities`.
- **B1 — SURFACE**: Lead Command Center panels + composer drafts + proposals rendering.
- **B1.5 — AGENT PARITY** (from the CEO's agent-walkthrough audit, 15 Jul): (a) ON-OPEN
  TRIGGER — LeadCommandCenter must invoke `buyerOrchestrator` (+ draft forging) once per
  visit exactly as LandlordDetailPage invokes its brain; today the card never wakes the
  engine. (b) BUYER CALL SCRIPT — mirror `generateLandlordCallScript` for leads: opener,
  discovery questions, value hooks from the INVENTORY PACK, objection handlers, cheat
  sheet. (c) RENT-TRACK SEMANTICS — on the rent track, money is ANNUAL RENT (with cheques
  preference), not sale budget; move-in date drives urgency; card, command center, and
  brain prompts must respect the active track. (d) COLD AUTO-OUTREACH for buyers mirroring
  `winBranchAutoOutreach` — drafts/dry-run first, sends only on human approval.
- **B2 — SWEEP**: `backfillBuyerBrain` daemon (KEEP-IN-SYNC blocks marked), tiered batch
  over the classified lead base; watch cost; report counts.
- **B3 — MORNING**: buyer section in `morningPowerSchedule`.
- **LATER (not now)**: LEARN/ACT (P3/P4) inherit from the landlord V4 build once it ships;
  keep the code structured so the same patterns drop in. The landlord↔buyer bridge is a
  separate future project — do not start it.

## 10 · VERIFICATION PROTOCOL

After each phase: read back the written Lead records live; confirm `stage` untouched;
confirm zero sends occurred; open `/lead/:id` and confirm rendering; run one cold-tier and
one full-tier invocation and diff cost/latency; `git push` only after
`git fetch`/rebase per law. Final: a one-screen report to the CEO — what shipped, what it
costs per run, and the three verified example leads.

— HOLD THE LINE.
