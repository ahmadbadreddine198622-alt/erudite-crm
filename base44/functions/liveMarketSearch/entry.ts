import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Area slug maps ───────────────────────────────────────────────────────────
const PF_AREA_SLUGS = {
  'downtown dubai': 'downtown-dubai',
  'dubai marina': 'dubai-marina',
  'palm jumeirah': 'palm-jumeirah',
  'business bay': 'business-bay',
  'jvc': 'jumeirah-village-circle',
  'jumeirah village circle': 'jumeirah-village-circle',
  'arabian ranches': 'arabian-ranches',
  'difc': 'difc',
  'dubai hills': 'dubai-hills-estate',
  'dubai hills estate': 'dubai-hills-estate',
  'jumeirah': 'jumeirah',
  'al barsha': 'al-barsha',
  'meydan': 'meydan',
  'dubai creek harbour': 'dubai-creek-harbour',
  'bluewaters': 'bluewaters-island',
  'emaar beachfront': 'emaar-beachfront',
  'mbr city': 'mohammed-bin-rashid-city',
  'jlt': 'jumeirah-lake-towers',
  'jumeirah lake towers': 'jumeirah-lake-towers',
  'motor city': 'motor-city',
  'sports city': 'dubai-sports-city',
  'silicon oasis': 'dubai-silicon-oasis',
  'international city': 'international-city',
  'discovery gardens': 'discovery-gardens',
  'the greens': 'the-greens',
  'the views': 'the-views',
  'jumeirah golf estates': 'jumeirah-golf-estates',
  'dubai south': 'dubai-south',
  'town square': 'town-square',
  'al furjan': 'al-furjan',
  'damac hills': 'damac-hills',
};

const BAYUT_AREA_SLUGS = {
  'downtown dubai': 'downtown-dubai',
  'dubai marina': 'dubai-marina',
  'palm jumeirah': 'palm-jumeirah',
  'business bay': 'business-bay',
  'jvc': 'jumeirah-village-circle-jvc',
  'jumeirah village circle': 'jumeirah-village-circle-jvc',
  'arabian ranches': 'arabian-ranches',
  'difc': 'difc',
  'dubai hills': 'dubai-hills-estate',
  'dubai hills estate': 'dubai-hills-estate',
  'jumeirah': 'jumeirah',
  'al barsha': 'al-barsha',
  'meydan': 'meydan',
  'dubai creek harbour': 'dubai-creek-harbour',
  'bluewaters': 'bluewaters-island',
  'emaar beachfront': 'emaar-beachfront',
  'mbr city': 'mohammed-bin-rashid-city',
  'jlt': 'jlt-jumeirah-lake-towers',
  'jumeirah lake towers': 'jlt-jumeirah-lake-towers',
  'motor city': 'motor-city',
  'sports city': 'dubai-sports-city',
  'silicon oasis': 'dubai-silicon-oasis',
  'international city': 'international-city',
  'al furjan': 'al-furjan',
  'damac hills': 'damac-hills',
  'town square': 'town-square',
};

const PF_TYPE_MAP = {
  apartment: 'apartments',
  villa: 'villas',
  townhouse: 'townhouses',
  penthouse: 'penthouses',
  studio: 'apartments', // studio is filtered via beds=0
  office: 'offices',
  retail: 'shops',
  warehouse: 'warehouses',
};

const BAYUT_TYPE_MAP = {
  apartment: 'apartments',
  villa: 'villas',
  townhouse: 'townhouses',
  penthouse: 'penthouses',
  studio: 'apartments',
  office: 'offices',
  retail: 'shops',
  warehouse: 'warehouses',
};

// ─── Property Finder URL builder ─────────────────────────────────────────────
function buildPFUrl(brief) {
  const action = brief.transaction === 'lease' ? 'rent' : 'buy';
  const typeSlug = PF_TYPE_MAP[brief.property_type] || 'properties';
  const areaKey = (brief.location || '').toLowerCase().trim();
  const areaSlug = PF_AREA_SLUGS[areaKey] || areaKey.replace(/\s+/g, '-').toLowerCase();
  const emirate = 'dubai'; // default

  const bedLabel = !brief.bedrooms ? '' :
    brief.bedrooms === 0 ? 'studio-' : `${brief.bedrooms}-bedroom-`;

  // Path: /en/buy/dubai/2-bedroom-apartments-for-sale.html
  const actionWord = action === 'buy' ? 'sale' : 'rent';
  let path = `/en/${action}/${emirate}/`;
  if (areaSlug) path += `${areaSlug}/`;
  path += `${bedLabel}${typeSlug}-for-${actionWord}.html`;

  const params = new URLSearchParams();
  if (brief.budget_min) params.set('price_min', brief.budget_min);
  if (brief.budget_max) params.set('price_max', brief.budget_max);
  if (brief.size_min) params.set('size_min', brief.size_min);
  if (brief.size_max) params.set('size_max', brief.size_max);
  if (brief.property_type === 'studio') params.set('beds', '0');
  if (brief.furnished) params.set('furnishing_status', 'furnished');
  if (brief.ready_only) params.set('completion_status', 'completed');

  const qs = params.toString();
  const url = `https://www.propertyfinder.ae${path}${qs ? '?' + qs : ''}`;
  return url;
}

// ─── Bayut URL builder ────────────────────────────────────────────────────────
function buildBayutUrl(brief) {
  const action = brief.transaction === 'lease' ? 'to-rent' : 'for-sale';
  const typeSlug = BAYUT_TYPE_MAP[brief.property_type] || 'properties';
  const areaKey = (brief.location || '').toLowerCase().trim();
  const areaSlug = BAYUT_AREA_SLUGS[areaKey] || areaKey.replace(/\s+/g, '-').toLowerCase();

  const bedLabel = !brief.bedrooms ? '' :
    brief.bedrooms === 0 ? 'studio-' : `${brief.bedrooms}-bedroom-`;

  // Path: /dubai/apartments-for-sale/2-bedroom/in-dubai-marina/
  let path = `/dubai/${typeSlug}-${action}/`;
  if (brief.bedrooms !== undefined && brief.bedrooms !== '') {
    path += brief.bedrooms === 0 ? 'studio/' : `${brief.bedrooms}-bedroom/`;
  }
  if (areaSlug) path += `in-${areaSlug}/`;

  const params = new URLSearchParams();
  if (brief.budget_min) params.set('price_min', brief.budget_min);
  if (brief.budget_max) params.set('price_max', brief.budget_max);
  if (brief.size_min) params.set('min_area', brief.size_min);
  if (brief.size_max) params.set('max_area', brief.size_max);
  if (brief.furnished) params.set('furnishing_status', 'Furnished');
  if (brief.ready_only) params.set('completion_status', 'completed');

  const qs = params.toString();
  const url = `https://www.bayut.com${path}${qs ? '?' + qs : ''}`;
  return url;
}

// ─── Fit confidence scorer ────────────────────────────────────────────────────
function scoreFitConfidence(brief, areaMatched) {
  let score = 0;
  const reasons = [];
  const gaps = [];

  if (brief.location) {
    if (areaMatched) { score += 35; reasons.push('Area mapped exactly'); }
    else { score += 15; reasons.push('Area used as-is (verify on site)'); gaps.push('Area slug not pre-mapped — results may be broader'); }
  } else {
    gaps.push('No area specified — city-wide results');
  }

  if (brief.bedrooms !== undefined && brief.bedrooms !== '') { score += 25; reasons.push(`${brief.bedrooms === 0 ? 'Studio' : brief.bedrooms + ' BR'} filter applied`); }
  else gaps.push('Bedrooms not specified');

  if (brief.budget_max) { score += 20; reasons.push(`Budget max AED ${Number(brief.budget_max).toLocaleString()} applied`); }
  else gaps.push('No budget cap set');

  if (brief.budget_min) { score += 5; reasons.push('Budget floor applied'); }
  if (brief.property_type) { score += 10; reasons.push(`Type: ${brief.property_type}`); }
  if (brief.ready_only) { score += 5; reasons.push('Ready only filter on'); }
  if (brief.furnished) { score += 5; reasons.push('Furnished filter on'); }

  const label = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Partial';
  return { score, label, reasons, gaps };
}

// ─── Internal property scoring ────────────────────────────────────────────────
function scoreInternalProperties(properties, brief) {
  return properties
    .map(p => {
      let score = 0;
      const price = p.price_aed || p.rent_aed || 0;
      if (brief.budget_max && price <= brief.budget_max) score += 40;
      else if (brief.budget_max && price <= brief.budget_max * 1.1) score += 20;
      if (brief.bedrooms !== undefined && brief.bedrooms !== '' && p.bedrooms === parseInt(brief.bedrooms)) score += 30;
      else if (brief.bedrooms !== undefined && brief.bedrooms !== '' && Math.abs((p.bedrooms || 0) - parseInt(brief.bedrooms)) === 1) score += 15;
      const loc = (p.location || '').toLowerCase();
      const briefLoc = (brief.location || '').toLowerCase();
      if (briefLoc && loc.includes(briefLoc)) score += 20;
      if (brief.property_type && (p.property_type || '').toLowerCase() === brief.property_type) score += 10;
      return { ...p, _score: score };
    })
    .filter(p => p._score >= 40)
    .sort((a, b) => b._score - a._score);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { brief, client_id } = body;
    if (!brief) return Response.json({ error: 'brief is required' }, { status: 400 });

    // 1. Internal match first
    let internalMatches = [];
    try {
      const internalProps = await base44.asServiceRole.entities.Property.list();
      internalMatches = scoreInternalProperties(internalProps, brief);
    } catch (_) { /* no properties yet */ }

    if (internalMatches.length >= 2) {
      return Response.json({
        source: 'internal',
        matches: internalMatches.slice(0, 8),
        total: internalMatches.length,
        searched_at: new Date().toISOString(),
      });
    }

    // 2. Build deep links
    const areaKey = (brief.location || '').toLowerCase().trim();
    const pfAreaMatched = !!PF_AREA_SLUGS[areaKey];
    const bayutAreaMatched = !!BAYUT_AREA_SLUGS[areaKey];

    const pfUrl = buildPFUrl(brief);
    const bayutUrl = buildBayutUrl(brief);

    const pfConfidence = scoreFitConfidence(brief, pfAreaMatched);
    const bayutConfidence = scoreFitConfidence(brief, bayutAreaMatched);

    // Build plain-language brief summary
    const briefSummary = [
      brief.bedrooms === 0 ? 'Studio' : brief.bedrooms ? `${brief.bedrooms} BR` : null,
      brief.property_type ? brief.property_type.charAt(0).toUpperCase() + brief.property_type.slice(1) : null,
      brief.transaction === 'lease' ? 'for Rent' : 'for Sale',
      brief.location ? `in ${brief.location}` : 'in Dubai',
      (brief.budget_min || brief.budget_max) ? `AED ${brief.budget_min ? Number(brief.budget_min).toLocaleString() + '–' : ''}${brief.budget_max ? Number(brief.budget_max).toLocaleString() : ''}` : null,
      brief.ready_only ? '· Ready only' : null,
      brief.furnished ? '· Furnished' : null,
    ].filter(Boolean).join(' ');

    const portals = [
      {
        name: 'Property Finder',
        url: pfUrl,
        confidence: pfConfidence,
        logo_color: '#00D09C',
      },
      {
        name: 'Bayut',
        url: bayutUrl,
        confidence: bayutConfidence,
        logo_color: '#E74C3C',
      },
    ].sort((a, b) => b.confidence.score - a.confidence.score);

    // 3. Log against client record
    if (client_id) {
      await base44.asServiceRole.entities.Activity.create({
        lead_id: client_id,
        type: 'system',
        title: `Live market search: ${briefSummary}`,
        description: `Deep-link search generated.\nProperty Finder: ${pfUrl}\nBayut: ${bayutUrl}`,
        source: 'automation',
        agent_email: user.email,
        status: 'completed',
      });
    }

    return Response.json({
      source: 'live_market',
      brief_summary: briefSummary,
      portals,
      internal_count: internalMatches.length,
      searched_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});