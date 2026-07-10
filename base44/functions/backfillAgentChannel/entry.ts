import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Backfill: reclassify WhatsApp messages + conversations that were recorded
 * as channel='personal' but actually belong to an agent's own Evolution line.
 *
 * For each agent who has whatsapp_instance + whatsapp_number configured in
 * their Profile, find WhatsAppMessage rows whose from_number/to_number matches
 * that agent's own number AND channel='personal', and update them to 'agent'.
 * Also fix WhatsAppConversation rows the same way.
 *
 * Never touches Ahmad's personal number (+971581806000) or the business line.
 * Admin-only.
 */

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate below */ }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const svc = base44.asServiceRole;

  // Ahmad's personal number — never reclassify these.
  const AHMAD_DIGITS = toDigits('+971581806000');
  const BUSINESS_DIGITS = toDigits('+971582806000');

  // Gather all agents who have their own WhatsApp line configured.
  const agents = await svc.entities.User.list('-created_date', 500);
  const agentLines = agents
    .filter((u) => u.whatsapp_instance && u.whatsapp_number)
    .map((u) => ({ email: u.email, instance: u.whatsapp_instance, number: u.whatsapp_number, digits: toDigits(u.whatsapp_number) }))
    .filter((a) => a.digits && a.digits !== AHMAD_DIGITS && a.digits !== BUSINESS_DIGITS);

  if (!agentLines.length) {
    return Response.json({ status: 'no_agent_lines', message: 'No agents have a configured WhatsApp line to backfill.' });
  }

  let msgFixed = 0;
  let convFixed = 0;
  const perAgent = [];

  for (const agent of agentLines) {
    // WhatsAppMessage: from_number match (agent sent it) OR to_number match (agent received it),
    // currently labelled 'personal'.
    const fromMsgs = await svc.entities.WhatsAppMessage.filter({ from_number: agent.number, channel: 'personal' }, '-created_date', 500);
    const toMsgs = await svc.entities.WhatsAppMessage.filter({ to_number: agent.number, channel: 'personal' }, '-created_date', 500);
    // Dedupe by id
    const seen = new Set();
    const toFix = [...fromMsgs, ...toMsgs].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    let agentMsgFixed = 0;
    for (const m of toFix) {
      try {
        await svc.entities.WhatsAppMessage.update(m.id, { channel: 'agent', assigned_agent_email: m.assigned_agent_email || agent.email });
        agentMsgFixed++;
      } catch (e) { /* skip on error, continue */ }
    }

    // WhatsAppConversation: assigned to this agent and channel='personal' → 'agent'.
    // Also catch conversations with no owner but whose phone matches an agent-owned thread.
    const convs = await svc.entities.WhatsAppConversation.filter({ assigned_agent_email: agent.email, channel: 'personal' }, '-created_date', 200);
    let agentConvFixed = 0;
    for (const c of convs) {
      try {
        await svc.entities.WhatsAppConversation.update(c.id, { channel: 'agent' });
        agentConvFixed++;
      } catch (e) { /* skip */ }
    }

    msgFixed += agentMsgFixed;
    convFixed += agentConvFixed;
    perAgent.push({ email: agent.email, instance: agent.instance, number: agent.number, messages_fixed: agentMsgFixed, conversations_fixed: agentConvFixed });
  }

  return Response.json({
    status: 'ok',
    agents_checked: agentLines.length,
    messages_reclassified: msgFixed,
    conversations_reclassified: convFixed,
    per_agent: perAgent,
  });
});