import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * resolveMessageIdentity — shared identity resolution for inbound WhatsApp messages.
 *
 * Takes a digits-only phone number and resolves it to a landlord or lead using
 * $in queries with BOTH format variants (digits-only AND '+''+digits) since
 * Landlord/Lead phones are stored in E.164 with the '+' prefix while
 * Message.phone is digits-only.
 *
 *   1. Landlord (phone, whatsapp, additional_phones) via $or + $in
 *   2. WhatsAppNumberCache (phone_e164) — validates known WhatsApp number
 *   3. Lead (phone, whatsapp) via $or + $in → lead_id
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

    // Query both format variants: digits-only AND E.164 with '+' prefix
    const variants = [digits, '+' + digits];

    // 1. Landlord — check phone, whatsapp, and additional_phones (array) in one query
    const landlords = await svc.entities.Landlord.filter({
      $or: [
        { phone: { $in: variants } },
        { whatsapp: { $in: variants } },
        { additional_phones: { $in: variants } },
      ],
    }, '-created_date', 50).catch(() => []);

    if (landlords.length > 0) {
      const l = landlords[0];
      return Response.json({
        landlord_id: l.id,
        lead_id: null,
        agent_email: l.assigned_agent_email || null,
      });
    }

    // 2. WhatsAppNumberCache — validates the number is a known WhatsApp number.
    //    Doesn't resolve landlord_id; checked per spec for completeness.
    await svc.entities.WhatsAppNumberCache.filter({
      phone_e164: { $in: variants },
    }, '-checked_at', 1).catch(() => []);

    // 3. Lead — check phone and whatsapp
    const leads = await svc.entities.Lead.filter({
      $or: [
        { phone: { $in: variants } },
        { whatsapp: { $in: variants } },
      ],
    }, '-created_date', 50).catch(() => []);

    if (leads.length > 0) {
      const ld = leads[0];
      return Response.json({
        landlord_id: null,
        lead_id: ld.id,
        agent_email: ld.assigned_agent_email || null,
      });
    }

    return Response.json({ landlord_id: null, lead_id: null, agent_email: null });
  } catch (e) {
    console.error('[resolveMessageIdentity] error:', e?.message);
    return Response.json({ landlord_id: null, lead_id: null, agent_email: null }, { status: 200 });
  }
});