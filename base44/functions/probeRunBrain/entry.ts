import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * probeRunBrain — diagnostics: run landlordOrchestrator through the SAME service-role
 * cross-invoke path the webhooks/nudge crons use (the orchestrator requires an authenticated
 * caller, so a bare curl cannot reach it on a private app). Admin-or-scheduled only.
 * Forwards a whitelisted body and returns the orchestrator's response verbatim.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (user && user.role !== 'admin') return Response.json({ error: 'admin only' }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    if (!body.landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });
    const payload = {
      landlord_id: String(body.landlord_id),
      force: body.force === true,
      tier: ['full', 'cold'].includes(body.tier) ? body.tier : 'full',
      force_cold: body.force_cold === true,
      eval_mode: body.eval_mode === true,
      debug_context: body.debug_context === true,
      triggered_by: typeof body.triggered_by === 'string' ? body.triggered_by.slice(0, 60) : 'manual',
    };
    const started = Date.now();
    const res = await svc.functions.invoke('landlordOrchestrator', payload);
    return Response.json({ elapsed_ms: Date.now() - started, orchestrator: res?.data ?? res });
  } catch (error) {
    console.error('probeRunBrain error:', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
