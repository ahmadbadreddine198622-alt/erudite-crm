import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Portfolio Radar — scans our internal database for properties this landlord may own.
 * Matching strategy:
 *   1. Phone match (high confidence) — checks Property.landlord_phone / owner_phone
 *      against all landlord phones (primary + additional_phones array), normalized
 *   2. Name match (medium confidence) — case-insensitive partial match on landlord_name / owner_name
 *
 * DLD external API: stub — returns [] until a real DLD/Reidin/PropertyMonitor key is configured.
 *
 * Body: { landlord_id }
 * Returns: { portfolio, opportunity_score, total_estimated_value_aed, pitch, scanned_at }
 */

function stripNonDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

// Normalize UAE phone to 9-digit local form (drop country code) for comparison
function normPhone(raw) {
  const digits = stripNonDigits(raw);
  if (!digits) return '';
  // 971XXXXXXXXX → last 9 digits
  if (digits.startsWith('971') && digits.length >= 11) return digits.slice(3);
  // 00971XXXXXXXXX
  if (digits.startsWith('00971') && digits.length >= 13) return digits.slice(5);
  // 05XXXXXXXX → 5XXXXXXXX
  if (digits.startsWith('0') && digits.length === 10) return digits.slice(1);
  return digits;
}

function phonesMatch(a, b) {
  const na = normPhone(a);
  const nb = normPhone(b);
  return na.length >= 8 && nb.length >= 8 && na === nb;
}

function namesMatch(landlordName, propName) {
  if (!landlordName || !propName) return false;
  const a = landlordName.toLowerCase().trim();
  const b = propName.toLowerCase().trim();
  // Partial match: one contains the other or 3+ word overlap
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = a.split(/\s+/).filter(w => w.length > 2);
  const bWords = b.split(/\s+/).filter(w => w.length > 2);
  const overlap = aWords.filter(w => bWords.includes(w));
  return overlap.length >= 2;
}

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { landlord_id } = body;
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Load landlord
    const landlords = await svc.entities.Landlord.filter({ id: landlord_id });
    const landlord = landlords?.[0];
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // All landlord phones (normalized)
    const rawPhones = [landlord.phone, landlord.whatsapp, ...(landlord.additional_phones || [])].filter(Boolean);
    const landlordPhones = [...new Set(rawPhones.map(normPhone).filter(p => p.length >= 8))];
    const landlordName = landlord.full_name_en || landlord.full_name || '';

    // Already-linked properties
    const linkedProps = await svc.entities.LandlordProperty.filter({ landlord_id }).catch(() => []);
    const linkedPropertyIds = new Set(linkedProps.map(l => l.property_id).filter(Boolean));

    // Scan Property entity
    let allProperties = [];
    try {
      allProperties = await svc.entities.Property.list('-created_date', 2000);
    } catch (_) {
      allProperties = [];
    }

    const portfolio = [];

    for (const prop of allProperties) {
      if (linkedPropertyIds.has(prop.id)) continue; // already linked

      // Check phone fields
      const propPhones = [
        prop.landlord_phone,
        prop.owner_phone,
        prop.contact_phone,
        prop.phone,
      ].filter(Boolean);

      let confidence = null;
      let matchReason = '';

      for (const pp of propPhones) {
        if (landlordPhones.some(lp => phonesMatch(lp, pp))) {
          confidence = 'high';
          matchReason = 'phone';
          break;
        }
      }

      if (!confidence) {
        const propOwnerName = prop.landlord_name || prop.owner_name || prop.contact_name || '';
        if (propOwnerName && namesMatch(landlordName, propOwnerName)) {
          confidence = 'medium';
          matchReason = 'name';
        }
      }

      if (!confidence) continue;

      portfolio.push({
        property_id: prop.id,
        source: 'internal_crm',
        match_confidence: confidence,
        match_reason: matchReason,
        title: prop.title || null,
        community: prop.community || prop.location || prop.area || null,
        type: prop.type || prop.property_type || null,
        bedrooms: prop.bedrooms || null,
        size_sqft: prop.size_sqft || prop.size || null,
        estimated_value_aed: prop.price_aed || prop.price || prop.asking_price || null,
        listing_status: prop.status || null,
      });
    }

    // Sort by confidence (high first)
    portfolio.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.match_confidence] ?? 2) - (order[b.match_confidence] ?? 2);
    });

    const totalEstValue = portfolio.reduce((s, p) => s + (p.estimated_value_aed || 0), 0);
    const opportunityScore = Math.min(100, portfolio.length * 18 + (totalEstValue >= 5_000_000 ? 10 : 0));

    // Generate pitch if matches found
    let pitch = '';
    if (portfolio.length > 0) {
      try {
        const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
        if (apiKey) {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 300,
              system: 'You are a luxury real estate agent in Dubai. Write a 2-sentence portfolio pitch (English) proposing a preferential commission for a multi-property mandate. Be warm, professional, concise.',
              messages: [{
                role: 'user',
                content: `Landlord: ${landlordName}. Detected additional properties: ${portfolio.map(p => [p.bedrooms ? p.bedrooms + 'BR' : null, p.type, p.community].filter(Boolean).join(' ')).join(', ')}. Total est. value: AED ${fmt(totalEstValue)}.`
              }]
            }),
          });
          if (resp.ok) {
            const d = await resp.json();
            pitch = (d?.content || []).map(b => b?.text || '').join('').trim();
          }
        }
      } catch (_) { /* non-fatal */ }
    }

    const result = {
      ok: true,
      portfolio,
      opportunity_score: opportunityScore,
      total_estimated_value_aed: totalEstValue,
      pitch,
      scanned_at: new Date().toISOString(),
    };

    // Persist scan result on Landlord record so UI can load it without re-scanning
    await svc.entities.Landlord.update(landlord_id, {
      portfolio_scan_result: result,
      portfolio_scanned_at: result.scanned_at,
    }).catch(() => {});

    return Response.json(result);
  } catch (err) {
    console.error('scanPortfolio error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});