import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// gatherLandlordPortfolioOnline
// Uses web-search-enabled LLM to find a landlord's Dubai property ownership /
// purchase history from public sources (Property Finder agent listings, DLD
// transaction mentions, news). Returns a structured list of discovered properties.
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

    const name = landlord.full_name_en || landlord.full_name || [landlord.first_name, landlord.last_name].filter(Boolean).join(' ');
    const phone = landlord.phone || '';
    const email = landlord.email || '';
    const nationality = landlord.nationality || '';
    const project = landlord.project_name || '';

    if (!name) return Response.json({ error: 'Landlord name is required to search online' }, { status: 400 });

    const prompt = `You are a Dubai real-estate research assistant. Search the public web (Property Finder, Bayut, DLD Dubai REST API transaction data, news articles, developer brochures) for properties owned by or listed by this person. Return every property you can find associated with them.

Subject:
- Name: ${name}
- Phone: ${phone || 'unknown'}
- Email: ${email || 'unknown'}
- Nationality: ${nationality || 'unknown'}
- Known project: ${project || 'unknown'}

For EACH property found, provide:
- building_name (building / tower name)
- project_name (master project / community)
- unit_no (unit number if known)
- floor (floor number if known)
- handover_year (year of handover / completion if known)
- estimated_value_aed (current estimated market value in AED, number)
- is_off_plan (true if off-plan / under construction)
- vacant (true if currently vacant, false if tenanted, null if unknown)
- source_url (link to the listing / source)
- source_name (e.g. "Property Finder", "Bayut", "DLD")
- confidence (high / medium / low)
- notes (any extra context)

Only return properties you actually found evidence of — do not invent data. If nothing is found, return an empty array with a short note.`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          properties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                building_name: { type: 'string' },
                project_name: { type: 'string' },
                unit_no: { type: 'string' },
                floor: { type: 'string' },
                handover_year: { type: 'string' },
                estimated_value_aed: { type: 'number' },
                is_off_plan: { type: 'boolean' },
                vacant: { type: ['boolean', 'null'] },
                source_url: { type: 'string' },
                source_name: { type: 'string' },
                confidence: { type: 'string' },
                notes: { type: 'string' },
              },
            },
          },
          research_note: { type: 'string' },
        },
      },
    });

    const data = res?.properties != null ? res : (res?.data ?? res);
    const properties = Array.isArray(data?.properties) ? data.properties : [];
    const researchNote = data?.research_note || '';

    return Response.json({ ok: true, landlord_name: name, properties, research_note: researchNote, gathered_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});