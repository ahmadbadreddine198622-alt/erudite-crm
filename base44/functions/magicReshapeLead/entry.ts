// magicReshapeLead — deep-context message rewrite for LEADS (BUYER BRAIN V1 B4e;
// twin of magicReshapeV2 — SEPARATE BRAINS: Lead-side entities only).
// Merges THREE brains into a single powerful LLM prompt:
//   1. THE BRAIN  — buyer AI intelligence (deal thesis, next best actions, coaching,
//      momentum, scores, strike-now, red flags)
//   2. THE SEARCH — budget (ANNUAL RENT on the rent track), beds, areas, timeline,
//      financing, cheques, language
//   3. THE CONVO  — recent messages across WhatsApp, Email, iMessage, Telegram, Notes
//
// Input:  { lead_id, text, channel, angle_index }
// Output: { ok, message, angle_label, next_angle_index }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MAGIC_ANGLES = [
  { key: 'matched_unit', label: 'Matched-unit urgency', brief: 'Lead with a specific matched unit meeting their stated criteria — make it feel real and time-bound. NEVER invent a listing: only reference units already named in the conversation or the brain context.' },
  { key: 'market_gift', label: 'Market intelligence gift', brief: 'Open with a sharp, specific market insight about their target area/bracket delivered as a gift before any ask — only facts present in the context.' },
  { key: 'search_specialist', label: 'Search-specialist proof', brief: 'Demonstrate you know their exact search — budget band, areas, must-haves — better than any other agent. Proof by specificity, not adjectives.' },
  { key: 'speed_advantage', label: 'Speed advantage', brief: 'Emphasize response speed and first-access: good units in their bracket move in days — position us as the fastest path to them.' },
  { key: 'budget_respect', label: 'Budget respect', brief: 'Anchor on working seriously WITHIN their stated number — never upsell; one concrete thing you can show inside it.' },
  { key: 'no_ask', label: 'No-ask value interrupt', brief: 'Deliver genuine value first with ZERO ask — a soft, non-transactional interrupt that earns a reply.' },
  { key: 'scarcity_window', label: 'Scarcity / closing window', brief: 'Frame the market window in their bracket as narrow right now — a concrete reason to act this week, grounded only in facts from the context.' },
  { key: 'pain_reframe', label: 'Pain-point reframe', brief: 'Name the lead\'s likely pain (endless portals, unresponsive agents, bait listings) and reframe your approach as the clean solution to it.' },
  { key: 'future_pace', label: 'Future-pace the move', brief: 'Walk them through the concrete next steps to keys-in-hand — make saying yes feel like a decision already made.' },
  { key: 'open_loop_close', label: 'Close the open loop', brief: 'Pick up something left open in the conversation (a question they asked, a promise we made) and close it decisively.' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lead_id, text, channel, angle_index } = body;
    if (!lead_id || !text?.trim?.()) {
      return Response.json({ error: 'Missing lead_id or text' }, { status: 400 });
    }

    // ── 1. THE BRAIN — lead record with all AI intelligence fields ──
    const L = await base44.asServiceRole.entities.Lead.get(lead_id);

    // ── 2. THE CONVO — recent messages across every channel ──
    const safeFilter = async (entityName, query, sort, limit) => {
      try {
        return await base44.asServiceRole.entities[entityName].filter(query, sort, limit);
      } catch { return []; }
    };

    const [wa, msgs, ems, ims, tgs, notes] = await Promise.all([
      safeFilter('WhatsAppMessage', { lead_id }, '-timestamp', 20),
      safeFilter('Message', { lead_id }, '-timestamp', 20),
      safeFilter('Email', { lead_id }, '-created_date', 8),
      safeFilter('IMessage', { lead_id }, '-sent_at', 8),
      safeFilter('TelegramMessage', { lead_id }, '-sent_at', 8),
      safeFilter('Note', { linked_lead_id: lead_id }, '-created_date', 5),
    ]);

    const conv = [];
    (wa || []).forEach((m) => conv.push({
      ts: m.timestamp, channel: 'WhatsApp',
      dir: (m.direction === 'inbound' || m.direction === 'incoming') ? '← lead' : '→ lead',
      text: m.text || m.caption || '',
    }));
    (msgs || []).forEach((m) => conv.push({
      ts: m.timestamp, channel: 'WhatsApp',
      dir: m.direction === 'incoming' ? '← lead' : '→ lead',
      text: m.text || '',
    }));
    (ems || []).forEach((e) => conv.push({
      ts: e.received_at || e.created_date, channel: 'Email',
      dir: e.direction === 'inbound' ? '← lead' : '→ lead',
      text: e.snippet || e.body_text || e.subject || '',
    }));
    (ims || []).forEach((m) => conv.push({
      ts: m.sent_at, channel: 'iMessage',
      dir: m.direction === 'inbound' ? '← lead' : '→ lead',
      text: m.body || '',
    }));
    (tgs || []).forEach((m) => conv.push({
      ts: m.sent_at || m.created_date, channel: 'Telegram',
      dir: m.direction === 'inbound' ? '← lead' : '→ lead',
      text: m.text || m.body || '',
    }));
    (notes || []).forEach((n) => conv.push({
      ts: n.created_date, channel: 'Note',
      dir: 'internal',
      text: n.body || n.content || n.text || '',
    }));

    conv.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
    const convText = conv.slice(0, 15)
      .map((c) => `[${c.channel} ${c.dir}] ${c.text || '(no text)'}`)
      .join('\n');

    // ── 3. Build the BRAIN context ──
    const isRent = L.intent === 'tenant';
    const nba = Array.isArray(L.ai_next_best_actions) && L.ai_next_best_actions[0] ? L.ai_next_best_actions[0] : null;
    const brain = [];
    if (L.ai_deal_thesis) brain.push(`DEAL THESIS: ${L.ai_deal_thesis}`);
    if (L.ai_rolling_summary) brain.push(`SITUATION SUMMARY: ${L.ai_rolling_summary}`);
    if (nba?.action) brain.push(`NEXT BEST ACTION (${nba.priority || 'medium'}): ${nba.action}`);
    if (nba?.reasoning) brain.push(`ACTION REASONING: ${nba.reasoning}`);
    if (L.ai_coaching_for_agent) brain.push(`COACHING: ${L.ai_coaching_for_agent}`);
    if (L.ai_momentum) brain.push(`MOMENTUM: ${L.ai_momentum}`);
    if (L.stage) brain.push(`PIPELINE STAGE: ${L.stage}`);
    if (L.ai_lead_score != null) brain.push(`LEAD SCORE: ${L.ai_lead_score}/100`);
    if (L.ai_conversion_probability != null) brain.push(`CONVERSION PROBABILITY: ${Math.round(L.ai_conversion_probability * 100)}%`);
    if (L.ai_strike_now) brain.push(`⚡ STRIKE NOW SIGNAL ACTIVE`);
    if (L.ai_buying_signals?.length) brain.push(`BUYING SIGNALS: ${L.ai_buying_signals.join('; ')}`);
    if (L.ai_red_flags?.length) brain.push(`RED FLAGS (landmines — avoid stepping on them): ${L.ai_red_flags.join('; ')}`);
    if (L.ai_suggested_messages?.length) {
      const top = L.ai_suggested_messages.slice(0, 2)
        .map((m) => `"${(m.text || '').slice(0, 120)}"`)
        .join(' | ');
      brain.push(`BRAIN'S SUGGESTED APPROACH: ${top}`);
    }

    // ── 4. Build the SEARCH context (rent-track aware) ──
    const search = [];
    if (L.full_name) search.push(`Lead: ${L.full_name}`);
    search.push(`Track: ${isRent ? 'RENT (tenant) — ALL MONEY FIGURES ARE ANNUAL RENT (AED/year)' : L.intent === 'buyer' ? 'SALE (buyer) — budget is purchase capital' : 'unknown (intake — clarify buy vs rent)'}`);
    if (L.budget_min || L.budget_max) search.push(`Budget: AED ${(L.budget_min || 0).toLocaleString()} – ${(L.budget_max || 0).toLocaleString()}${isRent ? ' per year' : ''}`);
    if (L.bedrooms_min != null || L.bedrooms_max != null) search.push(`Bedrooms: ${L.bedrooms_min ?? '?'}–${L.bedrooms_max ?? '?'}`);
    if (L.preferred_locations?.length) search.push(`Areas: ${L.preferred_locations.join(', ')}`);
    if (L.move_in_timeline) search.push(`Move-in timeline: ${L.move_in_timeline}`);
    if (isRent && L.cheques_count) search.push(`Cheque preference: ${L.cheques_count}/yr`);
    if (L.financing_method || L.financing_type) search.push(`Financing: ${L.financing_method || L.financing_type}`);
    if (L.preferred_language) search.push(`Preferred language: ${L.preferred_language}`);
    if (L.nationality) search.push(`Nationality: ${L.nationality}`);
    if (L.source) search.push(`Source: ${L.source}`);

    // ── 5. Select angle ──
    const aIdx = ((angle_index || 0) % MAGIC_ANGLES.length);
    const angle = MAGIC_ANGLES[aIdx];

    // ── 6. Call LLM with all three brains ──
    const prompt =
      `You are an elite Dubai real-estate agent rewriting a direct message from the AGENT to a property ${isRent ? 'TENANT (renting — money means ANNUAL RENT, never purchase)' : 'BUYER'} lead.\n\n` +
      `TASK: Rewrite the message below using a DIFFERENT, more powerful approach.\n\n` +
      `ANGLE TO USE: "${angle.label}"\n${angle.brief}\n\n` +
      `You have THREE sources of intelligence working together:\n\n` +
      `=== 1. THE BRAIN (AI strategic analysis of this lead) ===\n` +
      `${brain.length ? brain.join('\n') : '(No brain data yet — rely on conversation + search context)'}\n\n` +
      `=== 2. THE SEARCH (what they are hunting) ===\n` +
      `${search.length ? search.join('\n') : '(No search details available)'}\n\n` +
      `=== 3. THE CONVERSATION (recent cross-channel history, most recent first) ===\n` +
      `${convText || '(No recent conversation)'}\n\n` +
      `=== ORIGINAL MESSAGE TO RESHAPE ===\n${text}\n\n` +
      `RULES:\n` +
      `- The message must feel like a natural continuation of the conversation above. Reference what was already discussed; don't repeat things already said.\n` +
      `- Use the brain's deal thesis, next best action, and coaching to guide the angle and content. If the brain says STRIKE NOW, add appropriate urgency.\n` +
      `- Respect the track: ${isRent ? 'annual-rent framing only, cheques are a lever, move-in date drives urgency' : 'purchase framing; financing readiness is leverage'}.\n` +
      `- Keep EVERY factual detail from the original message. Invent nothing — no fake listings, prices, or availability that aren't in the context or original.\n` +
      `- Sound confident, specific and human — powerful but never sleazy, desperate, or long-winded.\n` +
      `- Keep it concise and punchy. One single, low-friction call to action at the end.\n` +
      `- Write in the SAME language as the original message.\n` +
      `- Output ONLY the rewritten message — no quotes, no commentary, no preamble.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: { type: 'object', properties: { message: { type: 'string' } } },
    });

    const message = res?.message || (typeof res === 'string' ? res : '');
    if (!message) throw new Error('No message returned from LLM');

    return Response.json({
      ok: true,
      message,
      angle_label: angle.label,
      next_angle_index: aIdx + 1,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
