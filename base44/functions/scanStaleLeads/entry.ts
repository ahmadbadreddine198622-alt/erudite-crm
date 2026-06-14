import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STALE_DAYS = 7; // alert threshold

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const CLOSED_STAGES = ['closed', 'lost', 'ejari_movein', 'complete'];
    const now = Date.now();
    const thresholdMs = STALE_DAYS * 24 * 60 * 60 * 1000;

    // Fetch all active leads
    const leads = await base44.asServiceRole.entities.Lead.filter({ status: 'active' }, '-stage_entered_at', 500);

    const staleLeads = [];

    for (const lead of leads) {
      if (CLOSED_STAGES.includes(lead.stage)) continue;

      // Use last_activity_at if set, else stage_entered_at, else created_date
      const lastTouched = lead.last_activity_at || lead.stage_entered_at || lead.created_date;
      if (!lastTouched) continue;

      const daysSince = Math.floor((now - new Date(lastTouched).getTime()) / (24 * 60 * 60 * 1000));
      if (daysSince >= STALE_DAYS) {
        staleLeads.push({
          id: lead.id,
          name: lead.full_name || lead.phone || 'Unknown',
          stage: lead.stage || '—',
          agent: lead.assigned_agent_name || lead.assigned_agent_email || 'Unassigned',
          daysSince,
        });
      }
    }

    if (staleLeads.length === 0) {
      return Response.json({ sent: false, message: 'No stale leads found.' });
    }

    // Sort worst first
    staleLeads.sort((a, b) => b.daysSince - a.daysSince);

    const rows = staleLeads.map(l =>
      `<tr style="border-bottom:1px solid #2a2a3a">
        <td style="padding:6px 10px;color:#f1f1f1">${l.name}</td>
        <td style="padding:6px 10px;color:#94a3b8;text-transform:capitalize">${l.stage.replace(/_/g,' ')}</td>
        <td style="padding:6px 10px;color:#94a3b8">${l.agent}</td>
        <td style="padding:6px 10px;font-weight:bold;color:${l.daysSince >= 14 ? '#f87171' : '#fbbf24'}">${l.daysSince}d</td>
      </tr>`
    ).join('');

    const body = `
      <div style="font-family:Inter,sans-serif;background:#0f1621;padding:24px;border-radius:12px;max-width:640px">
        <h2 style="color:#f59e0b;margin:0 0 4px">⚠️ Stale Leads Report</h2>
        <p style="color:#94a3b8;margin:0 0 20px;font-size:13px">${staleLeads.length} lead${staleLeads.length > 1 ? 's have' : ' has'} had no activity for ${STALE_DAYS}+ days.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#1e2535">
              <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600">Lead</th>
              <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600">Stage</th>
              <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600">Agent</th>
              <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600">Inactive</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#475569;font-size:11px;margin-top:16px">PropCRM · Sent daily at 9 AM</p>
      </div>`;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `⚠️ ${staleLeads.length} stale lead${staleLeads.length > 1 ? 's' : ''} need attention`,
      body,
    });

    return Response.json({ sent: true, count: staleLeads.length, leads: staleLeads });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});