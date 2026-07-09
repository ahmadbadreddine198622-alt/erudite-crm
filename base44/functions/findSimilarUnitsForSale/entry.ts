import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// findSimilarUnitsForSale
// Searches Property Finder (and Bayut as a secondary source) for units currently
// FOR SALE in the same project as a landlord's unit. Uses web-search-enabled LLM
// to pull live listing data: price, beds, area, floor, agent, source link, image.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const landlordId = body.landlord_id;
    if (!landlordId) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const landlord = await base44.asServiceRole.entities.Landlord.get(landlordId);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    const project = landlord.project_name || '';
    const layout = landlord.unit_layout || '';
    const asking = landlord.asking_price_aed || null;

    if (!project) return Response.json({ error: 'Landlord has no project_name set — cannot find similar units' }, { status: 400 });

    const prompt = `You are a Dubai real-estate market researcher. Search Property Finder (propertyfinder.ae) and Bayut (bayut.com) for units currently listed FOR SALE in this specific project/building. Return every active listing you can find.

Project / building: ${project}
Unit layout of the reference unit: ${layout || 'unknown'}
Reference asking price: ${asking ? 'AED ' + Number(asking).toLocaleString() : 'unknown'}

For EACH listing found, provide:
- title (listing headline)
- price_aed (asking price in AED, number)
- bedrooms (number, 0 for studio)
- bathrooms (number)
- area_sqft (built-up area in sqft, number)
- floor (floor number if known)
- agent_name (listing agent / agency)
- source_url (direct link to the listing)
- image_url (primary photo URL if available)
- listed_days_ago (approx days since listed, number or null)
- portal ("Property Finder" or "Bayut")

Only return real, currently-active for-sale listings in THIS project. Do not invent data. If none found, return an empty array with a short note.`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          listings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                price_aed: { type: 'number' },
                bedrooms: { type: 'number' },
                bathrooms: { type: 'number' },
                area_sqft: { type: 'number' },
                floor: { type: 'string' },
                agent_name: { type: 'string' },
                source_url: { type: 'string' },
                image_url: { type: 'string' },
                listed_days_ago: { type: ['number', 'null'] },
                portal: { type: 'string' },
              },
            },
          },
          research_note: { type: 'string' },
        },
      },
    });

    const data = res?.listings != null ? res : (res?.data ?? res);
    const listings = Array.isArray(data?.listings) ? data.listings : [];
    const note = data?.research_note || '';

    return Response.json({ ok: true, project, layout, asking, listings, research_note: note, searched_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});