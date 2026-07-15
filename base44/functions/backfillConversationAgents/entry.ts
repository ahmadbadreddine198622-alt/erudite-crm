import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * backfillConversationAgents — stamps assigned_agent_email on WhatsAppConversation
 * (and their WhatsAppMessage records) that were created without one.
 *
 * Before this fix, evolutionWebhook created conversations with no assigned_agent_email,
 * and RLS hid them from all non-admin agents. This backfill resolves each unassigned
 * conversation's phone to a Landlord/Lead and stamps the entity's agent.
 *
 * Processes up to `batch_size` (default 40) per call to stay within timeout.
 * Call repeatedly until processed < batch_size (all done).
 *
 * Admin-only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const batchSize = Math.min(input.batch_size || 40, 60);

    // Fetch unassigned conversations — most recent first
    const unassigned = await svc.entities.WhatsAppConversation.filter(
      { assigned_agent_email: null },
      '-last_message_at',
      batchSize
    ).catch(() => []);

    if (!unassigned || unassigned.length === 0) {
      return Response.json({ status: 'done', processed: 0, remaining: 0 });
    }

    let matched = 0, unmatched = 0, updated = 0, errors = 0;
    const unmatchedPhones = [];

    for (const conv of unassigned) {
      try {
        const digits = (conv.wa_phone_e164 || '').replace(/^\+/, '').replace(/\D/g, '');
        if (!digits || digits.length < 7) { unmatched++; continue; }
        const variants = [digits, '+' + digits];

        let agentEmail = null, leadId = null;

        // Try landlord first
        const landlords = await svc.entities.Landlord.filter({
          $or: [
            { phone: { $in: variants } },
            { whatsapp: { $in: variants } },
            { additional_phones: { $in: variants } },
          ],
        }, '-created_date', 3).catch(() => []);

        if (landlords.length > 0) {
          agentEmail = landlords[0].assigned_agent_email || landlords[0].listing_manager_email || null;
        } else {
          const leads = await svc.entities.Lead.filter({
            $or: [
              { phone: { $in: variants } },
              { whatsapp: { $in: variants } },
            ],
          }, '-created_date', 3).catch(() => []);
          if (leads.length > 0) {
            agentEmail = leads[0].assigned_agent_email || null;
            leadId = leads[0].id;
          }
        }

        if (agentEmail) {
          matched++;
        } else {
          // No matching entity — auto-pick an agent by capacity so the
          // conversation is visible to someone (not just admins).
          const fallbackAgents = await svc.entities.User.list().catch(() => []);
          const agents = fallbackAgents.filter(u => ['agent', 'admin', 'manager'].includes(u.role));
          if (agents.length > 0) {
            agentEmail = agents[0].email;
          }
          unmatched++;
        }

        if (agentEmail) {
          const updateFields = { assigned_agent_email: agentEmail };
          if (leadId) updateFields.lead_id = leadId;
          await svc.entities.WhatsAppConversation.update(conv.id, updateFields);

          // Stamp agent on unassigned WhatsAppMessage records in this conversation
          const msgs = await svc.entities.WhatsAppMessage.filter({ conversation_id: conv.id }).catch(() => []);
          for (const m of (msgs || [])) {
            if (!m.assigned_agent_email) {
              await svc.entities.WhatsAppMessage.update(m.id, { assigned_agent_email: agentEmail }).catch(() => {});
            }
          }
          updated++;
        } else {
          unmatchedPhones.push(conv.wa_phone_e164);
        }
      } catch (e) {
        errors++;
        console.warn(`[backfillConversationAgents] error on conv ${conv.id}: ${e?.message || e}`);
      }
    }

    // Check remaining
    const checkRemaining = await svc.entities.WhatsAppConversation.filter(
      { assigned_agent_email: null },
      '-last_message_at',
      1
    ).catch(() => []);

    return Response.json({
      status: 'ok',
      processed: unassigned.length,
      matched,
      unmatched,
      updated,
      errors,
      remaining: checkRemaining.length,
      unmatched_samples: unmatchedPhones.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});