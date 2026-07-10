import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

// ── Token management (inlined — backend functions deploy independently) ──
async function getToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || creds.length === 0) throw new Error('No PF credentials configured');
  const cred = creds[0];
  const now = Date.now();

  if (cred.access_token && cred.token_expires_at) {
    const expiresAtMs = new Date(cred.token_expires_at).getTime();
    if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) return cred.access_token;
  }

  if (!cred.api_key || !cred.api_secret) throw new Error('PF API key or secret missing');

  const authRes = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
  });
  if (!authRes.ok) {
    const txt = await authRes.text();
    throw new Error(`PF auth failed (${authRes.status}): ${txt.substring(0, 200)}`);
  }
  const tokenData = await authRes.json();
  const accessToken = tokenData.accessToken;
  if (!accessToken) throw new Error('PF auth returned no accessToken');

  const expiresInSec = tokenData.expiresIn || 1800;
  const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  const updateData = { access_token: accessToken, token_expires_at: expiresAt, api_environment: 'production' };
  if (tokenData.scopes) updateData.scopes_granted = Array.isArray(tokenData.scopes) ? tokenData.scopes : [tokenData.scopes];
  await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);
  return accessToken;
}

// ── DLD compliance (inlined from pfGetCompliance) ──
const DLD_TYPE_MAP = {
  'unit': 'apartment', 'villa': 'villa', 'building': 'building', 'land': 'land',
  'office': 'office', 'shop': 'retail', 'warehouse': 'warehouse', 'compound': 'compound',
};
const SALE_TYPE_MAP = { 'primary': 'completed_primary', 'secondary': 'completed' };

function isExemptZone(location, community) {
  const text = ((location || '') + ' ' + (community || '')).toLowerCase();
  return text.includes('difc') || text.includes('jafza') || text.includes('jebel ali free zone');
}

async function getCompliance(base44, token, permitNumber, licenseNumber, location, community) {
  if (isExemptZone(location, community)) return { valid: true, exempt: true, mappedType: null, projectStatus: null };
  const res = await fetch(`${PF_BASE}/compliances/${encodeURIComponent(permitNumber)}/${encodeURIComponent(licenseNumber)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text();
    return { valid: false, error: `Compliance check failed (${res.status}): ${txt.substring(0, 300)}` };
  }
  const data = await res.json();
  const prop = data.property || data || {};
  const listingType = prop.listingType || prop.type || null;
  const saleType = prop.saleType || prop.sale_type || null;
  return {
    valid: true,
    exempt: false,
    mappedType: listingType ? (DLD_TYPE_MAP[String(listingType).toLowerCase()] || null) : null,
    projectStatus: saleType ? (SALE_TYPE_MAP[String(saleType).toLowerCase()] || null) : null,
  };
}

// ── Sleep with jitter for rate limiting ──
const sleep = (ms) => new Promise(r => setTimeout(r, ms + Math.random() * 200));

// ── Resolve agent's PF publicProfile.id, caching on the User record ──
async function resolvePublicProfileId(base44, token, agentEmail, userRecord) {
  if (userRecord.pf_public_profile_id) return userRecord.pf_public_profile_id;

  const res = await fetch(`${PF_BASE}/users?email=${encodeURIComponent(agentEmail)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Could not resolve PF public profile for ${agentEmail} (${res.status}): ${txt.substring(0, 200)}`);
  }
  const data = await res.json();
  const users = Array.isArray(data) ? data : (data.data || []);
  const pfUser = users[0];
  if (!pfUser) throw new Error(`No PF user found for email ${agentEmail}`);
  const profileId = pfUser.publicProfile?.id || pfUser.publicProfileId;
  if (!profileId) throw new Error(`PF user found for ${agentEmail} but no publicProfile.id`);

  // Cache it on the User record
  try {
    await base44.asServiceRole.entities.User.update(userRecord.id, { pf_public_profile_id: profileId });
  } catch (e) { /* non-fatal */ }
  return profileId;
}

// ── Build the PF listing payload from CRM data ──
function buildListingPayload({ lp, property, company, agent, publicProfileId, compliance, locationId }) {
  const isSale = (property.listing_type || 'sale') === 'sale';
  const price = isSale ? property.price_aed : property.rent_aed;

  const payload = {
    title: { en: lp.listing_title || property.title || 'Listing' },
    type: compliance?.mappedType || mapPropertyType(property.property_type),
    category: isCommercial(property.property_type) ? 'commercial' : 'residential',
    price: {
      type: isSale ? 'sale' : 'rent',
      amounts: isSale ? { sale: Number(price) } : { rent: Number(price) },
    },
    uaeEmirate: 'dubai',
    furnishingType: property.furnishing || 'unfurnished',
    completionStatus: lp.is_off_plan ? 'off_plan' : 'ready',
    locationId: locationId,
    publicProfileId: publicProfileId,
    listingAdvertisementNumber: property.trakheesi_permit_no || property.permit_number,
    issuingClientLicenseNumber: company.brn || company.ded_license,
  };

  if (lp.listing_description || property.description) {
    payload.description = { en: lp.listing_description || property.description };
  }
  if (property.bedrooms != null) payload.bedrooms = Number(property.bedrooms);
  if (property.bathrooms != null) payload.bathrooms = Number(property.bathrooms);
  if (property.area_sqft) payload.size = Number(property.area_sqft);
  if (property.unit_no) payload.unitNumber = property.unit_no;
  if (property.location) payload.community = property.location;
  if (property.building_name) payload.buildingName = property.building_name;
  if (property.developer) payload.developer = { name: property.developer };
  if (compliance?.projectStatus) payload.projectStatus = compliance.projectStatus;
  if (property.latitude && property.longitude) {
    payload.coordinates = { latitude: Number(property.latitude), longitude: Number(property.longitude) };
  }
  if (property.amenities && property.amenities.length) payload.amenities = property.amenities;

  // Images — at least 1 required
  const images = Array.isArray(property.images) ? property.images.filter(Boolean) : [];
  if (images.length > 0) {
    payload.media = { images: images.map(url => ({ original: { url } })) };
  }

  // Agent assignment
  if (agent) {
    payload.assignedTo = {
      email: agent.email,
      firstName: agent.full_name?.split(' ')[0] || '',
      lastName: agent.full_name?.split(' ').slice(1).join(' ') || '',
      ...(agent.phone ? { phone: agent.phone } : {}),
    };
  }

  return payload;
}

function mapPropertyType(crmType) {
  const map = {
    apartment: 'apartment', villa: 'villa', townhouse: 'townhouse', penthouse: 'penthouse',
    studio: 'studio', office: 'office', retail: 'retail', warehouse: 'warehouse', land: 'land',
  };
  return map[crmType] || 'apartment';
}

function isCommercial(type) {
  return ['office', 'retail', 'warehouse', 'land'].includes(type);
}

// ── Validate required fields BEFORE any PF call ──
function validateRequired(lp, property, agent, locationId) {
  const errors = [];
  if (!property.trakheesi_permit_no && !property.permit_number) errors.push('Trakheesi permit number');
  const price = property.listing_type === 'rent' ? property.rent_aed : property.price_aed;
  if (!price || isNaN(Number(price))) errors.push('Price');
  if (!property.area_sqft) errors.push('Area (sqft)');
  if (!property.listing_type) errors.push('Listing type (sale/rent)');
  if (!property.latitude || !property.longitude) errors.push('Coordinates (latitude + longitude)');
  if (!agent?.brn) errors.push('Agent BRN');
  if (!locationId) errors.push('PF Location ID (pick from autocomplete)');
  const images = Array.isArray(property.images) ? property.images.filter(Boolean) : [];
  if (images.length === 0) errors.push('At least one image');
  return errors;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlordPropertyId } = body;
    if (!landlordPropertyId) return Response.json({ error: 'landlordPropertyId required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // 1. Load LandlordProperty + linked Property
    const lp = await svc.entities.LandlordProperty.get(landlordPropertyId);
    if (!lp) return Response.json({ error: 'LandlordProperty not found' }, { status: 404 });

    let property = null;
    if (lp.property_id) {
      const props = await svc.entities.Property.filter({ id: lp.property_id }).catch(() => []);
      property = props?.[0] || null;
    }
    if (!property) return Response.json({ error: 'Linked Property not found — cannot publish without property data' }, { status: 400 });

    // 2. Load Landlord to get agent email
    const landlords = await svc.entities.Landlord.filter({ id: lp.landlord_id }).catch(() => []);
    const landlord = landlords?.[0] || null;
    const agentEmail = landlord?.assigned_agent_email || landlord?.listing_manager_email || property.agent_email;
    if (!agentEmail) return Response.json({ error: 'No agent assigned — assign an agent to this landlord first' }, { status: 400 });

    // 3. Load the agent User record
    const users = await svc.entities.User.filter({ email: agentEmail }).catch(() => []);
    const agent = users?.[0] || null;
    if (!agent) return Response.json({ error: `Agent user not found for email ${agentEmail}` }, { status: 400 });

    // 4. Load company settings
    const settings = await svc.entities.CompanySettings.list();
    const company = (settings && settings[0]) || {};

    // 5. Resolve PF location ID — from LandlordProperty cache or body param
    const locationId = body.locationId || lp.pf_location_id;
    if (locationId && locationId !== lp.pf_location_id) {
      try { await svc.entities.LandlordProperty.update(lp.id, { pf_location_id: locationId, pf_location_name: body.locationName || null }); } catch (_) {}
    }

    // 6. Validate required fields BEFORE any PF call
    const validationErrors = validateRequired(lp, property, agent, locationId);
    if (validationErrors.length) {
      return Response.json({ error: 'Missing required fields', missing: validationErrors }, { status: 422 });
    }

    // 7. Get cached JWT
    const token = await getToken(svc);

    // 8. Resolve agent's PF publicProfile.id (cached on User)
    const publicProfileId = await resolvePublicProfileId(svc, token, agentEmail, agent);

    // 9. Check for existing PFListing (upsert switch)
    const existingPF = await svc.entities.PFListing.filter({ landlord_property_id: lp.id }).catch(() => []);
    const existingRecord = existingPF?.[0] || null;
    const isUpdate = !!(existingRecord?.pf_listing_id);

    // 10. Compliance check (skip if DIFC/JAFZA exempt)
    const permitNumber = property.trakheesi_permit_no || property.permit_number;
    const licenseNumber = company.brn || company.ded_license;
    const compliance = await getCompliance(svc, token, permitNumber, licenseNumber, property.location, property.building_name);
    if (!compliance.valid) {
      return Response.json({ error: compliance.error || 'Compliance check failed', stage: 'compliance' }, { status: 422 });
    }

    // 11. Build the listing payload
    const payload = buildListingPayload({ lp, property, company, agent, publicProfileId, compliance, locationId });

    let pfListingId = null;
    let pfResponseData = null;

    if (isUpdate) {
      // ── UPDATE path ──
      pfListingId = existingRecord.pf_listing_id;

      // Strip read-only fields for PUT
      const READONLY = ['id', 'reference', 'state', 'portals', 'status', 'createdAt', 'updatedAt', 'publicProfile', 'agent', 'assignedAgent', 'permitNumber', 'dld', 'qr', 'listingAdvertisementNumber', 'issuingClientLicenseNumber'];
      const updatePayload = Object.fromEntries(Object.entries(payload).filter(([k]) => !READONLY.includes(k)));

      const putRes = await fetch(`${PF_BASE}/listings/${pfListingId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (putRes.status === 401) {
        // Re-issue token and retry once
        const creds = await svc.entities.PFCredential.list();
        if (creds[0]) await svc.entities.PFCredential.update(creds[0].id, { access_token: null, token_expires_at: null });
        const freshToken = await getToken(svc);
        const retryRes = await fetch(`${PF_BASE}/listings/${pfListingId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${freshToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
        if (!retryRes.ok) {
          const txt = await retryRes.text();
          return Response.json({ error: `PF update failed after retry (${retryRes.status}): ${txt.substring(0, 400)}`, stage: 'update' }, { status: retryRes.status === 422 ? 422 : 400 });
        }
        pfResponseData = await retryRes.json();
      } else if (putRes.status === 429) {
        await sleep(2000);
        return Response.json({ error: 'Rate limited — please retry in a moment', stage: 'update' }, { status: 429 });
      } else if (!putRes.ok) {
        const txt = await putRes.text();
        const detail = safeJsonParse(txt);
        return Response.json({ error: `PF update failed (${putRes.status}): ${txt.substring(0, 400)}`, detail, stage: 'update' }, { status: putRes.status === 422 ? 422 : 400 });
      } else {
        pfResponseData = await putRes.json();
      }

      // Set status to "publishing" — NOT "active"
      await svc.entities.PFListing.update(existingRecord.id, {
        status: 'publishing',
        sync_status: 'pending',
        title: lp.listing_title || existingRecord.title,
        description: lp.listing_description || existingRecord.description,
        price: property.listing_type === 'rent' ? property.rent_aed : property.price_aed,
        area_sqft: property.area_sqft,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        permit_number: permitNumber,
        last_synced_at: new Date().toISOString(),
      });
    } else {
      // ── CREATE path ──
      // a. POST /v1/listings (draft)
      const createRes = await fetch(`${PF_BASE}/listings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (createRes.status === 401) {
        const creds = await svc.entities.PFCredential.list();
        if (creds[0]) await svc.entities.PFCredential.update(creds[0].id, { access_token: null, token_expires_at: null });
        const freshToken = await getToken(svc);
        const retryRes = await fetch(`${PF_BASE}/listings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!retryRes.ok) {
          const txt = await retryRes.text();
          const detail = safeJsonParse(txt);
          return Response.json({ error: `PF create failed after retry (${retryRes.status}): ${txt.substring(0, 400)}`, detail, stage: 'create' }, { status: retryRes.status === 422 ? 422 : 400 });
        }
        pfResponseData = await retryRes.json();
      } else if (createRes.status === 429) {
        await sleep(2000);
        return Response.json({ error: 'Rate limited — please retry in a moment', stage: 'create' }, { status: 429 });
      } else if (!createRes.ok) {
        const txt = await createRes.text();
        const detail = safeJsonParse(txt);
        return Response.json({ error: `PF create failed (${createRes.status}): ${txt.substring(0, 400)}`, detail, stage: 'create' }, { status: createRes.status === 422 ? 422 : 400 });
      } else {
        pfResponseData = await createRes.json();
      }

      pfListingId = pfResponseData?.id || pfResponseData?.listingId || pfResponseData?.data?.id;
      if (!pfListingId) {
        return Response.json({ error: 'PF create returned 200 but no listing ID', raw: JSON.stringify(pfResponseData).substring(0, 500), stage: 'create' }, { status: 500 });
      }

      // b. POST /v1/listings/{id}/publish
      const publishRes = await fetch(`${PF_BASE}/listings/${pfListingId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      });

      if (!publishRes.ok && publishRes.status !== 429) {
        // Non-fatal: listing was created as draft, publish may need retry
        const txt = await publishRes.text();
        console.error(`Publish call failed (${publishRes.status}): ${txt.substring(0, 200)}`);
      }

      // c. Create PFListing record — status "publishing" (NOT active)
      await svc.entities.PFListing.create({
        pf_listing_id: pfListingId,
        landlord_property_id: lp.id,
        property_id: lp.property_id,
        title: lp.listing_title || property.title,
        description: lp.listing_description || property.description,
        property_type: mapPropertyType(property.property_type),
        listing_type: property.listing_type || 'sale',
        price: property.listing_type === 'rent' ? property.rent_aed : property.price_aed,
        area_sqft: property.area_sqft,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        location: property.location,
        city: 'Dubai',
        building_name: property.building_name,
        unit_number: property.unit_no,
        latitude: property.latitude,
        longitude: property.longitude,
        images: Array.isArray(property.images) ? property.images : [],
        amenities: property.amenities || [],
        furnishing: property.furnishing || 'unfurnished',
        completion_status: lp.is_off_plan ? 'off_plan' : 'ready',
        status: 'publishing',
        permit_number: permitNumber,
        developer: property.developer,
        agent_email: agentEmail,
        agent_name: agent.full_name,
        agency_name: company.company_name_en || 'ERUDITE REAL ESTATE',
        sync_status: 'pending',
        last_synced_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        tags: ['crm_published'],
      });
    }

    // 12. Update LandlordProperty production stage
    try {
      await svc.entities.LandlordProperty.update(lp.id, { listing_production_stage: 'publishing' });
    } catch (_) {}

    return Response.json({
      ok: true,
      action: isUpdate ? 'update' : 'create',
      pf_listing_id: pfListingId,
      status: 'publishing',
      message: 'Publish request accepted. Status is "publishing" — confirmation pending from Property Finder (webhook or manual verify).',
    });
  } catch (error) {
    console.error('pfPublishListing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function safeJsonParse(txt) {
  try { return JSON.parse(txt); } catch (_) { return null; }
}