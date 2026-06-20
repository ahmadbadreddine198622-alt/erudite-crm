import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * propagateWhatsAppOwnership
 *
 * Triggered by the WhatsAppConversation update automation.
 * When a conversation's assigned_agent_email changes, stamps the new value
 * onto all WhatsAppMessage rows in that conversation.
 *
 * Payload from entity automation:
 *   { event, data, old_data, changed_fields }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const conversationId = body?.event?.entity_id || body?.data?.id;
    const newAgentEmail = body?.data?.assigned_agent_email || null;
    const oldAgentEmail = body?.old_data?.assigned_agent_email || null;
    const changedFields = body?.changed_fields || [];

    // Only act if assigned_agent_email actually changed
    if (!changedFields.includes('assigned_agent_email') && newAgentEmail === oldAgentEmail) {
      return Response.json({ status: 'skipped', reason: 'assigned_agent_email not changed' });
    }

    if (!conversationId) {
      return Response.json({ status: 'skipped', reason: 'no conversation_id' });
    }

    console.log(`[propagateWhatsAppOwnership] conv=${conversationId} old=${oldAgentEmail} → new=${newAgentEmail}`);

    // Fetch all messages in this conversation
    const messages = await base44.asServiceRole.entities.WhatsAppMessage.filter(
      { conversation_id: conversationId },
      '-timestamp',
      500
    );

    if (!messages || messages.length === 0) {
      return Response.json({ status: 'ok', updated: 0, reason: 'no messages in conversation' });
    }

    // Stamp all with new owner (or null if unassigned)
    let updated = 0;
    let errors = 0;
    for (const msg of messages) {
      // Skip if already correct
      if (msg.assigned_agent_email === newAgentEmail) continue;
      try {
        await base44.asServiceRole.entities.WhatsAppMessage.update(msg.id, {
          assigned_agent_email: newAgentEmail,
        });
        updated++;
      } catch (e) {
        console.warn(`[propagateWhatsAppOwnership] msg ${msg.id} update failed: ${e?.message}`);
        errors++;
      }
    }

    console.log(`[propagateWhatsAppOwnership] conv=${conversationId} stamped ${updated} messages, ${errors} errors`);
    return Response.json({ status: 'ok', conversation_id: conversationId, updated, errors, total: messages.length });

  } catch (error) {
    console.error('[propagateWhatsAppOwnership] error:', error?.message || error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});