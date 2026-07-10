import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const creds = await svc.entities.PFCredential.list();
    const cred = creds[0];
    const token = cred.sandbox_access_token;

    if (!token) return Response.json({ error: 'No sandbox token — run pfSandboxTest first to issue one' }, { status: 400 });

    const results = {};

    // Try different location endpoint paths
    const locationPaths = [
      '/locations?search=Business%20Bay',
      '/locations?q=Business%20Bay',
      '/locations?name=Business+Bay',
      '/locations/search?query=Business+Bay',
      '/locations',
    ];

    results.location_probes = [];
    for (const path of locationPaths) {
      const r = await fetch(`${SANDBOX_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const txt = await r.text();
      results.location_probes.push({
        path,
        status: r.status,
        ok: r.ok,
        body_preview: txt.substring(0, 300),
      });
      if (r.ok) break; // stop on first success
    }

    // Try minimal listing payload variations for created_by
    const payloadVariants = [
      { name: 'createdBy_object', extra: { createdBy: { id: 422160 } } },
      { name: 'created_by_string', extra: { created_by: { id: '422160' } } },
      { name: 'assignedTo_only', extra: { assignedTo: { id: 422160 } } },
      { name: 'no_creator', extra: {} },
    ];

    results.create_probes = [];
    for (const v of payloadVariants) {
      const testPayload = {
        title: { en: '[PROBE] Test' },
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
        ...v.extra,
      };
      const r = await fetch(`${SANDBOX_BASE}/listings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });
      const txt = await r.text();
      results.create_probes.push({
        variant: v.name,
        status: r.status,
        ok: r.ok,
        body_preview: txt.substring(0, 500),
      });
      // If created, delete it immediately
      if (r.ok) {
        try {
          const data = JSON.parse(txt);
          const id = data?.id || data?.listingId;
          if (id) {
            await fetch(`${SANDBOX_BASE}/listings/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            results.create_probes[results.create_probes.length - 1].created_id = id;
            results.create_probes[results.create_probes.length - 1].deleted = true;
          }
        } catch (_) {}
        break; // stop on first success
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});