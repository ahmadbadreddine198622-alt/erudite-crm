import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// generateLandlordCallScript — the Call Script Forge.
//
// Runs AFTER the landlordOrchestrator (the "V3 brain") has produced its analysis, and
// forges a powerful, personalized, ready-to-use CALL SCRIPT for the agent's next call with
// this Dubai landlord. It uses EVERY piece of intelligence the system has:
//   - the orchestrator's outputs (ai_rolling_summary, ai_deal_thesis, ai_next_best_action,
//     ai_coaching_for_agent, ai_objections, ai_suggested_messages, buying_signals, red_flags)
//   - the owner's FULL unit portfolio (synced owner registry) — so the script probes their
//     OTHER units, not just the CRM record
//   - the recent conversation + the agent's own notes
//   - the valuation / asking price reality
//
// Persists the forged script to Landlord.ai_call_script (+ ai_call_script_at) so it renders
// instantly on the detail page and survives reloads. Non-fatal: a generation failure never
// disturbs the orchestrator's own writes.
//
// Triggers: auto-invoked from the AICallScript UI section on mount when analysis exists but
// no script has been forged yet; manual "Regenerate" button.

const MODEL = 'claude-opus-4-8';

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    opener: { type: 'string', description: 'The first 15-30 seconds of the call, verbatim. Name the landlord, state why you are calling, and land a value hook tied to their SPECIFIC unit/project. No generic openers.' },
    rapport: { type: 'string', description: 'A 1-2 sentence personal warmup angle grounded in the landlord\'s archetype, nationality, or relocation timeline — the human beat before business.' },
    discovery_questions: {
      type: 'array', minItems: 3, maxItems: 8,
      description: '3-8 sharp discovery questions in order. Cover motivation, timeline, price expectation, mandate openness, decision-makers, tenancy/mortgage — prioritised by what is still unknown for THIS landlord.',
      items: { type: 'string' }
    },
    value_hooks: {
      type: 'array', minItems: 1, maxItems: 4,
      description: '1-4 value-before-price hooks. Each is one line delivering ONE concrete figure or insight the agent can drop in (buyer demand for their building, a deed comp with unit+date, a yield, a market data point from the summary). Never invent a figure — only use figures present in the context.',
      items: { type: 'string' }
    },
    objection_handlers: {
      type: 'array', minItems: 0, maxItems: 8,
      description: 'A handler for EACH ai_objection listed, plus the common ones that apply (already listed with another broker, commission too high, need to think, price too low). Each: the landlord\'s likely objection + a one-two sentence rebuttal anchored in the doctrine and the real data.',
      items: {
        type: 'object',
        properties: {
          objection: { type: 'string' },
          response: { type: 'string' }
        },
        required: ['objection', 'response']
      }
    },
    portfolio_probe: { type: 'string', description: 'When the OWNER PORTFOLIO shows other units, a natural line asking the owner about those other units on this call (sell/rent/manage). Empty string only when the owner holds a single unit.' },
    the_ask: { type: 'string', description: 'The single clear ask of the call — ONE concrete next step (book a call, send a specific document, sign the mandate, agree a viewing). One ask only.' },
    close: { type: 'string', description: 'The closing line that schedules the next touch — proposes a specific time or references the already-scheduled next step. No open-ended endings.' },
    cheat_sheet: {
      type: 'array', minItems: 4, maxItems: 12,
      description: '4-12 bullet reminders the agent glances at during the call: the landlord\'s name, the unit + project, the archetype, do/don\'t, and any landmine (red flag / objection to avoid).',
      items: { type: 'string' }
    },
    opener_native: { type: 'string', description: 'The opener line translated into the landlord\'s preferred_language, ready to say. Empty if the preferred language is English.' },
  },
  required: ['opener', 'discovery_questions', 'value_hooks', 'objection_handlers', 'the_ask', 'close', 'cheat_sheet']
};

const OP_clean = (v) => (v == null ? '' : String(v).trim());
const OP_phoneKey = (s) => OP_clean(s).replace(/[^0-9]/g, '');
const OP_last9 = (d) => (d ? d.slice(-9) : '');
const OP_escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fetch the owner's full unit portfolio directly from OwnerPortfolioUnit (same matching
// logic as fetchOwnerPortfolio / the orchestrator's gatherOwnerPortfolio). Never throws.
async function gatherOwnerPortfolio(svc, landlord) {
  try {
    const name = OP_clean(landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`);
    const emails = [
      ...(landlord.email ? [String(landlord.email).trim().toLowerCase()] : []),
      ...(Array.isArray(landlord.additional_emails) ? landlord.additional_emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : []),
    ];
    const phones = [
      ...(landlord.phone ? [landlord.phone] : []),
      ...(landlord.whatsapp ? [landlord.whatsapp] : []),
      ...(Array.isArray(landlord.additional_phones) ? landlord.additional_phones : []),
    ];
    const phonesLast9 = phones.map((p) => OP_last9(OP_phoneKey(p))).filter((p) => p.length >= 7);
    if (!name && !emails.length && !phonesLast9.length) return '';

    const matchedCodes = new Set();
    for (const em of [...new Set(emails)]) {
      const rows = await svc.entities.OwnerPortfolioUnit.filter({ owner_email: { $regex: '^' + OP_escapeRegex(em) + '$', $options: 'i' } }, '-created_date', 500).catch(() => []);
      for (const u of (Array.isArray(rows) ? rows : [])) if (u.owner_code) matchedCodes.add(u.owner_code);
    }
    for (const p9 of [...new Set(phonesLast9)]) {
      const rows = await svc.entities.OwnerPortfolioUnit.filter({ owner_phone: { $regex: p9 } }, '-created_date', 500).catch(() => []);
      for (const u of (Array.isArray(rows) ? rows : [])) if (u.owner_code) matchedCodes.add(u.owner_code);
    }
    if (name) {
      const tokens = name.toLowerCase().split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 1);
      if (tokens.length) {
        const qTok = tokens.slice().sort((a, b) => b.length - a.length)[0];
        const rows = await svc.entities.OwnerPortfolioUnit.filter({ owner_name: { $regex: OP_escapeRegex(qTok), $options: 'i' } }, '-created_date', 500).catch(() => []);
        for (const u of (Array.isArray(rows) ? rows : [])) {
          const un = OP_clean(u.owner_name).toLowerCase();
          if (un && tokens.every((t) => un.includes(t))) if (u.owner_code) matchedCodes.add(u.owner_code);
        }
      }
    }
    if (!matchedCodes.size) return '';

    const codes = Array.from(matchedCodes);
    const page = await svc.entities.OwnerPortfolioUnit.filter({ owner_code: { $in: codes } }, '-created_date', 1000).catch(() => []);
    const allUnits = Array.isArray(page) ? page : (page?.items || []);
    if (!allUnits.length) return '';

    const units = allUnits.map((u) => ({
      project: OP_clean(u.property_name), unit: OP_clean(u.unit_code), area: OP_clean(u.area),
      spa_status: OP_clean(u.spa_status), owner_status: OP_clean(u.owner_status), sales_agent: OP_clean(u.sales_agent),
    }));
    const projects = [...new Set(units.map((u) => u.project).filter(Boolean))];
    const lines = units.map((u) => `  - ${u.project || '?'} · ${u.unit || '?'}${u.area ? ` (${u.area})` : ''}${u.spa_status ? ` · SPA ${u.spa_status}` : ''}${u.owner_status ? ` · ${u.owner_status}` : ''}`).join('\n');
    return `\nOWNER PORTFOLIO (synced owner registry — every unit this owner holds):
The owner holds ${units.length} unit(s) across ${projects.length} project(s): ${projects.join(', ') || '?'}.
ALL UNITS:
${lines}
The script MUST include a portfolio_probe asking the owner about their other units (unless only one unit is listed). Treat the owner as a portfolio client.`;
  } catch (_) { return ''; }
}

const fmtDate = (d) => { if (!d) return '?'; const x = new Date(d); return isNaN(x) ? String(d) : x.toISOString().slice(0, 16).replace('T', ' '); };

async function callClaude(system, prompt) {
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ name: 'forge_call_script', description: 'Emit the forged landlord call script.', input_schema: SCRIPT_SCHEMA }],
      tool_choice: { type: 'tool', name: 'forge_call_script' }
    });
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    return toolBlock ? toolBlock.input : null;
  } catch (err) {
    console.error('generateLandlordCallScript Claude call failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, force = false } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const landlord = await svc.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // Need the orchestrator's analysis first — the script is forged FROM it. If no analysis
    // exists yet, refuse and tell the caller to run the brain first.
    if (!landlord.ai_processed_at) {
      return Response.json({ error: 'Run the AI analysis first — no orchestrator output to forge a script from.', needs_analysis: true }, { status: 409 });
    }

    // Debounce unless forced — avoid reforging on every page mount.
    if (!force && landlord.ai_call_script_at) {
      const hoursSince = (Date.now() - new Date(landlord.ai_call_script_at).getTime()) / 3.6e6;
      if (hoursSince < 6) return Response.json({ skipped: 'recently_forged', hours_since: hoursSince });
    }

    // Light context: recent conversation + the agent's own notes (the heavy intelligence
    // already lives on the landlord record from the orchestrator).
    const [messages, notes, properties, comps, intelRows, projectRows, reportRows] = await Promise.all([
      svc.entities.Message.filter({ landlord_id }, '-timestamp', 20).catch(() => []),
      svc.entities.LandlordNote.filter({ landlord_id }, '-created_date', 10).catch(() => []),
      svc.entities.LandlordProperty.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      landlord.project_name
        ? svc.entities.MarketTransaction.filter({ project_name: landlord.project_name }, '-transaction_date', 60).catch(() => [])
        : Promise.resolve([]),
      landlord.project_name
        ? svc.entities.ProjectIntelSource.filter({ auto_inject: true }, '-updated_date', 100).catch(() => [])
        : Promise.resolve([]),
      landlord.project_name
        ? svc.entities.Project.list('-updated_date', 500).catch(() => [])
        : Promise.resolve([]),
      landlord.project_name
        ? svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 40).catch(() => [])
        : Promise.resolve([]),
    ]);

    // ── PROJECT INTELLIGENCE SOURCES ── curated brand + portal intel (ProjectIntelSource),
    // matched to this landlord's project by normalized name. One brand/lifestyle fact per
    // script section max — deed figures always outrank these. Degrades to ''.
    const projNorm = (s) => String(s || '').toLowerCase().replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5').replace(/[\s\-_\.]+/g, '');
    // Project-name matcher: exact → Peninsula 5 family exact-only guard → substring → token-subset.
    // Handles "The Edge A" ↔ "The Edge Tower A"; never cross-matches the P5 tower with D1/D2.
    const PN_STOP = new Set(['the', 'of', 'at', 'in', 'on', 'and']);
    const pnTokens = (s) => String(s || '').toLowerCase().replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5').split(/[\s\-_\.]+/).map((t) => t.trim()).filter((t) => t && !PN_STOP.has(t));
    const isP5Fam = (s) => { const n = projNorm(s); return n === 'peninsula5' || n === 'peninsula5d1' || n === 'peninsula5d2'; };
    const matchPN = (landlordProj, candProj) => {
      const a = projNorm(landlordProj), b = projNorm(candProj);
      if (!a || !b) return false;
      if (a === b) return true;
      if (isP5Fam(landlordProj) || isP5Fam(candProj)) return false;
      if (a.includes(b) || b.includes(a)) return true;
      const ta = pnTokens(landlordProj), tb = pnTokens(candProj);
      if (ta.length && tb.length) { const sub = (x, y) => x.every((t) => y.includes(t)); if (sub(ta, tb) || sub(tb, ta)) return true; }
      return false;
    };
    const intelSources = (Array.isArray(intelRows) ? intelRows : [])
      .filter((s) => { const a = projNorm(landlord.project_name), b = projNorm(s.project_name); return a && b && (a === b || a.includes(b) || b.includes(a)); })
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
    const intelBlock = intelSources.length ? `\nPROJECT INTELLIGENCE SOURCES (curated brand + portal intel for ${String(landlord.project_name).toUpperCase()} — weave at most ONE of these facts into the opener or a value hook; deed figures always outrank these; never invent a fact not listed):\n${intelSources.map((s) => { const facts = Array.isArray(s.key_facts) && s.key_facts.length ? `\n  KEY FACTS: ${s.key_facts.map((f) => '• ' + f).join(' ')}` : ''; const talk = Array.isArray(s.talking_points) && s.talking_points.length ? `\n  SALES ANGLES: ${s.talking_points.map((t) => '• ' + t).join(' ')}` : ''; const sum = s.summary ? `\n  ${String(s.summary).slice(0, 1200)}` : ''; return `[${s.source_type || 'source'}] ${s.source_name}${s.last_checked ? ` (checked ${s.last_checked})` : ''}${facts}${talk}${sum}`; }).join('\n')}\n` : '';

    // ── PROJECT INTELLIGENCE BRIEF ── the Project record's curated `notes` (market
    // positioning, pricing anchors, objection handlers, mandate-winning playbook), matched
    // to the landlord's project by normalized name (substring either direction).
    const projMatches = (Array.isArray(projectRows) ? projectRows : []).filter((p) => p && p.notes && matchPN(landlord.project_name, p.name));
    const exactProj = projMatches.find((p) => projNorm(p.name) === projNorm(landlord.project_name));
    const projBriefRow = exactProj || projMatches[0] || null;
    const projectBrief = projBriefRow ? `\nPROJECT INTELLIGENCE BRIEF (${String(projBriefRow.name || landlord.project_name).toUpperCase()} — curated project brief: pricing anchors, objection handlers, mandate-winning playbook. Weave it into the opener, value hooks, objection handlers, and cheat sheet; it complements the deed/portal figures — never invent a figure not in the context):\n${String(projBriefRow.notes).slice(0, 4000)}\n` : '';

    // ── MARKET REPORT ANALYSIS ── the analyzed MarketReport's analysis_summary for this
    // project (matched by project_name, e.g. "The Edge Tower A" matches "The Edge A").
    const reportMatches = (Array.isArray(reportRows) ? reportRows : []).filter((r) => r && r.analysis_summary && matchPN(landlord.project_name, r.project_name));
    const exactReport = reportMatches.find((r) => projNorm(r.project_name) === projNorm(landlord.project_name));
    const matchedReport = exactReport || reportMatches[0] || null;
    const reportBlock = matchedReport ? `\nMARKET REPORT ANALYSIS (${String(matchedReport.project_name || landlord.project_name).toUpperCase()} report dated ${matchedReport.report_date || '?'}${matchedReport.source ? ` · ${matchedReport.source}` : ''} — AI analysis summary; take market figures, pricing anchors, and trends from here and weave them into value hooks and objection handlers; never invent a figure not in this summary or the evaluation block):\n${String(matchedReport.analysis_summary).slice(0, 3000)}\n` : '';

    const convo = (Array.isArray(messages) ? messages : []).slice().reverse().map((m) => {
      const who = m.direction === 'incoming' ? 'LANDLORD' : 'AGENT';
      const body = m.is_voice_note ? `[voice] ${m.transcript || ''}` : (m.text || m.caption || `[${m.media_type || 'media'}]`);
      return `[${fmtDate(m.timestamp)}] ${who}: ${String(body).slice(0, 400)}`;
    }).join('\n');

    const humanNotes = (Array.isArray(notes) ? notes : []).filter((n) => !n.created_from_ai);
    const notesBlock = humanNotes.length
      ? humanNotes.map((n) => `- [${fmtDate(n.created_date)}] ${n.author_name || n.author_email || 'agent'}: ${String(n.body || '').slice(0, 400)}`).join('\n')
      : '(no human notes)';

    const portfolio = await gatherOwnerPortfolio(svc, landlord);

    // ── EVALUATION & MARKET DATA ── the "evaluation" the agent maintains (valuation on the
    // linked LandlordProperty + recently SOLD units from MarketTransaction). The script must
    // weave these REAL figures into value_hooks, objection_handlers, and the cheat_sheet —
    // short, specific, powerful. Never invent a figure not present here.
    const prop = (Array.isArray(properties) ? properties : [])[0] || {};
    const cleanComps = (Array.isArray(comps) ? comps : []).filter((t) => !t.is_outlier);
    const valuationAed = (typeof prop.ai_estimated_value_aed === 'number' && isFinite(prop.ai_estimated_value_aed)) ? prop.ai_estimated_value_aed : null;
    const valuationPsf = (typeof prop.ai_estimated_price_sqft === 'number' && isFinite(prop.ai_estimated_price_sqft)) ? prop.ai_estimated_price_sqft : null;
    const valuationConf = prop.ai_valuation_confidence || null;
    const valuationBasis = prop.ai_valuation_basis || null;
    const asking = (typeof landlord.asking_price_aed === 'number' && isFinite(landlord.asking_price_aed)) ? landlord.asking_price_aed : null;
    const gapPct = (asking != null && valuationAed != null) ? Math.round(((asking - valuationAed) / valuationAed) * 100) : null;
    // ── SOLD EXAMPLES — similarity-ranked ── as many sold units as the report holds, ordered
    // CLOSEST to this landlord's unit first: this owner's OWN past deed (★), then same layout +
    // same tower, then same layout by nearest size, then other types labeled context-only.
    const LAYOUT_BEDS = { STUDIO: 'studio', '1BHK': '1br', '2BHK': '2br', '3BHK': '3br', '4BHK': '4plus', '5BHK': '4plus', '1BR': '1br', '2BR': '2br', '3BR': '3br', '4BR': '4plus', '5BR': '4plus', PENTHOUSE: '4plus', DUPLEX: '4plus', VILLA: '4plus', '4BHKVILLA': '4plus', '5BHKVILLA': '4plus' };
    const landlordBeds = LAYOUT_BEDS[String(landlord.unit_layout || '').toUpperCase().replace(/\s+/g, '')] || null;
    const basisSq = /([\d,]{3,7})\s*sqft/.exec(String(prop.ai_valuation_basis || ''));
    const unitSqft = basisSq ? parseInt(basisSq[1].replace(/,/g, ''), 10) : null;
    const normRef = (s) => String(s || '').toUpperCase().replace(/\s/g, '');
    const myRef = normRef(landlord.unit_reference);
    const myTower = myRef.includes('-') ? myRef.split('-')[0] : myRef.replace(/\d+$/, '');
    const towerOfTx = (u) => { const n = normRef(u); return n.includes('-') ? n.split('-')[0] : n.replace(/\d+$/, ''); };
    const simScore = (t) => {
      if (myRef && normRef(t.unit_number) === myRef) return -1e9; // this owner's own deed — always first
      let s = 0;
      if (landlordBeds && t.bedrooms !== landlordBeds) s += 1e6; // other types sink to the bottom
      if (myTower && towerOfTx(t.unit_number) !== myTower) s += 1e3; // same tower before other towers
      if (unitSqft && t.area_sqft) s += Math.min(999, Math.round((Math.abs(t.area_sqft - unitSqft) / Math.max(unitSqft, 1)) * 1000)); // nearest size
      return s;
    };
    const ranked = cleanComps.slice().sort((a, b) => (simScore(a) - simScore(b)) || String(b.transaction_date || '').localeCompare(String(a.transaction_date || '')));
    const compRows = ranked.slice(0, 15).map((t) => {
      const g = /capital gain ([+-]\d+)%/.exec(t.description || '');
      const isSelf = myRef && normRef(t.unit_number) === myRef;
      const sameType = landlordBeds && t.bedrooms === landlordBeds;
      const sameTower = myTower && towerOfTx(t.unit_number) === myTower;
      const tag = isSelf ? " ★ THIS OWNER'S OWN UNIT — their entry price" : (sameType && sameTower) ? ' ← SAME LAYOUT, SAME TOWER' : sameType ? ' ← SAME LAYOUT' : ' (different type — context only, never a price reference)';
      return `${t.transaction_date} unit ${t.unit_number || '?'} ${t.bedrooms || '?'} ${t.area_sqft || '?'}sqft AED ${Number(t.price_aed).toLocaleString('en-US')} @${t.price_per_sqft ?? '?'}/sqft${g ? ` (gain ${g[1]}%)` : ''}${tag}`;
    });
    const evalBlock = `\nEVALUATION & MARKET DATA (the "evaluation" — real numbers and recently SOLD units; weave these into value_hooks, objection_handlers, and cheat_sheet — short, specific, powerful. Cite a sold comp with unit + date + price + price/sqft; never invent a figure):\nAsking price: ${asking != null ? asking + ' AED' : 'NONE SET'}\nAI valuation: ${valuationAed != null ? valuationAed + ' AED' : 'not set'}${valuationPsf != null ? ` (${valuationPsf}/sqft)` : ''}${valuationConf ? ` | confidence: ${valuationConf}` : ''}\nValuation basis: ${valuationBasis || 'not stated'}\nAsking vs valuation gap: ${gapPct != null ? gapPct + '%' : '(cannot compute — missing asking or valuation)'}${gapPct != null && gapPct > 5 ? ' → asking is ABOVE valuation — coach the price down with the sold comps' : ''}${gapPct != null && gapPct < -5 ? ' → asking is BELOW valuation — opportunity to build trust / upsell' : ''}\nSOLD EXAMPLES — RANKED CLOSEST TO THIS UNIT FIRST (same project${cleanComps.length ? `, ${cleanComps.length} clean deeds on file — showing ${compRows.length}; order: this owner's own deed ★, then same layout + same tower, then same layout by nearest size, then other types labeled context-only` : ''}):\n${compRows.length ? compRows.map((r) => '  ' + r).join('\n') : '  (no sold comps on file — use only the brain summary figures, and never invent a number)'}\n`;

    const arr = (x) => Array.isArray(x) ? x : [];
    const nba = landlord.ai_next_best_action && typeof landlord.ai_next_best_action === 'object' ? landlord.ai_next_best_action : null;
    const suggestedMsgs = arr(landlord.ai_suggested_messages).filter((m) => m && typeof m.text === 'string' && m.text.trim()).slice(0, 3).map((m) => `- (${m.tone || 'tone'}·${m.intent || 'intent'}): ${String(m.text).slice(0, 300)}`).join('\n');

    const system = `You are the ERUDITE CALL SCRIPT FORGE — you turn the landlord brain's analysis into a powerful, personalised, ready-to-use call script for the agent's next call with this Dubai landlord.

You are given the FULL intelligence the system holds. Forge a script that is TACTICAL and SPECIFIC: name the landlord, name the unit, name the project, cite a real market figure only when one is present, anticipate and rebut the landlord's ACTUAL objections, and probe their other units when a portfolio exists.

USE THE EVALUATION: the EVALUATION & MARKET DATA block carries the AI valuation, the asking-vs-valuation gap, and SOLD EXAMPLES ranked closest to this landlord's unit first (unit + date + price + price/sqft + capital gain, tagged SAME LAYOUT / SAME TOWER, with ★ marking this owner's OWN unit's past deed when it exists). Weave these REAL figures into the script — value_hooks must each cite ONE concrete figure (a sold example by unit + date + price/sqft, the AI valuation, or the gap), objection_handlers must use the sold examples to defend the valuation against an unrealistic asking price, and the cheat_sheet must carry the TOP 3 CLOSEST sold examples verbatim plus the key numbers. Quote from the TOP of the list — the closer the example to the owner's own unit, the harder it lands; when the ★ own-unit deed is present it is the single most powerful line in the script (their own entry price and paper gain — use it). Rows tagged 'different type — context only' are NEVER quoted as a price reference. Short, smart, powerful — one figure per hook, never a data dump. Never invent a figure that is not in the context.

USE THE PROJECT INTELLIGENCE: when a PROJECT INTELLIGENCE SOURCES block is present, the opener or exactly ONE value hook should carry a brand/lifestyle/portal fact from it (resort operational, owner privileges, residence-count scarcity, the first registered rental and its yield, a portal average the owner can verify, or a location fact matched to the landlord's archetype) — one fact, stated naturally, ALONGSIDE (never instead of) the deed-figure discipline above. Objection handlers may use the brand premium (branded tower vs neighbouring non-branded asks) to defend pricing, and the hold-vs-sell frame should use a first-rental/yield fact when present. The cheat_sheet may carry one brand fact next to the key numbers.

USE THE PROJECT BRIEF & MARKET REPORT: when a PROJECT INTELLIGENCE BRIEF block is present, it is the curated project playbook — pricing anchors, objection handlers, and the mandate-winning strategy stored on the Project record. Use it to shape the opener, the discovery questions, the value hooks, the objection handlers, and the cheat sheet. When a MARKET REPORT ANALYSIS block is present, take market figures, pricing anchors, and trends from it and weave them into the value hooks and objection handlers. Both complement (never override) the deed figures in the EVALUATION block — never invent a figure that is not in the context.

SALES DOCTRINE (non-negotiable):
1. ONE clear ask per call.
2. The next step is ALWAYS scheduled — propose a specific time or reference the already-scheduled touch.
3. VALUE BEFORE PRICE — lead with what the landlord gains (data, buyer access, market insight) before commission or asking price.
4. Treat the owner as a PORTFOLIO CLIENT when they hold multiple units — ask about the others.
5. Never invent a market figure that is not in the context. If no figure exists, coach the agent to book the call to establish value.

Output ONLY the structured script via the tool. The opener and close are verbatim lines the agent can read aloud. Discovery questions and cheat_sheet are bullets. The script is agent-facing — write in English, but also provide opener_native (the opener in the landlord's preferred language) when their language is not English.`;

    const prompt = `LANDLORD: ${landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`}
Phone: ${landlord.phone || '?'} | Preferred language: ${landlord.preferred_language || 'en'} | Nationality: ${landlord.nationality || '?'}
Archetype: ${landlord.landlord_archetype || 'unknown'} | Rapport: ${landlord.rapport_level || 'cold'} | Stage: ${landlord.stage || 'initial_contact'}
Unit: ${landlord.unit_reference || '?'} | Project: ${landlord.project_name || '?'} | Layout: ${landlord.unit_layout || '?'}${landlord.unit_plan_code ? `\nUNIT PLAN (${landlord.unit_plan_code}): ${landlord.unit_total_sqft ? `${landlord.unit_total_sqft} sqft total` : 'developer plan on file'}${landlord.unit_floor != null ? ` | floor ${landlord.unit_floor} (brochure level ${landlord.unit_floor + 3})` : ''}${landlord.unit_view ? ` | view: ${landlord.unit_view}${landlord.unit_view_source === 'agent_verified' ? ' (agent-verified — may be stated as fact)' : ' (per developer plan — on the call say "the plan shows", NEVER state the view as verified fact)'}` : ''} — anchor the opener, value hooks and cheat sheet on THIS exact unit.` : ''}
Asking price: ${landlord.asking_price_aed != null ? landlord.asking_price_aed + ' AED' : 'NONE SET'} | Mandate: ${landlord.mandate_type || 'none'}/${landlord.mandate_status || '?'}
Listed with competitors: ${landlord.is_currently_listed_with_others ? 'YES' : 'no'} | Competing brokers: ${landlord.competing_brokers_count || 0}

── BRAIN OUTPUT (orchestrator) ──
ROLLING SUMMARY: ${landlord.ai_rolling_summary || '(none)'}
DEAL THESIS: ${landlord.ai_deal_thesis || '(none)'}
NEXT BEST ACTION: ${nba ? `${nba.action || ''} [${nba.priority || 'medium'}] — ${nba.reasoning || ''}` : '(none)'}
COACHING FOR AGENT: ${landlord.ai_coaching_for_agent || '(none)'}
OBJECTIONS (handle EACH): ${arr(landlord.ai_objections).length ? arr(landlord.ai_objections).join(' | ') : '(none stated)'}
BUYING SIGNALS: ${arr(landlord.buying_signals).length ? arr(landlord.buying_signals).join(' | ') : '(none)'}
RED FLAGS (landmines): ${arr(landlord.red_flags).length ? arr(landlord.red_flags).join(' | ') : '(none)'}
SUGGESTED MESSAGES (the brain's own drafts — adapt their angles into the script):
${suggestedMsgs || '(none)'}

${evalBlock}${reportBlock}${projectBrief}${intelBlock}${portfolio}
RECENT CONVERSATION (last ${Array.isArray(messages) ? messages.length : 0} messages):
${convo || '(no messages yet)'}

AGENT'S OWN NOTES:
${notesBlock}

Forge the call script now. Make it powerful, specific to THIS landlord, and ready to use on the next call.`;

    const result = await callClaude(system, prompt);
    if (!result) return Response.json({ error: 'Claude call failed' }, { status: 500 });

    // Normalise + persist.
    const cleanArr = (x) => Array.isArray(x) ? x.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
    const script = {
      opener: typeof result.opener === 'string' ? result.opener.trim() : '',
      rapport: typeof result.rapport === 'string' ? result.rapport.trim() : '',
      discovery_questions: cleanArr(result.discovery_questions),
      value_hooks: cleanArr(result.value_hooks),
      objection_handlers: Array.isArray(result.objection_handlers)
        ? result.objection_handlers.filter((h) => h && typeof h === 'object' && typeof h.objection === 'string' && h.objection.trim()).map((h) => ({ objection: h.objection.trim(), response: typeof h.response === 'string' ? h.response.trim() : '' }))
        : [],
      portfolio_probe: typeof result.portfolio_probe === 'string' ? result.portfolio_probe.trim() : '',
      the_ask: typeof result.the_ask === 'string' ? result.the_ask.trim() : '',
      close: typeof result.close === 'string' ? result.close.trim() : '',
      cheat_sheet: cleanArr(result.cheat_sheet),
      opener_native: typeof result.opener_native === 'string' ? result.opener_native.trim() : '',
      language: landlord.preferred_language || 'en',
      forged_at: new Date().toISOString(),
      model: MODEL,
    };

    await svc.entities.Landlord.update(landlord_id, {
      ai_call_script: script,
      ai_call_script_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, script });
  } catch (error) {
    console.error('generateLandlordCallScript error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});