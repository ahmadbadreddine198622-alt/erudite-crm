import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * winBranchAutoOutreach — the "Win branch" auto-pilot for the Project Intelligence
 * pipeline. For every landlord stuck at `initial_contact` (who has a phone and has
 * NEVER received an outbound message), it:
 *   1. crafts a personalized, project/unit-aware WhatsApp cold-open (InvokeLLM, fast model),
 *   2. sends it via the existing sendMultiChannelWhatsApp function (user-scoped, so the
 *      send sees the calling admin + their WhatsApp line),
 *   3. advances the landlord to `attempted_to_contact`, logs a WhatsApp activity, and
 *      records the send in the outcome ledger.
 *
 * Runs in small batches (default 8) to stay well under the function timeout and to let
 * the UI pace the blast. Admin-only. Skips owners already contacted and owners with no
 * phone. `dry_run` generates + returns drafts without sending.
 */

const normalizeProject = (s) =>
  String(s || '').toLowerCase()
    .replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5')
    .replace(/[\s\-_\.]+/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const {
      project_id, project_name,
      landlord_ids,
      limit = 8,
      send = true,
      channel = 'personal',
      dry_run = false,
    } = body;
    const maxN = Math.min(Math.max(1, Number(limit) || 8), 25);

    // ── Load initial_contact landlords for the project ────────────────────────
    let landlords = [];
    if (project_id) {
      landlords = await svc.entities.Landlord.filter({ stage: 'initial_contact', project_id }, '-created_date', 2000).catch(() => []);
    } else if (project_name) {
      const all = await svc.entities.Landlord.filter({ stage: 'initial_contact' }, '-created_date', 3000).catch(() => []);
      const n = normalizeProject(project_name);
      landlords = (Array.isArray(all) ? all : []).filter((l) => {
        const lp = normalizeProject(l.project_name || '');
        return lp && (lp.includes(n) || n.includes(lp));
      });
    } else {
      landlords = await svc.entities.Landlord.filter({ stage: 'initial_contact' }, '-created_date', 3000).catch(() => []);
    }
    landlords = (Array.isArray(landlords) ? landlords : []).filter((l) => l && l.phone);

    // Restrict to a caller-provided id set (e.g. the filtered board subset)
    if (Array.isArray(landlord_ids) && landlord_ids.length) {
      const allow = new Set(landlord_ids.map((id) => String(id)));
      landlords = landlords.filter((l) => allow.has(String(l.id)));
    }

    if (!landlords.length) {
      return Response.json({
        ok: true, processed: 0, sent: 0, skipped: 0, failed: 0,
        remaining: 0, totalQueue: 0, details: [],
        message: 'No initial-contact landlords with a phone found for this filter.',
      });
    }

    // ── Already-contacted guard (skip owners with any prior outbound message) ─
    const ids = landlords.map((l) => l.id);
    const [waOut, msgOut] = await Promise.all([
      svc.entities.WhatsAppMessage.filter({ landlord_id: { $in: ids }, direction: 'outbound' }).catch(() => []),
      svc.entities.Message.filter({ landlord_id: { $in: ids }, direction: 'outgoing' }).catch(() => []),
    ]);
    const contacted = new Set();
    [...(Array.isArray(waOut) ? waOut : []), ...(Array.isArray(msgOut) ? msgOut : [])].forEach((m) => {
      if (m && m.landlord_id) contacted.add(m.landlord_id);
    });

    const queue = landlords.filter((l) => !contacted.has(l.id));
    const totalQueue = queue.length;
    if (!totalQueue) {
      return Response.json({
        ok: true, processed: 0, sent: 0, skipped: landlords.length, failed: 0,
        remaining: 0, totalQueue: 0, details: [],
        message: 'All initial-contact owners for this filter have already been contacted.',
      });
    }
    const batch = queue.slice(0, maxN);

    // ── Preload property + project brief context for the batch ─────────────────
    const batchIds = batch.map((l) => l.id);
    const lpRows = await svc.entities.LandlordProperty.filter({ landlord_id: { $in: batchIds } }).catch(() => []);
    const lpByLandlord = {};
    (Array.isArray(lpRows) ? lpRows : []).forEach((lp) => {
      if (lp && lp.landlord_id && !lpByLandlord[lp.landlord_id]) lpByLandlord[lp.landlord_id] = lp;
    });

    let projectBrief = '';
    if (project_id || project_name) {
      const projRows = await svc.entities.Project.list('-updated_date', 500).catch(() => []);
      const proj = (Array.isArray(projRows) ? projRows : []).find((p) =>
        (project_id && p.id === project_id) ||
        (project_name && normalizeProject(p.name || '') === normalizeProject(project_name))
      );
      if (proj && proj.notes) projectBrief = String(proj.notes).slice(0, 1200);
    }

    const details = [];
    let sentCount = 0, skippedCount = 0, failedCount = 0;

    for (const ll of batch) {
      const prop = lpByLandlord[ll.id] || {};
      const name = ll.full_name_en || ll.full_name || `${ll.first_name || ''} ${ll.last_name || ''}`.trim() || 'Owner';
      const language = ll.preferred_language || 'en';
      const unitLabel = [ll.project_name || prop.project_name || '', ll.unit_reference || prop.unit_reference || '', ll.unit_layout || ''].filter(Boolean).join(' · ');

      const prompt = `Write ONE short WhatsApp first-contact message (2–3 sentences, max ~320 characters) from a Dubai real-estate agent (Ahmad, Erudite Real Estate) to a landlord owner.
Write ENTIRELY in the owner's preferred language (language code: ${language}). Do not mix languages.
Be warm and personal. Reference their specific building/unit to prove you know their property: "${unitLabel}".
Ask ONE smart question about the unit or their plans for it. Do NOT mention price, commission, or fees. No exclamation marks. No emojis. End with a soft sign-off.
Owner archetype: ${ll.landlord_archetype || 'unknown'}.
${projectBrief ? `Project brief (use for tone/positioning, do not dump): ${projectBrief}` : ''}
Return JSON: {"message": "..."}`;

      let message = null;
      try {
        const res = await svc.integrations.Core.InvokeLLM({
          prompt,
          model: 'gpt_5_mini',
          response_json_schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
        });
        if (res && typeof res === 'object' && typeof res.message === 'string') message = res.message.trim();
        else if (typeof res === 'string') message = res.trim();
      } catch (_) { /* fall through to gen_failed */ }

      if (!message) {
        failedCount++;
        details.push({ landlord_id: ll.id, name, status: 'gen_failed' });
        continue;
      }

      if (dry_run || !send) {
        details.push({ landlord_id: ll.id, name, status: 'draft', message });
        continue;
      }

      // Send via the user-scoped send function so it sees the admin + their WhatsApp line.
      try {
        const sendRes = await base44.functions.invoke('sendMultiChannelWhatsApp', {
          landlord_id: ll.id,
          text: message,
          channel,
          created_from_ai: true,
          ai_source: 'win_auto_outreach',
          ai_draft_text: message,
        });
        const sd = sendRes?.data ?? sendRes;
        if (sd && (sd.error || sd.status === 'sent_but_not_recorded' === false && sd.error)) {
          throw new Error(sd.error || 'send failed');
        }
        sentCount++;

        // Advance stage + log activity (non-fatal)
        try {
          const now = new Date().toISOString();
          await svc.entities.Landlord.update(ll.id, { stage: 'attempted_to_contact', stage_entered_at: now });
          await svc.entities.Activity.create({
            lead_id: ll.id,
            type: 'whatsapp',
            title: 'AI auto-outreach — first touch sent',
            direction: 'outbound',
            channel: 'whatsapp',
            description: message,
            status: 'completed',
            completed_at: now,
            agent_email: user.email,
            source: 'automation',
          });
        } catch (_) { /* stage/activity must never block the blast */ }

        // Outcome ledger (non-fatal)
        try {
          await svc.functions.invoke('recordOutcomeEvent', {
            landlord_id: ll.id,
            kind: 'draft_sent',
            channel: 'whatsapp',
            text: message,
            sent_at: new Date().toISOString(),
            writer_email: user.email,
            ai_source: 'win_auto_outreach',
            ai_draft_text: message,
          }).catch(() => {});
        } catch (_) { /* ledger must never block */ }

        details.push({ landlord_id: ll.id, name, status: 'sent', message });
      } catch (e) {
        failedCount++;
        details.push({ landlord_id: ll.id, name, status: 'send_failed', error: String(e?.message || e) });
      }
    }

    return Response.json({
      ok: true,
      processed: batch.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      remaining: Math.max(0, totalQueue - batch.length),
      totalQueue,
      details,
    });
  } catch (error) {
    console.error('winBranchAutoOutreach error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});