import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * generateNotification — called by entity automations to create Notification
 * records for lead assignments, landlord assignments, and all activities.
 *
 * Entity automation payload shape:
 *   { event: { type, entity_name, entity_id }, data, old_data, changed_fields }
 *
 * Supported triggers:
 *   - Lead update (assigned_agent_email changed) → lead_assigned notification
 *   - Landlord update (assigned_agent_email changed) → landlord_assigned notification
 *   - Activity create → activity notification (call, email, whatsapp, viewing, etc.)
 *   - Followup create/update → followup_due notification
 *   - LandlordTask create (due_date set) → task_due notification
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { event, data, old_data, changed_fields } = body;

    if (!event || !event.entity_name) {
      return Response.json({ error: 'Invalid payload — missing event.entity_name' }, { status: 400 });
    }

    const notifications = [];
    const entityName = event.entity_name;
    const eventType = event.type;

    // ── Lead assignment ──
    if (entityName === 'Lead' && eventType === 'update') {
      const changed = Array.isArray(changed_fields) ? changed_fields : [];
      if (changed.includes('assigned_agent_email') && data?.assigned_agent_email) {
        const oldAgent = old_data?.assigned_agent_email;
        const newAgent = data.assigned_agent_email;
        if (newAgent && newAgent !== oldAgent) {
          notifications.push({
            recipient_email: newAgent,
            type: 'lead_assigned',
            title: `Lead Assigned: ${data.full_name || 'New Lead'}`,
            body: `A lead "${data.full_name || ''}" has been assigned to you.${data.source ? ` Source: ${data.source}.` : ''}${data.intent ? ` Intent: ${data.intent}.` : ''}`,
            link: '/leads',
          });
        }
      }
    }

    // ── Landlord assignment ──
    if (entityName === 'Landlord' && eventType === 'update') {
      const changed = Array.isArray(changed_fields) ? changed_fields : [];
      if (changed.includes('assigned_agent_email') && data?.assigned_agent_email) {
        const oldAgent = old_data?.assigned_agent_email;
        const newAgent = data.assigned_agent_email;
        if (newAgent && newAgent !== oldAgent) {
          notifications.push({
            recipient_email: newAgent,
            type: 'landlord_assigned',
            title: `Landlord Assigned: ${data.full_name_en || data.full_name || 'New Landlord'}`,
            body: `Landlord "${data.full_name_en || data.full_name || ''}" has been assigned to you.${data.project_name ? ` Project: ${data.project_name}.` : ''}${data.unit_reference ? ` Unit: ${data.unit_reference}.` : ''}`,
            link: `/landlord/${event.entity_id}`,
          });
        }
      }
    }

    // ── Activity created (calls, emails, whatsapp, viewings, meetings, notes, offers, etc.) ──
    if (entityName === 'Activity' && eventType === 'create') {
      const agentEmail = data?.agent_email || data?.assigned_to_email;
      if (agentEmail) {
        const typeMap: Record<string, { notifType: string; title: string }> = {
          call:           { notifType: 'call',           title: 'Call Logged' },
          email:          { notifType: 'email_sent',     title: 'Email Sent' },
          whatsapp:      { notifType: 'whatsapp_sent',  title: 'WhatsApp Sent' },
          sms:            { notifType: 'whatsapp_sent',  title: 'SMS Sent' },
          viewing:       { notifType: 'viewing',        title: 'Viewing Scheduled' },
          meeting:       { notifType: 'meeting',       title: 'Meeting Scheduled' },
          note:           { notifType: 'note',          title: 'Note Added' },
          offer:          { notifType: 'offer',         title: 'Offer Made' },
          follow_up:     { notifType: 'followup_due',   title: 'Follow-up Logged' },
          stage_change:  { notifType: 'stage_change',   title: 'Stage Changed' },
          task:           { notifType: 'task_due',      title: 'Task Created' },
        };
        const mapped = typeMap[data?.type] || { notifType: 'activity', title: 'New Activity' };
        notifications.push({
          recipient_email: agentEmail,
          type: mapped.notifType,
          title: data?.title || mapped.title,
          body: data?.description || '',
          link: data?.lead_id ? '/leads' : (data?.deal_id ? '/pipeline' : null),
        });
      }
    }

    // ── Followup created → followup_due notification ──
    if (entityName === 'Followup' && eventType === 'create') {
      const agentEmail = data?.agent_email || data?.assigned_to_email;
      if (agentEmail) {
        notifications.push({
          recipient_email: agentEmail,
          type: 'followup_due',
          title: data?.title || 'New Follow-up Scheduled',
          body: data?.notes || data?.message || `Follow-up scheduled${data?.scheduled_at ? ` for ${new Date(data.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}.`,
          link: '/follow-ups',
        });
      }
    }

    // ── LandlordTask created with due date → task_due notification ──
    if (entityName === 'LandlordTask' && eventType === 'create') {
      const agentEmail = data?.assigned_to_email || data?.agent_email;
      if (agentEmail) {
        notifications.push({
          recipient_email: agentEmail,
          type: 'task_due',
          title: data?.title || 'New Task Assigned',
          body: data?.description || `Task${data?.due_date ? ` due ${new Date(data.due_date).toLocaleDateString('en-US')}` : ''}.`,
          link: data?.landlord_id ? `/landlord/${data.landlord_id}` : '/task-center',
        });
      }
    }

    // ── WhatsAppMessage created (inbound) → whatsapp_message notification ──
    if (entityName === 'WhatsAppMessage' && eventType === 'create') {
      const agentEmail = data?.assigned_agent_email;
      if (agentEmail && data?.direction === 'incoming') {
        notifications.push({
          recipient_email: agentEmail,
          type: 'whatsapp_message',
          title: `WhatsApp from ${data?.sender_name || data?.wa_phone_e164 || 'Unknown'}`,
          body: (data?.text || data?.caption || '[Media message]').slice(0, 200),
          link: '/whatsapp',
        });
      }
    }

    // Create all notifications
    const created = [];
    for (const n of notifications) {
      try {
        const rec = await svc.entities.Notification.create({
          recipient_email: n.recipient_email,
          type: n.type,
          title: n.title,
          body: n.body || '',
          is_read: false,
          link: n.link || null,
        });
        created.push(rec.id);
      } catch (err) {
        console.error('Failed to create notification:', n.title, err?.message);
      }
    }

    return Response.json({ ok: true, created: created.length, ids: created });
  } catch (error) {
    console.error('generateNotification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});