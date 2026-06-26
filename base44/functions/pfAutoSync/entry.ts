import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

// Fields that should trigger a PF portal sync when changed in the CRM
const SYNC_TRIGGER_FIELDS = new Set([
  'title', 'title_ar', 'description', 'description_ar',
  'price', 'price_on_request', 'downpayment', 'number_of_cheques', 'rent_frequency',
  'bedrooms', 'bathrooms', 'area_sqft', 'plot_size_sqft',
  'floor_number', 'number_of_floors', 'parking_slots',
  'furnishing', 'project_status', 'amenities',
  'permit_number', 'issuing_license_number',
  'building_name', 'unit_number', 'developer',
  'featured', 'verified',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { event, data, changed_fields } = body;

    if (event?.type !== 'update') return Response.json({ ok: true, skipped: 'not an update event' });

    const crmId = event?.entity_id;
    if (!crmId) return Response.json({ ok: true, skipped: 'no entity_id' });

    // Only sync if relevant fields changed
    const changedArr = Array.isArray(changed_fields) ? changed_fields : [];
    const hasSyncableChange = changedArr.some(f => SYNC_TRIGGER_FIELDS.has(f));
    if (!hasSyncableChange) return Response.json({ ok: true, skipped: 'no syncable fields changed', changed_fields: changedArr });

    // Load full CRM record
    const record = data || await base44.asServiceRole.entities.PFListing.get(crmId);
    if (!record) return Response.json({ ok: true, skipped: 'record not found' });

    // Only sync listings that are live or have a PF internal ID
    const pfInternalId = record.pf_internal_id;
    const pfListingId = record.pf_listing_id;
    if (!pfInternalId && !pfListingId) return Response.json({ ok: true, skipped: 'no PF identifier on record' });
    if (record.status === 'draft' || record.status === 'expired') return Response.json({ ok: true, skipped: `status is ${record.status}` });

    // Get token
    const tokenRes = await base44.functions.invoke('pfGetToken', {});
    const token = tokenRes?.data?.access_token || tokenRes?.access_token;
    if (!token) return Response.json({ ok: false, error: 'Could not get PF token' });

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

    // Resolve internal ID if not stored
    let internalId = pfInternalId;
    if (!internalId && pfListingId) {
      const searchRes = await fetch(`${PF_BASE}/listings?reference=${encodeURIComponent(pfListingId)}&perPage=5`, { headers });
      if (searchRes.ok) {
        const sd = await searchRes.json();
        const items = sd.results || sd.data || sd.listings || sd.items || [];
        const match = items.find(i => i.reference === pfListingId || i.id === pfListingId);
        if (match?.id) {
          internalId = match.id;
          await base44.asServiceRole.entities.PFListing.update(crmId, { pf_internal_id: internalId }).catch(() => {});
        }
      }
    }

    if (!internalId) return Response.json({ ok: false, error: 'Could not resolve PF internal ID for sync', pfListingId });

    // Build PATCH payload from only the changed fields
    const patch = {};
    const isSale = record.listing_type === 'sale';

    if (changedArr.includes('title') || changedArr.includes('title_ar')) {
      patch.title = { en: record.title || '' };
      if (record.title_ar) patch.title.ar = record.title_ar;
    }

    if (changedArr.includes('description') || changedArr.includes('description_ar')) {
      patch.description = { en: record.description || '' };
      if (record.description_ar) patch.description.ar = record.description_ar;
    }

    if (changedArr.some(f => ['price', 'price_on_request', 'downpayment', 'number_of_cheques', 'rent_frequency'].includes(f))) {
      patch.price = {
        type: record.listing_type || 'sale',
        onRequest: record.price_on_request || false,
        amounts: isSale ? { sale: record.price } : { rent: record.price },
      };
      if (isSale && record.downpayment) patch.price.downpayment = record.downpayment;
      if (isSale && record.number_of_cheques) patch.price.numberOfCheques = record.number_of_cheques;
      if (!isSale && record.rent_frequency) patch.price.rentFrequency = record.rent_frequency;
    }

    if (changedArr.includes('bedrooms')) patch.bedrooms = record.bedrooms;
    if (changedArr.includes('bathrooms')) patch.bathrooms = record.bathrooms;
    if (changedArr.includes('area_sqft')) patch.size = record.area_sqft;
    if (changedArr.includes('plot_size_sqft')) patch.plotSize = record.plot_size_sqft;
    if (changedArr.includes('floor_number')) patch.floorNumber = record.floor_number;
    if (changedArr.includes('number_of_floors')) patch.numberOfFloors = record.number_of_floors;
    if (changedArr.includes('parking_slots')) patch.parkingSlots = record.parking_slots;
    if (changedArr.includes('furnishing')) patch.furnishingType = record.furnishing;
    if (changedArr.includes('project_status')) patch.projectStatus = record.project_status;
    if (changedArr.includes('amenities')) patch.amenities = record.amenities;
    if (changedArr.includes('permit_number')) patch.listingAdvertisementNumber = record.permit_number;
    if (changedArr.includes('issuing_license_number')) patch.issuingClientLicenseNumber = record.issuing_license_number;
    if (changedArr.includes('building_name')) patch.buildingName = record.building_name;
    if (changedArr.includes('unit_number')) patch.unitNumber = record.unit_number;
    if (changedArr.includes('developer')) patch.developer = record.developer;
    if (changedArr.includes('featured')) patch.featured = record.featured;
    if (changedArr.includes('verified')) patch.verified = record.verified;

    if (Object.keys(patch).length === 0) return Response.json({ ok: true, skipped: 'patch payload empty' });

    // Push to PF API
    const patchRes = await fetch(`${PF_BASE}/listings/${internalId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });

    const rawText = await patchRes.text();
    let patchData; try { patchData = JSON.parse(rawText); } catch { patchData = { raw: rawText }; }

    if (!patchRes.ok) {
      await base44.asServiceRole.entities.PFListing.update(crmId, { sync_status: 'error', sync_error: `PF PATCH ${patchRes.status}: ${rawText.substring(0, 200)}` }).catch(() => {});
      return Response.json({ ok: false, error: `PF PATCH failed (${patchRes.status})`, detail: patchData }, { status: 502 });
    }

    // Mark as synced
    await base44.asServiceRole.entities.PFListing.update(crmId, {
      sync_status: 'synced',
      sync_error: null,
      last_synced_at: new Date().toISOString(),
    }).catch(() => {});

    console.log(`pfAutoSync: synced crmId=${crmId} internalId=${internalId} fields=${changedArr.filter(f => SYNC_TRIGGER_FIELDS.has(f)).join(',')}`);
    return Response.json({ ok: true, internalId, patchedFields: Object.keys(patch), pfResponse: patchData });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});