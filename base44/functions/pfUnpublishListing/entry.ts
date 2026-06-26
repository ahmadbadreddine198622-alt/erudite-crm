import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { pfListingId, crmId } = await req.json().catch(() => ({}));
    if (!pfListingId) return Response.json({ error: 'pfListingId is required' }, { status: 400 });

    // Get fresh PF token via pfGetToken
    const tokenRes = await base44.functions.invoke('pfGetToken', {});
    const token = tokenRes?.data?.access_token || tokenRes?.access_token;
    if (!token) return Response.json({ error: 'Could not get PF token' }, { status: 500 });

    const PF_BASE = 'https://atlas.propertyfinder.com/v1';

    // PATCH listing state to takendown (= unpublished/inactive on PF)
    const patchRes = await fetch(`${PF_BASE}/listings/${pfListingId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ state: { stage: 'takendown' } }),
    });

    const rawText = await patchRes.text();
    let patchData;
    try { patchData = JSON.parse(rawText); } catch { patchData = { raw: rawText }; }

    if (!patchRes.ok) {
      return Response.json({
        error: 'PF API unpublish failed',
        status: patchRes.status,
        detail: patchData,
      }, { status: 502 });
    }

    // Update CRM record to inactive
    if (crmId) {
      await base44.asServiceRole.entities.PFListing.update(crmId, {
        status: 'inactive',
        last_synced_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, pfListingId, crmId, pfResponse: patchData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});