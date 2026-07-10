import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { pfListingId, crmId } = await req.json().catch(() => ({}));
    if (!pfListingId) return Response.json({ error: 'pfListingId is required' }, { status: 400 });

    // ── Step 1: Get fresh PF token ──────────────────────────────────────────
    const tokenRes = await base44.functions.invoke('pfGetToken', {});
    const token = tokenRes?.data?.access_token || tokenRes?.access_token;
    if (!token) return Response.json({ error: 'Could not get PF token' }, { status: 500 });

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // ── Step 2: Look up the PF internal listing ID by reference ─────────────
    // pf_listing_id in CRM is actually the reference number, not PF's internal id.
    // We must search by reference to get the real PF id for PATCH.
    let pfInternalId = null;

    // Try fetching by reference search
    const searchRes = await fetch(`${PF_BASE}/listings?reference=${encodeURIComponent(pfListingId)}&perPage=5`, { headers });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const items = searchData.results || searchData.data || searchData.listings || searchData.items || [];
      const match = items.find(i => i.reference === pfListingId || i.id === pfListingId);
      if (match) pfInternalId = match.id;
    }

    // Fallback: try direct GET by ID (in case pf_listing_id IS the real id for some listings)
    if (!pfInternalId) {
      const directRes = await fetch(`${PF_BASE}/listings/${pfListingId}`, { headers });
      if (directRes.ok) {
        const directData = await directRes.json();
        if (directData?.id) pfInternalId = directData.id;
      }
    }

    if (!pfInternalId) {
      return Response.json({
        error: `Could not resolve PF internal ID for reference: ${pfListingId}. Listing may not exist on Property Finder.`,
        reference: pfListingId,
      }, { status: 404 });
    }

    // ── Step 3: PATCH state to takendown ────────────────────────────────────
    const patchRes = await fetch(`${PF_BASE}/listings/${pfInternalId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: { stage: 'takendown', type: 'takendown' } }),
    });

    const rawText = await patchRes.text();
    let patchData;
    try { patchData = JSON.parse(rawText); } catch { patchData = { raw: rawText }; }

    if (!patchRes.ok) {
      return Response.json({
        error: 'PF API unpublish failed',
        status: patchRes.status,
        pfInternalId,
        reference: pfListingId,
        detail: patchData,
      }, { status: 502 });
    }

    // ── Step 4: Update CRM record ────────────────────────────────────────────
    if (crmId) {
      await base44.asServiceRole.entities.PFListing.update(crmId, {
        status: 'inactive',
        last_synced_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, pfListingId, pfInternalId, crmId, pfResponse: patchData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});