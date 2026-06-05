import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

    // ── Gather real unit data ────────────────────────────────────────────────
    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    const landlordProperties = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id });
    const lp = landlordProperties[0] || null;

    // Fetch linked Property record if present
    let property = null;
    if (lp?.property_id) {
      property = await base44.asServiceRole.entities.Property.get(lp.property_id).catch(() => null);
    }

    // Build unit data object from real fields
    const unitData = {
      // From Landlord entity
      project_name: landlord.project_name || null,
      unit_reference: landlord.unit_reference || null,
      asking_price_aed: landlord.asking_price_aed || null,
      lead_type: landlord.lead_type || null,

      // From Property entity (if linked)
      property_type: property?.property_type || null,
      bedrooms: property?.bedrooms || null,
      bathrooms: property?.bathrooms || null,
      area_sqft: property?.area_sqft || null,
      location: property?.location || null,
      building_name: property?.building_name || null,
      furnishing: property?.furnishing || null,
      amenities: property?.amenities || [],
      view: property?.view || null,
      unit_no: property?.unit_no || null,

      // From LandlordProperty entity
      title_deed_number: lp?.title_deed_number || null,
      mortgage_status: lp?.mortgage_status || null,
      tenancy_status: lp?.tenancy_status || null,
      has_360_tour: lp?.has_360_tour || false,
      has_drone_footage: lp?.has_drone_footage || false,
      has_video_walkthrough: lp?.has_video_walkthrough || false,
      has_floor_plan: lp?.has_floor_plan || false,
    };

    // ── Build prompt ─────────────────────────────────────────────────────────
    const unitSummary = Object.entries(unitData)
      .filter(([, v]) => v !== null && v !== false && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');

    const prompt = `You are a premium Dubai real estate copywriter. Generate exactly 3 listing options for this property unit.

UNIT DATA:
${unitSummary}

REQUIREMENTS:
- Option 1 angle: luxury/lifestyle — emphasise prestige, design, lifestyle, exclusivity
- Option 2 angle: investment/ROI — emphasise yield potential, capital appreciation, market position, rental income
- Option 3 angle: family/practical — emphasise space, community, schools, comfort, practicality
- Each title: max 12 words, compelling, specific to the unit
- Each description: 60–100 words, professional Dubai real estate tone, use the real data provided (mention sqft, bedrooms, project, price where helpful)
- The 3 options must be clearly distinct — different vocabulary, different emphasis, not rephrasings
- Use actual figures from the data; do not invent specs not listed above

Return STRICT JSON only, no markdown, no explanation:
{"options":[{"angle":"luxury","title":"...","description":"..."},{"angle":"investment","title":"...","description":"..."},{"angle":"family","title":"...","description":"..."}]}`;

    // ── Call Claude ──────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();

    // Safe JSON parse — strip any accidental markdown fences
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      return Response.json({
        error: 'Claude returned invalid JSON',
        raw,
        parse_error: parseErr.message,
      }, { status: 502 });
    }

    if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length !== 3) {
      return Response.json({ error: 'Unexpected response shape from Claude', raw }, { status: 502 });
    }

    return Response.json({
      options: parsed.options,
      landlord_property_id: lp?.id || null,
      unit_data_used: unitData,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});