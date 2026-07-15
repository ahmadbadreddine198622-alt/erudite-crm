import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// forgeBuyerApproachDrafts — THE BUYER APPROACH FORGE (twin of forgeApproachDrafts).
//
// Auto-invoked every time a Lead Command Center opens. Studies EVERYTHING the buyer brain
// knows — the buyerOrchestrator's intelligence report (scores, deal thesis, next-best-actions,
// rolling summary, momentum), the forged buyer call script (real inventory hooks, objection
// handlers), and the FULL cross-channel conversation history (WhatsApp + Message + iMessage +
// Telegram + Email) — then forges ONE ready-to-send approach draft PER CHANNEL:
//
//   email     — subject + 110-170 word body
//   whatsapp  — 45-90 word conversational message
//   telegram  — 40-80 word direct message
//   sms       — hard <=300 characters, punchy, no links
//   imessage  — 2-4 sentence personal text, <=480 characters
//
// Every draft is written in the lead's preferred language with an English gloss, is DIFFERENT
// on every forge (opening-line history fed back in and banned from reuse, plus a rotating
// strategic angle), and is persisted to Lead.ai_approach_drafts so it renders instantly in the
// LCC composer's draft section. DRAFTS ONLY — this function NEVER sends anything. The agent
// reviews, edits, and sends.
//
// SEPARATE BRAINS BY DESIGN: reads/writes Lead-side entities only — no Landlord reads, no
// PlaybookPrior coupling (buyer LEARN ships later).
//
// Debounce: skipped when drafts were forged < 6h ago AND no new message has arrived on any
// channel since — unless force=true (the Regenerate button). New inbound/outbound activity
// always unlocks a fresh forge so the drafts stay context-aware.

const MODEL = 'claude-opus-4-8';
const DEBOUNCE_HOURS = 6;

// Buyer entry stages — beyond these means an engaged relationship exists.
const ENTRY_STAGES = new Set(['intake_clarify', 'contact_identity', 'new_tenant_lead']);

const ANGLES = [
  'inventory_gift — lead with ONE concrete matched listing from the INVENTORY INTELLIGENCE (building, beds, price) offered as useful information for THEIR stated search',
  'search_empathy — open on the human reality of their search (relocation, family move, first Dubai purchase, investment hunt) and position Erudite as taking the legwork off their plate',
  'market_moment — lead with ONE verified market fact from the intelligence relevant to their target area/budget and what it means for their search right now',
  'direct_principal — a short, confident note from a senior professional who personally tracks inventory in their bracket; minimal, specific, zero pressure, one easy ask',
  'budget_respect — anchor on working seriously WITHIN their stated number (never upsell); one concrete thing you can show them inside it',
  'curiosity_open — a specific, true, intriguing observation about their target area, building, or bracket that makes not replying feel like leaving information on the table',
];

// Follow-up mode angles — used when communication already exists. Same doctrine, different plays.
const FOLLOWUP_ANGLES = [
  'value_drop — deliver ONE fresh verified listing or market insight matched to their search with zero or minimal ask; the information IS the message',
  'thread_advance — pick up the exact last topic and move it one concrete step forward with a specific, easy next action',
  'open_loop_close — close something left open in the history (a question they asked, something we promised, a pending decision)',
  'easy_reentry — a guilt-free, one-line question the lead can answer in five seconds; make replying effortless',
  'time_anchor — anchor on what has genuinely changed since the last exchange (a verified listing/market fact) and why it matters to their search now',
  'direct_status — senior and brief: state plainly where the search stands and the single next step, respectful of their time',
];

const DRAFTS_SCHEMA = {
  type: 'object',
  properties: {
    email: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: "Short subject line in the lead's language." },
        body_native: { type: 'string', description: "Email body in the lead's preferred language. 110-170 words, under ~1,400 characters. Plain text. No signature/footer." },
        body_english_gloss: { type: 'string', description: 'Faithful English translation of body_native (verbatim if already English).' },
      },
      required: ['subject', 'body_native', 'body_english_gloss'],
    },
    whatsapp: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "WhatsApp message in the lead's language. 45-90 words. Conversational but senior. No emojis. One clear ask. Plain text." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    telegram: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "Telegram message in the lead's language. 40-80 words. Slightly more direct than WhatsApp. No emojis. Plain text, no markdown." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    sms: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "SMS in the lead's language. HARD LIMIT 300 characters. Punchy, complete, one ask, sender identity clear from context. No links, no emojis." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    imessage: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "iMessage in the lead's language. 2-4 sentences, 30-70 words, under 480 characters. Reads like a personal text from a senior professional. No subject, no sign-off, no emojis." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    language: { type: 'string', description: 'Language code used for the bodies (e.g. "ru", "en").' },
    angle_used: { type: 'string', description: 'The strategic angle chosen for this forge (short key, e.g. inventory_gift).' },
    opening_lines: {
      type: 'array',
      description: 'The English first sentence of the email body and of the whatsapp body (2 items) — used to prevent repetition on future forges.',
      items: { type: 'string' },
      minItems: 1, maxItems: 3,
    },
  },
  required: ['email', 'whatsapp', 'telegram', 'sms', 'imessage', 'language', 'angle_used', 'opening_lines'],
};

// ── WRITER IDENTITY ── KEEP IN SYNC with buyerOrchestrator's buildWriter/CEO_EMAILS.
// The forge writes as the LOGGED-IN USER in their real CRM position. CEO accounts write in
// Ahmad's first-person CEO voice; every other user writes as themselves, with company strength
// framed as "we/our brokerage" and the CEO's credentials referenced ONLY in third person.
const CEO_EMAILS = ['ahmad.badreddine198622@gmail.com', 'ahmad@erudite-estate.com'];

function buildWriter(u) {
  const email = String(u?.email || '').trim().toLowerCase();
  const isCEO = CEO_EMAILS.includes(email);
  const rawName = String(u?.display_name || u?.full_name || '').trim();
  const name = isCEO ? 'Ahmad Badreddine' : (rawName || 'your Erudite consultant');
  const firstName = name.split(/\s+/)[0];
  const position = isCEO ? 'CEO of Erudite Real Estate' : (String(u?.position || '').trim() || 'Property Consultant');
  return {
    email, isCEO, name, firstName, position,
    brn: String(u?.brn || '').trim(),
    pfUrl: String(u?.pf_profile_url || '').trim(),
    pfRating: u?.pf_rating || null,
    pfDeals: u?.pf_deals_count || null,
    pfDealsLabel: String(u?.pf_deals_value_label || '').trim(),
  };
}

function buildCredibilityBlock(w) {
  if (w.isCEO) {
    return `ERUDITE CREDIBILITY — the ONLY credibility facts you may use. Each MUST be expressed as a benefit to the BUYER/TENANT, never a standalone boast. Weave in only what fits the angle; never list them all, and never repeat the same credibility point across more than two channels in one forge.
- Ahmad Badreddine: SuperAgent on Property Finder, 4.3★ rating, 12+ years in Dubai real estate (since 2014), Dubai BRN 34625, CEO of Erudite Real Estate. Frame as: a senior, accountable principal handling their search personally.
- Erudite is a 25-agent brokerage. Frame as: "25 agents surfacing inventory for you from day one" — never just "we are a big team."
- If a real matched listing appears in the intelligence below, reference THAT specific listing. If none is supplied, speak to access generally — do NOT invent a listing, figure, or transaction.
- Ahmad personally speaks English, Arabic, French, Russian and Mandarin. If the lead's preferred language is one of these, direct-in-their-language is a trust/benefit point.
- Erudite responds within 5 minutes. Frame as reliability FOR THE BUYER, not a slogan.
- Verify-me anchor (email ONLY, never SMS): the Property Finder profile https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264 as a low-key "you are welcome to look me up" line.
- VERIFIED PUBLIC FIGURES: 56 closed deals, AED 87.9M total deals value, 56 sale + 17 rent listings live. Always as buyer-benefit.
HARD GUARDRAIL: NEVER use larger or rounder figures than these. NEVER fabricate or inflate any number, price, date, listing, seller, or transaction. If a fact is not in this block or in the intelligence context below, it does not exist. A generic message is a failure; an invented fact is a catastrophe.`;
  }
  const brnLine = w.brn ? `- Your own RERA BRN ${w.brn} — you may cite it as your personal accountability anchor.\n` : '';
  const pfLine = (w.pfRating || w.pfDeals)
    ? `- Your own Property Finder record${w.pfRating ? `: ${w.pfRating}★` : ''}${w.pfDeals ? `${w.pfRating ? ', ' : ': '}${w.pfDeals} closed deals${w.pfDealsLabel ? ` (${w.pfDealsLabel})` : ''}` : ''} — citable as YOUR personal, checkable track record.\n`
    : '';
  const verifyAnchor = w.pfUrl
    ? `your own Property Finder profile ${w.pfUrl}`
    : `the CEO's public Property Finder profile https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264, referenced explicitly as "our CEO's public profile" — never as your own page`;
  return `WRITER IDENTITY — you are ${w.name}, ${w.position} at Erudite Real Estate, Dubai (Business Bay). Write in first person as ${w.firstName}: a senior, courteous professional. YOU ARE NOT THE CEO — never present yourself as Ahmad Badreddine, and never claim his personal credentials (his rating, his BRN, his languages, his deal counts) as your own.

ERUDITE CREDIBILITY — the ONLY credibility facts you may use. Each MUST be expressed as a benefit to the BUYER/TENANT, never a boast. YOUR personal facts stay first person; COMPANY facts are "we / our brokerage"; the CEO's facts stay strictly THIRD person. Weave in only what fits the angle; never repeat the same credibility point across more than two channels in one forge.
${brnLine}${pfLine}- Erudite Real Estate is a 25-agent Dubai brokerage led by CEO Ahmad Badreddine — SuperAgent on Property Finder, 4.3★, 12+ years in Dubai real estate, BRN 34625. Frame as: their search is backed by a senior accountable principal AND a full inventory-hunting team behind you.
- "25 agents surfacing inventory for you from day one" — always "our team", never claimed as your personal team.
- If a real matched listing appears in the intelligence below, reference THAT specific listing. If none is supplied, speak to access generally — do NOT invent a listing, figure, or transaction.
- Erudite responds within 5 minutes — a company standard; frame as reliability FOR THE BUYER ("we").
- VERIFIED PUBLIC FIGURES (company-level framing ONLY): 56 closed deals, AED 87.9M total deals value, 56 sale + 17 rent listings live — always "a brokerage that has closed…", NEVER "I have closed…".
- Verify-me anchor (email ONLY, never SMS): ${verifyAnchor}.
- Do NOT claim to personally speak the lead's language. If genuinely helpful you may say our team serves clients in English, Arabic, French, Russian and Mandarin — company-level only.
HARD GUARDRAIL: NEVER use larger or rounder figures than these. NEVER fabricate or inflate any number, price, date, listing, seller, or transaction. If a fact is not in this block or in the intelligence context below, it does not exist. A generic message is a failure; an invented fact is a catastrophe.`;
}

const clean = (v) => (v == null ? '' : String(v).trim());
const fmtTs = (ts) => { try { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return ''; } };

function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}

async function callClaude(system, prompt) {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 1,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ name: 'forge_approach_drafts', description: 'Emit the forged multi-channel approach drafts.', input_schema: DRAFTS_SCHEMA }],
    tool_choice: { type: 'tool', name: 'forge_approach_drafts' },
  });
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  return toolBlock ? toolBlock.input : null;
}

// ── INVENTORY INTELLIGENCE — KEEP IN SYNC with buyerOrchestrator's gatherInventoryPack
// (same filter + budget window; compacted to the top 5 for the forge prompt). Degrades to ''.
async function gatherInventoryBlock(svc, lead) {
  try {
    const listingType = lead.intent === 'tenant' ? 'rent' : 'sale';
    const rows = await svc.entities.PFListing.filter({ status: 'active', listing_type: listingType }, '-published_at', 200).catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return '';
    const budgetMin = (typeof lead.budget_min === 'number' && lead.budget_min > 0) ? lead.budget_min : null;
    const budgetMax = (typeof lead.budget_max === 'number' && lead.budget_max > 0) ? lead.budget_max : null;
    const locs = (Array.isArray(lead.preferred_locations) ? lead.preferred_locations : []).map((l) => String(l).toLowerCase());
    const scored = rows.map((r) => {
      let score = 0;
      const price = typeof r.price === 'number' ? r.price : null;
      if (price && budgetMax) {
        if (price >= (budgetMin ?? budgetMax * 0.5) * 0.8 && price <= budgetMax * 1.15) score += 3;
        else if (price <= budgetMax * 1.4) score += 1;
      }
      const loc = String(r.location || r.community || '').toLowerCase();
      if (locs.length && loc && locs.some((l) => loc.includes(l) || l.includes(loc))) score += 2;
      const beds = r.bedrooms;
      if (beds != null && lead.bedrooms_min != null && lead.bedrooms_max != null) {
        const b = Number(String(beds).replace(/\D/g, '') || 0);
        if (b >= lead.bedrooms_min && b <= lead.bedrooms_max) score += 2;
      }
      return { r, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    if (!scored.length) return '';
    const per = lead.intent === 'tenant' ? '/yr' : '';
    const lines = scored.map(({ r }) => `- ${r.title || r.building_name || 'Listing'} · ${r.location || r.community || '?'} · ${r.bedrooms != null ? r.bedrooms + 'BR' : '?'} · ${typeof r.price === 'number' ? 'AED ' + r.price.toLocaleString() + per : 'price ?'}${r.reference_number ? ` · ref ${r.reference_number}` : ''}`);
    return `\nINVENTORY INTELLIGENCE (REAL live listings matched to their search — you may reference THESE facts exactly, never altered, never invented):\n${lines.join('\n')}\n`;
  } catch (_) { return ''; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const { lead_id, force = false } = await req.json();
    if (!lead_id) return Response.json({ ok: false, error: 'lead_id required' }, { status: 400 });

    const lead = await svc.entities.Lead.get(lead_id).catch(() => null);
    if (!lead) return Response.json({ ok: false, error: 'lead not found' }, { status: 404 });
    if (!lead.full_name) return Response.json({ ok: false, error: 'lead has no full_name to address' }, { status: 400 });

    // Cross-invoked runs (probe, sweep, webhooks) arrive as the platform service account —
    // never let "Service" sign a draft: fall back to the ASSIGNED agent (KEEP IN SYNC with
    // buyerOrchestrator's service-caller fallback).
    const isServiceCaller = !user.email || String(user.email).toLowerCase().includes('no-reply.base44.com');
    let writerUser = user;
    if (isServiceCaller) {
      writerUser = (lead.assigned_agent_email
        ? await svc.entities.User.filter({ email: lead.assigned_agent_email }, '-created_date', 1).then((r) => r?.[0]).catch(() => null)
        : null) || { email: '', display_name: '', position: '' };
    }
    const writer = buildWriter(writerUser);
    const credibilityBlock = buildCredibilityBlock(writer);

    // ── Gather cross-channel history (also drives the activity-aware debounce) ──
    const variants = phoneVariants(lead.phone || lead.whatsapp);
    const [waById, waFrom, waTo, msgRows, imMsgs, tgMsgs, emails, notes, reminders, calls1, calls2] = await Promise.all([
      svc.entities.WhatsAppMessage.filter({ lead_id }, '-timestamp', 15).catch(() => []),
      variants.length ? svc.entities.WhatsAppMessage.filter({ from_number: { $in: variants } }, '-timestamp', 10).catch(() => []) : Promise.resolve([]),
      variants.length ? svc.entities.WhatsAppMessage.filter({ to_number: { $in: variants } }, '-timestamp', 10).catch(() => []) : Promise.resolve([]),
      svc.entities.Message.filter({ lead_id, direction: { $in: ['incoming', 'outgoing'] } }, '-timestamp', 15).catch(() => []),
      svc.entities.IMessage.filter({ lead_id }, '-sent_at', 10).catch(() => []),
      svc.entities.TelegramMessage.filter({ lead_id }, '-sent_at', 10).catch(() => []),
      svc.entities.Email.filter({ lead_id }, '-created_date', 5).catch(() => []),
      svc.entities.Note.filter({ linked_lead_id: lead_id }, '-created_date', 6).catch(() => []),
      svc.entities.Reminder.filter({ lead_id }, '-created_date', 5).catch(() => []),
      variants.length ? svc.entities.CallLog.filter({ to_number: { $in: variants } }, '-started_at', 5).catch(() => []) : Promise.resolve([]),
      svc.entities.AircallCall.filter({ lead_id }, '-started_at', 5).catch(() => []),
    ]);

    // Dedupe WhatsApp rows across the id + phone-variant queries.
    const waSeen = new Set();
    const waMsgs = [...(waById || []), ...(waFrom || []), ...(waTo || [])].filter((m) => {
      if (!m || waSeen.has(m.id)) return false;
      waSeen.add(m.id);
      return true;
    });

    // Latest activity timestamp across every channel — new activity unlocks a fresh forge.
    let latestActivity = 0;
    const bump = (ts) => { const t = new Date(ts || 0).getTime(); if (!isNaN(t) && t > latestActivity) latestActivity = t; };
    for (const m of waMsgs) bump(m.timestamp || m.created_date);
    for (const m of (msgRows || [])) bump(m.timestamp || m.created_date);
    for (const m of (imMsgs || [])) bump(m.sent_at || m.created_date);
    for (const m of (tgMsgs || [])) bump(m.sent_at || m.created_date);
    for (const e of (emails || [])) bump(e.created_date);
    for (const n of (notes || [])) bump(n.created_date);
    for (const r of (reminders || [])) bump(r.created_date);

    // ── Activity-aware debounce (Regenerate button passes force=true) ──
    const prev = (lead.ai_approach_drafts && typeof lead.ai_approach_drafts === 'object') ? lead.ai_approach_drafts : null;
    // Identity guard — drafts forged for a different user are never served: the voice must
    // match whoever is on the card right now (CEO voice for the CEO, agent voice for agents).
    const identityChanged = !!prev && String(prev?.forged_for?.email || '').toLowerCase() !== writer.email;
    if (!force && prev && lead.ai_approach_drafts_at) {
      const forgedTs = new Date(lead.ai_approach_drafts_at).getTime();
      const hoursSince = (Date.now() - forgedTs) / 3.6e6;
      const newActivity = latestActivity > forgedTs;
      if (hoursSince < DEBOUNCE_HOURS && !newActivity && !identityChanged) {
        return Response.json({ ok: true, skipped: 'fresh', hours_since: Math.round(hoursSince * 10) / 10, drafts: prev });
      }
    }

    // ── Merge every channel into one chronological stream (drives history + mode detection) ──
    const merged = [];
    for (const m of waMsgs) { const txt = m?.text || m?.caption; if (txt) merged.push({ t: new Date(m.timestamp || m.created_date || 0).getTime(), dir: (m.direction === 'outbound' || m.direction === 'outgoing') ? 'out' : 'in', ch: 'WhatsApp', text: String(txt).slice(0, 300), ts: m.timestamp || m.created_date }); }
    for (const m of (msgRows || [])) { if (m?.text) merged.push({ t: new Date(m.timestamp || m.created_date || 0).getTime(), dir: m.direction === 'outgoing' ? 'out' : 'in', ch: 'WhatsApp', text: String(m.text).slice(0, 300), ts: m.timestamp || m.created_date }); }
    for (const m of (imMsgs || [])) { if (m?.body) merged.push({ t: new Date(m.sent_at || m.created_date || 0).getTime(), dir: m.direction === 'outbound' ? 'out' : 'in', ch: 'iMessage', text: String(m.body).slice(0, 300), ts: m.sent_at || m.created_date }); }
    for (const m of (tgMsgs || [])) { if (m?.body) merged.push({ t: new Date(m.sent_at || m.created_date || 0).getTime(), dir: m.direction === 'outbound' ? 'out' : 'in', ch: 'Telegram', text: String(m.body).slice(0, 300), ts: m.sent_at || m.created_date }); }
    for (const e of (emails || [])) { const preview = (e?.body_text || e?.body || e?.subject || '').replace(/<[^>]+>/g, '').slice(0, 300); if (preview) merged.push({ t: new Date(e.created_date || 0).getTime(), dir: e.direction === 'outbound' ? 'out' : 'in', ch: 'Email', text: preview, ts: e.created_date }); }
    merged.sort((a, b) => a.t - b.t);
    const conversationHistory = merged.slice(-20).map((m) => `[${fmtTs(m.ts)}] ${m.dir === 'out' ? 'Agent' : 'Lead'} (${m.ch}): ${m.text.slice(0, 200)}`).join('\n');

    // ── MODE DETECTION — first approach vs follow-up (same AI mindset, different laws) ──
    const hadCalls = ((calls1 || []).length + (calls2 || []).length) > 0;
    const stageEngaged = !!(lead.stage && !ENTRY_STAGES.has(lead.stage));
    const hasCommunication = merged.length > 0 || hadCalls || stageEngaged;
    const mode = hasCommunication ? 'followup' : 'approach';
    const lastMsg = merged.length ? merged[merged.length - 1] : null;
    let consecutiveOut = 0;
    for (let i = merged.length - 1; i >= 0; i--) { if (merged[i].dir === 'out') consecutiveOut++; else break; }
    const leadEverReplied = merged.some((m) => m.dir === 'in');
    let situation = 'first_contact';
    if (mode === 'followup') {
      if (!merged.length) situation = 'after_call';
      else if (lastMsg.dir === 'in') situation = 'lead_replied_last';
      else situation = leadEverReplied ? 'active_thread_pending' : 'awaiting_first_reply';
    }
    const liveChannel = lastMsg ? lastMsg.ch : (hasCommunication ? 'Phone (calls / offline contact)' : 'none');
    const lastMsgLine = lastMsg ? `[${fmtTs(lastMsg.ts)}] ${lastMsg.dir === 'out' ? 'Agent' : 'Lead'} (${lastMsg.ch}): ${lastMsg.text}` : '(no written messages — prior contact was by phone/other)';
    const SITUATION_LINES = {
      first_contact: 'FIRST CONTACT — no communication yet. Opening strike.',
      lead_replied_last: 'THE LEAD SENT THE LAST MESSAGE AND IT IS UNANSWERED — every draft must respond to it directly and specifically FIRST, then advance exactly one step.',
      awaiting_first_reply: `We have sent ${consecutiveOut} message(s); the lead has NEVER replied. Value-drop energy: deliver something verified and genuinely useful with zero or minimal ask, guilt-free, and SHORTER than the previous message.`,
      active_thread_pending: 'A real two-way conversation exists; our last message awaits a response. Re-enter lightly off the actual thread — one easy, specific question or a fresh value drop. Do not repeat the pending ask verbatim.',
      after_call: 'Prior contact happened by phone (or off-platform); these are the first WRITTEN follow-ups to an existing relationship — acknowledge the contact naturally, never open cold.',
    };
    const fuHints = Array.isArray(lead.ai_suggested_followups) && lead.ai_suggested_followups.length
      ? `BRAIN FOLLOW-UP DOCTRINE HINTS (cadence intent from the orchestrator — honor the spirit):\n${lead.ai_suggested_followups.slice(0, 4).map((f) => `- [${f.channel || 'any'}] ${f.reason || f.template_key || ''}`).join('\n')}`
      : '';

    const notesBlock = (notes || []).filter((n) => n?.body || n?.text).slice(0, 6)
      .map((n) => `- [${fmtTs(n.created_date)}] ${String(n.body || n.text).slice(0, 180)}`).join('\n');

    // ── Call-script intelligence (real inventory hooks, objections) ──
    const cs = (lead.ai_call_script && typeof lead.ai_call_script === 'object') ? lead.ai_call_script : null;
    const csBlock = cs ? [
      Array.isArray(cs.value_hooks) && cs.value_hooks.length ? `REAL VALUE HOOKS (verified figures — you may use these EXACT facts, never altered):\n${cs.value_hooks.map((h) => '- ' + h).join('\n')}` : '',
      Array.isArray(cs.cheat_sheet) && cs.cheat_sheet.length ? `AGENT CHEAT SHEET (context; key figures/facts here are also verified):\n${cs.cheat_sheet.map((h) => '- ' + h).join('\n')}` : '',
      Array.isArray(cs.objection_handlers) && cs.objection_handlers.length ? `KNOWN OBJECTION LANDSCAPE (avoid triggering these; do not rebut them unprompted):\n${cs.objection_handlers.slice(0, 4).map((o) => '- ' + o.objection).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') : '';

    const inventoryBlock = await gatherInventoryBlock(svc, lead);

    // ── Anti-repetition: previous opening lines are banned ──
    const priorOpenings = Array.isArray(prev?.opening_line_history) ? prev.opening_line_history.slice(-10) : [];

    // ── Angle rotation (per mode): exclude the last-used angle, uniform pick.
    // (No PlaybookPrior weighting — buyer LEARN ships later; SEPARATE BRAINS BY DESIGN.)
    const lastAngle = clean(prev?.angle_used);
    const sameModeAsPrev = clean(prev?.mode || 'approach') === mode;
    const basePool = mode === 'followup' ? FOLLOWUP_ANGLES : ANGLES;
    let pool = basePool.filter((a) => !(sameModeAsPrev && lastAngle) || !a.startsWith(lastAngle));
    if (!inventoryBlock) pool = pool.filter((a) => !a.startsWith('inventory_gift'));
    if (!pool.length) pool = basePool.slice();
    const chosenAngle = pool[Math.floor(Math.random() * pool.length)];

    const lang = lead.preferred_language || 'en';
    const firstName = lead.full_name ? lead.full_name.split(' ')[0] : 'there';
    const isRentTrack = lead.intent === 'tenant';
    const nbaTop = Array.isArray(lead.ai_next_best_actions) && lead.ai_next_best_actions.length ? lead.ai_next_best_actions[0] : null;

    // Mode-specific law block — injected into the system prompt. Same doctrine, different discipline.
    const modeLaw = mode === 'followup'
      ? `MODE: FOLLOW-UP — communication already exists. FOLLOW-UP LAWS:
- BANNED PHRASES in any language: "just following up", "just checking in", "gentle reminder", "circling back", "did you get my message", or any apology for writing again.
- NEVER re-introduce yourself or the company as if this were first contact — the relationship exists. A channel switch is a fresh surface, never a fresh stranger.
- Anchor every draft in the REAL last exchange (supplied below). If the lead's last message is unanswered, ANSWER it first — directly and specifically — before anything else.
- Advance exactly ONE concrete step from where things actually stand; when the lead is silent, the verified value IS the message (zero or minimal ask).
- Every follow-up is SHORTER than a first approach. The more silence, the lighter the touch — never heavier, never needier.
- The conversation lives primarily on ${liveChannel}; that channel's draft is the direct continuation of the thread. The other channels adapt to their medium while still acknowledging the existing relationship.`
      : `MODE: FIRST APPROACH — no prior communication. This is the opening strike: introduce naturally, lead with verified value, earn the reply, land ONE easy ask.`;

    const trackLaw = isRentTrack
      ? `RENT TRACK: this lead is a TENANT. Money means ANNUAL RENT — every budget figure is AED/year${lead.cheques_count ? ` (prefers ${lead.cheques_count} cheques/yr)` : ''}, NEVER a purchase price. Move-in timing drives urgency. Matched inventory is RENT listings. Never talk purchase, ROI, or capital appreciation to a tenant.`
      : lead.intent === 'buyer'
        ? `SALE TRACK: this lead is a BUYER. Budget figures are purchase capital.`
        : `TRACK UNKNOWN (intake): do not assume buy vs rent — the drafts may gently clarify which one they mean, but never both frames at once.`;

    const systemPrompt = `You are ${writer.name}, ${writer.position}${writer.isCEO ? '' : ' at Erudite Real Estate'} in Dubai, forging FIVE ready-to-send outreach drafts — one per channel (email, WhatsApp, Telegram, SMS, iMessage) — for the same property ${isRentTrack ? 'TENANT' : 'BUYER'} lead, in a single pass. You write like a senior, courteous ${writer.isCEO ? 'principal' : 'professional'}: concise, specific, never salesy, never a template.

${credibilityBlock}

THE FIVE CHANNELS ARE NOT COPIES OF EACH OTHER. Same strategic angle, five genuinely different executions, each native to its medium:
- EMAIL: subject in the lead's language + 110-170 word body (< ~1,400 chars). The fullest expression of the angle. May carry ONE verify-me link.
- WHATSAPP: 45-90 words. Conversational but senior. One clear ask. No links unless essential, no emojis.
- TELEGRAM: 40-80 words. Slightly more direct and compact than WhatsApp. Plain text, no markdown, no emojis.
- SMS: HARD LIMIT 300 characters. Every word earns its place. One fact or hook + one ask + who you are. No links, no emojis.
- IMESSAGE: 2-4 sentences, 30-70 words, < 480 characters. A personal text from a senior professional. First name only if natural. No sign-off.

${modeLaw}

${trackLaw}

GLOBAL RULES:
- Write every body in the lead's preferred language (code below); produce a faithful English gloss for each (verbatim if already English).
- Be specific to their stated search (budget, areas, beds). A generic message is a failure.
- Tone: senior, courteous, human. No emojis anywhere. No exclamation-heavy hype. No "I hope this message finds you well."
- NEVER fabricate a fact, figure, listing, seller, price, or date. Only the credibility block and the verified intelligence below exist.
- No signature, sign-off block, or contact footer on ANY channel — the send layer appends identity. End on the last substantive sentence. (SMS/iMessage may name ${writer.firstName}/Erudite inside the message so the recipient knows who is writing.)
- Exactly ONE ask per message, and it must be concrete (a specific call slot, a yes/no question, a simple reply).
- If prior conversation history exists, every draft must read as a natural continuation: never repeat what was already sent, never contradict what the lead said, never re-introduce yourself to someone who already knows you.
- ANTI-TEMPLATE LAW: the BANNED OPENING LINES below were used before. Every new opening must be structurally different from all of them — different first word class, different hook type, different rhythm. Vary sentence shapes across the five drafts; no two drafts may share their first six words.`;

    const userPrompt = `Forge the five ${mode === 'followup' ? 'FOLLOW-UP' : 'approach'} drafts now.

STRATEGIC ANGLE FOR THIS FORGE (build all five drafts around it): ${chosenAngle}
VARIATION SEED: ${Math.floor(Math.random() * 100000)} (use to vary structure and rhythm, never to invent facts)
MODE: ${mode.toUpperCase()}
SITUATION: ${SITUATION_LINES[situation]}

LEAD & SEARCH (real facts only):
- Lead: ${lead.full_name} (first name: ${firstName})
- Nationality: ${lead.nationality || 'unknown'} · Residence: ${lead.residence_country || 'unknown'}
- Track: ${isRentTrack ? 'RENT (tenant)' : lead.intent === 'buyer' ? 'SALE (buyer)' : 'unknown (intake)'} · Transaction: ${lead.transaction_type || 'unknown'}
- Budget: ${lead.budget_min || lead.budget_max ? `AED ${(lead.budget_min || 0).toLocaleString()} – ${(lead.budget_max || 0).toLocaleString()}${isRentTrack ? ' PER YEAR (annual rent)' : ''}` : '(not stated — do not invent)'}
- Requirements: ${lead.bedrooms_min ?? '?'}–${lead.bedrooms_max ?? '?'} BR · Areas: ${(lead.preferred_locations || []).join(', ') || '(none stated)'} · Timeline: ${lead.move_in_timeline || 'unknown'}
- Financing: ${lead.financing_method || lead.financing_type || 'unknown'}
- Stage: ${lead.stage || 'unknown'} · Source: ${lead.source || 'unknown'}
- Preferred language code (write all bodies in this): ${lang}

BRAIN INTELLIGENCE (the report — calibrate strategy and tone from this):
- Rolling summary: ${lead.ai_rolling_summary || '(none)'}
- Deal thesis: ${lead.ai_deal_thesis || '(none)'}
- Next best action: ${nbaTop ? `${nbaTop.action || ''} — ${nbaTop.reasoning || ''}` : '(none)'}
- Coaching: ${lead.ai_coaching_for_agent || '(none)'}
- Momentum: ${lead.ai_momentum || '(none)'} · Lead score ${lead.ai_lead_score ?? '?'} / Conversion ${lead.ai_conversion_probability ?? '?'}
- Buying signals: ${Array.isArray(lead.ai_buying_signals) && lead.ai_buying_signals.length ? lead.ai_buying_signals.join('; ') : '(none recorded)'}
- Red flags (landmines — avoid stepping on them): ${Array.isArray(lead.ai_red_flags) && lead.ai_red_flags.length ? lead.ai_red_flags.join('; ') : '(none recorded)'}

${csBlock ? `VERIFIED CALL-SCRIPT INTELLIGENCE:\n${csBlock}\n` : ''}${inventoryBlock}
${notesBlock ? `AGENT NOTES (internal context; never quote back to the lead):\n${notesBlock}\n` : ''}
CONVERSATION HISTORY — ALL CHANNELS (chronological, most recent last):
${conversationHistory || '(no written messages on record)'}
${mode === 'followup' ? `
LAST EXCHANGE — THE ANCHOR (never ignore this; if it is the lead speaking, answer it first):
${lastMsgLine}
UNANSWERED OUTBOUND TOUCHES IN A ROW: ${consecutiveOut}
${fuHints}` : ''}

BANNED OPENING LINES (used in previous forges — every new opening must differ structurally from ALL of these):
${priorOpenings.length ? priorOpenings.map((o) => '- ' + o).join('\n') : '(none yet — this is the first forge)'}

Produce all five drafts, the language code ("${lang}"), the angle key used, and the English first sentences of the email and whatsapp bodies as opening_lines.`;

    const result = await callClaude(systemPrompt, userPrompt);
    if (!result || !result.email?.body_native || !result.whatsapp?.body_native || !result.telegram?.body_native || !result.sms?.body_native || !result.imessage?.body_native) {
      return Response.json({ ok: false, error: 'approach forge failed' }, { status: 502 });
    }

    // SMS hard-limit safety: truncate at a sentence boundary if the model overshoots.
    let smsBody = String(result.sms.body_native || '');
    if (smsBody.length > 320) {
      const cut = smsBody.slice(0, 300);
      const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'), cut.lastIndexOf('!'));
      smsBody = lastStop > 120 ? cut.slice(0, lastStop + 1) : cut;
    }

    const englishGloss = (obj) => (lang === 'en' ? (obj.body_native || '') : (obj.body_english_gloss || ''));
    const nowIso = new Date().toISOString();
    const openingHistory = [...priorOpenings, ...(Array.isArray(result.opening_lines) ? result.opening_lines : [])]
      .map((s) => String(s).slice(0, 160)).filter(Boolean).slice(-12);

    const drafts = {
      email: { subject: result.email.subject || '', body_native: result.email.body_native, body_english_gloss: englishGloss(result.email) },
      whatsapp: { body_native: result.whatsapp.body_native, body_english_gloss: englishGloss(result.whatsapp) },
      telegram: { body_native: result.telegram.body_native, body_english_gloss: englishGloss(result.telegram) },
      sms: { body_native: smsBody, body_english_gloss: lang === 'en' ? smsBody : (result.sms.body_english_gloss || '') },
      imessage: { body_native: result.imessage.body_native, body_english_gloss: englishGloss(result.imessage) },
      mode,
      situation,
      forged_for: { email: writer.email, name: writer.name, position: writer.position, is_ceo: writer.isCEO },
      language: result.language || lang,
      angle_used: result.angle_used || chosenAngle.split(' ')[0],
      opening_line_history: openingHistory,
      forged_at: nowIso,
      model: MODEL,
    };

    await svc.entities.Lead.update(lead_id, {
      ai_approach_drafts: drafts,
      ai_approach_drafts_at: nowIso,
    });

    return Response.json({ ok: true, forged: true, drafts });
  } catch (error) {
    console.error('forgeBuyerApproachDrafts error:', error);
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
});
