import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// morningPowerSchedule — daily "Power Schedule" digest email for each agent
// who has at least one assigned active (non-deal_closed) landlord.
//
// Runs daily at 03:30 UTC (07:30 Dubai) via the platform scheduler, and supports
// manual invocation with { dry_run: true } to preview digests without sending.
//
// All reads via service role. NO silent error swallowing — every error surfaces
// in the response. Returns verified counts: { agents_processed, emails_sent, errors }.
//
// Each agent's digest contains:
//   1. TODAY'S DOCTRINE QUEUE — pending Followups scheduled for today or overdue (top 5, flag 14-Day Law)
//   2. STRIKE NOW — landlords with ai_strike_now=true (up to 5)
//   3. TIME × ACTIONS — yesterday's outbound touch count vs DAILY_TOUCH_TARGET of 30
//
// Email mechanism: base44.integrations.Core.SendEmail (same as sendAgentNotificationEmail).

const DAILY_TOUCH_TARGET = 30;
const AGENT_CAP = 50;
const LAW_FLAG = '14-Day Law';
const TERMINAL_STAGES = ['deal_closed'];

// ─── Dubai time helpers (UTC+4, no DST) ───

function dubaiDateStr(offsetDays) {
  const ms = Date.now() + 4 * 3600 * 1000 + offsetDays * 24 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfDubaiDayMs(offsetDays) {
  return new Date(dubaiDateStr(offsetDays) + 'T00:00:00+04:00').getTime();
}

function endOfDubaiDayMs(offsetDays) {
  return new Date(dubaiDateStr(offsetDays) + 'T23:59:59.999+04:00').getTime();
}

// ─── Small utils ───

function tsOf(row, fields) {
  for (const f of fields) {
    if (row[f]) {
      const t = new Date(row[f]).getTime();
      if (!isNaN(t)) return t;
    }
  }
  return 0;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function agentDisplayName(email, nameMap) {
  return nameMap[email.toLowerCase()] || email.split('@')[0];
}

// ─── Digest composition ───

function composeDigest({ agentName, subjectDate, doctrineQueue, topFollowups, landlordNames, strikeLandlords, touchCount, pendingDirectives }) {
  const sections = [];

  // 0. FOUNDER DIRECTIVES WAITING
  sections.push(`
    <div style="margin-bottom:24px;">
      <h3 style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:15px;margin:0 0 8px;">👑 FOUNDER DIRECTIVES WAITING (${pendingDirectives.length})</h3>
      ${pendingDirectives.length === 0
        ? '<p style="font-family:Arial,Helvetica,sans-serif;color:#888;font-size:13px;margin:0;">No pending founder directives.</p>'
        : pendingDirectives.map(item => {
            const name = item.landlord.full_name_en || item.landlord.full_name_ar || 'Unknown landlord';
            const text = String(item.directive.directive_text || '').slice(0, 80);
            return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:4px 0;padding:6px 10px;border-radius:6px;background:rgba(201,162,75,0.06);border-left:3px solid #C5A059;">
              <strong>${esc(name)}</strong>: ${esc(text)}${String(item.directive.directive_text || '').length > 80 ? '…' : ''}
            </div>`;
          }).join('')
      }
    </div>
  `);

  // 1. TODAY'S DOCTRINE QUEUE
  sections.push(`
    <div style="margin-bottom:24px;">
      <h3 style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:15px;margin:0 0 8px;">📋 TODAY'S DOCTRINE QUEUE (${doctrineQueue.length})</h3>
      ${doctrineQueue.length === 0
        ? '<p style="font-family:Arial,Helvetica,sans-serif;color:#888;font-size:13px;margin:0;">No pending followups due today. Stay ahead.</p>'
        : topFollowups.map(f => {
            const isLaw = (f.title || '').includes(LAW_FLAG);
            const name = landlordNames[f.landlord_id] || 'Unknown landlord';
            return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:4px 0;padding:6px 10px;border-radius:6px;background:${isLaw ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.04)'};border-left:3px solid ${isLaw ? '#ef4444' : '#C5A059'};">
              ${isLaw ? '<strong style="color:#ef4444;">⚠ 14-DAY LAW</strong> — ' : ''}<strong>${esc(name)}</strong>: ${esc(f.title)}
            </div>`;
          }).join('')
      }
      ${doctrineQueue.length > 5 ? `<p style="font-family:Arial,Helvetica,sans-serif;color:#888;font-size:12px;margin:6px 0 0;">+${doctrineQueue.length - 5} more…</p>` : ''}
    </div>
  `);

  // 2. STRIKE NOW
  sections.push(`
    <div style="margin-bottom:24px;">
      <h3 style="font-family:Arial,Helvetica,sans-serif;color:#ef4444;font-size:15px;margin:0 0 8px;">⚡ STRIKE NOW (${strikeLandlords.length})</h3>
      ${strikeLandlords.length === 0
        ? '<p style="font-family:Arial,Helvetica,sans-serif;color:#888;font-size:13px;margin:0;">No strike-now landlords flagged.</p>'
        : strikeLandlords.map(ll => {
            const name = ll.full_name_en || ll.full_name_ar || 'Unknown';
            const nba = ll.ai_next_best_action;
            const nbaText = nba ? (typeof nba === 'string' ? nba : (nba.action || '')) : '';
            return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:4px 0;padding:6px 10px;border-radius:6px;background:rgba(239,68,68,0.06);border-left:3px solid #ef4444;">
              <strong>${esc(name)}</strong>${ll.project_name ? ' — ' + esc(ll.project_name) : ''}${nbaText ? '<br><span style="color:#666;">→ ' + esc(nbaText) + '</span>' : ''}
            </div>`;
          }).join('')
      }
    </div>
  `);

  // 3. TIME × ACTIONS
  const diff = touchCount - DAILY_TOUCH_TARGET;
  const verdict = touchCount >= DAILY_TOUCH_TARGET
    ? `<span style="color:#10A492;font-weight:700;">+${diff} over target ✓</span>`
    : `<span style="color:#ef4444;font-weight:700;">${Math.abs(diff)} under target</span>`;

  sections.push(`
    <div style="margin-bottom:24px;">
      <h3 style="font-family:Arial,Helvetica,sans-serif;color:#3b82f6;font-size:15px;margin:0 0 8px;">📊 TIME × ACTIONS (Yesterday)</h3>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0;">
        You logged <strong style="font-size:18px;color:${touchCount >= DAILY_TOUCH_TARGET ? '#10A492' : '#ef4444'};">${touchCount}</strong> outbound touches yesterday.
        Target is ${DAILY_TOUCH_TARGET}. ${verdict}
      </p>
    </div>
  `);

  const html = `
    <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
      <h2 style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:22px;margin:0 0 4px;">⚡ Your Power Schedule</h2>
      <p style="font-family:Arial,Helvetica,sans-serif;color:#888;font-size:13px;margin:0 0 20px;">${esc(subjectDate)} — Hi ${esc(agentName)}, here's your focus for today.</p>
      ${sections.join('')}
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#C5A059;text-align:center;">
        No landlord sits silent past 14 days.
      </p>
    </div>
  `;

  return {
    subject: `⚡ Your Power Schedule — ${subjectDate}`,
    html,
    summary: {
      doctrine_queue: doctrineQueue.length,
      strike_now: strikeLandlords.length,
      touches_yesterday: touchCount,
    },
  };
}

// ─── Main handler ───

Deno.serve(async (req) => {
  const errors = [];
  let agentsProcessed = 0;
  let emailsSent = 0;

  try {
    const base44 = createClientFromRequest(req);

    // If a user token is present (manual invocation), require admin.
    // No-token calls (platform-scheduled) are allowed — service role handles all reads.
    try {
      const callerUser = await base44.auth.me();
      if (callerUser && callerUser.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }
    } catch (_authErr) {
      // No user token — scheduled invocation, proceed with service role.
    }

    const svc = base44.asServiceRole;

    // Parse body (dry_run flag). Scheduled invocations may have no body.
    let body = {};
    if (req.method !== 'GET') {
      body = await req.json();
    }
    const dryRun = body.dry_run === true;

    // ─── Date boundaries ───
    const todayEnd = endOfDubaiDayMs(0);
    const yesterdayStart = startOfDubaiDayMs(-1);
    const yesterdayEnd = endOfDubaiDayMs(-1);
    const subjectDate = dubaiDateStr(0);

    // ─── Batch fetch all data in parallel (service role) ───
    const [
      landlords,
      pendingFollowups,
      users,
      msgs,
      ims,
      tgs,
      ems,
      activeDirectives,
    ] = await Promise.all([
      svc.entities.Landlord.list('-updated_date', 5000),
      svc.entities.Followup.filter({ status: 'pending' }, '-scheduled_at', 5000),
      svc.entities.User.list(200),
      svc.entities.Message.filter({ direction: 'outgoing' }, '-timestamp', 1000),
      svc.entities.IMessage.filter({ direction: 'outbound' }, '-sent_at', 1000),
      svc.entities.TelegramMessage.filter({ direction: 'outbound' }, '-sent_at', 1000),
      svc.entities.Email.filter({ direction: 'outbound' }, '-received_at', 1000),
      svc.entities.LandlordDirective.filter({ status: 'active' }, '-created_date', 5000),
    ]);

    // ─── Build agent name map ───
    const nameMap = {};
    (users || []).forEach(u => {
      if (u.email) nameMap[u.email.toLowerCase()] = u.full_name || u.email;
    });

    // ─── Extract distinct agent emails from active landlords ───
    const activeLandlords = (landlords || []).filter(
      l => l && l.assigned_agent_email && !TERMINAL_STAGES.includes(l.stage)
    );
    const agentEmailSet = new Set(activeLandlords.map(l => l.assigned_agent_email));
    const agentEmails = [...agentEmailSet].slice(0, AGENT_CAP);

    // ─── Build landlord lookup map (for followup name resolution + strike-now) ───
    const landlordById = {};
    activeLandlords.forEach(l => { if (l.id) landlordById[l.id] = l; });

    // ─── Build per-agent touch counts from yesterday's outbound messages ───
    const touchCounts = {};
    const inYesterday = (ts) => ts >= yesterdayStart && ts <= yesterdayEnd;
    const addTouch = (email) => {
      if (!email) return;
      const k = email.toLowerCase();
      touchCounts[k] = (touchCounts[k] || 0) + 1;
    };

    (msgs || []).forEach(r => { if (inYesterday(tsOf(r, ['timestamp']))) addTouch(r.agent_email); });
    (ims || []).forEach(r => { if (inYesterday(tsOf(r, ['sent_at']))) addTouch(r.agent_email); });
    (tgs || []).forEach(r => { if (inYesterday(tsOf(r, ['sent_at']))) addTouch(r.agent_email); });
    // Email entity has no agent_email field — match on from_email instead.
    (ems || []).forEach(r => { if (inYesterday(tsOf(r, ['received_at']))) addTouch(r.from_email); });

    // ─── Build per-agent pending followup map (scheduled for today or overdue) ───
    const followupsByAgent = {};
    (pendingFollowups || []).forEach(f => {
      if (!f.agent_email) return;
      const ts = tsOf(f, ['scheduled_at']);
      if (ts <= 0 || ts > todayEnd) return; // not today or overdue
      const k = f.agent_email.toLowerCase();
      if (!followupsByAgent[k]) followupsByAgent[k] = [];
      followupsByAgent[k].push(f);
    });

    // ─── Build per-agent founder-directive-waiting list ───
    // Directives with status 'active' (not yet acknowledged) assigned to the landlord's agent.
    const directiveByAgent = {};
    const directiveLandlordIds = new Set();
    (activeDirectives || []).forEach(d => {
      if (!d.landlord_id) return;
      directiveLandlordIds.add(d.landlord_id);
    });
    // For each active landlord that has an active directive, attribute it to the agent.
    activeLandlords.forEach(l => {
      if (!directiveLandlordIds.has(l.id)) return;
      const matchingDirectives = (activeDirectives || []).filter(d => d.landlord_id === l.id);
      if (!matchingDirectives.length) return;
      const k = l.assigned_agent_email.toLowerCase();
      if (!directiveByAgent[k]) directiveByAgent[k] = [];
      for (const d of matchingDirectives) {
        directiveByAgent[k].push({ landlord: l, directive: d });
      }
    });

    // ─── Process each agent ───
    const digests = [];

    for (const agentEmail of agentEmails) {
      agentsProcessed++;

      const agentKey = agentEmail.toLowerCase();
      const agentName = agentDisplayName(agentEmail, nameMap);
      const doctrineQueue = (followupsByAgent[agentKey] || []).sort(
        (a, b) => tsOf(a, ['scheduled_at']) - tsOf(b, ['scheduled_at'])
      );
      const strikeLandlords = (strikeByAgent[agentKey] || []).slice(0, 5);
      const touchCount = touchCounts[agentKey] || 0;

      // Skip agents with zero items in all three sections.
      if (doctrineQueue.length === 0 && strikeLandlords.length === 0 && touchCount === 0) {
        continue;
      }

      // Resolve landlord names for top 5 followups.
      const topFollowups = doctrineQueue.slice(0, 5);
      const landlordNames = {};
      for (const f of topFollowups) {
        if (!f.landlord_id) continue;
        const ll = landlordById[f.landlord_id]
          || await svc.entities.Landlord.get(f.landlord_id);
        if (ll) {
          landlordNames[f.landlord_id] = ll.full_name_en || ll.full_name_ar || 'Unknown';
        }
      }

      const digest = composeDigest({
        agentName,
        subjectDate,
        doctrineQueue,
        topFollowups,
        landlordNames,
        strikeLandlords,
        touchCount,
      });

      digests.push({ agent_email: agentEmail, ...digest.summary });

      if (dryRun) continue;

      // Send the email — same integration as sendAgentNotificationEmail.
      await svc.integrations.Core.SendEmail({
        to: agentEmail,
        subject: digest.subject,
        body: digest.html,
      });
      emailsSent++;
    }

    return Response.json({
      agents_processed: agentsProcessed,
      emails_sent: emailsSent,
      errors,
      ...(dryRun ? { digests } : {}),
    });
  } catch (error) {
    return Response.json({
      error: error.message,
      agents_processed: agentsProcessed,
      emails_sent: emailsSent,
      errors,
    }, { status: 500 });
  }
});