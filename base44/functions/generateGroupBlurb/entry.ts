import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

    // ── Fetch data ───────────────────────────────────────────────────────────
    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    const landlordProperties = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id });
    const lp = landlordProperties[0] || null;

    let property = null;
    if (lp?.property_id) {
      property = await base44.asServiceRole.entities.Property.get(lp.property_id).catch(() => null);
    }

    // ── Marketable fields ONLY — no owner name, no commission, no title deed ─
    // Fields from Landlord: project_name, asking_price_aed, lead_type
    // Fields from Property: property_type, bedrooms, area_sqft, location, building_name, furnishing, amenities, view
    // Fields from LandlordProperty: has_360_tour, has_floor_plan, has_drone_footage, has_video_walkthrough
    // EXCLUDED: landlord.full_name_en, landlord.phone, landlord.email, landlord.passport_no,
    //           lp.title_deed_number, lp.oqood_number, landlord.commission_pct_negotiated,
    //           any other owner-identifying data
    const marketableData = {
      project_name:         landlord.project_name || null,
      asking_price_aed:     landlord.asking_price_aed || null,
      listing_type:         landlord.lead_type === 'landlord_rent' ? 'rent' : 'sale',
      property_type:        property?.property_type || null,
      bedrooms:             property?.bedrooms ?? null,
      area_sqft:            property?.area_sqft || null,
      location:             property?.location || null,
      building_name:        property?.building_name || null,
      furnishing:           property?.furnishing || null,
      view:                 property?.view || null,
      amenities:            (property?.amenities || []).slice(0, 6), // cap at 6 highlights
      has_3d_tour:          lp?.has_360_tour || false,
      has_floor_plan:       lp?.has_floor_plan || false,
      has_drone_footage:    lp?.has_drone_footage || false,
      has_video_walkthrough: lp?.has_video_walkthrough || false,
    };

    // Build readable summary — only non-empty values
    const mediaBits = [
      marketableData.has_3d_tour && '3D tour',
      marketableData.has_floor_plan && 'floor plan',
      marketableData.has_drone_footage && 'drone footage',
      marketableData.has_video_walkthrough && 'video walkthrough',
    ].filter(Boolean);

    const unitSummary = [
      marketableData.project_name    && `Project: ${marketableData.project_name}`,
      marketableData.building_name   && `Building: ${marketableData.building_name}`,
      marketableData.location        && `Area: ${marketableData.location}`,
      marketableData.property_type   && `Type: ${marketableData.property_type}`,
      marketableData.bedrooms != null && `Bedrooms: ${marketableData.bedrooms === 0 ? 'Studio' : marketableData.bedrooms}`,
      marketableData.area_sqft       && `Size: ${marketableData.area_sqft} sqft`,
      marketableData.asking_price_aed && `Price: AED ${marketableData.asking_price_aed.toLocaleString()}`,
      marketableData.listing_type    && `Listing type: ${marketableData.listing_type}`,
      marketableData.furnishing      && `Furnishing: ${marketableData.furnishing}`,
      marketableData.view            && `View: ${marketableData.view}`,
      marketableData.amenities.length > 0 && `Highlights: ${marketableData.amenities.join(', ')}`,
      mediaBits.length > 0           && `Media available: ${mediaBits.join(', ')}`,
    ].filter(Boolean).join('\n');

    // ── Prompt ───────────────────────────────────────────────────────────────
    const prompt = `You are a Dubai real estate agent writing a short teaser for a WhatsApp broker group chat.

PROPERTY FACTS:
${unitSummary}

TASK:
Write ONE punchy, professional WhatsApp broker-group post. Rules:
- 4–7 lines max, with natural line breaks (\\n between lines)
- Open with a hook line (emoji optional, keep tasteful — max 2 emojis total)
- Include: project/building name, area, bedrooms/size, price, and listing type (for sale / for rent)
- If media is available (3D tour, floor plan, etc.) mention it in a closing line such as "3D tour & floor plan available — DM for details"
- Tone: confident, broker-to-broker, factual — not salesy fluff
- CRITICAL: Do NOT include any owner name, landlord contact, commission percentage, title deed number, or any confidential owner-identifying information
- Return STRICT JSON only, no markdown: {"blurb":"...the post text with \\n line breaks..."}`;

    // ── Call Claude ──────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();
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

    if (!parsed.blurb || typeof parsed.blurb !== 'string') {
      return Response.json({ error: 'Unexpected response shape from Claude', raw }, { status: 502 });
    }

    return Response.json({
      blurb: parsed.blurb,
      // Report which fields were fed in (for audit — confirms no sensitive data)
      fields_used: Object.keys(marketableData).filter(k => {
        const v = marketableData[k];
        return v !== null && v !== false && !(Array.isArray(v) && v.length === 0);
      }),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});