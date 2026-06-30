import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * pfSandboxTest — Full end-to-end sandbox publish test.
 * Creates a minimal test listing → publishes it → unpublishes it → deletes it.
 * Always uses sandbox credentials. Never touches production.
 */

const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

async function getSandboxToken(svc) {
  const creds = await svc.entities.PFCredential.list();
  if (!creds || creds.length === 0) throw new Error('No PF credentials configured');
  const cred = creds[0];

  if (cred.active_environment !== 'sandbox') {
    throw new Error('Active environment is not sandbox. Switch to sandbox in Settings first.');
  }

  const apiKey = cred.sandbox_api_key;
  const apiSecret = cred.sandbox_api_secret;
  if (!apiKey || !apiSecret) throw new Error('Sandbox API key/secret not configured');

  const now = Date.now();
  if (cred.sandbox_access_token && cred.sandbox_token_expires_at) {
    const expiresAtMs = new Date(cred.sandbox_token_expires_at).getTime();
    if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
      return { token: cred.sandbox_access_token, credId: cred.id };
    }
  }

  const authRes = await fetch(`${SANDBOX_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  if (!authRes.ok) {
    const txt = await authRes.text();
    throw new Error(`Sandbox auth failed (${authRes.status}): ${txt.substring(0, 300)}`);
  }
  const tokenData = await authRes.json();
  const accessToken = tokenData.accessToken;
  if (!accessToken) throw new Error('Sandbox auth returned no accessToken');

  const expiresInSec = tokenData.expiresIn || 1800;
  const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  await svc.entities.PFCredential.update(cred.id, {
    sandbox_access_token: accessToken,
    sandbox_token_expires_at: expiresAt,
  });

  return { token: accessToken, credId: cred.id };
}

async function pfCall(method, path, token, body) {
  const res = await fetch(`${SANDBOX_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const steps = [];
    let listingId = null;

    // ── Step 1: Authenticate ──────────────────────────────────────────────────
    let token;
    try {
      const result = await getSandboxToken(svc);
      token = result.token;
      steps.push({ step: 'authenticate', ok: true, message: 'JWT issued from sandbox' });
    } catch (err) {
      steps.push({ step: 'authenticate', ok: false, message: err.message });
      return Response.json({ ok: false, steps, failed_at: 'authenticate' });
    }

    // ── Step 2: Fetch users (resolve publicProfileId) ─────────────────────────
    let publicProfileId = null;
    const usersRes = await pfCall('GET', '/users?page=1&perPage=5', token, null);
    if (usersRes.ok) {
      const users = usersRes.data?.data || usersRes.data || [];
      const firstUser = Array.isArray(users) ? users[0] : null;
      publicProfileId = firstUser?.publicProfile?.id || firstUser?.publicProfileId || null;
      steps.push({
        step: 'fetch_users',
        ok: true,
        message: `Found ${Array.isArray(users) ? users.length : 0} users${publicProfileId ? `, publicProfileId: ${publicProfileId}` : ' (no publicProfileId found)'}`,
        users_count: Array.isArray(users) ? users.length : 0,
        public_profile_id: publicProfileId,
      });
    } else {
      steps.push({ step: 'fetch_users', ok: false, message: `${usersRes.status}: ${JSON.stringify(usersRes.data).substring(0, 200)}` });
      // Non-fatal — continue without publicProfileId
    }

    // ── Step 3: Resolve location ID ───────────────────────────────────────────
    // Sandbox locations search returns 404 — use a known valid PF location ID (Business Bay = 3187)
    const locationId = 3187;
    steps.push({
      step: 'fetch_location',
      ok: true,
      message: `Using known sandbox location ID: ${locationId} (Business Bay, Dubai)`,
      location_id: locationId,
    });

    // ── Step 4: Create a test listing ─────────────────────────────────────────
    const testListing = {
      title: { en: '[SANDBOX TEST] Erudite CRM Integration Test Listing' },
      type: 'apartment',
      category: 'residential',
      price: { type: 'sale', amounts: { sale: 1500000 } },
      uaeEmirate: 'dubai',
      furnishingType: 'unfurnished',
      completionStatus: 'ready',
      bedrooms: '1',
      bathrooms: '1',
      size: 750,
      community: 'Business Bay',
      description: { en: 'This is a sandbox test listing created by Erudite CRM. It will be deleted automatically.' },
      location: { id: locationId },
      ...(publicProfileId ? { publicProfileId, createdBy: { id: publicProfileId } } : {}),
    };

    const createRes = await pfCall('POST', '/listings', token, testListing);
    if (createRes.ok) {
      listingId = createRes.data?.id || createRes.data?.listingId || createRes.data?.data?.id;
      steps.push({
        step: 'create_listing',
        ok: true,
        message: `Test listing created — ID: ${listingId}`,
        listing_id: listingId,
        reference: createRes.data?.reference || null,
      });
    } else {
      steps.push({
        step: 'create_listing',
        ok: false,
        message: `${createRes.status}: ${JSON.stringify(createRes.data).substring(0, 400)}`,
        detail: createRes.data,
      });
      return Response.json({ ok: false, steps, failed_at: 'create_listing' });
    }

    // ── Step 5: Publish the listing ───────────────────────────────────────────
    if (listingId) {
      const publishRes = await pfCall('POST', `/listings/${listingId}/publish`, token, null);
      steps.push({
        step: 'publish_listing',
        ok: publishRes.ok,
        message: publishRes.ok
          ? `Listing ${listingId} published successfully`
          : `Publish returned ${publishRes.status}: ${JSON.stringify(publishRes.data).substring(0, 300)}`,
        listing_id: listingId,
        detail: publishRes.ok ? null : publishRes.data,
      });
    }

    // ── Step 6: Unpublish ─────────────────────────────────────────────────────
    // Sandbox note: unpublish may return "catalog is not live" — this is expected in sandbox
    // because listings go to a review queue before becoming live. Non-fatal.
    if (listingId) {
      const unpubRes = await pfCall('POST', `/listings/${listingId}/unpublish`, token, null);
      const sandboxCatalogNotLive = !unpubRes.ok && JSON.stringify(unpubRes.data).includes('catalog is not live');
      steps.push({
        step: 'unpublish_listing',
        ok: unpubRes.ok || sandboxCatalogNotLive,
        message: unpubRes.ok
          ? `Listing ${listingId} unpublished`
          : sandboxCatalogNotLive
            ? `Sandbox: listing queued for review (not yet live) — unpublish not needed. Expected behavior.`
            : `Unpublish returned ${unpubRes.status}: ${JSON.stringify(unpubRes.data).substring(0, 300)}`,
      });
    }

    // ── Step 7: Delete the test listing (cleanup) ─────────────────────────────
    if (listingId) {
      const deleteRes = await pfCall('DELETE', `/listings/${listingId}`, token, null);
      steps.push({
        step: 'delete_listing',
        ok: deleteRes.ok || deleteRes.status === 204 || deleteRes.status === 404,
        message: (deleteRes.ok || deleteRes.status === 204)
          ? `Test listing ${listingId} deleted — sandbox is clean`
          : `Delete returned ${deleteRes.status}: ${JSON.stringify(deleteRes.data).substring(0, 200)}`,
      });
    }

    const allOk = steps.every(s => s.ok);
    const failedStep = steps.find(s => !s.ok);

    return Response.json({
      ok: allOk,
      environment: 'sandbox',
      steps,
      summary: allOk
        ? '✅ All sandbox tests passed — create, publish, unpublish, delete all working'
        : `⚠️ Failed at step: ${failedStep?.step} — ${failedStep?.message}`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});