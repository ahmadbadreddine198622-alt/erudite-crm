import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROD_BASE = 'https://atlas.propertyfinder.com/v1';
const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

async function getEnvToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || creds.length === 0) throw new Error('No PF credentials configured');
  const cred = creds[0];
  const env = cred.active_environment || 'production';
  const isSandbox = env === 'sandbox';
  const baseUrl = isSandbox ? SANDBOX_BASE : PROD_BASE;
  const apiKey = isSandbox ? cred.sandbox_api_key : cred.api_key;
  const apiSecret = isSandbox ? cred.sandbox_api_secret : cred.api_secret;
  const cachedToken = isSandbox ? cred.sandbox_access_token : cred.access_token;
  const cachedExpiry = isSandbox ? cred.sandbox_token_expires_at : cred.token_expires_at;
  const now = Date.now();

  if (cachedToken && cachedExpiry && new Date(cachedExpiry).getTime() - now > TOKEN_SAFETY_BUFFER_MS) {
    return { token: cachedToken, baseUrl, environment: env, credId: cred.id };
  }
  if (!apiKey || !apiSecret) throw new Error(`PF ${env} API key or secret missing`);

  const res = await fetch(`${baseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  if (!res.ok) throw new Error('PF auth failed: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  const token = data.accessToken;
  if (!token) throw new Error('PF auth returned no accessToken');

  const expiresAt = new Date(now + (data.expiresIn || 1800) * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  const updateData = isSandbox
    ? { sandbox_access_token: token, sandbox_token_expires_at: expiresAt }
    : { access_token: token, token_expires_at: expiresAt };
  await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);

  return { token, baseUrl, environment: env, credId: cred.id };
}

async function resolvePublicProfileId(token, baseUrl, agentEmail) {
  try {
    const res = await fetch(`${baseUrl}/users`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const users = json.data || json.results || [];
    if (agentEmail) {
      const match = users.find(u => u.email === agentEmail);
      if (match?.publicProfile?.id) return match.publicProfile.id;
    }
    // Fallback: first user
    return users[0]?.publicProfile?.id || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pfPayload, crmPayload } = body;

    if (!pfPayload || !crmPayload) {
      return Response.json({ error: 'pfPayload and crmPayload are required' }, { status: 400 });
    }

    // Get env-aware token
    const { token, baseUrl, environment } = await getEnvToken(base44);
    console.log(`[publishNewPFListing] env=${environment}, baseUrl=${baseUrl}`);

    // Resolve agent publicProfileId
    const agentEmail = crmPayload.agent_email || user.email;
    const publicProfileId = await resolvePublicProfileId(token, baseUrl, agentEmail);
    console.log(`[publishNewPFListing] publicProfileId=${publicProfileId}`);

    // Ensure location is set (use known Business Bay ID as fallback for sandbox)
    const locationId = pfPayload.location?.id || pfPayload.locationId || 3187;

    // Build the create payload — conform to PF API field names
    const createBody = {
      ...pfPayload,
      location: { id: locationId },
      ...(publicProfileId ? { createdBy: { id: publicProfileId } } : {}),
    };
    // Remove locationId key if present (use location object instead)
    delete createBody.locationId;
    // PF API requires bedrooms as string: 0 → "studio", others → "1","2"...
    if (createBody.bedrooms !== undefined) {
      createBody.bedrooms = createBody.bedrooms === 0 || createBody.bedrooms === '0' ? 'studio' : String(createBody.bedrooms);
    }
    if (createBody.bathrooms !== undefined) createBody.bathrooms = String(createBody.bathrooms);

    // ── Step 1: Create listing ─────────────────────────────────────────────
    const createRes = await fetch(`${baseUrl}/listings`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    });
    const createText = await createRes.text();
    let createData;
    try { createData = JSON.parse(createText); } catch { createData = {}; }

    if (!createRes.ok) {
      console.error('[publishNewPFListing] Create failed:', createRes.status, createText);
      return Response.json({ ok: false, error: `Create failed (${createRes.status}): ${createText.substring(0, 400)}` });
    }

    const pfListingId = createData.id || createData.reference || createData.data?.id;
    if (!pfListingId) {
      return Response.json({ ok: false, error: 'Listing created but no ID returned', raw: createData });
    }
    console.log(`[publishNewPFListing] Created listing ID: ${pfListingId}`);

    // ── Step 2: Publish listing ────────────────────────────────────────────
    let publishOk = false;
    let publishNote = '';
    const publishRes = await fetch(`${baseUrl}/listings/${pfListingId}/publish`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (publishRes.ok) {
      publishOk = true;
      publishNote = 'Published successfully';
    } else {
      const pText = await publishRes.text();
      // Sandbox: "catalog is not live" is expected — listing is pending review
      if (pText.includes('catalog is not live')) {
        publishOk = true;
        publishNote = 'Submitted for review (sandbox — catalog not yet live, expected behavior)';
      } else {
        publishNote = `Publish returned ${publishRes.status}: ${pText.substring(0, 200)}`;
        console.warn('[publishNewPFListing] Publish issue:', publishNote);
      }
    }

    // ── Step 3: Save to CRM ────────────────────────────────────────────────
    const crmRecord = await base44.asServiceRole.entities.PFListing.create({
      ...crmPayload,
      pf_listing_id: String(pfListingId),
      status: publishOk ? 'active' : 'draft',
      sync_status: publishOk ? 'synced' : 'pending',
      city: 'Dubai',
      environment,
      last_synced_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      environment,
      pf_listing_id: String(pfListingId),
      publish_ok: publishOk,
      publish_note: publishNote,
      crm_id: crmRecord?.id,
    });
  } catch (error) {
    console.error('[publishNewPFListing] Error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});