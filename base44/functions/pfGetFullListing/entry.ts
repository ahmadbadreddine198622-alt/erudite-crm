import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getToken(base44) {
  const tokenRes = await base44.functions.invoke('pfGetToken', {});
  return tokenRes?.data?.access_token || tokenRes?.access_token;
}

// Resolve PF internal ID from a reference or internal ID
async function resolveId(identifier, headers) {
  // Try direct GET
  const directRes = await fetch(`${PF_BASE}/listings/${identifier}`, { headers });
  if (directRes.ok) {
    const data = await directRes.json();
    if (data?.id) return { id: data.id, listing: data };
  }
  // Search by reference
  const searchRes = await fetch(`${PF_BASE}/listings?reference=${encodeURIComponent(identifier)}&perPage=5`, { headers });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const items = searchData.results || [];
    const match = items.find(i => i.reference === identifier || i.id === identifier);
    if (match) return { id: match.id, listing: match };
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pfListingId, crmId } = await req.json().catch(() => ({}));

    const token = await getToken(base44);
    if (!token) return Response.json({ error: 'Could not get PF token' }, { status: 500 });

    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    let resolved = null;

    // If we have a crmId, try to get pf_internal_id from CRM first (fastest path)
    if (crmId) {
      const crmRecord = await base44.asServiceRole.entities.PFListing.get(crmId).catch(() => null);
      if (crmRecord?.pf_internal_id) {
        const r = await fetch(`${PF_BASE}/listings/${crmRecord.pf_internal_id}`, { headers });
        if (r.ok) {
          const listing = await r.json();
          resolved = { id: crmRecord.pf_internal_id, listing };
        }
      }
      if (!resolved && crmRecord?.pf_listing_id) {
        resolved = await resolveId(crmRecord.pf_listing_id, headers);
      }
    }

    if (!resolved && pfListingId) {
      resolved = await resolveId(pfListingId, headers);
    }

    if (!resolved) {
      return Response.json({ error: 'Listing not found on PF API' }, { status: 404 });
    }

    const l = resolved.listing;

    // Normalize to CRM-friendly shape
    const normalized = {
      pf_internal_id: l.id,
      pf_listing_id: l.reference,
      reference_number: l.reference,
      title: l.title?.en || l.title || '',
      title_ar: l.title?.ar || '',
      description: l.description?.en || l.description || '',
      description_ar: l.description?.ar || '',
      property_type: l.type,
      category: l.category,
      listing_type: l.price?.type || 'sale',
      price: l.price?.amounts?.sale || l.price?.amounts?.rent || 0,
      price_on_request: l.price?.onRequest || false,
      downpayment: l.price?.downpayment || 0,
      number_of_cheques: l.price?.numberOfCheques || 0,
      rent_frequency: l.price?.rentFrequency || null,
      area_sqft: l.size || 0,
      plot_size_sqft: l.plotSize || 0,
      bedrooms: l.bedrooms != null ? Number(l.bedrooms) : null,
      bathrooms: l.bathrooms != null ? Number(l.bathrooms) : null,
      floor_number: l.floorNumber || '',
      number_of_floors: l.numberOfFloors || 0,
      parking_slots: l.parkingSlots || 0,
      pf_location_id: l.location?.id || null,
      community: l.community || '',
      building_name: l.buildingName || '',
      unit_number: l.unitNumber || '',
      developer: l.developer || '',
      amenities: l.amenities || [],
      furnishing: l.furnishingType || 'unfurnished',
      project_status: l.projectStatus || null,
      images: (l.media?.images || []).map(img => img?.original?.url || img?.url).filter(Boolean),
      permit_number: l.listingAdvertisementNumber || '',
      issuing_license_number: l.issuingClientLicenseNumber || '',
      pf_agent_id: l.assignedTo?.id || null,
      agent_name: l.assignedTo?.name || '',
      quality_score: l.qualityScore || 0,
      // Portal status
      status: l.portals?.propertyfinder?.isLive ? 'active' : (l.state?.stage === 'takendown' ? 'inactive' : 'draft'),
      pf_url: l.portals?.propertyfinder?.url || null,
      is_live: l.portals?.propertyfinder?.isLive || false,
      pf_state: l.state,
      portals: l.portals,
      // Raw for reference
      _raw: l,
    };

    return Response.json({ ok: true, listing: normalized, pfInternalId: resolved.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});