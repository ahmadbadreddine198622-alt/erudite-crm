import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * notifyPhotographyEvent — unified WhatsApp + Email notifications for the
 * photography workflow (Landlord record ⇄ Photographer exchange).
 *
 * Payload: { task_id, event, meta? }
 *   event:
 *     'task_assigned'  → notifies the assigned PHOTOGRAPHER (new/reassigned shoot)
 *                        Channels: WhatsApp + Email
 *     'links_saved'    → notifies the landlord's assigned AGENT (3D tour / video /
 *                        photos delivered). Channels: WhatsApp + Email
 *     'stage_advanced' → notifies the assigned AGENT (task moved through workflow)
 *                        Channels: WhatsApp only (lightweight ping)
 *                        meta: { new_stage }
 *
 * WhatsApp goes out via the Evolution personal channel (instance erudite_whatsapp),
 * same proven pattern as notifyOnAssignmentChange. Designed to be invoked
 * fire-and-forget: it never throws into callers, it reports per-channel results.
 */

const EVOLUTION_INSTANCE = 'erudite_whatsapp';
const APP_BASE_URL = 'https://app.erudite-estate.com';

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  pre_shoot_check: 'Pre-Shoot Check',
  shooting: 'Shooting',
  uploaded_3d: '3D Uploaded',
  editing: 'Editing',
  complete: 'Complete',
  handed_to_listing: 'Handed to Listing',
};

function toDigits(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

function fmtDubai(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Dubai',
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) {
    return '';
  }
}

async function sendWhatsApp(phone: string, text: string) {
  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!apiUrl || !apiKey) {
    return { ok: false, error: 'Evolution secrets missing (EVOLUTION_API_URL / EVOLUTION_API_KEY)' };
  }
  const number = toDigits(phone);
  if (!number) return { ok: false, error: 'Recipient has no phone on their User profile' };
  try {
    const resp = await fetch(`${apiUrl}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number, text }),
    });
    const raw = await resp.text();
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    if (!resp.ok) return { ok: false, error: `Evolution ${resp.status}`, detail: parsed };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function lookupUser(base44: any, email: string) {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email });
    return users?.[0] || null;
  } catch (_) {
    return null;
  }
}

function goldButton(href: string, label: string): string {
  return `<p style="margin: 20px 0;"><a href="${href}" style="background: #f59e0b; color: #1a1205; padding: 11px 22px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">${label}</a></p>`;
}

function infoRow(label: string, value: string): string {
  if (!value) return '';
  return `<tr>
    <td style="padding: 10px 12px; border: 1px solid #e5e7eb; background: #f9fafb; width: 150px;"><strong>${label}</strong></td>
    <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${value}</td>
  </tr>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { task_id, event, meta = {} } = await req.json();

    if (!task_id || !event) {
      return Response.json({ error: 'task_id and event required' }, { status: 400 });
    }

    // ── Load the task + its landlord + property (service role: callable from backend) ──
    const tasks = await base44.asServiceRole.entities.PhotographyTask.filter({ id: task_id });
    const task = tasks?.[0];
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

    const landlords = task.landlord_id
      ? await base44.asServiceRole.entities.Landlord.filter({ id: task.landlord_id })
      : [];
    const landlord = landlords?.[0] || {};

    const lps = task.landlord_property_id
      ? await base44.asServiceRole.entities.LandlordProperty.filter({ id: task.landlord_property_id })
      : [];
    const lp = lps?.[0] || {};

    const ownerName = landlord.full_name_en || landlord.full_name || 'Unknown owner';
    const project = landlord.project_name || '';
    const unit = landlord.unit_reference || '';
    const unitTag = unit ? ` · Unit ${unit}` : '';
    const landlordLink = landlord.id ? `${APP_BASE_URL}/landlord/${landlord.id}` : APP_BASE_URL;
    const worklistLink = `${APP_BASE_URL}/photography`;

    let result: any = { event, task_id };

    // ═══════════════════════════════════════════════════════════════════
    // EVENT 1: task_assigned → notify the PHOTOGRAPHER (WhatsApp + Email)
    // ═══════════════════════════════════════════════════════════════════
    if (event === 'task_assigned') {
      const photographerEmail = task.assigned_photographer_email;
      if (!photographerEmail) return Response.json({ skipped: 'No photographer assigned on task' });

      const photographer = await lookupUser(base44, photographerEmail);
      const photographerName = photographer?.full_name || photographerEmail.split('@')[0];
      const keys = lp.keys_location ? String(lp.keys_location).replace(/_/g, ' ') : '';
      const scheduled = fmtDubai(lp.photoshoot_scheduled_at);

      // WhatsApp
      const waLines = [
        `📸 *New Shoot Assigned* — ${ownerName}`,
        project || unit ? `🏢 ${[project, unit ? `Unit ${unit}` : ''].filter(Boolean).join(' · ')}` : null,
        keys ? `🔑 Keys: ${keys}` : null,
        lp.key_access_instructions ? `📝 ${lp.key_access_instructions}` : null,
        scheduled ? `📅 Shoot: ${scheduled} (Dubai)` : `📅 Shoot: to be scheduled`,
        '',
        `Open your worklist: ${worklistLink}`,
      ].filter((l) => l !== null);
      const whatsapp = await sendWhatsApp(photographer?.phone, waLines.join('\n'));

      // Email
      let email: any = null;
      try {
        const body = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px;">
            <h2 style="margin: 0 0 8px;">📸 New Shoot Assigned</h2>
            <p style="margin: 0 0 16px; color: #444;">Hi ${photographerName},</p>
            <p style="margin: 0 0 16px;">A photo / video / 3D tour task has been assigned to you:</p>
            <table style="border-collapse: collapse; margin: 0 0 8px; width: 100%;">
              ${infoRow('Owner', ownerName)}
              ${infoRow('Project', project)}
              ${infoRow('Unit', unit)}
              ${infoRow('Keys', keys)}
              ${infoRow('Access notes', lp.key_access_instructions || '')}
              ${infoRow('Shoot', scheduled || 'To be scheduled')}
            </table>
            ${goldButton(worklistLink, 'Open Photography Worklist')}
            <p style="color: #888; font-size: 12px; margin-top: 24px;">Erudite Property CRM</p>
          </div>`;
        email = await base44.integrations.Core.SendEmail({
          to: photographerEmail,
          subject: `📸 New shoot assigned — ${ownerName}${unitTag}`,
          body,
          from_name: 'Erudite CRM',
        });
        email = { ok: true, result: email };
      } catch (e) {
        email = { ok: false, error: String(e?.message || e) };
      }

      result = { ...result, notified: photographerEmail, whatsapp, email };
    }

    // ═══════════════════════════════════════════════════════════════════
    // EVENT 2: links_saved → notify the assigned AGENT (WhatsApp + Email)
    // ═══════════════════════════════════════════════════════════════════
    else if (event === 'links_saved') {
      const agentEmail = landlord.assigned_agent_email;
      if (!agentEmail) return Response.json({ skipped: 'No assigned agent on landlord' });

      const agent = await lookupUser(base44, agentEmail);
      const agentName = agent?.full_name || agentEmail.split('@')[0];
      const photographerName = (task.assigned_photographer_email || 'photographer').split('@')[0];

      // WhatsApp
      const waLines = [
        `🎬 *Media Delivered* — ${ownerName}${unitTag}`,
        `By ${photographerName}`,
        task.tour_3d_link ? `🧊 3D Tour: ${task.tour_3d_link}` : null,
        task.video_link ? `🎥 Video: ${task.video_link}` : null,
        task.photos_link ? `📷 Photos: ${task.photos_link}` : null,
        '',
        `Open landlord: ${landlordLink}`,
      ].filter((l) => l !== null);
      const whatsapp = await sendWhatsApp(agent?.phone, waLines.join('\n'));

      // Email
      let email: any = null;
      try {
        const linkCell = (url: string, label: string) =>
          url ? `<a href="${url}" target="_blank">${label}</a>` : '';
        const body = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px;">
            <h2 style="margin: 0 0 8px;">🎬 Media Delivered</h2>
            <p style="margin: 0 0 16px; color: #444;">Hi ${agentName},</p>
            <p style="margin: 0 0 16px;">${photographerName} has delivered media for <strong>${ownerName}</strong>${unitTag}:</p>
            <table style="border-collapse: collapse; margin: 0 0 8px; width: 100%;">
              ${infoRow('3D Tour', linkCell(task.tour_3d_link, 'Open 3D Tour'))}
              ${infoRow('Video', linkCell(task.video_link, 'Open Video'))}
              ${infoRow('Photos', linkCell(task.photos_link, 'Open Photos'))}
            </table>
            ${goldButton(landlordLink, 'Open Landlord Record')}
            <p style="color: #888; font-size: 12px; margin-top: 24px;">Erudite Property CRM</p>
          </div>`;
        email = await base44.integrations.Core.SendEmail({
          to: agentEmail,
          subject: `🎬 Media delivered — ${ownerName}${unitTag}`,
          body,
          from_name: 'Erudite CRM',
        });
        email = { ok: true, result: email };
      } catch (e) {
        email = { ok: false, error: String(e?.message || e) };
      }

      result = { ...result, notified: agentEmail, whatsapp, email };
    }

    // ═══════════════════════════════════════════════════════════════════
    // EVENT 3: stage_advanced → light WhatsApp ping to the assigned AGENT
    // ═══════════════════════════════════════════════════════════════════
    else if (event === 'stage_advanced') {
      const agentEmail = landlord.assigned_agent_email;
      if (!agentEmail) return Response.json({ skipped: 'No assigned agent on landlord' });

      const agent = await lookupUser(base44, agentEmail);
      const photographerName = (task.assigned_photographer_email || 'photographer').split('@')[0];
      const stageLabel = STAGE_LABELS[meta.new_stage] || meta.new_stage || 'next stage';

      const text = [
        `📸 ${ownerName}${unitTag} → *${stageLabel}*`,
        `Moved by ${photographerName}`,
        `Open: ${landlordLink}`,
      ].join('\n');
      const whatsapp = await sendWhatsApp(agent?.phone, text);

      result = { ...result, notified: agentEmail, whatsapp };
    }

    else {
      return Response.json({ error: `Unknown event: ${event}` }, { status: 400 });
    }

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('notifyPhotographyEvent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
