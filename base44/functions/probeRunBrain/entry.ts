import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * probeRunBrain — diagnostics: run landlordOrchestrator OR buyerOrchestrator through the SAME
 * service-role cross-invoke path the webhooks/nudge crons use (both orchestrators require an
 * authenticated caller, so a bare curl cannot reach them on a private app). Admin-or-scheduled
 * only. Forwards a whitelisted body and returns the orchestrator's response verbatim.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (user && user.role !== 'admin') return Response.json({ error: 'admin only' }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const BUYER_TARGETS = new Set(['buyerOrchestrator', 'forgeBuyerApproachDrafts', 'generateBuyerCallScript', 'buyerColdAutoOutreach', 'backfillBuyerBrain', 'buyerBrainQualify', 'leadPostCallDebrief', 'magicReshapeLead']);
    const target = BUYER_TARGETS.has(body.target) ? body.target : 'landlordOrchestrator';
    if (target === 'backfillBuyerBrain') {
      const payload = {
        ...(body.max_full != null ? { max_full: Number(body.max_full) } : {}),
        ...(body.max_cold != null ? { max_cold: Number(body.max_cold) } : {}),
        ...(body.delay_ms != null ? { delay_ms: Number(body.delay_ms) } : {}),
        ...(body.force_cold === true ? { force_cold: true } : {}),
        ...(Array.isArray(body.lead_ids) ? { lead_ids: body.lead_ids.map(String) } : {}),
        ...(typeof body.run_group === 'string' ? { run_group: body.run_group.slice(0, 60) } : {}),
        triggered_by: typeof body.triggered_by === 'string' ? body.triggered_by.slice(0, 60) : 'probe_sweep',
      };
      const started = Date.now();
      const res = await svc.functions.invoke(target, payload);
      return Response.json({ elapsed_ms: Date.now() - started, orchestrator: res?.data ?? res });
    }
    if (target === 'buyerColdAutoOutreach') {
      // Diagnostics may only DRY-RUN the outreach branch — sends require a human admin in the UI.
      const payload = {
        dry_run: true,
        send: false,
        limit: Math.min(Math.max(1, Number(body.limit) || 2), 5),
        ...(body.intent ? { intent: String(body.intent) } : {}),
        ...(Array.isArray(body.lead_ids) ? { lead_ids: body.lead_ids.map(String) } : {}),
      };
      const started = Date.now();
      const res = await svc.functions.invoke(target, payload);
      return Response.json({ elapsed_ms: Date.now() - started, orchestrator: res?.data ?? res });
    }
    const idField = BUYER_TARGETS.has(target) ? 'lead_id' : 'landlord_id';
    if (!body[idField]) return Response.json({ error: `${idField} required` }, { status: 400 });
    const payload = target === 'magicReshapeLead'
      ? { [idField]: String(body[idField]), text: String(body.text || '').slice(0, 2000), channel: typeof body.channel === 'string' ? body.channel : 'whatsapp', angle_index: Number(body.angle_index) || 0 }
      : target === 'buyerBrainQualify' || target === 'leadPostCallDebrief'
      ? { [idField]: String(body[idField]), ...(typeof body.transcript === 'string' ? { transcript: body.transcript.slice(0, 20000) } : {}) }
      : target === 'forgeBuyerApproachDrafts' || target === 'generateBuyerCallScript'
      ? { [idField]: String(body[idField]), force: body.force === true }
      : {
        [idField]: String(body[idField]),
        force: body.force === true,
        tier: ['full', 'cold'].includes(body.tier) ? body.tier : 'full',
        force_cold: body.force_cold === true,
        eval_mode: body.eval_mode === true,
        debug_context: body.debug_context === true,
        triggered_by: typeof body.triggered_by === 'string' ? body.triggered_by.slice(0, 60) : 'manual',
      };
    const started = Date.now();
    const res = await svc.functions.invoke(target, payload);
    return Response.json({ elapsed_ms: Date.now() - started, orchestrator: res?.data ?? res });
  } catch (error) {
    console.error('probeRunBrain error:', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
