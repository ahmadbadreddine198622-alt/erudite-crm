import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// sendFollowupReminders — scheduled daemon (runs every 5 minutes).
//
// Finds pending Followups whose scheduled_at falls within the next 15 minutes
// and that haven't had their 15-minute reminder sent yet (reminder_15_sent !=
// true), then creates a followup_due Notification for the owning agent and
// marks the followup reminded.
//
// The NotificationCenter bell (src/components/notifications/NotificationCenter.jsx)
// already subscribes to new Notification records and plays a two-tone chime +
// browser notification when one arrives for the logged-in agent — so the agent
// hears the sound and sees the bell badge ~15 minutes before the follow-up.
//
// Polling every 5 min with a 15-min look-ahead means the reminder fires 10–15
// minutes before the scheduled time (never earlier, never duplicated).

const LEAD_MS = 15 * 60 * 1000; // 15 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const soonIso = new Date(nowMs + LEAD_MS).toISOString();

    // Fetch pending followups scheduled within the next 15 minutes.
    let due = [];
    try {
      due = await svc.entities.Followup.filter({
        status: 'pending',
        scheduled_at: { $gte: nowIso, $lte: soonIso },
      });
    } catch (_) {
      // Fallback if range operators aren't supported: pull pending followups
      // and filter the 15-min window in code.
      const all = await svc.entities.Followup.filter({ status: 'pending' }, '-scheduled_at', 500);
      due = (all || []).filter((f) => {
        if (!f.scheduled_at) return false;
        const s = new Date(f.scheduled_at).getTime();
        return s >= nowMs && s <= nowMs + LEAD_MS;
      });
    }

    // Only those whose 15-min reminder hasn't been sent yet.
    const pending = (due || []).filter((f) => !f.reminder_15_sent);

    let sent = 0;
    const errors = [];
    for (const f of pending) {
      const agentEmail = f.agent_email;
      if (!agentEmail) continue;
      const when = f.scheduled_at
        ? new Date(f.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'soon';
      try {
        await svc.entities.Notification.create({
          recipient_email: agentEmail,
          type: 'followup_due',
          title: `⏰ Follow-up in 15 min${f.title ? ': ' + f.title : ''}`,
          body: `Your follow-up is due ${when}.${f.notes ? ' ' + String(f.notes).slice(0, 160) : ''}`,
          is_read: false,
          link: f.landlord_id ? `/landlord/${f.landlord_id}` : '/follow-ups',
        });
        await svc.entities.Followup.update(f.id, { reminder_15_sent: true });
        sent++;
      } catch (err) {
        errors.push({ id: f.id, error: String(err?.message || err).slice(0, 120) });
      }
    }

    return Response.json({
      ok: true,
      checked: (due || []).length,
      sent,
      window: { now: nowIso, end: soonIso },
      errors,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});