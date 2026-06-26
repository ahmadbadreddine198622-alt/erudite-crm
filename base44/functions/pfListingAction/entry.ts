import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getToken(base44) {
  const tokenRes = await base44.functions.invoke('pfGetToken', {});
  const token = tokenRes?.data?.access_token || tokenRes?.access_token;
  if (!token) throw new Error('Could not get PF token');
  return token;
}

// Resolve PF internal listing ID from a reference/id (our pf_listing_id may be a reference)
async function resolvePFInternalId(pfListingId, headers) {
  // Try direct GET first (fast path — works if pf_listing_id IS the real id)
  const directRes = await fetch(`${PF_BASE}/listings/${pfListingId}`, { headers });
  if (directRes.ok) {
    const data = await directRes.json();
    if (data?.id) return { id: data.id, listing: data };
  }

  // Fallback: search by reference
  const searchRes = await fetch(`${PF_BASE}/listings?reference=${encodeURIComponent(pfListingId)}&perPage=5`, { headers });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const items = searchData.results || searchData.data || searchData.listings || searchData.items || [];
    const match = items.find(i => i.reference === pfListingId || i.id === pfListingId);
    if (match) return { id: match.id, listing: match };
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, pfListingId, crmId, fieldUpdates } = await req.json().catch(() => ({}));
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // Actions that don't need PF API (CRM-only)
    if (action === 'delete_crm') {
      if (!crmId) return Response.json({ error: 'crmId required' }, { status: 400 });
      await base44.asServiceRole.entities.PFListing.delete(crmId);
      return Response.json({ ok: true, action });
    }

    if (action === 'refresh_crm') {
      if (!crmId || !pfListingId) return Response.json({ error: 'crmId and pfListingId required' }, { status: 400 });
      const token = await getToken(base44);
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      const resolved = await resolvePFInternalId(pfListingId, headers);
      if (!resolved) return Response.json({ error: 'Listing not found on Property Finder', pfListingId }, { status: 404 });

      const l = resolved.listing;
      const isLive = l?.portals?.propertyfinder?.isLive === true;
      const isTakenDown = l?.state?.stage === 'takendown';
      const newStatus = isLive ? 'active' : isTakenDown ? 'inactive' : l?.state?.stage || 'inactive';
      const images = (l?.media?.images || []).map(img => img?.original?.url || img?.url || img).filter(Boolean);
      const pfUrl = l?.portals?.propertyfinder?.url || l?.portals?.propertyfinder?.webUrl || l?.portals?.propertyfinder?.permalink || null;

      await base44.asServiceRole.entities.PFListing.update(crmId, {
        pf_internal_id: resolved.id,
        status: newStatus,
        title: l?.title?.en || (typeof l?.title === 'string' ? l.title : undefined),
        title_ar: l?.title?.ar || undefined,
        description: l?.description?.en || (typeof l?.description === 'string' ? l.description : undefined),
        description_ar: l?.description?.ar || undefined,
        category: l?.category || undefined,
        price: l?.price?.amounts?.sale || l?.price?.amounts?.rent || undefined,
        price_on_request: l?.price?.onRequest || false,
        downpayment: l?.price?.downpayment || undefined,
        number_of_cheques: l?.price?.numberOfCheques || undefined,
        rent_frequency: l?.price?.rentFrequency || undefined,
        area_sqft: l?.size || undefined,
        plot_size_sqft: l?.plotSize || undefined,
        floor_number: l?.floorNumber || undefined,
        number_of_floors: l?.numberOfFloors || undefined,
        parking_slots: l?.parkingSlots != null ? Number(l.parkingSlots) : undefined,
        bedrooms: l?.bedrooms != null ? Number(l.bedrooms) : undefined,
        bathrooms: l?.bathrooms != null ? Number(l.bathrooms) : undefined,
        images: images.length ? images : undefined,
        amenities: l?.amenities || undefined,
        furnishing: l?.furnishingType || undefined,
        project_status: l?.projectStatus || undefined,
        developer: l?.developer || undefined,
        community: l?.community || l?.location?.name || undefined,
        building_name: l?.buildingName || undefined,
        unit_number: l?.unitNumber || undefined,
        pf_location_id: l?.location?.id || undefined,
        permit_number: l?.listingAdvertisementNumber || undefined,
        issuing_license_number: l?.issuingClientLicenseNumber || undefined,
        agent_name: l?.assignedTo?.name || undefined,
        pf_agent_id: l?.assignedTo?.id ? Number(l.assignedTo.id) : undefined,
        quality_score: l?.qualityScore || undefined,
        pf_url: pfUrl || l?.portals?.propertyfinder?.url || undefined,
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      });

      return Response.json({ ok: true, action, newStatus, pfInternalId: resolved.id, pfUrl });
    }

    // Actions that need PF API
    if (!pfListingId) return Response.json({ error: 'pfListingId is required' }, { status: 400 });

    const token = await getToken(base44);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
    const resolved = await resolvePFInternalId(pfListingId, headers);
    if (!resolved) return Response.json({ error: 'Listing not found on Property Finder', pfListingId }, { status: 404 });
    const pfInternalId = resolved.id;

    let result = null;

    if (action === 'publish') {
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}/publish`, {
        method: 'POST', headers,
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF publish failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { status: 'publishing', last_synced_at: new Date().toISOString() });
      result = { pfResponse: data };

    } else if (action === 'unpublish') {
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ state: { stage: 'takendown', type: 'takendown' } }),
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF unpublish failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { status: 'inactive', last_synced_at: new Date().toISOString() });
      result = { pfResponse: data };

    } else if (action === 'feature') {
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ featured: true }),
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF feature failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { featured: true });
      result = { pfResponse: data };

    } else if (action === 'unfeature') {
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ featured: false }),
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF unfeature failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { featured: false });
      result = { pfResponse: data };

    } else if (action === 'verify') {
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ verified: true }),
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF verify failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { verified: true });
      result = { pfResponse: data };

    } else if (action === 'patch_fields') {
      if (!fieldUpdates || typeof fieldUpdates !== 'object') return Response.json({ error: 'fieldUpdates object required for patch_fields' }, { status: 400 });
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify(fieldUpdates),
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF patch failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { last_synced_at: new Date().toISOString() });
      result = { pfResponse: data };

    } else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return Response.json({ ok: true, action, pfListingId, pfInternalId, crmId, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});