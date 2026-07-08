// magicReshapeV2 — deep-context message rewrite.
// Merges THREE brains into a single powerful LLM prompt:
//   1. THE BRAIN  — landlord AI intelligence (deal thesis, next best action,
//      coaching, objections, momentum, rapport, mandate, trust score, strike-now)
//   2. THE UNIT   — unit reference, project, asking price, layout, handover, language
//   3. THE CONVO   — recent messages across WhatsApp, Email, iMessage, Telegram, Notes
//
// Input:  { landlord_id, text, channel, angle_index }
// Output: { ok, message, angle_label, next_angle_index }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MAGIC_ANGLES = [
  { key: 'buyer_led', label: 'Ready-buyer urgency', brief: 'Lead with a specific, ready buyer actively looking in their building — make the buyer feel real and imminent, not speculative.' },
  { key: 'market_gift', label: 'Market intelligence gift', brief: 'Open with a sharp, specific market insight about their project (recent transactions, AED/sqft, demand trend) delivered as a gift before any ask.' },
  { key: 'hyper_specialist', label: 'Hyper-specialist asset proof', brief: 'Demonstrate you know their exact unit, floor, stack, view and recent comps better than any other broker — proof by specificity, not adjectives.' },
  { key: 'social_proof', label: 'Credibility stack', brief: 'Lead with recent closed deals in the SAME project/building as concrete social proof you are the broker who actually transacts here.' },
  { key: 'collaboration', label: 'Co-broker collaboration', brief: 'Position yourself as working alongside whoever they may already be listed with — collaborative, not competitive.' },
  { key: 'funds_on_table', label: 'Funds on the table', brief: 'Emphasize the buyer has funds ready to deposit now and can move fast — reduce the owner\'s perceived risk and friction.' },
  { key: 'no_ask', label: 'No-ask value interrupt', brief: 'Deliver genuine value first with ZERO ask for the listing — a soft, non-transactional interrupt that earns a reply.' },
  { key: 'scarcity_window', label: 'Scarcity / closing window', brief: 'Frame the buyer or market window as narrow right now — give a concrete reason to act this week, not next month.' },
  { key: 'pain_reframe', label: 'Pain-point reframe', brief: 'Name the owner\'s likely pain (time-wasters, lowballs, stale listing) and reframe your approach as the clean solution to it.' },
  { key: 'future_pace', label: 'Future-pace the close', brief: 'Walk the owner through the concrete next steps and the outcome they want — make saying yes feel like a decision already made.' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { landlord_id, text, channel, angle_index } = body;
    if (!landlord_id || !text?.trim?.()) {
      return Response.json({ error: 'Missing landlord_id or text' }, { status: 400 });
    }

    // ── 1. THE BRAIN — landlord record with all AI intelligence fields ──
    const ll = await base44.asServiceRole.entities.Landlord.get(landlord_id);

    // ── 2. THE CONVO — recent messages across every channel ──
    const safeFilter = async (entityName, sort, limit) => {
      try {
        return await base44.asServiceRole.entities[entityName].filter({ landlord_id }, sort, limit);
      } catch { return []; }
    };

    const [wa, ems, ims, tgs, notes] = await Promise.all([
      safeFilter('Message', '-timestamp', 20),
      safeFilter('Email', '-received_at', 8),
      safeFilter('IMessage', '-sent_at', 8),
      safeFilter('TelegramMessage', '-created_date', 8),
      safeFilter('LandlordNote', '-created_date', 5),
    ]);

    // Normalize into a unified timeline
    const conv: any[] = [];
    (wa || []).forEach((m: any) => conv.push({
      ts: m.timestamp, channel: 'WhatsApp',
      dir: m.direction === 'incoming' ? '← landlord' : '→ landlord',
      text: m.text || '',
    }));
    (ems || []).forEach((e: any) => conv.push({
      ts: e.received_at, channel: 'Email',
      dir: e.direction === 'inbound' ? '← landlord' : '→ landlord',
      text: e.snippet || e.body_text || e.subject || '',
    }));
    (ims || []).forEach((m: any) => conv.push({
      ts: m.sent_at, channel: 'iMessage',
      dir: m.direction === 'inbound' ? '← landlord' : '→ landlord',
      text: m.body || '',
    }));
    (tgs || []).forEach((m: any) => conv.push({
      ts: m.created_date, channel: 'Telegram',
      dir: m.direction === 'inbound' ? '← landlord' : '→ landlord',
      text: m.text || m.body || '',
    }));
    (notes || []).forEach((n: any) => conv.push({
      ts: n.created_date, channel: 'Note',
      dir: 'internal',
      text: n.body || n.content || n.text || '',
    }));

    conv.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
    const convText = conv.slice(0, 15)
      .map((c) => `[${c.channel} ${c.dir}] ${c.text || '(no text)'}`)
      .join('\n');

    // ── 3. Build the BRAIN context ──
    const brain: string[] = [];
    if (ll.ai_deal_thesis) brain.push(`DEAL THESIS: ${ll.ai_deal_thesis}`);
    if (ll.ai_rolling_summary) brain.push(`SITUATION SUMMARY: ${ll.ai_rolling_summary}`);
    if (ll.ai_next_best_action?.action) brain.push(`NEXT BEST ACTION (${ll.ai_next_best_action.priority || 'medium'}): ${ll.ai_next_best_action.action}`);
    if (ll.ai_next_best_action?.reasoning) brain.push(`ACTION REASONING: ${ll.ai_next_best_action.reasoning}`);
    if (ll.ai_coaching_for_agent) brain.push(`COACHING: ${ll.ai_coaching_for_agent}`);
    if (ll.ai_objections?.length) brain.push(`KNOWN OBJECTIONS: ${ll.ai_objections.join('; ')}`);
    if (ll.ai_competitive_intel) brain.push(`COMPETITIVE INTEL: ${ll.ai_competitive_intel}`);
    if (ll.ai_momentum) brain.push(`MOMENTUM: ${ll.ai_momentum}`);
    if (ll.rapport_level) brain.push(`RAPPORT: ${ll.rapport_level}`);
    if (ll.stage) brain.push(`PIPELINE STAGE: ${ll.stage}`);
    if (ll.mandate_status) brain.push(`MANDATE: ${ll.mandate_status}`);
    if (ll.trust_score) brain.push(`TRUST SCORE: ${ll.trust_score}/100`);
    if (ll.urgency_score) brain.push(`URGENCY: ${ll.urgency_score}/100`);
    if (ll.ai_strike_now) brain.push(`⚡ STRIKE NOW SIGNAL ACTIVE`);
    if (ll.buying_signals?.length) brain.push(`SELLING SIGNALS: ${ll.buying_signals.join('; ')}`);
    if (ll.ai_suggested_messages?.length) {
      const top = ll.ai_suggested_messages.slice(0, 2)
        .map((m: any) => `"${(m.text || '').slice(0, 120)}"`)
        .join(' | ');
      brain.push(`BRAIN'S SUGGESTED APPROACH: ${top}`);
    }

    // ── 4. Build the UNIT context ──
    const unit: string[] = [];
    if (ll.full_name_en) unit.push(`Owner: ${ll.full_name_en}`);
    if (ll.unit_reference) unit.push(`Unit: ${ll.unit_reference}`);
    if (ll.project_name) unit.push(`Project: ${ll.project_name}`);
    if (ll.asking_price_aed) unit.push(`Asking: AED ${ll.asking_price_aed}`);
    if (ll.unit_layout) unit.push(`Layout: ${ll.unit_layout}`);
    if (ll.handover_status) unit.push(`Handover: ${ll.handover_status}`);
    if (ll.preferred_language) unit.push(`Preferred language: ${ll.preferred_language}`);
    if (ll.nationality) unit.push(`Nationality: ${ll.nationality}`);
    if (ll.source) unit.push(`Source: ${ll.source}`);

    // ── 5. Select angle ──
    const aIdx = ((angle_index || 0) % MAGIC_ANGLES.length);
    const angle = MAGIC_ANGLES[aIdx];

    // ── 6. Call LLM with all three brains ──
    const prompt =
      `You are an elite Dubai real-estate broker rewriting a direct message from the AGENT to the LANDLORD (property owner).\n\n` +
      `TASK: Rewrite the message below using a DIFFERENT, more powerful approach.\n\n` +
      `ANGLE TO USE: "${angle.label}"\n${angle.brief}\n\n` +
      `You have THREE sources of intelligence working together:\n\n` +
      `=== 1. THE BRAIN (AI strategic analysis of this landlord) ===\n` +
      `${brain.length ? brain.join('\n') : '(No brain data yet — rely on conversation + unit context)'}\n\n` +
      `=== 2. THE UNIT (property details) ===\n` +
      `${unit.length ? unit.join('\n') : '(No unit details available)'}\n\n` +
      `=== 3. THE CONVERSATION (recent cross-channel history, most recent first) ===\n` +
      `${convText || '(No recent conversation)'}\n\n` +
      `=== ORIGINAL MESSAGE TO RESHAPE ===\n${text}\n\n` +
      `RULES:\n` +
      `- The message must feel like a natural continuation of the conversation above. Reference what was already discussed; don't repeat things already said.\n` +
      `- Use the brain's deal thesis, next best action, and coaching to guide the angle and content. If the brain says STRIKE NOW, add appropriate urgency.\n` +
      `- If there are known objections, address or preempt them naturally without being defensive.\n` +
      `- Ground it in the specific unit number and project so it is unmistakably about THEIR property.\n` +
      `- Keep EVERY factual detail from the original message. Invent nothing — no fake buyers, prices, or deals that aren't in the context or original.\n` +
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