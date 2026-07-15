import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// forgeApproachDrafts — THE APPROACH FORGE.
//
// Auto-invoked every time a landlord card is opened. Studies EVERYTHING the system knows —
// the orchestrator's intelligence report (scores, deal thesis, next-best-action, rolling
// summary), the forged AI call script (real DLD deed comps, value hooks, objection handlers,
// portfolio probe), any active Founder Directives, and the FULL cross-channel conversation
// history (WhatsApp + iMessage + Telegram + Email) — then forges ONE ready-to-send approach
// draft PER TELECOMMUNICATION CHANNEL:
//
//   email     — subject + 110-170 word body
//   whatsapp  — 45-90 word conversational message
//   telegram  — 40-80 word direct message
//   sms       — hard <=300 characters, punchy, no links
//   imessage  — 2-4 sentence personal text, <=480 characters
//
// Every draft is written in the owner's preferred language with an English gloss, is
// DIFFERENT on every forge (opening-line history is fed back in and banned from reuse,
// plus a rotating strategic angle), and is persisted to Landlord.ai_approach_drafts so it
// renders instantly in each channel composer's draft section. DRAFTS ONLY — this function
// NEVER sends anything. The agent reviews, edits, and sends.
//
// Debounce: skipped when drafts were forged < 6h ago AND no new message has arrived on any
// channel since — unless force=true (the Regenerate button). New inbound/outbound activity
// always unlocks a fresh forge so the drafts stay context-aware.

const MODEL = 'claude-opus-4-8';
const DEBOUNCE_HOURS = 6;

const ANGLES = [
  'value_gift — lead with ONE concrete deed comp / market figure from the intelligence, offered as useful information about THEIR asset',
  'archetype_empathy — open on the human reality of their situation (relocation, overseas ownership, inherited unit...) and position Erudite as taking the property side off their plate',
  'project_moment — lead with ONE concrete project/brand catalyst from the intelligence (a mall opening, sold-out status, resale-only entry) and what it means for their unit right now',
  'direct_principal — a short, confident note from a senior principal who follows this exact unit; minimal, specific, zero pressure, one easy ask',
  'portfolio_lens — when the intelligence shows multiple units, open on the WHOLE portfolio picture and offer one consolidated read',
  'curiosity_open — open with a specific, true, intriguing observation about their unit or building that makes not replying feel like leaving information on the table',
];

// Follow-up mode angles — used when communication already exists. Same doctrine, different plays.
const FOLLOWUP_ANGLES = [
  'value_drop — deliver ONE fresh verified figure or insight about their asset with zero or minimal ask; the information IS the message',
  'thread_advance — pick up the exact last topic and move it one concrete step forward with a specific, easy next action',
  'open_loop_close — close something left open in the history (a question they asked, something we promised, a pending decision)',
  'easy_reentry — a guilt-free, one-line question the owner can answer in five seconds; make replying effortless',
  'time_anchor — anchor on what has genuinely changed since the last exchange (a verified market/project fact) and why it matters to them now',
  'direct_status — senior and brief: state plainly where things stand and the single next step, respectful of their time',
];

const DRAFTS_SCHEMA = {
  type: 'object',
  properties: {
    email: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: "Short subject line in the owner's language." },
        body_native: { type: 'string', description: "Email body in the owner's preferred language. 110-170 words, under ~1,400 characters. Plain text. No signature/footer." },
        body_english_gloss: { type: 'string', description: 'Faithful English translation of body_native (verbatim if already English).' },
      },
      required: ['subject', 'body_native', 'body_english_gloss'],
    },
    whatsapp: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "WhatsApp message in the owner's language. 45-90 words. Conversational but senior. No emojis. One clear ask. Plain text." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    telegram: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "Telegram message in the owner's language. 40-80 words. Slightly more direct than WhatsApp. No emojis. Plain text, no markdown." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    sms: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "SMS in the owner's language. HARD LIMIT 300 characters. Punchy, complete, one ask, sender identity clear from context. No links, no emojis." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    imessage: {
      type: 'object',
      properties: {
        body_native: { type: 'string', description: "iMessage in the owner's language. 2-4 sentences, 30-70 words, under 480 characters. Reads like a personal text from a senior professional. No subject, no sign-off, no emojis." },
        body_english_gloss: { type: 'string' },
      },
      required: ['body_native', 'body_english_gloss'],
    },
    language: { type: 'string', description: 'Language code used for the bodies (e.g. "ru", "en").' },
    angle_used: { type: 'string', description: 'The strategic angle chosen for this forge (short key, e.g. value_gift).' },
    opening_lines: {
      type: 'array',
      description: 'The English first sentence of the email body and of the whatsapp body (2 items) — used to prevent repetition on future forges.',
      items: { type: 'string' },
      minItems: 1, maxItems: 3,
    },
  },
  required: ['email', 'whatsapp', 'telegram', 'sms', 'imessage', 'language', 'angle_used', 'opening_lines'],
};

// ── WRITER IDENTITY ── the forge writes as the LOGGED-IN USER, in their real CRM position.
// CEO accounts write in Ahmad's first-person CEO voice with his personal credentials; every
// other user writes as themselves (display_name/full_name + their User.position), with company
// strength framed as "we/our brokerage" and the CEO's credentials referenced ONLY in third
// person. Identities are never mixed; a change of user re-forges the drafts in the new voice.
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
    return `ERUDITE CREDIBILITY — the ONLY credibility facts you may use. Each MUST be expressed as an owner-benefit, never a standalone boast. Weave in only what fits the angle; never list them all, and never repeat the same credibility point across more than two channels in one forge.
- Ahmad Badreddine: SuperAgent on Property Finder, 4.3★ rating, 12+ years in Dubai real estate (since 2014), Dubai BRN 34625, CEO of Erudite Real Estate. Frame as: a senior, accountable principal handling the owner's unit personally.
- Erudite is a 25-agent brokerage. Frame as: "25 active buyer-handlers working your unit from day one" — never just "we are a big team."
- Peninsula specialists with a real track record. If a real comp appears in the intelligence below, reference THAT specific comp. If none is supplied, speak to specialization generally — do NOT invent a comp, figure, or transaction.
- Ahmad personally speaks English, Arabic, French, Russian and Mandarin. If the owner's preferred language is one of these, direct-in-their-language is a trust/benefit point.
- Erudite responds within 5 minutes. Frame as reliability FOR THE OWNER, not a slogan.
- Verify-me anchor (email ONLY, never SMS): the Property Finder profile https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264 as a low-key "you are welcome to look me up" line.
- VERIFIED PUBLIC FIGURES: 56 closed deals, AED 87.9M total deals value, 56 sale + 17 rent listings live. Always as owner-benefit.
HARD GUARDRAIL: NEVER use larger or rounder figures than these. NEVER fabricate or inflate any number, price, date, comp, buyer, or transaction. If a fact is not in this block or in the intelligence context below, it does not exist. A generic message is a failure; an invented fact is a catastrophe.`;
  }
  const brnLine = w.brn ? `- Your own RERA BRN ${w.brn} — you may cite it as your personal accountability anchor.\n` : '';
  const pfLine = (w.pfRating || w.pfDeals)
    ? `- Your own Property Finder record${w.pfRating ? `: ${w.pfRating}★` : ''}${w.pfDeals ? `${w.pfRating ? ', ' : ': '}${w.pfDeals} closed deals${w.pfDealsLabel ? ` (${w.pfDealsLabel})` : ''}` : ''} — citable as YOUR personal, checkable track record.\n`
    : '';
  const verifyAnchor = w.pfUrl
    ? `your own Property Finder profile ${w.pfUrl}`
    : `the CEO's public Property Finder profile https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264, referenced explicitly as "our CEO's public profile" — never as your own page`;
  return `WRITER IDENTITY — you are ${w.name}, ${w.position} at Erudite Real Estate, Dubai (Business Bay). Write in first person as ${w.firstName}: a senior, courteous professional. YOU ARE NOT THE CEO — never present yourself as Ahmad Badreddine, and never claim his personal credentials (his rating, his BRN, his languages, his deal counts) as your own.

ERUDITE CREDIBILITY — the ONLY credibility facts you may use. Each MUST be expressed as an owner-benefit, never a boast. YOUR personal facts stay first person; COMPANY facts are "we / our brokerage"; the CEO's facts stay strictly THIRD person. Weave in only what fits the angle; never repeat the same credibility point across more than two channels in one forge.
${brnLine}${pfLine}- Erudite Real Estate is a 25-agent Dubai brokerage led by CEO Ahmad Badreddine — SuperAgent on Property Finder, 4.3★, 12+ years in Dubai real estate, BRN 34625. Frame as: the owner's unit is backed by a senior accountable principal AND a full buyer-handling team behind you.
- "25 active buyer-handlers working your unit from day one" — always "our team", never claimed as your personal team.
- Peninsula specialists with a real track record. If a real comp appears in the intelligence below, reference THAT specific comp. If none is supplied, speak to specialization generally — do NOT invent a comp, figure, or transaction.
- Erudite responds within 5 minutes — a company standard; frame as reliability FOR THE OWNER ("we").
- VERIFIED PUBLIC FIGURES (company-level framing ONLY): 56 closed deals, AED 87.9M total deals value, 56 sale + 17 rent listings live — always "a brokerage that has closed…", NEVER "I have closed…".
- Verify-me anchor (email ONLY, never SMS): ${verifyAnchor}.
- Do NOT claim to personally speak the owner's language. If genuinely helpful you may say our team serves clients in English, Arabic, French, Russian and Mandarin — company-level only.
HARD GUARDRAIL: NEVER use larger or rounder figures than these. NEVER fabricate or inflate any number, price, date, comp, buyer, or transaction. If a fact is not in this block or in the intelligence context below, it does not exist. A generic message is a failure; an invented fact is a catastrophe.`;
}

const clean = (v) => (v == null ? '' : String(v).trim());
const fmtTs = (ts) => { try { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return ''; } };

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

// ── PLAYBOOK PRIORS (BRAIN V4 P3 LEARN, Phase 2) ──────────────────────────────
// Measured reply-rate priors from the outcome ledger (PlaybookPrior, compiled nightly).
// Used two ways: (1) the angle pick is WEIGHTED by measured per-angle reply rates (uniform
// when no priors exist — exploration never dies); (2) a compact priors block is injected into
// the prompt so channel emphasis and framing honor real data. Degrades to empty on any error.

// nationality bucketing — KEEP IN SYNC across compileBrainPriors, landlordOrchestrator,
// forgeApproachDrafts (V4 sync group #3).
function natBucket(nationality) {
  const s = String(nationality || '').toLowerCase();
  if (!s) return 'unknown';
  if (/(russia|belarus|ukrain|kazakh|uzbek|azerbaij|armeni|georgi|kyrgyz|tajik|turkmen|moldov)/.test(s)) return 'russian_cis';
  if (/(emirat|saudi|kuwait|qatar|bahrain|oman)/.test(s)) return 'gcc';
  if (/(india|pakistan|banglade|sri lanka|nepal)/.test(s)) return 'south_asia';
  if (/(china|chinese|hong kong|taiwan|japan|korea|singapor|vietnam|thai|malays|indones|philipp)/.test(s)) return 'east_asia';
  if (/(british|united kingdom|uk\b|english|irish|french|german|italian|spanish|dutch|belgi|swiss|austri|swed|norw|danish|finn|portug|greek|polish|czech|romanian|hungar)/.test(s)) return 'western_europe';
  if (/(american|united states|usa|canad|mexic|brazil|argentin|chile|colomb)/.test(s)) return 'americas';
  if (/(egypt|leban|jordan|syria|iraq|iran|turk|morocc|tunis|alger|libya)/.test(s)) return 'mena';
  if (/(nigeri|kenya|south africa|ghana|ethiop)/.test(s)) return 'africa';
  return 'other';
}

let FORGE_PRIORS_CACHE = { at: 0, rows: [] };
const FORGE_PRIORS_CACHE_MS = 10 * 60 * 1000;

// Returns { anglePriors: Map<angleKey,{reply_rate,sample_size,low_confidence}>, block: string }.
async function gatherForgePriors(svc, landlord) {
  try {
    if (Date.now() - FORGE_PRIORS_CACHE.at > FORGE_PRIORS_CACHE_MS) {
      const rows = await svc.entities.PlaybookPrior.filter({}, '-sample_size', 500).catch(() => []);
      FORGE_PRIORS_CACHE = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
    }
    const arch = landlord.landlord_archetype || '';
    const nb = natBucket(landlord.nationality);
    const relevant = FORGE_PRIORS_CACHE.rows
      .map((p) => {
        let spec = 0;
        if (p.landlord_archetype !== 'any') { if (p.landlord_archetype !== arch) return null; spec++; }
        if (p.nationality_bucket !== 'any') { if (p.nationality_bucket !== nb) return null; spec++; }
        if (p.project_name !== 'any') return null; // forge keeps priors cohort-level, not per project
        return { p, spec };
      })
      .filter(Boolean)
      .sort((a, b) => (b.spec - a.spec) || ((b.p.sample_size || 0) - (a.p.sample_size || 0)));
    const anglePriors = new Map();
    for (const { p } of relevant) {
      if (p.angle_used !== 'any' && !anglePriors.has(p.angle_used)) {
        anglePriors.set(p.angle_used, { reply_rate: p.reply_rate, sample_size: p.sample_size, low_confidence: !!p.low_confidence });
      }
    }
    const top = relevant.slice(0, 5);
    const block = top.length ? `MEASURED OUTREACH PRIORS (this brokerage's own reply data — honor them in channel emphasis and framing; never present a LOW CONFIDENCE prior as fact):\n${top.map(({ p }) => {
      const dims = [p.channel !== 'any' ? p.channel : null, p.angle_used !== 'any' ? `angle:${p.angle_used}` : null, p.landlord_archetype !== 'any' ? p.landlord_archetype : null, p.nationality_bucket !== 'any' ? p.nationality_bucket : null].filter(Boolean).join(' × ');
      const rr = typeof p.reply_rate === 'number' ? `${Math.round(p.reply_rate * 100)}% reply rate` : 'reply rate n/a';
      const hr = typeof p.best_hour_dubai === 'number' ? `, best hour ${String(p.best_hour_dubai).padStart(2, '0')}:00 Dubai` : '';
      return `- [${dims}] ${rr} (n=${p.sample_size}${hr})${p.low_confidence ? ' — LOW CONFIDENCE' : ''}`;
    }).join('\n')}` : '';
    return { anglePriors, block };
  } catch (_) { return { anglePriors: new Map(), block: '' }; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const writer = buildWriter(user);
    const credibilityBlock = buildCredibilityBlock(writer);

    const { landlord_id, force = false } = await req.json();
    if (!landlord_id) return Response.json({ ok: false, error: 'landlord_id required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const landlord = await svc.entities.Landlord.get(landlord_id).catch(() => null);
    if (!landlord) return Response.json({ ok: false, error: 'landlord not found' }, { status: 404 });
    if (!landlord.full_name_en) return Response.json({ ok: false, error: 'landlord has no full_name_en to address' }, { status: 400 });

    // ── Gather cross-channel history (also drives the activity-aware debounce) ──
    const [waMsgs, imMsgs, tgMsgs, emails, notes, directives, calls1, calls2, tasksA, apptsA] = await Promise.all([
      svc.entities.Message.filter({ landlord_id, direction: { $in: ['incoming', 'outgoing'] } }, '-timestamp', 15).catch(() => []),
      svc.entities.IMessage.filter({ landlord_id }, '-sent_at', 10).catch(() => []),
      svc.entities.TelegramMessage.filter({ landlord_id }, '-sent_at', 10).catch(() => []),
      svc.entities.Email.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      svc.entities.LandlordNote.filter({ landlord_id }, '-created_date', 6).catch(() => []),
      svc.entities.LandlordDirective.filter({ landlord_id, status: 'active' }, '-created_date', 3).catch(() => []),
      svc.entities.CallLog.filter({ landlord_id }, '-started_at', 5).catch(() => []),
      svc.entities.AircallCall.filter({ landlord_id }, '-started_at', 5).catch(() => []),
      svc.entities.LandlordTask.filter({ landlord_id }, '-created_date', 3).catch(() => []),
      svc.entities.LandlordAppointment.filter({ landlord_id }, '-created_date', 3).catch(() => []),
    ]);

    // Latest activity timestamp across every channel — new activity unlocks a fresh forge.
    let latestActivity = 0;
    const bump = (ts) => { const t = new Date(ts || 0).getTime(); if (!isNaN(t) && t > latestActivity) latestActivity = t; };
    for (const m of (waMsgs || [])) bump(m.timestamp || m.created_date);
    for (const m of (imMsgs || [])) bump(m.sent_at || m.created_date);
    for (const m of (tgMsgs || [])) bump(m.sent_at || m.created_date);
    for (const e of (emails || [])) bump(e.created_date);
    // New tasks, notes, and appointments also unlock a fresh forge — they are information too.
    for (const n of (notes || [])) bump(n.created_date);
    for (const t of (tasksA || [])) bump(t.created_date);
    for (const a of (apptsA || [])) bump(a.created_date);

    // ── Activity-aware debounce (Regenerate button passes force=true) ──
    const prev = (landlord.ai_approach_drafts && typeof landlord.ai_approach_drafts === 'object') ? landlord.ai_approach_drafts : null;
    // Identity guard — drafts forged for a different user are never served: the voice must
    // match whoever is on the card right now (CEO voice for the CEO, agent voice for agents).
    const identityChanged = !!prev && String(prev?.forged_for?.email || '').toLowerCase() !== writer.email;
    if (!force && prev && landlord.ai_approach_drafts_at) {
      const forgedTs = new Date(landlord.ai_approach_drafts_at).getTime();
      const hoursSince = (Date.now() - forgedTs) / 3.6e6;
      const newActivity = latestActivity > forgedTs;
      if (hoursSince < DEBOUNCE_HOURS && !newActivity && !identityChanged) {
        return Response.json({ ok: true, skipped: 'fresh', hours_since: Math.round(hoursSince * 10) / 10, drafts: prev });
      }
    }

    // ── Merge every channel into one chronological stream (drives history + mode detection) ──
    const merged = [];
    for (const m of (waMsgs || [])) { if (m?.text) merged.push({ t: new Date(m.timestamp || m.created_date || 0).getTime(), dir: m.direction === 'outgoing' ? 'out' : 'in', ch: 'WhatsApp', text: String(m.text).slice(0, 300), ts: m.timestamp || m.created_date }); }
    for (const m of (imMsgs || [])) { if (m?.body) merged.push({ t: new Date(m.sent_at || m.created_date || 0).getTime(), dir: m.direction === 'outbound' ? 'out' : 'in', ch: 'iMessage', text: String(m.body).slice(0, 300), ts: m.sent_at || m.created_date }); }
    for (const m of (tgMsgs || [])) { if (m?.body) merged.push({ t: new Date(m.sent_at || m.created_date || 0).getTime(), dir: m.direction === 'outbound' ? 'out' : 'in', ch: 'Telegram', text: String(m.body).slice(0, 300), ts: m.sent_at || m.created_date }); }
    for (const e of (emails || [])) { const preview = (e?.body_text || e?.body || e?.subject || '').replace(/<[^>]+>/g, '').slice(0, 300); if (preview) merged.push({ t: new Date(e.created_date || 0).getTime(), dir: e.direction === 'outbound' ? 'out' : 'in', ch: 'Email', text: preview, ts: e.created_date }); }
    merged.sort((a, b) => a.t - b.t);
    const conversationHistory = merged.slice(-20).map((m) => `[${fmtTs(m.ts)}] ${m.dir === 'out' ? 'Agent' : 'Owner'} (${m.ch}): ${m.text.slice(0, 200)}`).join('\n');

    // ── MODE DETECTION — first approach vs follow-up (same AI mindset, different laws) ──
    const hadCalls = ((calls1 || []).length + (calls2 || []).length) > 0;
    const stageBeyondAttempt = !!(landlord.stage && landlord.stage !== 'initial_contact' && landlord.stage !== 'attempted_to_contact');
    const hasCommunication = merged.length > 0 || hadCalls || stageBeyondAttempt;
    const mode = hasCommunication ? 'followup' : 'approach';
    const lastMsg = merged.length ? merged[merged.length - 1] : null;
    let consecutiveOut = 0;
    for (let i = merged.length - 1; i >= 0; i--) { if (merged[i].dir === 'out') consecutiveOut++; else break; }
    const ownerEverReplied = merged.some((m) => m.dir === 'in');
    let situation = 'first_contact';
    if (mode === 'followup') {
      if (!merged.length) situation = 'after_call';
      else if (lastMsg.dir === 'in') situation = 'owner_replied_last';
      else situation = ownerEverReplied ? 'active_thread_pending' : 'awaiting_first_reply';
    }
    const liveChannel = lastMsg ? lastMsg.ch : (hasCommunication ? 'Phone (calls / offline contact)' : 'none');
    const lastMsgLine = lastMsg ? `[${fmtTs(lastMsg.ts)}] ${lastMsg.dir === 'out' ? 'Agent' : 'Owner'} (${lastMsg.ch}): ${lastMsg.text}` : '(no written messages — prior contact was by phone/other)';
    const SITUATION_LINES = {
      first_contact: 'FIRST CONTACT — no communication yet. Opening strike.',
      owner_replied_last: 'THE OWNER SENT THE LAST MESSAGE AND IT IS UNANSWERED — every draft must respond to it directly and specifically FIRST, then advance exactly one step.',
      awaiting_first_reply: `We have sent ${consecutiveOut} message(s); the owner has NEVER replied. Value-drop energy: deliver something verified and genuinely useful with zero or minimal ask, guilt-free, and SHORTER than the previous message.`,
      active_thread_pending: 'A real two-way conversation exists; our last message awaits a response. Re-enter lightly off the actual thread — one easy, specific question or a fresh value drop. Do not repeat the pending ask verbatim.',
      after_call: 'Prior contact happened by phone (or off-platform); these are the first WRITTEN follow-ups to an existing relationship — acknowledge the contact naturally, never open cold.',
    };
    const fuHints = Array.isArray(landlord.ai_suggested_followups) && landlord.ai_suggested_followups.length
      ? `BRAIN FOLLOW-UP DOCTRINE HINTS (cadence intent from the orchestrator — honor the spirit):\n${landlord.ai_suggested_followups.slice(0, 4).map((f) => `- [${f.channel || 'any'}] ${f.reason || f.template_key || ''}`).join('\n')}`
      : '';

    const notesBlock = (notes || []).filter((n) => n?.body || n?.text).slice(0, 6)
      .map((n) => `- [${fmtTs(n.created_date)}] ${String(n.body || n.text).slice(0, 180)}`).join('\n');

    const directiveBlock = (directives || []).filter((d) => d?.directive_text)
      .map((d) => `- [${(d.priority || 'normal').toUpperCase()}] ${String(d.directive_text).slice(0, 400)}`).join('\n');

    // ── Call-script intelligence (real deed comps, hooks, objections, portfolio) ──
    const cs = (landlord.ai_call_script && typeof landlord.ai_call_script === 'object') ? landlord.ai_call_script : null;
    const csBlock = cs ? [
      Array.isArray(cs.value_hooks) && cs.value_hooks.length ? `REAL VALUE HOOKS (verified figures — you may use these EXACT facts, never altered):\n${cs.value_hooks.map((h) => '- ' + h).join('\n')}` : '',
      Array.isArray(cs.cheat_sheet) && cs.cheat_sheet.length ? `AGENT CHEAT SHEET (context; key figures/facts here are also verified):\n${cs.cheat_sheet.map((h) => '- ' + h).join('\n')}` : '',
      cs.portfolio_probe ? `PORTFOLIO INTEL: ${cs.portfolio_probe}` : '',
      Array.isArray(cs.objection_handlers) && cs.objection_handlers.length ? `KNOWN OBJECTION LANDSCAPE (avoid triggering these; do not rebut them unprompted):\n${cs.objection_handlers.slice(0, 4).map((o) => '- ' + o.objection).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') : '';

    // ── Anti-repetition: previous opening lines are banned ──
    const priorOpenings = Array.isArray(prev?.opening_line_history) ? prev.opening_line_history.slice(-10) : [];

    // ── Angle rotation (per mode): exclude the last-used angle, then pick WEIGHTED by the
    // measured per-angle reply rates for this cohort (BRAIN V4 P3 LEARN). Uniform when no
    // priors exist; every angle keeps a base weight so exploration never dies.
    const lastAngle = clean(prev?.angle_used);
    const sameModeAsPrev = clean(prev?.mode || 'approach') === mode;
    const hasPortfolio = !!(cs && cs.portfolio_probe && String(cs.portfolio_probe).trim());
    const basePool = mode === 'followup' ? FOLLOWUP_ANGLES : ANGLES;
    let pool = basePool.filter((a) => !(sameModeAsPrev && lastAngle) || !a.startsWith(lastAngle));
    if (!hasPortfolio) pool = pool.filter((a) => !a.startsWith('portfolio_lens'));
    if (!pool.length) pool = basePool.slice();
    const { anglePriors, block: priorsBlock } = await gatherForgePriors(svc, landlord);
    let chosenAngle = pool[0];
    {
      const weights = pool.map((a) => {
        const pr = anglePriors.get(a.split(' ')[0]);
        return 1 + ((pr && !pr.low_confidence && typeof pr.reply_rate === 'number') ? Math.min(3, pr.reply_rate * 6) : 0);
      });
      const total = weights.reduce((s, w) => s + w, 0);
      let roll = Math.random() * total;
      for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) { chosenAngle = pool[i]; break; } }
    }

    const lang = landlord.preferred_language || 'en';
    const firstName = landlord.first_name || (landlord.full_name_en ? landlord.full_name_en.split(' ')[0] : landlord.full_name_en);

    // Mode-specific law block — injected into the system prompt. Same doctrine, different discipline.
    const modeLaw = mode === 'followup'
      ? `MODE: FOLLOW-UP — communication already exists. FOLLOW-UP LAWS:
- BANNED PHRASES in any language: "just following up", "just checking in", "gentle reminder", "circling back", "did you get my message", or any apology for writing again.
- NEVER re-introduce yourself or the company as if this were first contact — the relationship exists. A channel switch is a fresh surface, never a fresh stranger.
- Anchor every draft in the REAL last exchange (supplied below). If the owner's last message is unanswered, ANSWER it first — directly and specifically — before anything else.
- Advance exactly ONE concrete step from where things actually stand; when the owner is silent, the verified value IS the message (zero or minimal ask).
- Every follow-up is SHORTER than a first approach. The more silence, the lighter the touch — never heavier, never needier.
- The conversation lives primarily on ${liveChannel}; that channel's draft is the direct continuation of the thread. The other channels adapt to their medium while still acknowledging the existing relationship.`
      : `MODE: FIRST APPROACH — no prior communication. This is the opening strike: introduce naturally, lead with verified value, earn the reply, land ONE easy ask.`;

    const systemPrompt = `You are ${writer.name}, ${writer.position}${writer.isCEO ? '' : ' at Erudite Real Estate'} in Dubai, forging FIVE ready-to-send outreach drafts — one per channel (email, WhatsApp, Telegram, SMS, iMessage) — for the same property OWNER, in a single pass. You write like a senior, courteous ${writer.isCEO ? 'principal' : 'professional'}: concise, specific, never salesy, never a template.

${credibilityBlock}

THE FIVE CHANNELS ARE NOT COPIES OF EACH OTHER. Same strategic angle, five genuinely different executions, each native to its medium:
- EMAIL: subject in the owner's language + 110-170 word body (< ~1,400 chars). The fullest expression of the angle. May carry ONE verify-me link.
- WHATSAPP: 45-90 words. Conversational but senior. One clear ask. No links unless essential, no emojis.
- TELEGRAM: 40-80 words. Slightly more direct and compact than WhatsApp. Plain text, no markdown, no emojis.
- SMS: HARD LIMIT 300 characters. Every word earns its place. One fact or hook + one ask + who you are. No links, no emojis.
- IMESSAGE: 2-4 sentences, 30-70 words, < 480 characters. A personal text from a senior professional. First name only if natural. No sign-off.

${modeLaw}

GLOBAL RULES:
- Write every body in the owner's preferred language (code below); produce a faithful English gloss for each (verbatim if already English).
- Be specific to the named project and unit. A generic message is a failure.
- Tone: senior, courteous, human. No emojis anywhere. No exclamation-heavy hype. No "I hope this message finds you well."
- NEVER fabricate a fact, figure, comp, buyer, price, or date. Only the credibility block and the verified intelligence below exist.
- No signature, sign-off block, or contact footer on ANY channel — the send layer appends identity. End on the last substantive sentence. (SMS/iMessage may name ${writer.firstName}/Erudite inside the message so the recipient knows who is writing.)
- Exactly ONE ask per message, and it must be concrete (a specific call slot, a yes/no question, a simple reply).
- If prior conversation history exists, every draft must read as a natural continuation: never repeat what was already sent, never contradict what the owner said, never re-introduce yourself to someone who already knows you.
- If a FOUNDER DIRECTIVE is present, it OVERRIDES style preferences (but never the no-fabrication rule): obey it in every channel.
- ANTI-TEMPLATE LAW: the BANNED OPENING LINES below were used before. Every new opening must be structurally different from all of them — different first word class, different hook type, different rhythm. Vary sentence shapes across the five drafts; no two drafts may share their first six words.`;

    const userPrompt = `Forge the five ${mode === 'followup' ? 'FOLLOW-UP' : 'approach'} drafts now.

STRATEGIC ANGLE FOR THIS FORGE (build all five drafts around it): ${chosenAngle}
VARIATION SEED: ${Math.floor(Math.random() * 100000)} (use to vary structure and rhythm, never to invent facts)
MODE: ${mode.toUpperCase()}
SITUATION: ${SITUATION_LINES[situation]}

OWNER & UNIT (real facts only):
- Owner: ${landlord.full_name_en} (first name: ${firstName})
- Nationality: ${landlord.nationality || 'unknown'} · Archetype: ${landlord.landlord_archetype || 'unknown'} (context for tone; never name it back to them)
- Project: ${landlord.project_name || '(unknown — do not invent)'} · Unit: ${landlord.unit_reference || '(unknown — do not invent)'}${landlord.unit_layout ? ` · Layout: ${landlord.unit_layout}` : ''}
- Asking price: ${landlord.asking_price_aed ? landlord.asking_price_aed + ' AED' : '(none set)'}
- Stage: ${landlord.stage || 'unknown'} · Rapport: ${landlord.rapport_level || 'cold'} · Mandate: ${landlord.mandate_status || 'none'}
- Listed with another broker: ${landlord.is_currently_listed_with_others ? 'YES — be additive, never attack the other broker' : 'no/unknown'}
- Preferred language code (write all bodies in this): ${lang}

BRAIN INTELLIGENCE (the report — calibrate strategy and tone from this):
- Rolling summary: ${landlord.ai_rolling_summary || '(none)'}
- Deal thesis: ${landlord.ai_deal_thesis || '(none)'}
- Next best action: ${landlord.ai_next_best_action ? `${landlord.ai_next_best_action.action || ''} — ${landlord.ai_next_best_action.reasoning || ''}` : '(none)'}
- Coaching: ${landlord.ai_coaching_for_agent || '(none)'}
- Momentum: ${landlord.ai_momentum || '(none)'} · Urgency ${landlord.urgency_score ?? '?'} / Trust ${landlord.trust_score ?? '?'} / Win prob ${landlord.mandate_win_probability ?? '?'}
- Known objections: ${Array.isArray(landlord.ai_objections) && landlord.ai_objections.length ? landlord.ai_objections.join('; ') : '(none recorded)'}

${csBlock ? `VERIFIED CALL-SCRIPT INTELLIGENCE:\n${csBlock}\n` : ''}
${priorsBlock ? `${priorsBlock}\n` : ''}
${directiveBlock ? `FOUNDER DIRECTIVES — ACTIVE (obey in every draft):\n${directiveBlock}\n` : ''}
${notesBlock ? `AGENT NOTES (internal context; never quote back to the owner):\n${notesBlock}\n` : ''}
CONVERSATION HISTORY — ALL CHANNELS (chronological, most recent last):
${conversationHistory || '(no written messages on record)'}
${mode === 'followup' ? `
LAST EXCHANGE — THE ANCHOR (never ignore this; if it is the owner speaking, answer it first):
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

    await svc.entities.Landlord.update(landlord_id, {
      ai_approach_drafts: drafts,
      ai_approach_drafts_at: nowIso,
    });

    return Response.json({ ok: true, forged: true, drafts });
  } catch (error) {
    console.error('forgeApproachDrafts error:', error);
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
});
