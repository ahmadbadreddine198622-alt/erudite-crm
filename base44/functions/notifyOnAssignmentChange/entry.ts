import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Fires on entity updates (Lead, Landlord, WhatsAppConversation).
// When assigned_agent_email changes, sends the assigned agent:
//   1. An email notification (via Base44 SendEmail integration)
//   2. A personal-WhatsApp message (via Evolution API, same channel that powers
//      the rest of the personal-WhatsApp features in the app)
// Both messages include the entity's name so the agent immediately sees who.

const EVOLUTION_INSTANCE = 'erudite_whatsapp';
const APP_BASE_URL = 'https://dubai-estate-pro.base44.app';

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

async function sendEmail(base44, { to, subject, body }) {
  return await base44.integrations.Core.SendEmail({ to, subject, body });
}

async function sendPersonalWhatsApp(agentPhone, text) {
  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!apiUrl || !apiKey) {
    return { ok: false, error: 'Evolution secrets missing (EVOLUTION_API_URL / EVOLUTION_API_KEY)' };
  }
  const number = toDigits(agentPhone);
  if (!number) return { ok: false, error: 'Agent has no phone on their User profile' };
  const sendUrl = `${apiUrl}/message/sendText/${EVOLUTION_INSTANCE}`;
  try {
    const resp = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number, text }),
    });
    const raw = await resp.text();
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    if (!resp.ok) return { ok: false, error: `Evolution ${resp.status}`, detail: parsed };
    return { ok: true, response: parsed };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

async function lookupAgent(base44, email) {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email });
    return users && users[0] ? users[0] : null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Only proceed when the assigned agent actually changed (and is set).
    if (!data?.assigned_agent_email || data.assigned_agent_email === old_data?.assigned_agent_email) {
      return Response.json({ skipped: 'No assignment change' });
    }

    // Who assigned it (best-effort; service role won't have a user)
    let assigned_by = 'System';
    try {
      const currentUser = await base44.auth.me();
      if (currentUser) assigned_by = currentUser.full_name || currentUser.email;
    } catch (_) {}

    const agentEmail = data.assigned_agent_email;
    const agent = await lookupAgent(base44, agentEmail);
    const agentName = agent?.full_name || agentEmail.split('@')[0];
    const agentPhone = agent?.phone || null;

    // Resolve the entity-specific display name + deep link
    let entityKind = '';
    let entityName = '';
    let entityPhone = '';
    let entityLink = '';
    let emoji = '';

    const en = event?.entity_name;
    if (en === 'Lead') {
      entityKind = 'Lead';
      entityName = data.full_name || data.name || 'Unknown lead';
      entityPhone = data.phone || '';
      entityLink = `${APP_BASE_URL}/leads?id=${data.id}`;
      emoji = '🎯';
    } else if (en === 'Landlord') {
      entityKind = 'Landlord';
      entityName = data.full_name_en || data.full_name_ar
        || [data.first_name, data.last_name].filter(Boolean).join(' ')
        || 'Unknown landlord';
      entityPhone = data.phone || '';
      entityLink = `${APP_BASE_URL}/landlord/${data.id}`;
      emoji = '🏠';
    } else if (en === 'WhatsAppConversation') {
      entityKind = 'WhatsApp conversation';
      // Try to pull the linked lead's name for richer context
      let leadName = null;
      if (data.lead_id) {
        try {
          const leads = await base44.asServiceRole.entities.Lead.filter({ id: data.lead_id }, '-created_date', 1);
          leadName = leads?.[0]?.full_name;
        } catch (_) {}
      }
      entityName = leadName || data.wa_saved_name || data.wa_display_name || data.wa_phone_e164 || 'Unknown contact';
      entityPhone = data.wa_phone_e164 || data.phone_number || '';
      entityLink = `${APP_BASE_URL}/whatsapp`;
      emoji = '💬';
    } else {
      return Response.json({ skipped: `Unsupported entity type: ${en}` });
    }

    // ───── Email ─────
    const subject = `${emoji} ${entityKind} assigned to you: ${entityName}`;
    const body = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px;">
        <h2 style="margin: 0 0 8px;">${emoji} ${entityKind} Assigned</h2>
        <p style="margin: 0 0 16px; color: #444;">Hi ${agentName},</p>
        <p style="margin: 0 0 16px;">A ${entityKind.toLowerCase()} has been assigned to you:</p>
        <table style="border-collapse: collapse; margin: 0 0 20px; width: 100%;">
          <tr>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb; background: #f9fafb; width: 140px;"><strong>Name</strong></td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${entityName}</td>
          </tr>
          ${entityPhone ? `
          <tr>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Phone</strong></td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${entityPhone}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Assigned by</strong></td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${assigned_by}</td>
          </tr>
        </table>
        <p>
          <a href="${entityLink}" style="background: #f59e0b; color: #1a1205; padding: 11px 22px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            Open in CRM
          </a>
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Erudite Property CRM</p>
      </div>
    `;

    let emailResult = null;
    let emailError = null;
    try {
      emailResult = await sendEmail(base44, { to: agentEmail, subject, body });
    } catch (e) {
      emailError = String(e && e.message ? e.message : e);
    }

    // ───── Personal WhatsApp ping ─────
    let waResult = null;
    if (agentPhone) {
      const lines = [
        `${emoji} ${entityKind} assigned: *${entityName}*`,
        entityPhone ? `📞 ${entityPhone}` : null,
        `Assigned by: ${assigned_by}`,
        '',
        `Open: ${entityLink}`,
      ].filter(Boolean);
      waResult = await sendPersonalWhatsApp(agentPhone, lines.join('\n'));
    } else {
      waResult = { ok: false, error: 'No phone on agent User record — set it in their profile to receive WhatsApp pings.' };
    }

    return Response.json({
      success: true,
      entity_kind: entityKind,
      entity_name: entityName,
      notified_agent: agentEmail,
      email: emailError ? { ok: false, error: emailError } : { ok: true, result: emailResult },
      whatsapp: waResult,
    });
  } catch (error) {
    console.error('Assignment notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});