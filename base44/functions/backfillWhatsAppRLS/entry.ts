import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Backfill: stamp assigned_agent_email on WhatsAppConversation + WhatsAppMessage
 * records that are missing it, by matching the conversation phone to a Landlord or Lead.
 *
 * This fixes the RLS visibility issue for existing data — non-admin users
 * couldn't see conversations/messages because assigned_agent_email was null.
 */

function normalizePhone(raw) {
  if (!raw) return '';
  let c = String(raw).replace(/[^\d+]/g, '');
  if (!c) return '';
  if (c.startsWith('+')) return c;
  if (c.startsWith('00')) return '+' + c.slice(2);
  if (c.startsWith('05') && c.length === 10) return '+971' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) return '+971' + c;
  if (c.length >= 10) return '+' + c;
  return c;
}

function toDigits(raw) { return String(raw || '').replace(/\D/g, ''); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const svc = base44.asServiceRole;

    // 1. Fetch all conversations missing assigned_agent_email
    const convs = await svc.entities.WhatsAppConversation.filter({});
    const unassigned = convs.filter(c => !c.assigned_agent_email);
    console.log(`[backfillWhatsAppRLS] Found ${unassigned.length} unassigned conversations (of ${convs.length} total)`);

    // 2. Build phone → agent lookup from Landlords
    const landlords = await svc.entities.Landlord.filter({});
    const landlordMap = new Map();
    for (const l of landlords) {
      const agentEmail = l.assigned_agent_email || l.listing_manager_email;
      if (!agentEmail) continue;
      for (const phone of [l.phone, l.whatsapp, ...(l.additional_phones || [])]) {
        if (phone) {
          const norm = normalizePhone(phone);
          const digits = toDigits(phone);
          landlordMap.set(norm, { agentEmail, landlordId: l.id });
          landlordMap.set(digits, { agentEmail, landlordId: l.id });
        }
      }
    }

    // 3. Build phone → agent lookup from Leads
    const leads = await svc.entities.Lead.filter({});
    const leadMap = new Map();
    for (const l of leads) {
      const agentEmail = l.assigned_agent_email;
      if (!agentEmail) continue;
      for (const phone of [l.phone, l.whatsapp]) {
        if (phone) {
          const norm = normalizePhone(phone);
          const digits = toDigits(phone);
          leadMap.set(norm, { agentEmail, leadId: l.id });
          leadMap.set(digits, { agentEmail, leadId: l.id });
        }
      }
    }

    let fixed = 0;
    let msgFixed = 0;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (const conv of unassigned) {
      const phone = conv.wa_phone_e164 || conv.phone_number || '';
      if (!phone) continue;

      const norm = normalizePhone(phone);
      const digits = toDigits(phone);

      const llMatch = landlordMap.get(norm) || landlordMap.get(digits);
      const leadMatch = leadMap.get(norm) || leadMap.get(digits);
      const match = llMatch || leadMatch;

      if (!match) continue;

      try {
        await svc.entities.WhatsAppConversation.update(conv.id, {
          assigned_agent_email: match.agentEmail,
        });
        fixed++;
        await sleep(150); // throttle to avoid 429

        // Also fix messages in this conversation
        const msgs = await svc.entities.WhatsAppMessage.filter({ conversation_id: conv.id });
        await sleep(100);
        for (const m of (msgs || [])) {
          if (!m.assigned_agent_email) {
            await svc.entities.WhatsAppMessage.update(m.id, {
              assigned_agent_email: match.agentEmail,
            }).catch(() => {});
            msgFixed++;
            await sleep(100);
          }
        }
      } catch (err) {
        console.warn(`[backfillWhatsAppRLS] Failed to fix conv ${conv.id}: ${err?.message}`);
        await sleep(500); // back off after rate limit
      }
    }

    return Response.json({
      status: 'ok',
      total_conversations: convs.length,
      unassigned_found: unassigned.length,
      conversations_fixed: fixed,
      messages_fixed: msgFixed,
    });
  } catch (error) {
    console.error('[backfillWhatsAppRLS] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});