import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const PF_HOST = 'atlas.propertyfinder.com';
const AWS_REGION = 'me-south-1'; // Bahrain — PF API gateway region
const AWS_SERVICE = 'execute-api';

// ── AWS SigV4 signing for PF write endpoints ──────────────────────────────
async function hmacSha256(key, data) {
  const enc = new TextEncoder();
  const keyData = typeof key === 'string' ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data)));
}

async function sha256Hex(data) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest({ method, url, body, token, apiKey, apiSecret }) {
  const parsed = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z'; // 20260626T171234Z
  const dateStamp = amzDate.substring(0, 8); // 20260626

  const bodyStr = body || '';
  const payloadHash = await sha256Hex(bodyStr);

  const canonicalHeaders = [
    `content-type:application/json`,
    `host:${PF_HOST}`,
    `x-amz-date:${amzDate}`,
    `x-amz-security-token:${token}`, // JWT as session token
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-date;x-amz-security-token';

  const canonicalRequest = [
    method.toUpperCase(),
    parsed.pathname,
    parsed.search.slice(1), // query string without '?'
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  // Derive signing key
  const kDate = await hmacSha256(`AWS4${apiSecret}`, dateStamp);
  const kRegion = await hmacSha256(kDate, AWS_REGION);
  const kService = await hmacSha256(kRegion, AWS_SERVICE);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Amz-Date': amzDate,
    'X-Amz-Security-Token': token,
  };
}

async function getToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || !creds.length) throw new Error('No PF credentials configured');
  const cred = creds[0];
  const now = Date.now();

  // Return cached token if still valid (>60s remaining)
  if (cred.access_token && cred.token_expires_at) {
    if (new Date(cred.token_expires_at).getTime() - now > 60000) return cred.access_token;
  }

  // Request fresh token
  const authRes = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
  });
  if (!authRes.ok) throw new Error(`PF auth failed (${authRes.status}): ${await authRes.text()}`);
  const data = await authRes.json();
  const token = data.accessToken;
  if (!token) throw new Error('PF auth returned no accessToken');

  const expiresAt = new Date(now + (data.expiresIn || 1800) * 1000 - 60000).toISOString();
  await base44.asServiceRole.entities.PFCredential.update(cred.id, { access_token: token, token_expires_at: expiresAt }).catch(() => {});
  return token;
}

// Resolve PF internal listing ID.
// Strategy: the ULID internal ID (e.g. 1WCYDKDWQ5K380M8JKTTWQ8CJW) must be used for PATCH/state changes.
// The CRM stores it in pf_internal_id. The pf_listing_id is the human reference (e.g. erudite-3366406).
// We try: 1) stored pf_internal_id from CRM, 2) search by reference, 3) direct GET (works if already internal id).
async function resolvePFInternalId(pfListingId, headers, base44, crmId) {
  // Step 1: check CRM record for stored pf_internal_id (fastest, most reliable)
  if (crmId) {
    try {
      const record = await base44.asServiceRole.entities.PFListing.get(crmId);
      if (record?.pf_internal_id) {
        // Use the stored internal ULID — no API lookup needed
        return { id: record.pf_internal_id, listing: null };
      }
    } catch (_) { /* fallthrough */ }
  }

  // Step 2: search by reference (pf_listing_id is typically the reference)
  const searchRes = await fetch(`${PF_BASE}/listings?reference=${encodeURIComponent(pfListingId)}&perPage=5`, { headers });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const items = searchData.results || searchData.data || searchData.listings || searchData.items || [];
    const match = items.find(i => i.reference === pfListingId || i.id === pfListingId);
    if (match) {
      // Persist the resolved internal ID to avoid future lookups
      if (crmId && match.id) {
        await base44.asServiceRole.entities.PFListing.update(crmId, { pf_internal_id: match.id }).catch(() => {});
      }
      return { id: match.id, listing: match };
    }
  }

  // Step 3: try direct GET — works if pfListingId happens to be the real internal ULID
  const directRes = await fetch(`${PF_BASE}/listings/${pfListingId}`, { headers });
  if (directRes.ok) {
    const data = await directRes.json();
    if (data?.id) {
      if (crmId) {
        await base44.asServiceRole.entities.PFListing.update(crmId, { pf_internal_id: data.id }).catch(() => {});
      }
      return { id: data.id, listing: data };
    }
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
      const resolved = await resolvePFInternalId(pfListingId, headers, base44, crmId);
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

    // Load creds for SigV4 signing
    const pfCreds = await base44.asServiceRole.entities.PFCredential.list();
    if (!pfCreds || !pfCreds.length) return Response.json({ error: 'No PF credentials configured' }, { status: 500 });
    const pfCred = pfCreds[0];

    const token = await getToken(base44);
    // Read headers used for GET (Bearer only — works for reads)
    const readHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
    const resolved = await resolvePFInternalId(pfListingId, readHeaders, base44, crmId);
    if (!resolved) return Response.json({ error: 'Listing not found on Property Finder', pfListingId }, { status: 404 });
    const pfInternalId = resolved.id;

    let result = null;

    // Helper: make a SigV4-signed write request
    const signedFetch = async (method, url, body) => {
      const bodyStr = body ? JSON.stringify(body) : '';
      const h = await signRequest({ method, url, body: bodyStr, token, apiKey: pfCred.api_key, apiSecret: pfCred.api_secret });
      return fetch(url, { method, headers: h, ...(bodyStr ? { body: bodyStr } : {}) });
    };

    if (action === 'publish') {
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}/publish`, {
        method: 'POST',
        headers: readHeaders,
        body: '{}',
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF publish failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { status: 'publishing', last_synced_at: new Date().toISOString() });
      result = { pfResponse: data };

    } else if (action === 'unpublish') {
      // POST /unpublish with Bearer JWT — takes listing off portal without deleting it
      const res = await fetch(`${PF_BASE}/listings/${pfInternalId}/unpublish`, {
        method: 'POST',
        headers: readHeaders,
        body: '{}',
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      // 422 "catalog is not live" means it's already unpublished — treat as success
      const alreadyUnpublished = res.status === 422 && raw.includes('not live');
      if (!res.ok && !alreadyUnpublished) return Response.json({ error: `PF unpublish failed (${res.status})`, detail: data, hint: raw.substring(0, 400) }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { status: 'inactive', last_synced_at: new Date().toISOString() });
      result = { method: 'POST_unpublish', alreadyUnpublished, pfResponse: data };

    } else if (action === 'feature') {
      const res = await signedFetch('PATCH', `${PF_BASE}/listings/${pfInternalId}`, { featured: true });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF feature failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { featured: true });
      result = { pfResponse: data };

    } else if (action === 'unfeature') {
      const res = await signedFetch('PATCH', `${PF_BASE}/listings/${pfInternalId}`, { featured: false });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF unfeature failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { featured: false });
      result = { pfResponse: data };

    } else if (action === 'verify') {
      const res = await signedFetch('PATCH', `${PF_BASE}/listings/${pfInternalId}`, { verified: true });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!res.ok) return Response.json({ error: `PF verify failed (${res.status})`, detail: data }, { status: 502 });
      if (crmId) await base44.asServiceRole.entities.PFListing.update(crmId, { verified: true });
      result = { pfResponse: data };

    } else if (action === 'patch_fields') {
      if (!fieldUpdates || typeof fieldUpdates !== 'object') return Response.json({ error: 'fieldUpdates object required for patch_fields' }, { status: 400 });
      const res = await signedFetch('PATCH', `${PF_BASE}/listings/${pfInternalId}`, fieldUpdates);
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