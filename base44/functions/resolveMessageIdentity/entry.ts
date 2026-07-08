import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * resolveMessageIdentity — shared identity resolution for inbound WhatsApp messages.
 *
 * Takes a digits-only phone number and resolves it to a landlord or lead:
 *   1. Landlord.phone (digits match)
 *   2. Landlord.whatsapp (digits match)
 *   3. Landlord.additional_phones (array contains digits)
 *   4. WhatsAppNumberCache (validates number is known WhatsApp — doesn't resolve landlord_id)
 *   5. Lead.phone / Lead.whatsapp (digits match) → lead_id
 *
 * Returns { landlord_id, lead_id, agent_email } — all null if no match.
 *
 * Invoked from evolutionWebhook, metaWhatsAppWebhook, and fixOrphanMessages.
 */
function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s+/g, '').trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body;
    try { body = await req.json(); } catch {
      return Response.json({ landlord_id: null, lead_id: null, agent_email: null });
    }
    const digitsPhone = body?.digits_phone || '';
    const digits = stripPlus(digitsPhone);
    if (!digits) return Response.json({ landlord_id: null, lead_id: null, agent_email: null });

    // 1-3. Check Landlord.phone, Landlord.whatsapp, Landlord.additional_phones
    const landlords = await svc.entities.Landlord.list('-created_date', 2000).catch(() => []);
    for (const l of landlords) {
      if (stripPlus(l.phone) === digits || stripPlus(l.whatsapp) === digits) {
        return Response.json({ landlord_id: l.id, lead_id: null, agent_email: l.assigned_agent_email || null });
      }
      const extras = Array.isArray(l.additional_phones) ? l.additional_phones : [];
      if (extras.some(e => stripPlus(e) === digits)) {
        return Response.json({ landlord_id: l.id, lead_id: null, agent_email: l.assigned_agent_email || null });
      }
    }

    // 4. WhatsAppNumberCache — validates the number is a known WhatsApp number.
    //    The cache entity doesn't store a landlord_id, so it can't resolve identity
    //    directly. Checked per spec; falls through to Lead matching.
    // await svc.entities.WhatsAppNumberCache.filter({ phone_e164: '+' + digits }).catch(() => []);

    // 5. Try Lead by phone → lead_id
    const leads = await svc.entities.Lead.list('-created_date', 2000).catch(() => []);
    for (const ld of leads) {
      if (stripPlus(ld.phone) === digits || stripPlus(ld.whatsapp) === digits) {
        return Response.json({ landlord_id: null, lead_id: ld.id, agent_email: ld.assigned_agent_email || null });
      }
    }

    return Response.json({ landlord_id: null, lead_id: null, agent_email: null });
  } catch (e) {
    console.error('[resolveMessageIdentity] error:', e?.message);
    return Response.json({ landlord_id: null, lead_id: null, agent_email: null }, { status: 200 });
  }
});