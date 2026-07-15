import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * buyerOrchestrator — BUYER AURORA B0 (ENGINE): the buyer-side intelligence brain.
 *
 * The buyer twin of landlordOrchestrator (its architectural bible is
 * BRAIN_V4_MASTER_PROMPT.md; its spec is BUYER_BRAIN_V1_MASTER_PROMPT.md). SEPARATE BRAINS BY
 * DESIGN: no shared writes, no cross-brain reads, no merged prompts. One run =
 *
 *   READ  everything lead-scoped (degrade-safe): WhatsAppMessage (lead_id, then phone-variant
 *         fallback — live rows store E.164 WITH '+' and often NO lead_id), Message (Evolution),
 *         IMessage, TelegramMessage, Email (lead_id then address match), CallLog (phone
 *         variants), AircallCall, Note (linked_lead_id — weighted heavily), Reminder
 *         (tasks + follow-ups), LeadActivity + Activity + ContactHistory, Offer, Deal,
 *         ClosingDeal, LeadScoreSnapshot (trend), linked PFListing, BrandVoice (active).
 *   PACK  BUYER MARKET PACK (deed comps for the lead's TARGET projects, same never-mix rules
 *         as the landlord brain), INVENTORY PACK (live PFListings matching budget/beds/areas —
 *         what we can show them TODAY), PROJECT INTELLIGENCE + PROJECT BRIEF (reused builders).
 *   THINK tool-forced structured output. Tiers: full = claude-opus-4-8 (any engagement);
 *         cold = claude-haiku-4-5 (brand-new/no engagement; score + persona + summary + NBA +
 *         personal cold-open drafts tailored to their stated search).
 *   WRITE ONE Lead.update filling the 22 existing ai_* fields + the B0 additions, plus ONE
 *         LeadScoreSnapshot row. NOTHING else.
 *
 * LAWS (inherited from Brain V4 — violating any is a failed build):
 *   - Stage writes are BANNED. recommended_stage is returned in the response ONLY.
 *   - NEVER auto-send. Drafts and suggestions only; a human presses Send.
 *   - No fabrication: only figures present in the packs exist. Thin data ⇒ low/neutral scores
 *     + 'insufficient_contact_data' in ai_red_flags.
 *   - Degrade-safe everything: every read .catch(() => []); every side write non-fatal.
 *   - Quiet hours 21:00–09:00 Asia/Dubai for anything time-scheduled toward the lead.
 *   - Identity engine: drafts voiced as the LOGGED-IN agent (CEO voice only for CEO emails).
 *   - estimated_commission_aed is computed in CODE from a real basis (linked Deal.commission_value)
 *     — never asked from the model, never invented.
 */

// Live Lead stage taxonomy — MUST match Lead.jsonc `stage` enum exactly. Used ONLY to validate
// the model's recommended_stage (returned in the response, NEVER written).
const STAGES = [
  'contact_identity', 'financial_qualification', 'intent_lock', 'unit_matching', 'viewing',
  'objection_offer', 'negotiation_deal_lock', 'closing_dld', 'closed',
  'new_tenant_lead', 'qualified_tenant', 'viewing_decision', 'contract_cheques', 'ejari_movein',
  'intake_clarify'
];

// Entry stages — a lead sitting here with no inbound and no journey rows is COLD.
const ENTRY_STAGES = new Set(['intake_clarify', 'contact_identity', 'new_tenant_lead']);

// Buyer task taxonomy (referenced by ai_suggested_tasks[].template_key).
const TASK_TEMPLATE_KEYS = [
  'qualify_budget', 'confirm_financing', 'send_matched_listings', 'book_viewing',
  'post_viewing_debrief', 'prepare_offer', 'request_documents', 'follow_up_silence',
  'switch_channel', 'schedule_call'
];

// Buyer cadence (referenced by ai_suggested_followups[].template_key).
const FOLLOWUP_TEMPLATE_KEYS = [
  'day2_matched_listing_drop', 'day5_checkin_call', 'day9_voice_note',
  'day14_market_snapshot', 'nurture_monthly'
];

// Sales Doctrine — buyer flavor. The non-negotiable rules every output must obey.
const DOCTRINE_RULES = `
SALES DOCTRINE (non-negotiable — every message, action, and follow-up MUST obey):
1. ONE clear ask per message. The buyer should know exactly what to do next.
2. Next step is ALWAYS scheduled. Every outbound either proposes a specific time or references an already-scheduled touch.
3. VALUE BEFORE PRESSURE. Lead with what the buyer gains (a matched unit, a deed-backed price insight, scarcity intelligence, saved time) before any ask. Never open with pushiness.
4. FOLLOW UP UNTIL CLOSED OR DEFINITIVE NO. Silence is not a "no". A buyer who ghosted is a buyer still in play — the cadence continues until a deal closes or there is an explicit, unambiguous "no".
5. THE 14-DAY LAW: no active lead goes 14 days without a scheduled next touch. If the lead has NO pending Reminder and NO upcoming appointment, that is a DOCTRINE VIOLATION — the top next-best-action MUST schedule the next touch and a cadence follow-up MUST be proposed.
6. THE BUYER CADENCE (pick by recency of last contact):
   - day2_matched_listing_drop → day 2 after last contact: deliver ONE matched listing or one deed-backed market fact — pure value, NO ask.
   - day5_checkin_call         → day 5: a short check-in call (not a hard pitch).
   - day9_voice_note           → day 9: a personal voice note (warmth + presence).
   - day14_market_snapshot     → day 14: a "where the market is" snapshot — restate value + the one ask.
   - nurture_monthly           → beyond 14 days unresponsive: long-horizon monthly value touch, no pressure.
7. URGENCY IS REAL, NEVER FAKE: a matched unit can be sold to someone else tomorrow — scarcity claims must come from the INVENTORY PACK (real listings), never invented.
8. QUIET HOURS: 21:00–09:00 Asia/Dubai — never suggest a touch inside them.`;

const FULL_MODEL = 'claude-opus-4-8';            // strongest — quality matters for the brain
const COLD_MODEL = 'claude-haiku-4-5-20251001';  // lighter — brand-new leads with no conversation

// ───────────────────────────────────────────────────────────────────────────
// KEEP IN SYNC with the landlord trio's resolveTier (landlordOrchestrator,
// backfillLandlordBrainV2, backfillLandlordAIAnalysis) — buyer twin. Engagement-wins tier
// routing with a force_cold escape hatch.
//
// Engagement signals (ANY one ⇒ engaged):
//   • stage beyond the entry stages (intake_clarify / contact_identity / new_tenant_lead)
//   • any inbound message on any channel
//   • any journey row (activity, offer, deal, reminder marked done)
//
// Resolution order:
//   1. forceCold === true → 'cold'  (explicit bulk cost-control — overrides engagement)
//   2. engaged            → 'full'  (auto-upgrade — an engaged buyer is never thesis-starved)
//   3. otherwise          → requestedTier === 'full' ? 'full' : 'cold'
function resolveTier({ lead, hasInbound, hasActivity, forceCold = false, requestedTier }) {
  if (forceCold === true) return 'cold';
  const stageEngaged = !!lead.stage && !ENTRY_STAGES.has(lead.stage);
  const contactEngaged = !!hasInbound || !!hasActivity;
  if (stageEngaged || contactEngaged) return 'full';
  return requestedTier === 'full' ? 'full' : 'cold';
}

// ── Identity engine (KEEP IN SYNC with forgeApproachDrafts' buildWriter) ──
const CEO_EMAILS = ['ahmad.badreddine198622@gmail.com', 'ahmad@erudite-estate.com'];
function buildWriter(u) {
  const email = String(u?.email || '').trim().toLowerCase();
  const isCEO = CEO_EMAILS.includes(email);
  const rawName = String(u?.display_name || u?.full_name || '').trim();
  const name = isCEO ? 'Ahmad Badreddine' : (rawName || 'your Erudite consultant');
  const firstName = name.split(/\s+/)[0];
  const position = isCEO ? 'CEO of Erudite Real Estate' : (String(u?.position || '').trim() || 'Property Consultant');
  return { email, isCEO, name, firstName, position };
}

// ── Phone variants — live message rows store E.164 WITH '+'; Lead.phone may lack it. ──
function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}

// ── Project-name matching (KEEP IN SYNC with landlordOrchestrator — same never-mix rules) ──
function normalizeProjectName(name) {
  let s = String(name || '').toLowerCase().trim();
  s = s.replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5');
  s = s.replace(/[\s\-_\.]+/g, '');
  return s;
}
function matchProjectName(leadProject, reportProject) {
  const a = normalizeProjectName(leadProject);
  const b = normalizeProjectName(reportProject);
  if (!a || !b) return false;
  if (a === b) return true;
  // Peninsula 5 family (tower / D1 / D2): EXACT only — distinct sub-projects, never cross-match.
  const p5 = (s) => s === 'peninsula5' || s === 'peninsula5d1' || s === 'peninsula5d2';
  if (p5(a) || p5(b)) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const STOP = new Set(['the', 'of', 'at', 'in', 'on', 'and']);
  const toks = (s) => String(s || '').toLowerCase().replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5').split(/[\s\-_\.]+/).map(t => t.trim()).filter(t => t && !STOP.has(t));
  const ta = toks(leadProject), tb = toks(reportProject);
  if (ta.length && tb.length) {
    const subset = (x, y) => x.every(t => y.includes(t));
    if (subset(ta, tb) || subset(tb, ta)) return true;
  }
  return false;
}

// Map the lead's bedroom preference onto MarketTransaction.bedrooms enum values.
function bedsEnumSet(lead) {
  const lo = (typeof lead.bedrooms_min === 'number') ? lead.bedrooms_min : null;
  const hi = (typeof lead.bedrooms_max === 'number') ? lead.bedrooms_max : lo;
  if (lo == null && hi == null) return null;
  const set = new Set();
  const from = Math.max(0, lo ?? hi ?? 0);
  const to = Math.min(5, Math.max(from, hi ?? from));
  for (let b = from; b <= to; b++) {
    if (b === 0) set.add('studio');
    else if (b >= 4) set.add('4plus');
    else set.add(`${b}br`);
  }
  return set.size ? set : null;
}

// ── BUYER MARKET PACK — deed comps for the lead's TARGET projects (value + urgency
// justification for the BUYER; the landlord pack defends a price, this one justifies one).
// Same source discipline: analyzed MarketReport → MarketTransaction, outliers dropped,
// type-pure figures, never-mix project families. ──
async function gatherBuyerMarketPack(svc, lead, targetProjects) {
  try {
    if (!targetProjects.length) return '';
    const reports = await svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 40).catch(() => []);
    if (!reports || !reports.length) return '';
    const wanted = bedsEnumSet(lead);
    const blocks = [];
    for (const projName of targetProjects.slice(0, 2)) {
      const report = reports.find(r => matchProjectName(projName, r.project_name));
      if (!report) continue;
      const txs = await svc.entities.MarketTransaction.filter({ market_report_id: report.id }, '-transaction_date', 300).catch(() => []);
      const clean = (Array.isArray(txs) ? txs : []).filter(t => !t.is_outlier);
      let comps = wanted ? clean.filter(t => t.price_per_sqft && wanted.has(t.bedrooms)) : clean.filter(t => t.price_per_sqft);
      let scope = wanted ? `the lead's own target type (${[...wanted].join('/')})` : 'all types';
      if (!comps.length) { comps = clean.filter(t => t.price_per_sqft); scope = 'all types (no same-type deeds on file)'; }
      const rows = comps.slice(0, 5).map(t =>
        `• ${t.transaction_date} | ${t.bedrooms || '?'} | AED ${Math.round(t.price_aed).toLocaleString()}${t.area_sqft ? ` | ${Math.round(t.area_sqft)} sqft` : ''}${t.price_per_sqft ? ` | ${Math.round(t.price_per_sqft)}/sqft` : ''}${t.unit_number ? ` | unit ${t.unit_number}` : ''}`
      ).join('\n');
      blocks.push(
        `— ${String(report.project_name).toUpperCase()} (deed data, report ${report.report_date}): building median ${report.median_price_sqft ?? '?'} AED/sqft | ${report.transactions_count ?? '?'} clean deeds\n` +
        `RECENT DEEDS (${scope}):\n${rows || '• none on file'}`
      );
    }
    if (!blocks.length) return '';
    return `\nBUYER MARKET PACK (live deed data — the ONLY market figures you may use; cite unit + date when quoting a deed):\nTYPE DISCIPLINE (absolute): quote this buyer ONLY deeds of the type they are shopping for; another type's figure may appear only to explain a building's ladder, explicitly labeled. For the Peninsula 5 family never mix the tower with the D1/D2 duplexes.\n${blocks.join('\n')}\nUSE THE PACK: deed figures justify VALUE and real URGENCY for the buyer (what things actually transact at, how fast). NEVER state a market figure that is not in this pack.\n`;
  } catch (_) { return ''; }
}

// ── INVENTORY PACK — live PFListings matching the lead's budget/beds/areas: the
// "what can we show them TODAY" list. Capped; never dumped. Feeds urgency + every
// suggested message; ai_recommendations may ONLY reference these listing ids. ──
async function gatherInventoryPack(svc, lead) {
  try {
    const listingType = lead.intent === 'tenant' ? 'rent' : 'sale';
    const rows = await svc.entities.PFListing.filter({ status: 'active', listing_type: listingType }, '-published_at', 200).catch(() => []);
    if (!rows || !rows.length) return { text: '', ids: [] };
    const budgetMin = (typeof lead.budget_min === 'number' && lead.budget_min > 0) ? lead.budget_min : null;
    const budgetMax = (typeof lead.budget_max === 'number' && lead.budget_max > 0) ? lead.budget_max : null;
    const bedsLo = (typeof lead.bedrooms_min === 'number') ? lead.bedrooms_min : null;
    const bedsHi = (typeof lead.bedrooms_max === 'number') ? lead.bedrooms_max : bedsLo;
    const prefLocs = (Array.isArray(lead.preferred_locations) ? lead.preferred_locations : []).map(s => String(s).toLowerCase()).filter(Boolean);
    const scored = rows.map(l => {
      let score = 0;
      const price = (typeof l.price === 'number' && l.price > 0) ? l.price : null;
      if (price && budgetMax) {
        if (price >= (budgetMin ?? budgetMax * 0.5) * 0.8 && price <= budgetMax * 1.15) score += 3;
        else if (price <= budgetMax * 1.4) score += 1;
        else score -= 2;
      }
      if (typeof l.bedrooms === 'number' && bedsLo != null) {
        if (l.bedrooms >= bedsLo && l.bedrooms <= (bedsHi ?? bedsLo)) score += 2;
        else score -= 1;
      }
      const hay = `${l.location || ''} ${l.community || ''} ${l.building_name || ''} ${l.title || ''}`.toLowerCase();
      if (prefLocs.length && prefLocs.some(p => hay.includes(p))) score += 2;
      return { l, score };
    }).sort((a, b) => b.score - a.score);
    const top = scored.filter(s => s.score > 0).slice(0, 8);
    const picks = top.length ? top : scored.slice(0, 4); // nothing matches → show the closest few, honestly labeled
    const rowsTxt = picks.map(({ l, score }) =>
      `• [${l.id}] ${l.building_name || l.title || '?'} | ${l.community || l.location || '?'} | ${typeof l.bedrooms === 'number' ? (l.bedrooms === 0 ? 'studio' : l.bedrooms + 'BR') : '?'} | AED ${typeof l.price === 'number' ? Math.round(l.price).toLocaleString() : '?'}${l.area_sqft ? ` | ${Math.round(l.area_sqft)} sqft` : ''}${score <= 0 ? ' | (outside stated criteria)' : ''}`
    ).join('\n');
    const text = `\nINVENTORY PACK (live ${listingType} listings we can show TODAY — the ONLY inventory you may reference; ai_recommendations.property_id MUST be one of the [ids] below, else leave recommendations empty):\n${rowsTxt}\nUSE THE INVENTORY: matched units are the buyer's strongest value + urgency lever (a real unit can be gone tomorrow). NEVER invent a listing, price, or availability.\n`;
    return { text, ids: picks.map(({ l }) => l.id) };
  } catch (_) { return { text: '', ids: [] }; }
}

// ── PROJECT INTELLIGENCE + BRIEF (reused from the landlord brain, matched on the lead's
// target projects; same caches, same auto_inject discipline). ──
let INTEL_SRC_CACHE = { at: 0, rows: [] };
const INTEL_SRC_CACHE_MS = 10 * 60 * 1000;
async function gatherProjectIntelPack(svc, targetProjects) {
  try {
    if (!targetProjects.length) return '';
    if (Date.now() - INTEL_SRC_CACHE.at > INTEL_SRC_CACHE_MS) {
      const rows = await svc.entities.ProjectIntelSource.filter({ auto_inject: true }, '-updated_date', 200).catch(() => []);
      INTEL_SRC_CACHE = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
    }
    const sources = INTEL_SRC_CACHE.rows
      .filter(s => targetProjects.some(p => matchProjectName(p, s.project_name)))
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
      .slice(0, 4);
    if (!sources.length) return '';
    const blocks = sources.map(s => {
      const facts = Array.isArray(s.key_facts) && s.key_facts.length ? ` KEY FACTS: ${s.key_facts.slice(0, 5).map(f => `• ${f}`).join(' ')}` : '';
      const talk = Array.isArray(s.talking_points) && s.talking_points.length ? ` ANGLES: ${s.talking_points.slice(0, 4).map(t => `• ${t}`).join(' ')}` : '';
      return `[${s.source_type || 'source'}] ${s.source_name}${facts}${talk}${s.summary ? ` — ${String(s.summary).slice(0, 700)}` : ''}`;
    }).join('\n');
    return `\nPROJECT INTELLIGENCE (curated intel for the lead's target projects — complements the packs; deed figures always outrank these):\n${blocks}\nWeave AT MOST one intel fact per touch; NEVER invent a fact not in this block.\n`;
  } catch (_) { return ''; }
}

let PROJECT_BRIEF_CACHE = { at: 0, rows: [] };
const PROJECT_BRIEF_CACHE_MS = 10 * 60 * 1000;
async function gatherProjectBriefPack(svc, targetProjects) {
  try {
    if (!targetProjects.length) return '';
    if (Date.now() - PROJECT_BRIEF_CACHE.at > PROJECT_BRIEF_CACHE_MS) {
      const rows = await svc.entities.Project.list('-updated_date', 500).catch(() => []);
      PROJECT_BRIEF_CACHE = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
    }
    const match = PROJECT_BRIEF_CACHE.rows.find(p => p && p.notes && targetProjects.some(t => matchProjectName(t, p.name)));
    if (!match) return '';
    return `\nPROJECT BRIEF (${String(match.name).toUpperCase()} — curated positioning, pricing anchors, objection handlers; complements the packs, never overrides deed figures):\n${String(match.notes).slice(0, 2500)}\n`;
  } catch (_) { return ''; }
}

// ── Anthropic call — tool-forced structured output. Returns { result, usage }. ──
async function callClaude(system, prompt, model, schema, maxTokens = 4096) {
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ name: 'emit_orchestrator', description: 'Emit the buyer orchestration result.', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'emit_orchestrator' }
    });
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    return {
      result: toolBlock ? toolBlock.input : null,
      usage: { input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null }
    };
  } catch (err) {
    console.error('Claude call failed:', err);
    return { result: null, usage: { input_tokens: null, output_tokens: null } };
  }
}

// ── Output schemas ──
const MESSAGE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Ready to send, in the lead\'s language, NO placeholders.' },
    language: { type: 'string' },
    channel: { type: 'string', enum: ['whatsapp', 'call', 'email', 'sms'] },
    tone: { type: 'string' },
    intent: { type: 'string' },
    mode: { type: 'string', enum: ['reply', 'cold_open'] },
    rationale: { type: 'string' }
  },
  required: ['text']
};

const NBA_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['call', 'whatsapp', 'email', 'send_listings', 'schedule_viewing', 'send_brochure', 'negotiate', 'send_contract', 'request_documents', 'escalate_to_manager', 'nurture_campaign', 'close_as_lost'] },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
    reasoning: { type: 'string' },
    draft_message: { type: 'string', description: 'Optional ready-to-send draft for this action.' },
    draft_language: { type: 'string' },
    expected_outcome: { type: 'string' },
    confidence: { type: 'number', description: '0-1' }
  },
  required: ['action', 'priority', 'reasoning']
};

const SCORE_BREAKDOWN_SCHEMA = {
  type: 'object',
  description: 'Each 0-100. Calibrated to EVIDENCE DEPTH — thin data means neutral-low, never inflated.',
  properties: {
    budget_fit: { type: 'number' }, authority: { type: 'number' }, need_clarity: { type: 'number' },
    timeline_urgency: { type: 'number' }, engagement: { type: 'number' }, inventory_match: { type: 'number' },
    responsiveness: { type: 'number' }
  },
  required: ['budget_fit', 'authority', 'need_clarity', 'timeline_urgency', 'engagement', 'inventory_match', 'responsiveness']
};

const PERSONA_SCHEMA = {
  type: 'object',
  properties: {
    archetype: { type: 'string', enum: ['first_time_buyer', 'upgrader', 'downsizer', 'investor_yield', 'investor_capital_growth', 'international_buyer', 'end_user_family', 'young_professional', 'luxury_buyer', 'off_plan_speculator', 'relocator', 'tire_kicker'] },
    decision_style: { type: 'string', enum: ['analytical', 'emotional', 'consensus_seeking', 'impulsive', 'cautious'] },
    price_sensitivity: { type: 'string', enum: ['low', 'medium', 'high'] },
    communication_style: { type: 'string', enum: ['formal', 'casual', 'direct', 'relationship_first', 'data_driven'] },
    key_motivators: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    concerns: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    persona_summary: { type: 'string' }
  },
  required: ['archetype', 'persona_summary']
};

const CHURN_SCHEMA = {
  type: 'object',
  properties: {
    risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    probability: { type: 'number', description: '0-1' },
    predicted_churn_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' },
    primary_risk_factors: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    retention_actions: { type: 'array', items: { type: 'string' }, maxItems: 3 }
  },
  required: ['risk_level', 'probability']
};

const FULL_SCHEMA = {
  type: 'object',
  properties: {
    ai_lead_score: { type: 'number', description: '0-100 composite lead quality.' },
    ai_lead_score_breakdown: SCORE_BREAKDOWN_SCHEMA,
    ai_lead_score_rationale: { type: 'string', description: 'ONE line.' },
    ai_conversion_probability: { type: 'number', description: '0-1 probability this lead transacts with us. Calibrated, never performative.' },
    ai_conversion_rationale: { type: 'string', description: 'ONE line.' },
    ai_estimated_close_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null when unknowable.' },
    ai_estimated_deal_value: { type: ['number', 'null'], description: 'AED. ONLY from stated budget, an offer, or a matched listing price in the packs — else null.' },
    ai_lifetime_value_estimate: { type: ['number', 'null'], description: 'AED. Conservative; null when no basis.' },
    ai_churn_prediction: CHURN_SCHEMA,
    ai_persona: PERSONA_SCHEMA,
    ai_engagement_level: { type: 'string', enum: ['highly_engaged', 'engaged', 'lukewarm', 'disengaged', 'silent'] },
    ai_best_contact_time: {
      type: 'object',
      properties: { day_of_week: { type: 'string' }, hour_range: { type: 'string' }, timezone: { type: 'string' }, reasoning: { type: 'string' } }
    },
    ai_buying_signals: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'ONLY signals actually present in the conversation/journey.' },
    ai_red_flags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    ai_objections_summary: {
      type: 'array', maxItems: 4,
      items: {
        type: 'object',
        properties: { objection: { type: 'string' }, frequency: { type: 'number' }, category: { type: 'string' }, best_response: { type: 'string' } },
        required: ['objection']
      }
    },
    ai_journey_stage: { type: 'string', enum: ['awareness', 'consideration', 'evaluation', 'decision', 'post_purchase', 'advocacy'] },
    ai_rolling_summary: { type: 'string', description: 'State-aware tactical current-state — reflects what is already scheduled instead of re-suggesting it.' },
    ai_coaching_for_agent: { type: 'string', description: '2-3 sentences of concrete coaching for the assigned agent.' },
    ai_next_best_actions: { type: 'array', items: NBA_ITEM_SCHEMA, minItems: 1, maxItems: 3, description: 'Most important first. #1 is THE next move.' },
    ai_recommendations: {
      type: 'array', maxItems: 5,
      description: 'Matched-listing recommendations. property_id MUST be an [id] from the INVENTORY PACK — no pack, no recommendations.',
      items: {
        type: 'object',
        properties: {
          property_id: { type: 'string' }, match_score: { type: 'number', description: '0-100' }, reasoning: { type: 'string' },
          matched_criteria: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          mismatched_criteria: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          suggested_pitch: { type: 'string' }
        },
        required: ['property_id', 'match_score', 'reasoning']
      }
    },
    ai_deal_thesis: { type: 'string', description: 'The persistent strategic narrative: where this deal is going and how we close it. EVOLVE the prior thesis — never reset it without cause.' },
    ai_strike_now: { type: 'boolean', description: 'True ONLY when hot signals + matched inventory + finance readiness align RIGHT NOW.' },
    ai_momentum: { type: 'string', enum: ['accelerating', 'steady', 'slowing', 'stalled'] },
    ai_suggested_messages: { type: 'array', items: MESSAGE_ITEM_SCHEMA, minItems: 2, maxItems: 3, description: 'Send-ready drafts advancing NBA #1, in the lead\'s preferred language, voiced as the WRITER (identity block).' },
    ai_suggested_tasks: {
      type: 'array', maxItems: 5,
      items: { type: 'object', properties: { template_key: { type: 'string', enum: TASK_TEMPLATE_KEYS }, reason: { type: 'string' } }, required: ['template_key'] }
    },
    ai_suggested_followups: {
      type: 'array', maxItems: 4,
      items: {
        type: 'object',
        properties: {
          template_key: { type: 'string', enum: FOLLOWUP_TEMPLATE_KEYS },
          when_offset_days: { type: 'number' }, suggested_hour: { type: 'number', description: '9-21 Asia/Dubai — quiet hours are FORBIDDEN' },
          channel: { type: 'string', enum: ['whatsapp', 'call', 'email', 'sms'] }, reason: { type: 'string' }
        },
        required: ['template_key']
      }
    },
    recommended_stage: { type: ['string', 'null'], enum: [...STAGES, null], description: 'Stage RECOMMENDATION only — never written by the AI; a human moves stages.' }
  },
  required: ['ai_lead_score', 'ai_lead_score_breakdown', 'ai_lead_score_rationale', 'ai_conversion_probability', 'ai_conversion_rationale', 'ai_churn_prediction', 'ai_persona', 'ai_engagement_level', 'ai_journey_stage', 'ai_rolling_summary', 'ai_coaching_for_agent', 'ai_next_best_actions', 'ai_suggested_messages']
};

const COLD_SCHEMA = {
  type: 'object',
  properties: {
    ai_lead_score: { type: 'number', description: '0-100. Thin data ⇒ neutral-low (20-45), never inflated.' },
    ai_lead_score_breakdown: SCORE_BREAKDOWN_SCHEMA,
    ai_lead_score_rationale: { type: 'string', description: 'ONE line.' },
    ai_persona: PERSONA_SCHEMA,
    ai_engagement_level: { type: 'string', enum: ['highly_engaged', 'engaged', 'lukewarm', 'disengaged', 'silent'] },
    ai_journey_stage: { type: 'string', enum: ['awareness', 'consideration', 'evaluation', 'decision', 'post_purchase', 'advocacy'] },
    ai_rolling_summary: { type: 'string' },
    ai_buying_signals: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    ai_red_flags: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'Include insufficient_contact_data when the record is thin.' },
    ai_next_best_actions: { type: 'array', items: NBA_ITEM_SCHEMA, minItems: 1, maxItems: 2 },
    ai_coaching_for_agent: { type: 'string' },
    ai_suggested_messages: { type: 'array', items: MESSAGE_ITEM_SCHEMA, minItems: 2, maxItems: 3, description: 'PERSONAL cold-open first-contact drafts tailored to their stated search — never generic.' }
  },
  required: ['ai_lead_score', 'ai_lead_score_breakdown', 'ai_lead_score_rationale', 'ai_persona', 'ai_engagement_level', 'ai_journey_stage', 'ai_rolling_summary', 'ai_next_best_actions', 'ai_suggested_messages']
};

// ── small utils ──
const ts = (v) => { const t = new Date(v || 0).getTime(); return isNaN(t) ? 0 : t; };
const fmtD = (v) => v ? String(v).slice(0, 10) : '?';
const num01 = (v) => (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : null;
const num100 = (v) => (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(100, Math.round(v))) : null;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      lead_id, force = false, tier = 'full', force_cold = false, debug_context = false,
      triggered_by = 'manual'
    } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const lead = await svc.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: 'lead not found' }, { status: 404 });

    // Debounce auto-triggers: skip if recently processed and nothing new since — UNLESS forced.
    if (!force && lead.ai_processed_at) {
      const lastRun = ts(lead.ai_processed_at);
      if (Date.now() - lastRun < 6 * 3600 * 1000) {
        const newest = async (name, q, sort) => {
          try { const r = await svc.entities[name].filter(q, sort, 1); return r?.[0] ? ts(r[0].timestamp || r[0].sent_at || r[0].received_at || r[0].created_date) : 0; }
          catch (_) { return 0; }
        };
        const stamps = await Promise.all([
          newest('WhatsAppMessage', { lead_id }, '-timestamp'),
          newest('IMessage', { lead_id }, '-sent_at'),
          newest('TelegramMessage', { lead_id }, '-sent_at'),
          newest('Reminder', { lead_id }, '-created_date'),
          newest('LeadActivity', { lead_id }, '-created_date'),
          newest('Note', { linked_lead_id: lead_id }, '-created_date'),
          Promise.resolve(ts(lead.last_activity_at)),
        ]);
        if (!stamps.some(s => s > lastRun)) {
          return Response.json({ ok: true, skipped: 'recent_run_no_new_activity', last_run: lead.ai_processed_at });
        }
      }
    }

    // ── GATHER (all degrade-safe) ──
    const variants = phoneVariants(lead.phone || lead.whatsapp);
    const waByPhone = async () => {
      const byId = await svc.entities.WhatsAppMessage.filter({ lead_id }, '-timestamp', 60).catch(() => []);
      if (byId && byId.length) return byId;
      if (!variants.length) return [];
      const batches = await Promise.all(variants.flatMap(v => [
        svc.entities.WhatsAppMessage.filter({ from_number: v }, '-timestamp', 40).catch(() => []),
        svc.entities.WhatsAppMessage.filter({ to_number: v }, '-timestamp', 40).catch(() => []),
      ]));
      const seen = new Set(); const out = [];
      for (const b of batches) for (const m of (b || [])) { if (m && !seen.has(m.id)) { seen.add(m.id); out.push(m); } }
      return out;
    };
    const emailFetch = async () => {
      const byId = await svc.entities.Email.filter({ lead_id }, '-received_at', 30).catch(() => []);
      if (byId && byId.length) return byId;
      if (!lead.email) return [];
      const batches = await Promise.all([
        svc.entities.Email.filter({ to_email: lead.email }, '-received_at', 20).catch(() => []),
        svc.entities.Email.filter({ from_email: lead.email }, '-received_at', 20).catch(() => []),
      ]);
      const seen = new Set(); const out = [];
      for (const b of batches) for (const m of (b || [])) { if (m && !seen.has(m.id)) { seen.add(m.id); out.push(m); } }
      return out;
    };
    const callsFetch = async () => {
      if (!variants.length) return [];
      const batches = await Promise.all(variants.flatMap(v => [
        svc.entities.CallLog.filter({ to_number: v }, '-started_at', 10).catch(() => []),
        svc.entities.CallLog.filter({ from_number: v }, '-started_at', 10).catch(() => []),
      ]));
      const seen = new Set(); const out = [];
      for (const b of batches) for (const m of (b || [])) { if (m && !seen.has(m.id)) { seen.add(m.id); out.push(m); } }
      return out;
    };

    const [
      waMsgs, evoMsgs, iMsgs, tgMsgs, emails, callLogs, aircalls,
      notes, reminders, leadActivities, activities, offers, deals, closingDeals,
      snapshots, brandVoice, linkedPF, projectRec
    ] = await Promise.all([
      waByPhone(),
      svc.entities.Message.filter({ lead_id }, '-timestamp', 40).catch(() => []),
      svc.entities.IMessage.filter({ lead_id }, '-sent_at', 30).catch(() => []),
      svc.entities.TelegramMessage.filter({ lead_id }, '-sent_at', 30).catch(() => []),
      emailFetch(),
      callsFetch(),
      svc.entities.AircallCall.filter({ lead_id }, '-started_at', 10).catch(() => []),
      svc.entities.Note.filter({ linked_lead_id: lead_id }, '-created_date', 20).catch(() => []),
      svc.entities.Reminder.filter({ lead_id }, '-created_date', 50).catch(() => []),
      svc.entities.LeadActivity.filter({ lead_id }, '-created_date', 30).catch(() => []),
      svc.entities.Activity.filter({ lead_id }, '-created_date', 30).catch(() => []),
      svc.entities.Offer.filter({ lead_id }, '-created_date', 10).catch(() => []),
      svc.entities.Deal.filter({ lead_id }, '-created_date', 5).catch(() => []),
      svc.entities.ClosingDeal.filter({ lead_id }, '-created_date', 5).catch(() => []),
      svc.entities.LeadScoreSnapshot.filter({ lead_id }, '-captured_at', 10).catch(() => []),
      svc.entities.BrandVoice.filter({ is_active: true }, '-updated_date', 1).then(r => r?.[0]).catch(() => null),
      lead.linked_pf_listing_id ? svc.entities.PFListing.get(lead.linked_pf_listing_id).catch(() => null) : Promise.resolve(null),
      lead.project_id ? svc.entities.Project.get(lead.project_id).catch(() => null) : Promise.resolve(null),
    ]);

    // ── Conversation digest (chronological, all channels merged) ──
    const msgRows = [
      ...(waMsgs || []).map(m => ({ t: ts(m.timestamp), ch: 'whatsapp', dir: m.direction === 'inbound' ? 'IN' : 'OUT', text: m.body || m.transcription || `[${m.media_type || 'media'}]` })),
      ...(evoMsgs || []).map(m => ({ t: ts(m.timestamp), ch: 'whatsapp', dir: m.direction === 'incoming' ? 'IN' : 'OUT', text: m.is_voice_note ? `[voice] ${m.transcript || ''}` : (m.text || m.caption || `[${m.media_type || 'media'}]`) })),
      ...(iMsgs || []).map(m => ({ t: ts(m.sent_at), ch: 'imessage', dir: m.direction === 'inbound' ? 'IN' : 'OUT', text: m.body || '' })),
      ...(tgMsgs || []).map(m => ({ t: ts(m.sent_at), ch: 'telegram', dir: m.direction === 'inbound' ? 'IN' : 'OUT', text: m.body || '' })),
      ...(emails || []).map(m => ({ t: ts(m.received_at || m.created_date), ch: 'email', dir: m.direction === 'inbound' ? 'IN' : 'OUT', text: `${m.subject ? `[${m.subject}] ` : ''}${(m.body_text || m.snippet || '').slice(0, 300)}` })),
      ...(callLogs || []).map(c => ({ t: ts(c.started_at), ch: 'call', dir: c.direction === 'inbound' ? 'IN' : 'OUT', text: `[call ${c.status}${c.duration_seconds ? ` ${c.duration_seconds}s` : ''}] ${(c.summary || c.transcript || '').slice(0, 250)}` })),
      ...(aircalls || []).map(c => ({ t: ts(c.started_at), ch: 'call', dir: c.direction === 'inbound' ? 'IN' : 'OUT', text: `[call ${c.status || ''}] ${(c.transcript || '').slice(0, 250)}` })),
    ].filter(r => r.t > 0 || r.text).sort((a, b) => a.t - b.t).slice(-40);
    const hasInbound = msgRows.some(r => r.dir === 'IN');
    const convoDigest = msgRows.length
      ? msgRows.map(r => `${fmtD(new Date(r.t).toISOString())} ${r.ch} ${r.dir}: ${String(r.text).slice(0, 400)}`).join('\n')
      : '(no conversation on record)';
    const lastInbound = [...msgRows].reverse().find(r => r.dir === 'IN');

    // ── Journey digest ──
    // Engagement counts REAL interactions only — a system "lead created" row, an agent-side
    // note, or a field change is not buyer engagement and must not upgrade the tier.
    const INTERACTION_TYPES = new Set(['call', 'email', 'whatsapp', 'sms', 'viewing', 'meeting', 'offer', 'contract_sent', 'contract_signed', 'payment_received']);
    const hasActivity =
      (activities || []).some(a => a && INTERACTION_TYPES.has(a.type)) ||
      (leadActivities || []).some(a => a && ['booking', 'whatsapp'].includes(a.activity_type)) ||
      (offers?.length || 0) + (deals?.length || 0) + (closingDeals?.length || 0) > 0;
    const journeyLines = [
      ...(offers || []).map(o => `OFFER ${o.status}: AED ${o.offer_amount_aed?.toLocaleString?.() || o.offer_amount_aed} on ${o.property_title || o.property_id || '?'} (${fmtD(o.submitted_at || o.created_date)})`),
      ...(deals || []).map(d => `DEAL ${d.stage}: ${d.property_ref || d.property_id || '?'} value AED ${d.deal_value?.toLocaleString?.() || d.deal_value || '?'}${d.commission_value ? ` commission AED ${d.commission_value.toLocaleString()}` : ''}`),
      ...(closingDeals || []).map(c => `CLOSING ${c.stage}: ${c.property_ref || '?'} value AED ${c.deal_value_aed?.toLocaleString?.() || c.deal_value_aed || '?'}`),
      ...(activities || []).filter(a => ['viewing', 'meeting', 'offer'].includes(a.type)).slice(0, 8).map(a => `${String(a.type).toUpperCase()} ${a.status}: ${a.title}${a.outcome ? ` → ${a.outcome}` : ''} (${fmtD(a.scheduled_at || a.completed_at || a.created_date)})`),
    ];

    // ── State (open work) — surfaced so the brain never re-suggests what exists ──
    const openReminders = (reminders || []).filter(r => r.status === 'pending');
    const upcomingReminder = openReminders.find(r => r.due_date && ts(r.due_date) > Date.now());
    const stateLines = openReminders.slice(0, 8).map(r => `PENDING ${r.type || 'task'}: "${r.title}"${r.due_date ? ` due ${fmtD(r.due_date)}` : ''}`);
    const daysSinceContact = msgRows.length ? Math.floor((Date.now() - msgRows[msgRows.length - 1].t) / 86400000) : null;
    const doctrineViolation = !upcomingReminder && (daysSinceContact == null || daysSinceContact >= 14) && lead.status === 'active';

    // ── Target projects for the packs ──
    const targetProjects = [...new Set([
      projectRec?.name,
      linkedPF?.building_name, linkedPF?.community,
      ...(Array.isArray(lead.preferred_locations) ? lead.preferred_locations : []),
    ].filter(Boolean).map(String))].slice(0, 3);

    // ── Tier ──
    const effectiveTier = resolveTier({ lead, hasInbound, hasActivity, forceCold: force_cold === true, requestedTier: tier });
    const modelUsed = effectiveTier === 'full' ? FULL_MODEL : COLD_MODEL;

    // ── Packs ──
    const [marketPack, inventory, intelPack, briefPack] = await Promise.all([
      gatherBuyerMarketPack(svc, lead, targetProjects),
      gatherInventoryPack(svc, lead),
      gatherProjectIntelPack(svc, targetProjects),
      gatherProjectBriefPack(svc, targetProjects),
    ]);

    // ── Writer identity (CEO voice only for the CEO; agents in their own name).
    // Cross-invoked runs (probe, sweep daemon, webhooks) arrive as the platform service
    // account — never let "Service" sign a draft: fall back to the ASSIGNED agent. ──
    const isServiceCaller = !user.email || String(user.email).toLowerCase().includes('no-reply.base44.com');
    let writerUser = user;
    if (isServiceCaller) {
      writerUser = (lead.assigned_agent_email
        ? await svc.entities.User.filter({ email: lead.assigned_agent_email }, '-created_date', 1).then(r => r?.[0]).catch(() => null)
        : null) || { email: '', display_name: '', position: '' };
    }
    const writer = buildWriter(writerUser);
    const identityBlock = writer.isCEO
      ? `WRITER IDENTITY: every draft is written in first person as Ahmad Badreddine, CEO of Erudite Real Estate (senior, accountable principal). Never invent credentials or figures.`
      : `WRITER IDENTITY: every draft is written in first person as ${writer.name}, ${writer.position} at Erudite Real Estate. NOT the CEO — never claim the CEO's identity or personal credentials. Never invent credentials or figures.`;

    const voiceBlock = brandVoice?.charter_text ? `\nBRAND VOICE CHARTER (every draft obeys):\n${String(brandVoice.charter_text).slice(0, 1200)}\n` : '';

    // ── Dossier ──
    const q = lead.qualification || {};
    const dossier = `LEAD DOSSIER
Name: ${lead.full_name || '?'} | Phone: ${lead.phone || '?'} | Email: ${lead.email || '?'} | Language: ${lead.preferred_language || 'en'} | Nationality: ${lead.nationality || '?'} | Residence: ${lead.residence_country || '?'}
Intent: ${lead.intent || 'unknown'} | Transaction: ${lead.transaction_type || '?'} | Source: ${lead.source || '?'}${lead.source_campaign ? ` (${lead.source_campaign})` : ''}
Stage: ${lead.stage} (entered ${fmtD(lead.stage_entered_at)}) | Status: ${lead.status} | Assigned: ${lead.assigned_agent_email || 'UNASSIGNED'}
Budget: ${lead.budget_min ? `AED ${lead.budget_min.toLocaleString()}` : '?'} – ${lead.budget_max ? `AED ${lead.budget_max.toLocaleString()}` : '?'} | Financing: ${lead.financing_method || lead.financing_type || 'unknown'} | Pre-approval: ${lead.mortgage_pre_approval_status || 'not_started'}${lead.mortgage_pre_approval_amount_aed ? ` (AED ${lead.mortgage_pre_approval_amount_aed.toLocaleString()})` : ''} | Proof of funds: ${lead.proof_of_funds_received ? 'YES' : 'no'}
Requirements: ${lead.bedrooms_min ?? '?'}–${lead.bedrooms_max ?? '?'} BR | ${(lead.preferred_property_types || []).join('/') || '?'} | Areas: ${(lead.preferred_locations || []).join(', ') || '?'} | Timeline: ${lead.move_in_timeline || '?'}
Must-haves: ${(lead.must_have_features || []).join(', ') || '(none stated)'} | Deal-breakers: ${(lead.deal_breakers || []).join(', ') || '(none stated)'}
Qualification: budget ${q.budget_confirmed ? '✓' : '✗'} authority ${q.authority_confirmed ? '✓' : '✗'} need ${q.need_confirmed ? '✓' : '✗'} timeline ${q.timeline_confirmed ? '✓' : '✗'} kyc ${q.kyc_completed ? '✓' : '✗'}
Rollups: last activity ${fmtD(lead.last_activity_at)} (${lead.last_activity_type || '?'}) | days since last contact (computed): ${daysSinceContact ?? 'never contacted'}
${lead.notes ? `Agent notes on record: ${String(lead.notes).slice(0, 600)}` : ''}
PRIOR DEAL THESIS (evolve, don't reset): ${String(lead.ai_deal_thesis || '(none yet)').slice(0, 600)}
PRIOR ROLLING SUMMARY: ${String(lead.ai_rolling_summary || '(none yet)').slice(0, 500)}
SCORE HISTORY (newest first): ${(snapshots || []).slice(0, 5).map(s => `${fmtD(s.captured_at)}:${s.overall_score ?? '?'}`).join(' | ') || '(first run)'}
${doctrineViolation ? '⚠ DOCTRINE VIOLATION: no scheduled next touch and ≥14 days silent (or never contacted while active) — NBA #1 MUST schedule the next touch and a cadence follow-up MUST be proposed.' : ''}`;

    const journeyBlock = journeyLines.length ? `\nBUYER JOURNEY:\n${journeyLines.join('\n')}\n` : '';
    const stateBlock = stateLines.length ? `\nALREADY SCHEDULED / OPEN (never re-suggest these — reference them):\n${stateLines.join('\n')}\n` : '\nALREADY SCHEDULED / OPEN: nothing — no pending reminders.\n';
    const notesBlock = (notes || []).length ? `\nHUMAN NOTES (weight these heavily — a human wrote them):\n${(notes || []).slice(0, 8).map(n => `• [${fmtD(n.created_date)}] ${n.title || ''}: ${String(n.body || '').slice(0, 300)}`).join('\n')}\n` : '';

    const system = `You are BUYER AURORA — the buyer-side intelligence brain of Erudite Real Estate, Dubai. You read EVERYTHING on one lead and produce calibrated scores, a living strategy, and concrete next moves that a HUMAN agent executes.
${DOCTRINE_RULES}
${identityBlock}
${voiceBlock}
HARD GUARDRAILS:
- NO FABRICATION: only figures present in the packs/dossier exist. An invented listing, comp, or number is a catastrophe. Thin data ⇒ low/neutral scores + "insufficient_contact_data" in ai_red_flags.
- Scores are CALIBRATED to evidence depth, never performative.
- You never send anything; you never move stages (recommended_stage is a recommendation for a human).
- Drafts: in the lead's preferred_language (${lead.preferred_language || 'en'}), voiced as the writer, ONE ask each, next step always concrete. NO placeholders like [name] — use real values or omit.
- STRICT tool output. Emit via the tool only.`;

    let prompt;
    if (effectiveTier === 'cold') {
      prompt = `COLD-TIER PASS (brand-new/no-engagement lead — assess + open):
${dossier}
${stateBlock}${inventory.text}${briefPack}
CONVERSATION: ${convoDigest}

Emit: calibrated ai_lead_score (thin data ⇒ 20-45) + breakdown + one-line rationale; best-guess ai_persona (labeled by evidence in persona_summary); ai_engagement_level; ai_journey_stage; a short ai_rolling_summary; 1-2 next best actions; coaching; and 2-3 PERSONAL cold-open drafts (mode cold_open) tailored to their stated search${targetProjects.length ? ` and target areas (${targetProjects.join(', ')})` : ''} — never generic, one ask each.`;
    } else {
      prompt = `FULL SYNTHESIS PASS:
${dossier}
${journeyBlock}${stateBlock}${notesBlock}
CONVERSATION (chronological, all channels):
${convoDigest}
${lastInbound ? `\nLATEST INBOUND (answer this FIRST in any reply draft): "${String(lastInbound.text).slice(0, 300)}"` : ''}
${briefPack}${marketPack}${inventory.text}${intelPack}
OUTPUT DIRECTIVES:
1. Scores calibrated to evidence. One-line rationales.
2. ai_conversion_probability = probability THIS lead transacts WITH US — grounded in engagement, finance readiness, inventory match, and journey progress.
3. ai_churn_prediction from staleness + sentiment + competing signals.
4. ai_estimated_deal_value ONLY from stated budget, a real offer, or a matched listing price — else null. NEVER invent.
5. ai_recommendations ONLY from INVENTORY PACK ids; match_score honest; empty when no pack.
6. ai_rolling_summary is STATE-AWARE: reflect what is already scheduled instead of re-suggesting it.
7. ai_deal_thesis EVOLVES the prior thesis.
8. ai_next_best_actions: #1 is THE move${doctrineViolation ? ' and MUST schedule the next touch (doctrine violation is live)' : ''}.
9. ai_suggested_messages: 2-3 send-ready drafts advancing NBA #1 (mode 'reply' when answering the latest inbound, else 'cold_open'), in ${lead.preferred_language || 'en'}.
10. ai_suggested_followups on the buyer cadence, suggested_hour 9-21 Asia/Dubai only.
11. ai_strike_now true ONLY when hot signals + matched inventory + finance readiness align NOW.
Emit the full result.`;
    }

    const runStartedAt = Date.now();
    const { result, usage } = await callClaude(system, prompt, modelUsed, effectiveTier === 'full' ? FULL_SCHEMA : COLD_SCHEMA, effectiveTier === 'full' ? 8192 : 4096);
    if (!result) {
      await svc.entities.Lead.update(lead.id, { ai_processing_status: 'failed' }).catch(() => {});
      return Response.json({ error: 'model returned no result' }, { status: 500 });
    }

    // ── Normalize + build the ONE Lead update. Stage is NEVER written. ──
    const nowIso = new Date().toISOString();
    const update = {
      ai_processed_at: nowIso,
      ai_model_used: modelUsed,
      ai_processing_status: 'completed',
    };

    const score = num100(result.ai_lead_score);
    if (score != null) update.ai_lead_score = score;
    if (result.ai_lead_score_breakdown && typeof result.ai_lead_score_breakdown === 'object') {
      const b = result.ai_lead_score_breakdown;
      update.ai_lead_score_breakdown = {
        budget_fit: num100(b.budget_fit) ?? 0, authority: num100(b.authority) ?? 0, need_clarity: num100(b.need_clarity) ?? 0,
        timeline_urgency: num100(b.timeline_urgency) ?? 0, engagement: num100(b.engagement) ?? 0,
        inventory_match: num100(b.inventory_match) ?? 0, responsiveness: num100(b.responsiveness) ?? 0,
      };
    }
    if (typeof result.ai_lead_score_rationale === 'string' && result.ai_lead_score_rationale.trim()) {
      update.ai_lead_score_rationale = result.ai_lead_score_rationale.trim().slice(0, 300);
    }

    // ai_score_trend: computed in CODE from the previous snapshot — never model vibes.
    const prevScore = snapshots?.[0]?.overall_score;
    if (score != null && typeof prevScore === 'number') {
      update.ai_score_trend = score >= prevScore + 3 ? 'rising' : score <= prevScore - 3 ? 'falling' : 'stable';
    } else if (score != null) {
      update.ai_score_trend = 'stable';
    }

    if (effectiveTier === 'full') {
      const conv = num01(result.ai_conversion_probability);
      if (conv != null) update.ai_conversion_probability = conv;
      if (typeof result.ai_conversion_rationale === 'string' && result.ai_conversion_rationale.trim()) {
        update.ai_conversion_rationale = result.ai_conversion_rationale.trim().slice(0, 300);
      }
      if (typeof result.ai_estimated_close_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.ai_estimated_close_date)) {
        update.ai_estimated_close_date = result.ai_estimated_close_date;
      }
      if (typeof result.ai_estimated_deal_value === 'number' && isFinite(result.ai_estimated_deal_value) && result.ai_estimated_deal_value > 0) {
        update.ai_estimated_deal_value = Math.round(result.ai_estimated_deal_value);
      }
      if (typeof result.ai_lifetime_value_estimate === 'number' && isFinite(result.ai_lifetime_value_estimate) && result.ai_lifetime_value_estimate > 0) {
        update.ai_lifetime_value_estimate = Math.round(result.ai_lifetime_value_estimate);
      }
      const churn = result.ai_churn_prediction;
      if (churn && typeof churn === 'object' && churn.risk_level) {
        update.ai_churn_prediction = {
          risk_level: ['low', 'medium', 'high', 'critical'].includes(churn.risk_level) ? churn.risk_level : 'medium',
          probability: num01(churn.probability) ?? 0.5,
          ...(typeof churn.predicted_churn_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(churn.predicted_churn_date) ? { predicted_churn_date: churn.predicted_churn_date } : {}),
          primary_risk_factors: (Array.isArray(churn.primary_risk_factors) ? churn.primary_risk_factors : []).filter(x => typeof x === 'string').slice(0, 4),
          retention_actions: (Array.isArray(churn.retention_actions) ? churn.retention_actions : []).filter(x => typeof x === 'string').slice(0, 3),
        };
      }
      if (result.ai_best_contact_time && typeof result.ai_best_contact_time === 'object') {
        const b = result.ai_best_contact_time;
        update.ai_best_contact_time = {
          day_of_week: String(b.day_of_week || '').slice(0, 40), hour_range: String(b.hour_range || '').slice(0, 40),
          timezone: String(b.timezone || 'Asia/Dubai').slice(0, 40), reasoning: String(b.reasoning || '').slice(0, 200),
        };
      }
      if (Array.isArray(result.ai_objections_summary)) {
        update.ai_objections_summary = result.ai_objections_summary
          .filter(o => o && typeof o.objection === 'string' && o.objection.trim()).slice(0, 4)
          .map(o => ({
            objection: o.objection.trim().slice(0, 200),
            frequency: (typeof o.frequency === 'number' && isFinite(o.frequency)) ? Math.max(1, Math.round(o.frequency)) : 1,
            category: String(o.category || '').slice(0, 60),
            best_response: String(o.best_response || '').slice(0, 300),
          }));
      }
      // Recommendations — property ids are WHITELISTED to the inventory pack. No pack, no recs.
      const validIds = new Set(inventory.ids);
      const recs = (Array.isArray(result.ai_recommendations) ? result.ai_recommendations : [])
        .filter(r => r && typeof r === 'object' && validIds.has(r.property_id)).slice(0, 5)
        .map(r => ({
          property_id: r.property_id,
          match_score: num100(r.match_score) ?? 50,
          reasoning: String(r.reasoning || '').slice(0, 300),
          matched_criteria: (Array.isArray(r.matched_criteria) ? r.matched_criteria : []).filter(x => typeof x === 'string').slice(0, 5),
          mismatched_criteria: (Array.isArray(r.mismatched_criteria) ? r.mismatched_criteria : []).filter(x => typeof x === 'string').slice(0, 3),
          suggested_pitch: String(r.suggested_pitch || '').slice(0, 300),
        }));
      if (recs.length) {
        update.ai_recommendations = recs;
        update.ai_recommended_property_ids = recs.map(r => r.property_id);
      }
      if (typeof result.ai_deal_thesis === 'string' && result.ai_deal_thesis.trim()) {
        update.ai_deal_thesis = result.ai_deal_thesis.trim().slice(0, 1500);
      }
      if (typeof result.ai_strike_now === 'boolean') update.ai_strike_now = result.ai_strike_now;
      if (['accelerating', 'steady', 'slowing', 'stalled'].includes(result.ai_momentum)) update.ai_momentum = result.ai_momentum;
      if (typeof result.ai_coaching_for_agent === 'string' && result.ai_coaching_for_agent.trim()) {
        update.ai_coaching_for_agent = result.ai_coaching_for_agent.trim().slice(0, 800);
      }
      // Suggested tasks/follow-ups — template-key validated; hours clamped to daylight (quiet hours are LAW).
      update.ai_suggested_tasks = (Array.isArray(result.ai_suggested_tasks) ? result.ai_suggested_tasks : [])
        .filter(t => t && TASK_TEMPLATE_KEYS.includes(t.template_key)).slice(0, 5)
        .map(t => ({ template_key: t.template_key, reason: String(t.reason || '').slice(0, 200) }));
      update.ai_suggested_followups = (Array.isArray(result.ai_suggested_followups) ? result.ai_suggested_followups : [])
        .filter(f => f && FOLLOWUP_TEMPLATE_KEYS.includes(f.template_key)).slice(0, 4)
        .map(f => ({
          template_key: f.template_key,
          when_offset_days: (typeof f.when_offset_days === 'number' && isFinite(f.when_offset_days)) ? Math.max(0, Math.min(30, Math.round(f.when_offset_days))) : 1,
          suggested_hour: (typeof f.suggested_hour === 'number' && isFinite(f.suggested_hour)) ? Math.min(21, Math.max(9, Math.round(f.suggested_hour))) : 10,
          channel: ['whatsapp', 'call', 'email', 'sms'].includes(f.channel) ? f.channel : 'whatsapp',
          reason: String(f.reason || '').slice(0, 200),
        }));
    } else {
      if (typeof result.ai_coaching_for_agent === 'string' && result.ai_coaching_for_agent.trim()) {
        update.ai_coaching_for_agent = result.ai_coaching_for_agent.trim().slice(0, 800);
      }
    }

    // Shared across tiers
    if (result.ai_persona && typeof result.ai_persona === 'object' && result.ai_persona.archetype) {
      const p = result.ai_persona;
      update.ai_persona = {
        archetype: p.archetype,
        ...(p.decision_style ? { decision_style: p.decision_style } : {}),
        ...(p.price_sensitivity ? { price_sensitivity: p.price_sensitivity } : {}),
        ...(p.communication_style ? { communication_style: p.communication_style } : {}),
        key_motivators: (Array.isArray(p.key_motivators) ? p.key_motivators : []).filter(x => typeof x === 'string').slice(0, 4),
        concerns: (Array.isArray(p.concerns) ? p.concerns : []).filter(x => typeof x === 'string').slice(0, 4),
        persona_summary: String(p.persona_summary || '').slice(0, 500),
      };
    }
    if (['highly_engaged', 'engaged', 'lukewarm', 'disengaged', 'silent'].includes(result.ai_engagement_level)) {
      update.ai_engagement_level = result.ai_engagement_level;
    }
    if (['awareness', 'consideration', 'evaluation', 'decision', 'post_purchase', 'advocacy'].includes(result.ai_journey_stage)) {
      update.ai_journey_stage = result.ai_journey_stage;
    }
    if (typeof result.ai_rolling_summary === 'string' && result.ai_rolling_summary.trim()) {
      update.ai_rolling_summary = result.ai_rolling_summary.trim().slice(0, 2000);
    }
    update.ai_buying_signals = (Array.isArray(result.ai_buying_signals) ? result.ai_buying_signals : []).filter(x => typeof x === 'string' && x.trim()).slice(0, 6).map(x => x.trim().slice(0, 150));
    update.ai_red_flags = (Array.isArray(result.ai_red_flags) ? result.ai_red_flags : []).filter(x => typeof x === 'string' && x.trim()).slice(0, 6).map(x => x.trim().slice(0, 150));
    update.ai_next_best_actions = (Array.isArray(result.ai_next_best_actions) ? result.ai_next_best_actions : [])
      .filter(a => a && typeof a === 'object' && a.action && a.reasoning).slice(0, 3)
      .map(a => ({
        action: a.action,
        priority: ['low', 'medium', 'high', 'urgent'].includes(a.priority) ? a.priority : 'medium',
        suggested_at: nowIso,
        reasoning: String(a.reasoning).slice(0, 400),
        ...(typeof a.draft_message === 'string' && a.draft_message.trim() ? { draft_message: a.draft_message.trim().slice(0, 1200) } : {}),
        ...(typeof a.draft_language === 'string' && a.draft_language ? { draft_language: a.draft_language } : {}),
        ...(typeof a.expected_outcome === 'string' && a.expected_outcome ? { expected_outcome: a.expected_outcome.slice(0, 200) } : {}),
        ...(num01(a.confidence) != null ? { confidence: num01(a.confidence) } : {}),
      }));
    update.ai_suggested_messages = (Array.isArray(result.ai_suggested_messages) ? result.ai_suggested_messages : [])
      .filter(m => m && typeof m === 'object' && typeof m.text === 'string' && m.text.trim()).slice(0, 3)
      .map(m => ({
        text: m.text.trim(),
        language: (typeof m.language === 'string' && m.language) ? m.language : (lead.preferred_language || 'en'),
        channel: ['whatsapp', 'call', 'email', 'sms'].includes(m.channel) ? m.channel : 'whatsapp',
        tone: typeof m.tone === 'string' ? m.tone : '',
        intent: typeof m.intent === 'string' ? m.intent : '',
        mode: (m.mode === 'reply' || m.mode === 'cold_open') ? m.mode : (hasInbound ? 'reply' : 'cold_open'),
        rationale: typeof m.rationale === 'string' ? m.rationale : '',
      }));

    // estimated_commission_aed — CODE-computed from a real basis ONLY (a linked Deal's
    // commission_value). No basis ⇒ field untouched. The model is never asked for it.
    const dealCommission = (deals || []).map(d => (typeof d.commission_value === 'number' && d.commission_value > 0 && d.stage !== 'lost') ? d.commission_value : 0).reduce((a, b) => Math.max(a, b), 0)
      || (closingDeals || []).map(c => (typeof c.commission_amount_buy_side_aed === 'number' && c.commission_amount_buy_side_aed > 0) ? c.commission_amount_buy_side_aed : (typeof c.commission_amount_aed === 'number' && c.commission_amount_aed > 0 ? c.commission_amount_aed : 0)).reduce((a, b) => Math.max(a, b), 0);
    if (dealCommission > 0) update.estimated_commission_aed = Math.round(dealCommission);

    // Stage recommendation is response-only. Defense-in-depth: the update NEVER carries stage.
    const recommendedStage = (typeof result.recommended_stage === 'string' && STAGES.includes(result.recommended_stage) && result.recommended_stage !== lead.stage)
      ? result.recommended_stage : null;
    delete update.stage;

    await svc.entities.Lead.update(lead.id, update);

    // KEEP IN SYNC (buyer twin of the landlord score-snapshot block): append-only
    // LeadScoreSnapshot — exactly ONE per successful Lead.update, built from the values just
    // written. Non-fatal: a failure here must never break the brain. Forward-only.
    try {
      const bd = update.ai_lead_score_breakdown || {};
      await svc.entities.LeadScoreSnapshot.create({
        lead_id: lead.id,
        captured_at: nowIso,
        overall_score: (update.ai_lead_score != null) ? update.ai_lead_score : null,
        engagement_score: (bd.engagement != null) ? bd.engagement : null,
        intent_score: (bd.need_clarity != null && bd.timeline_urgency != null) ? Math.round((bd.need_clarity + bd.timeline_urgency) / 2) : null,
        budget_alignment_score: (bd.budget_fit != null) ? bd.budget_fit : null,
        property_fit_score: (bd.inventory_match != null) ? bd.inventory_match : null,
        trend: update.ai_score_trend === 'rising' ? 'increasing' : update.ai_score_trend === 'falling' ? 'decreasing' : 'stable',
        risk_factors: (update.ai_red_flags || []).slice(0, 5),
        description: `buyerOrchestrator ${effectiveTier} run (${triggered_by})`,
      });
    } catch (snapErr) {
      console.error('LeadScoreSnapshot create failed (non-fatal):', snapErr?.message);
    }

    return Response.json({
      ok: true,
      tier: effectiveTier,
      model: modelUsed,
      usage,
      duration_ms: Date.now() - runStartedAt,
      recommended_stage: recommendedStage,
      inventory_ids: inventory.ids,
      ...(debug_context ? { debug: { targetProjects, hasInbound, hasActivity, doctrineViolation, msg_count: msgRows.length, packs: { market: !!marketPack, inventory: !!inventory.text, intel: !!intelPack, brief: !!briefPack } } } : {}),
      ...update,
    });
  } catch (error) {
    console.error('buyerOrchestrator error:', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
