import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    if (!leads.length) return Response.json({ error: 'Lead not found' }, { status: 404 });
    const lead = leads[0];

    // Fetch properties from Property Finder API
    const PF_API_KEY = Deno.env.get('PROPERTY_FINDER_API_KEY');
    const PF_API_SECRET = Deno.env.get('PROPERTY_FINDER_API_SECRET');
    
    if (!PF_API_KEY || !PF_API_SECRET) {
      return Response.json({ error: 'Property Finder credentials not configured' }, { status: 500 });
    }

    // Get auth token from Property Finder
    const authResponse = await fetch('https://dev-sandbox.propertyfinder.ae/api/v1/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: PF_API_KEY,
        api_secret: PF_API_SECRET,
      }),
    });

    if (!authResponse.ok) {
      throw new Error('Property Finder authentication failed');
    }

    const { access_token } = await authResponse.json();

    // Determine lead intent — buyer or tenant
    const searchType = lead.intent === 'tenant' ? 'rent' : 'buy';

    // Build search query based on lead criteria
    const queryParams = new URLSearchParams({
      search_type: searchType,
      per_page: '50',
    });

    if (lead.preferred_locations?.length > 0) {
      // Use first preferred location for search
      queryParams.append('location', lead.preferred_locations[0]);
    }

    if (lead.bedrooms_min) {
      queryParams.append('beds_min', lead.bedrooms_min.toString());
    }

    if (lead.bedrooms_max) {
      queryParams.append('beds_max', lead.bedrooms_max.toString());
    }

    if (lead.budget_min) {
      queryParams.append('price_min', lead.budget_min.toString());
    }

    if (lead.budget_max) {
      queryParams.append('price_max', lead.budget_max.toString());
    }

    // Fetch properties from Property Finder
    const pfResponse = await fetch(`https://dev-sandbox.propertyfinder.ae/api/v1/property/search?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!pfResponse.ok) {
      throw new Error('Property Finder search failed');
    }

    const pfData = await pfResponse.json();
    const properties = pfData.results || [];

    if (!properties.length) {
      return Response.json({ matches: [], total_checked: 0 });
    }

    // Lead criteria for scoring
    const budgetMin = lead.budget_min || 0;
    const budgetMax = lead.budget_max || Infinity;
    const bedsMin = lead.bedrooms_min;
    const bedsMax = lead.bedrooms_max;
    const prefLocations = (lead.preferred_locations || []).map(l => l.toLowerCase());
    const prefTypes = (lead.preferred_property_types || []);
    const sizeMin = lead.size_sqft_min;
    const sizeMax = lead.size_sqft_max;

    const scored = properties.map(p => {
      let score = 0;
      const matched = [];
      const missed = [];

      // Listing type match (hard filter reduces score heavily if wrong)
      if (p.search_type === searchType) {
        score += 20;
        matched.push(`Listed for ${searchType}`);
      } else {
        score -= 30;
        missed.push(`Listed for ${p.search_type}, lead wants ${searchType}`);
      }

      // Budget fit (30 pts)
      const price = p.price;
      if (price && (budgetMin || budgetMax !== Infinity)) {
        if (price >= budgetMin && price <= budgetMax) {
          score += 30;
          matched.push('Within budget');
        } else if (price < budgetMin * 0.85) {
          score += 10;
          missed.push('Below stated budget range');
        } else {
          const overPct = ((price - budgetMax) / budgetMax) * 100;
          if (overPct <= 10) { score += 15; missed.push('Slightly over budget (<10%)'); }
          else if (overPct <= 20) { score += 5; missed.push('Over budget (10–20%)'); }
          else { score -= 10; missed.push('Significantly over budget'); }
        }
      } else {
        score += 15; // No budget stated — neutral
      }

      // Location match (25 pts)
      if (prefLocations.length > 0) {
        const propLoc = (p.location || '').toLowerCase();
        const locHit = prefLocations.some(l => propLoc.includes(l) || l.includes(propLoc));
        if (locHit) { score += 25; matched.push('Preferred location'); }
        else { score -= 5; missed.push('Outside preferred locations'); }
      } else {
        score += 10;
      }

      // Bedroom match (15 pts)
      if (bedsMin !== undefined || bedsMax !== undefined) {
        const beds = p.bedrooms;
        const min = bedsMin ?? 0;
        const max = bedsMax ?? 99;
        if (beds >= min && beds <= max) { score += 15; matched.push(`${beds} bed matches criteria`); }
        else if (Math.abs(beds - (min + max) / 2) <= 1) { score += 7; missed.push('Close bedroom count'); }
        else { score -= 5; missed.push('Bedroom count mismatch'); }
      }

      // Property type (10 pts)
      if (prefTypes.length > 0) {
        if (prefTypes.includes(p.property_type)) { score += 10; matched.push(`Property type: ${p.property_type}`); }
        else { missed.push(`Type is ${p.property_type}, preferred: ${prefTypes.join(', ')}`); }
      }

      // Size fit (optional bonus)
      if ((sizeMin || sizeMax) && p.area) {
        const sz = p.area;
        const min = sizeMin || 0;
        const max = sizeMax || Infinity;
        if (sz >= min && sz <= max) { score += 5; matched.push('Size within range'); }
      }

      const probability = Math.max(5, Math.min(99, score));

      return {
        property: {
          id: p.id,
          title: p.title,
          property_type: p.property_type,
          listing_type: p.search_type,
          price_aed: p.price,
          location: p.location,
          building_name: p.building_name,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          area_sqft: p.area,
          furnishing: p.furnishing_status,
          images: p.images || [],
          amenities: p.amenities || [],
          developer: p.developer,
        },
        probability,
        matched_criteria: matched,
        missed_criteria: missed,
      };
    });

    // Sort by probability, return top 5
    const top = scored
      .filter(s => s.probability > 20)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    // Persist recommended IDs on lead
    await base44.asServiceRole.entities.Lead.update(lead_id, {
      ai_recommended_property_ids: top.map(t => t.property.id),
    });

    return Response.json({ matches: top, total_checked: properties.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});