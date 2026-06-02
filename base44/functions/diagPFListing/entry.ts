import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    // Get credentials
    const creds = await base44.asServiceRole.entities.PFCredential.list();
    const cred = creds?.[0];
    const apiKey = cred?.api_key || Deno.env.get('PROPERTY_FINDER_API_KEY');
    const apiSecret = cred?.api_secret || Deno.env.get('PROPERTY_FINDER_API_SECRET');

    // Auth
    const authRes = await fetch(`${PF_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ apiKey, apiSecret }),
    });
    const { accessToken } = await authRes.json();

    // Fetch first page, find a LIVE listing
    const listRes = await fetch(`${PF_BASE}/listings?page=1&perPage=50`, {
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' },
    });
    const listData = await listRes.json();
    const items = listData.results || listData.data || listData.listings || listData.items || [];
    // Prefer a live listing so we can inspect its portal URL fields
    const sample = items.find(i => i?.portals?.propertyfinder?.isLive === true) || items[0] || null;
    const liveSample = items.find(i => i?.portals?.propertyfinder?.isLive === true);
    console.log('PF_DIAG_LIVE_SAMPLE_PORTALS:', JSON.stringify(liveSample?.portals));

    if (!sample) {
      return Response.json({ ok: false, error: 'No listings returned', raw_response: listData });
    }

    // Extract all URL-like and ID-like fields recursively
    function extractUrlAndIdFields(obj, prefix = '') {
      const results = {};
      for (const [k, v] of Object.entries(obj || {})) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v === null || v === undefined) continue;
        if (typeof v === 'string' && (
          k.toLowerCase().includes('url') || k.toLowerCase().includes('link') ||
          k.toLowerCase().includes('slug') || k.toLowerCase().includes('permalink') ||
          k.toLowerCase().includes('href') || k.toLowerCase().includes('path') ||
          v.startsWith('http') || /^\d{6,}$/.test(v)
        )) {
          results[key] = v;
        } else if (typeof v === 'number' && v > 100000) {
          results[key] = v;
        } else if (typeof v === 'string' && /^\d{5,}$/.test(v)) {
          results[key] = v;
        } else if (typeof v === 'object' && !Array.isArray(v)) {
          Object.assign(results, extractUrlAndIdFields(v, key));
        }
      }
      return results;
    }

    const urlAndIdFields = extractUrlAndIdFields(sample);

    console.log('PF_DIAG_SAMPLE_KEYS:', JSON.stringify(Object.keys(sample)));
    console.log('PF_DIAG_URL_ID_FIELDS:', JSON.stringify(urlAndIdFields));
    console.log('PF_DIAG_FULL_SAMPLE:', JSON.stringify(sample));

    // Also try fetching single listing for more detail
    let singleListing = null;
    try {
      const singleRes = await fetch(`${PF_BASE}/listings/${sample.id}`, {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' },
      });
      if (singleRes.ok) singleListing = await singleRes.json();
    } catch (_) {}

    console.log('PF_DIAG_PORTALS:', JSON.stringify(sample.portals));
    console.log('PF_DIAG_SINGLE_LISTING:', JSON.stringify(singleListing));

    return Response.json({
      ok: true,
      top_level_keys: Object.keys(sample),
      url_and_id_fields: urlAndIdFields,
      id_field: sample.id,
      reference_field: sample.reference,
      url_field: sample.url,
      web_url_field: sample.web_url,
      link_field: sample.link,
      links_field: sample.links,
      share_url: sample.share_url,
      public_url: sample.public_url,
      permalink: sample.permalink,
      details_url: sample.details_url,
      portals_field: sample.portals,
      state_field: sample.state,
      live_sample_found: !!liveSample,
      live_sample_reference: liveSample?.reference,
      live_sample_state: liveSample?.state,
      live_sample_portals: liveSample?.portals,
      // Show state values of first 10 listings
      all_states: items.slice(0, 10).map(i => ({ ref: i.reference, state: i.state })),
      single_listing_endpoint_response: singleListing,
      full_sample: sample,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});