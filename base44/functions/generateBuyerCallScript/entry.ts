import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// generateBuyerCallScript — the Buyer Call Script Forge (twin of generateLandlordCallScript).
//
// Runs AFTER the buyerOrchestrator has produced its analysis, and forges a powerful,
// personalized, ready-to-use CALL SCRIPT for the agent's next call with this buyer/tenant
// lead. It uses EVERY piece of intelligence the system has:
//   - the orchestrator's outputs (ai_rolling_summary, ai_deal_thesis, ai_next_best_actions,
//     ai_coaching_for_agent, ai_suggested_messages, ai_buying_signals, ai_red_flags)
//   - the INVENTORY PACK (live PFListings matched to their budget/beds/areas) — value hooks
//     come from REAL matched listings, never invented
//   - the analyzed MarketReport for their target project/area when one exists
//   - the recent conversation + the agent's own notes
//
// RENT-TRACK AWARE: for tenant leads, money is ANNUAL RENT (cheque preference matters) and
// move-in timing drives urgency — the script must never talk purchase frames to a tenant.
//
// Persists the forged script to Lead.ai_call_script (+ ai_call_script_at) so it renders
// instantly in the Lead Command Center and survives reloads. SEPARATE BRAINS BY DESIGN:
// Lead-side entities only.
//
// Triggers: auto-invoked from the BuyerCallScript UI section on mount when analysis exists but
// no script has been forged yet; manual "Regenerate" button.

const MODEL = 'claude-opus-4-8';

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    opener: { type: 'string', description: 'The first 15-30 seconds of the call, verbatim. Name the lead, state why you are calling, and land a value hook tied to their SPECIFIC search (budget bracket, area, a matched listing). No generic openers.' },
    rapport: { type: 'string', description: "A 1-2 sentence personal warmup angle grounded in the lead's situation (relocation, family move, first purchase, investment hunt, move-in deadline) — the human beat before business." },
    discovery_questions: {
      type: 'array', minItems: 3, maxItems: 8,
      description: '3-8 sharp discovery questions in order. Cover budget confirmation, financing (cash/mortgage/pre-approval), timeline/move-in, decision-makers, must-haves vs deal-breakers, viewing availability — prioritised by what is still unknown for THIS lead.',
      items: { type: 'string' }
    },
    value_hooks: {
      type: 'array', minItems: 1, maxItems: 4,
      description: '1-4 value-before-pressure hooks. Each is one line delivering ONE concrete fact the agent can drop in — a REAL matched listing from the INVENTORY PACK (building + beds + price), or a market figure from the report. Never invent a figure — only use figures present in the context.',
      items: { type: 'string' }
    },
    objection_handlers: {
      type: 'array', minItems: 0, maxItems: 8,
      description: "A handler for each objection this lead is likely to raise (from red flags + conversation), plus the common ones that apply (just looking, budget stretched, another agent already, need to think, market is too hot/falling). Each: the lead's likely objection + a one-two sentence rebuttal anchored in the doctrine and the real data.",
      items: {
        type: 'object',
        properties: {
          objection: { type: 'string' },
          response: { type: 'string' }
        },
        required: ['objection', 'response']
      }
    },
    qualification_probe: { type: 'string', description: "ONE natural line that fills this lead's BIGGEST qualification gap on this call (unconfirmed budget, unknown financing, no timeline, unclear decision-maker). Empty string when the lead is fully qualified." },
    the_ask: { type: 'string', description: 'The single clear ask of the call — ONE concrete next step (book a specific viewing, send 3 matched listings for a yes/no, confirm pre-approval, agree a shortlist call). One ask only.' },
    close: { type: 'string', description: 'The closing line that schedules the next touch — proposes a specific time or references the already-scheduled next step. No open-ended endings.' },
    cheat_sheet: {
      type: 'array', minItems: 4, maxItems: 12,
      description: "4-12 bullet reminders the agent glances at during the call: the lead's name, budget + track (SALE capital vs RENT annual), areas, beds, financing status, do/don't, and any landmine (red flag / objection to avoid).",
      items: { type: 'string' }
    },
    opener_native: { type: 'string', description: "The opener line translated into the lead's preferred_language, ready to say. Empty if the preferred language is English." },
  },
  required: ['opener', 'discovery_questions', 'value_hooks', 'objection_handlers', 'the_ask', 'close', 'cheat_sheet']
};

const fmtDate = (d) => { if (!d) return '?'; const x = new Date(d); return isNaN(x) ? String(d) : x.toISOString().slice(0, 16).replace('T', ' '); };

function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}

// ── INVENTORY PACK — KEEP IN SYNC with buyerOrchestrator's gatherInventoryPack (same
// filter + budget window + scoring; top 8 for the script). Value hooks MUST come from
// these real listings. Degrades to ''.
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
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
    if (!scored.length) return '';
    const per = lead.intent === 'tenant' ? '/yr' : '';
    const lines = scored.map(({ r }) => `- ${r.title || r.building_name || 'Listing'} · ${r.location || r.community || '?'} · ${r.bedrooms != null ? r.bedrooms + 'BR' : '?'}${r.area_sqft ? ` · ${r.area_sqft} sqft` : ''} · ${typeof r.price === 'number' ? 'AED ' + r.price.toLocaleString() + per : 'price ?'}${r.reference_number ? ` · ref ${r.reference_number}` : ''}`);
    return `\nINVENTORY PACK (REAL live ${listingType} listings matched to this lead's search — value_hooks MUST cite these exact facts, never altered, never invented):\n${lines.join('\n')}\n`;
  } catch (_) { return ''; }
}

async function callClaude(system, prompt) {
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ name: 'forge_call_script', description: 'Emit the forged buyer call script.', input_schema: SCRIPT_SCHEMA }],
      tool_choice: { type: 'tool', name: 'forge_call_script' }
    });
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    return toolBlock ? toolBlock.input : null;
  } catch (err) {
    console.error('generateBuyerCallScript Claude call failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, force = false } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const lead = await svc.entities.Lead.get(lead_id).catch(() => null);
    if (!lead) return Response.json({ error: 'lead not found' }, { status: 404 });

    // Need the orchestrator's analysis first — the script is forged FROM it.
    if (!lead.ai_processed_at) {
      return Response.json({ error: 'Run the AI analysis first — no orchestrator output to forge a script from.', needs_analysis: true }, { status: 409 });
    }

    // Debounce unless forced — avoid reforging on every page mount.
    if (!force && lead.ai_call_script_at) {
      const hoursSince = (Date.now() - new Date(lead.ai_call_script_at).getTime()) / 3.6e6;
      if (hoursSince < 6) return Response.json({ skipped: 'recently_forged', hours_since: hoursSince });
    }

    // Writer identity — the script's opener/close speak in the calling agent's first person.
    // Cross-invoked runs arrive as the platform service account: fall back to the ASSIGNED
    // agent (KEEP IN SYNC with buyerOrchestrator's service-caller fallback).
    const isServiceCaller = !user.email || String(user.email).toLowerCase().includes('no-reply.base44.com');
    let writerUser = user;
    if (isServiceCaller) {
      writerUser = (lead.assigned_agent_email
        ? await svc.entities.User.filter({ email: lead.assigned_agent_email }, '-created_date', 1).then((r) => r?.[0]).catch(() => null)
        : null) || { email: '', display_name: '', position: '' };
    }
    const writerName = String(writerUser?.display_name || writerUser?.full_name || '').trim() || 'the Erudite agent';

    // Light context: recent conversation + the agent's own notes (the heavy intelligence
    // already lives on the lead record from the orchestrator).
    const variants = phoneVariants(lead.phone || lead.whatsapp);
    const [waById, waFrom, waTo, msgRows, notes, projectRows, reportRows] = await Promise.all([
      svc.entities.WhatsAppMessage.filter({ lead_id }, '-timestamp', 15).catch(() => []),
      variants.length ? svc.entities.WhatsAppMessage.filter({ from_number: { $in: variants } }, '-timestamp', 10).catch(() => []) : Promise.resolve([]),
      variants.length ? svc.entities.WhatsAppMessage.filter({ to_number: { $in: variants } }, '-timestamp', 10).catch(() => []) : Promise.resolve([]),
      svc.entities.Message.filter({ lead_id, direction: { $in: ['incoming', 'outgoing'] } }, '-timestamp', 15).catch(() => []),
      svc.entities.Note.filter({ linked_lead_id: lead_id }, '-created_date', 10).catch(() => []),
      lead.project_id ? svc.entities.Project.list('-updated_date', 500).catch(() => []) : Promise.resolve([]),
      svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 40).catch(() => []),
    ]);

    // Target project (when the lead is attached to one) + matched analyzed market report.
    const project = lead.project_id ? (Array.isArray(projectRows) ? projectRows : []).find((p) => p.id === lead.project_id) : null;
    const projNorm = (s) => String(s || '').toLowerCase().replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5').replace(/[\s\-_\.]+/g, '');
    const targets = [project?.name, ...(Array.isArray(lead.preferred_locations) ? lead.preferred_locations : [])].filter(Boolean);
    const matchedReport = (Array.isArray(reportRows) ? reportRows : []).find((r) => {
      if (!r || !r.analysis_summary) return false;
      const rn = projNorm(r.project_name);
      return rn && targets.some((t) => { const tn = projNorm(t); return tn && (tn === rn || tn.includes(rn) || rn.includes(tn)); });
    }) || null;
    const reportBlock = matchedReport ? `\nMARKET REPORT ANALYSIS (${String(matchedReport.project_name || '').toUpperCase()} report dated ${matchedReport.report_date || '?'}${matchedReport.source ? ` · ${matchedReport.source}` : ''} — AI analysis summary; take market figures, pricing anchors, and trends from here and weave them into value hooks and objection handlers; never invent a figure not in this summary):\n${String(matchedReport.analysis_summary).slice(0, 3000)}\n` : '';
    const projectBrief = project?.notes ? `\nPROJECT INTELLIGENCE BRIEF (${String(project.name).toUpperCase()} — curated project brief. Weave it into the opener, value hooks, objection handlers, and cheat sheet; never invent a figure not in the context):\n${String(project.notes).slice(0, 3000)}\n` : '';

    // Merge WhatsApp rows (id + phone-variant queries) with Message rows, chronological.
    const seen = new Set();
    const wa = [...(waById || []), ...(waFrom || []), ...(waTo || [])].filter((m) => { if (!m || seen.has(m.id)) return false; seen.add(m.id); return true; });
    const stream = [];
    for (const m of wa) { const txt = m.is_voice_note ? `[voice] ${m.transcript || ''}` : (m.text || m.caption || `[${m.media_type || 'media'}]`); stream.push({ t: new Date(m.timestamp || m.created_date || 0).getTime(), who: (m.direction === 'outbound' || m.direction === 'outgoing') ? 'AGENT' : 'LEAD', txt, ts: m.timestamp || m.created_date }); }
    for (const m of (Array.isArray(msgRows) ? msgRows : [])) { stream.push({ t: new Date(m.timestamp || m.created_date || 0).getTime(), who: m.direction === 'outgoing' ? 'AGENT' : 'LEAD', txt: m.text || m.caption || '[media]', ts: m.timestamp || m.created_date }); }
    stream.sort((a, b) => a.t - b.t);
    const convo = stream.slice(-20).map((m) => `[${fmtDate(m.ts)}] ${m.who}: ${String(m.txt).slice(0, 400)}`).join('\n');

    const humanNotes = (Array.isArray(notes) ? notes : []).filter((n) => !n.created_from_ai);
    const notesBlock = humanNotes.length
      ? humanNotes.map((n) => `- [${fmtDate(n.created_date)}] ${n.author_name || n.author_email || 'agent'}: ${String(n.body || '').slice(0, 400)}`).join('\n')
      : '(no human notes)';

    const inventoryBlock = await gatherInventoryBlock(svc, lead);

    const isRentTrack = lead.intent === 'tenant';
    const arr = (x) => Array.isArray(x) ? x : [];
    const nba = arr(lead.ai_next_best_actions)[0] || null;
    const suggestedMsgs = arr(lead.ai_suggested_messages).filter((m) => m && typeof m.text === 'string' && m.text.trim()).slice(0, 3).map((m) => `- (${m.tone || 'tone'}·${m.intent || 'intent'}): ${String(m.text).slice(0, 300)}`).join('\n');
    const q = lead.qualification || {};

    const trackLaw = isRentTrack
      ? `RENT TRACK LAW: this lead is a TENANT. Money means ANNUAL RENT — every budget figure is AED/year${lead.cheques_count ? ` (prefers ${lead.cheques_count} cheques/yr)` : ''}, NEVER a purchase price. Cheque count is a negotiation lever (fewer cheques = stronger tenant). The move-in date drives urgency — anchor the timeline questions on it. Inventory hooks are RENT listings. Never talk purchase, ROI, mortgages, or capital appreciation.`
      : lead.intent === 'buyer'
        ? `SALE TRACK: this lead is a BUYER. Budget is purchase capital; financing (cash vs mortgage, pre-approval) is a core qualification axis.`
        : `TRACK UNKNOWN (intake): the FIRST discovery question must clarify buy vs rent — everything else follows from it.`;

    const system = `You are the ERUDITE BUYER CALL SCRIPT FORGE — you turn the buyer brain's analysis into a powerful, personalised, ready-to-use call script for the agent's next call with this Dubai ${isRentTrack ? 'tenant' : 'buyer'} lead.

You are given the FULL intelligence the system holds. Forge a script that is TACTICAL and SPECIFIC: name the lead, name their budget bracket and target areas, cite a real matched listing only when one is present in the INVENTORY PACK, anticipate and rebut the lead's ACTUAL likely objections, and fill their biggest qualification gap.

USE THE INVENTORY PACK: value_hooks must each cite ONE concrete fact — a REAL matched listing (building + beds + price) from the pack, or a market figure from the report. The cheat_sheet must carry the TOP 2-3 matched listings verbatim plus the key numbers. Never invent a listing or figure that is not in the context. If the pack is empty, coach the agent to book the call around understanding the search better — never fake inventory.

${trackLaw}

SALES DOCTRINE (non-negotiable):
1. ONE clear ask per call.
2. The next step is ALWAYS scheduled — propose a specific time or reference the already-scheduled touch.
3. VALUE BEFORE PRESSURE — lead with what the lead gains (a matched unit, a market insight, saved time) before any ask.
4. FOLLOW UP UNTIL CLOSED OR DEFINITIVE NO — silence is not a no.
5. Never invent a market figure or listing that is not in the context.

Output ONLY the structured script via the tool. The opener and close are verbatim lines the agent can read aloud. Discovery questions and cheat_sheet are bullets. The script is agent-facing — write in English, but also provide opener_native (the opener in the lead's preferred language) when their language is not English.`;

    const prompt = `CALLING AGENT: ${writerName} — write the opener and close in first person as ${writerName.split(' ')[0]}. NEVER use placeholders like [Agent], [Name], or [X]; every line must be ready to read aloud verbatim.

LEAD: ${lead.full_name || '?'}
Phone: ${lead.phone || '?'} | Preferred language: ${lead.preferred_language || 'en'} | Nationality: ${lead.nationality || '?'} | Residence: ${lead.residence_country || '?'}
Track: ${isRentTrack ? 'RENT (tenant) — ALL BUDGET FIGURES ARE ANNUAL RENT' : lead.intent === 'buyer' ? 'SALE (buyer)' : 'UNKNOWN (intake)'} | Transaction: ${lead.transaction_type || '?'} | Stage: ${lead.stage || '?'} | Source: ${lead.source || '?'}
Budget: ${lead.budget_min || lead.budget_max ? `AED ${(lead.budget_min || 0).toLocaleString()} – ${(lead.budget_max || 0).toLocaleString()}${isRentTrack ? ' PER YEAR' : ''}` : 'NOT STATED'} | Financing: ${lead.financing_method || lead.financing_type || 'unknown'} | Pre-approval: ${lead.mortgage_pre_approval_status || 'not_started'}
Requirements: ${lead.bedrooms_min ?? '?'}–${lead.bedrooms_max ?? '?'} BR | Areas: ${arr(lead.preferred_locations).join(', ') || '?'} | Timeline: ${lead.move_in_timeline || '?'}${isRentTrack && lead.cheques_count ? ` | Cheque preference: ${lead.cheques_count}/yr` : ''}
Must-haves: ${arr(lead.must_have_features).join(', ') || '(none stated)'} | Deal-breakers: ${arr(lead.deal_breakers).join(', ') || '(none stated)'}
Qualification gaps: budget ${q.budget_confirmed ? 'CONFIRMED' : 'UNCONFIRMED'} · authority ${q.authority_confirmed ? 'CONFIRMED' : 'UNCONFIRMED'} · need ${q.need_confirmed ? 'CONFIRMED' : 'UNCONFIRMED'} · timeline ${q.timeline_confirmed ? 'CONFIRMED' : 'UNCONFIRMED'}

── BRAIN OUTPUT (orchestrator) ──
ROLLING SUMMARY: ${lead.ai_rolling_summary || '(none)'}
DEAL THESIS: ${lead.ai_deal_thesis || '(none)'}
NEXT BEST ACTION: ${nba ? `${nba.action || ''} [${nba.priority || 'medium'}] — ${nba.reasoning || ''}` : '(none)'}
COACHING FOR AGENT: ${lead.ai_coaching_for_agent || '(none)'}
MOMENTUM: ${lead.ai_momentum || '(none)'} | Lead score ${lead.ai_lead_score ?? '?'} | Conversion ${lead.ai_conversion_probability ?? '?'}
BUYING SIGNALS: ${arr(lead.ai_buying_signals).length ? arr(lead.ai_buying_signals).join(' | ') : '(none)'}
RED FLAGS (landmines): ${arr(lead.ai_red_flags).length ? arr(lead.ai_red_flags).join(' | ') : '(none)'}
SUGGESTED MESSAGES (the brain's own drafts — adapt their angles into the script):
${suggestedMsgs || '(none)'}

${inventoryBlock}${reportBlock}${projectBrief}
RECENT CONVERSATION (last ${stream.length > 20 ? 20 : stream.length} messages):
${convo || '(no messages yet)'}

AGENT'S OWN NOTES:
${notesBlock}

Forge the call script now. Make it powerful, specific to THIS lead, and ready to use on the next call.`;

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
      qualification_probe: typeof result.qualification_probe === 'string' ? result.qualification_probe.trim() : '',
      the_ask: typeof result.the_ask === 'string' ? result.the_ask.trim() : '',
      close: typeof result.close === 'string' ? result.close.trim() : '',
      cheat_sheet: cleanArr(result.cheat_sheet),
      opener_native: typeof result.opener_native === 'string' ? result.opener_native.trim() : '',
      language: lead.preferred_language || 'en',
      forged_at: new Date().toISOString(),
      model: MODEL,
    };

    await svc.entities.Lead.update(lead_id, {
      ai_call_script: script,
      ai_call_script_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, script });
  } catch (error) {
    console.error('generateBuyerCallScript error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
