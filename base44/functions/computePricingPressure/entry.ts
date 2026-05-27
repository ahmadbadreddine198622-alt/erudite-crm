import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Pricing Pressure Meter — for a landlord's property, computes:
 *   - CMA value (Comparative Market Analysis) using AI + comparable sales
 *   - Asking price gap (% above/below CMA)
 *   - Pressure color: green/yellow/orange/red
 *   - Predicted days-on-market at current price
 *   - 3 negotiation scripts (gentle, data-driven, hard)
 *
 * Body: { landlord_id, property_id? }
 * Writes back to MandateNegotiation entity.
 */

async function getComps(base44: any, property: any) {
  // Find closed transactions in same community/building, similar size + BR, sold in last 180 days
  try {
    const all = await base44.asServiceRole.entities.Property.filter({
      community: property?.community,
      bedrooms: property?.bedrooms,
      status: 'sold'
    }, '-sold_date', 50);
    return all.filter((p: any) => {
      const soldRecent = p.sold_date && (Date.now() - new Date(p.sold_date).getTime()) < 180 * 86400000;
      const sizeMatch = !property?.size_sqft || !p.size_sqft ||
        Math.abs(p.size_sqft - property.size_sqft) / property.size_sqft < 0.25;
      return soldRecent && sizeMatch;
    }).slice(0, 10);
  } catch {
    return [];
  }
}

function pressureColor(gapPct: number): string {
  if (gapPct <= 5) return 'green';
  if (gapPct <= 10) return 'yellow';
  if (gapPct <= 20) return 'orange';
  return 'red';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, property_id } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    const negotiationList = await base44.asServiceRole.entities.MandateNegotiation.filter({ landlord_id });
    const negotiation = negotiationList?.[0];

    let property = null;
    if (property_id) {
      try { property = await base44.asServiceRole.entities.Property.get(property_id); } catch {}
    } else {
      const lpList = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id });
      if (lpList?.[0]?.property_id) {
        try { property = await base44.asServiceRole.entities.Property.get(lpList[0].property_id); } catch {}
      }
    }

    const askingPrice = negotiation?.asking_price_current || property?.price || 0;
    if (!askingPrice) {
      return Response.json({ error: 'No asking price set' }, { status: 400 });
    }

    const comps = await getComps(base44, property);
    const compsText = comps.map((c: any, i: number) =>
      `${i+1}. ${c.community} ${c.bedrooms}BR ${c.size_sqft}sqft sold ${c.sold_date} for ${c.sold_price || c.price} AED`
    ).join('\n') || '(no comparable sales in last 180 days)';

    const systemPrompt = `You are AURORA PRICING ANALYST.

Given a property's asking price and comparable sales, produce:
1. cma_value_aed (your best estimate of fair market value)
2. cma_evidence (which comps justify it — reference them by index)
3. pricing_gap_pct ((asking - cma) / cma * 100, can be negative)
4. predicted_days_on_market at current price (calibrated honestly — 30 days is typical, 60+ if mispriced)
5. recommended_price (what they should list at for fastest sale at fair margin)
6. negotiation_scripts: array of 3 — { tone: "gentle"|"data_driven"|"hard", script: "what to say" }

Rules:
- Be honest. Don't tell the agent what they want to hear.
- If comps are thin, lower confidence and note it.
- Scripts must be specific to this property + this landlord archetype, not generic.
- STRICT JSON.`;

    const userPrompt = `LANDLORD: ${landlord.full_name_en || landlord.full_name}
Archetype: ${landlord.landlord_archetype}
Price sensitivity inferred: ${landlord.landlord_archetype === 'distressed_seller' ? 'HIGH (motivated)' : landlord.landlord_archetype === 'professional_investor' ? 'MEDIUM (data-driven)' : 'MEDIUM'}

PROPERTY:
${property ? `Community: ${property.community}, Type: ${property.type}, BR: ${property.bedrooms}, Size: ${property.size_sqft} sqft` : 'No property details'}

ASKING PRICE: ${askingPrice} AED
DAYS ON MARKET: ${property?.days_on_market || landlord.days_on_market || 0}

COMPARABLES (last 180 days, same community/BR):
${compsText}

Compute and return pricing analysis JSON.`;

    const aiRes = await base44.functions.invoke('claudeAI', {
      action: 'generate',
      system: systemPrompt,
      prompt: userPrompt,
      model: 'claude-opus-4-7',
      response_format: {
        type: 'object',
        properties: {
          cma_value_aed: { type: 'number' },
          cma_evidence: { type: 'array', items: { type: 'string' } },
          pricing_gap_pct: { type: 'number' },
          predicted_days_on_market: { type: 'number' },
          recommended_price: { type: 'number' },
          confidence: { type: 'number' },
          negotiation_scripts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tone: { type: 'string' },
                script: { type: 'string' }
              }
            }
          }
        },
        required: ['cma_value_aed', 'pricing_gap_pct', 'recommended_price']
      }
    });

    const result = aiRes?.data || aiRes;
    if (!result) return Response.json({ error: 'AI call failed' }, { status: 500 });

    const color = pressureColor(result.pricing_gap_pct);

    // Map indices to actual comp records for cma_evidence
    const cmaEvidenceMapped = (result.cma_evidence || [])
      .map((ref: string) => {
        const idx = parseInt(ref.match(/\d+/)?.[0] || '0', 10) - 1;
        const comp = comps[idx];
        return comp ? {
          comp_property_id: comp.id,
          comp_address: `${comp.community} ${comp.building || ''} ${comp.unit || ''}`.trim(),
          sold_price_aed: comp.sold_price || comp.price,
          sold_date: comp.sold_date,
          size_sqft: comp.size_sqft,
          bedrooms: comp.bedrooms,
          similarity_pct: 85
        } : null;
      })
      .filter(Boolean);

    const negotiationUpdate = {
      cma_value_aed: result.cma_value_aed,
      cma_evidence: cmaEvidenceMapped,
      pricing_gap_pct: result.pricing_gap_pct,
      pricing_pressure: color,
      asking_price_current: askingPrice
    };

    if (negotiation) {
      await base44.asServiceRole.entities.MandateNegotiation.update(negotiation.id, negotiationUpdate);
    } else {
      await base44.asServiceRole.entities.MandateNegotiation.create({ landlord_id, ...negotiationUpdate });
    }

    return Response.json({
      ok: true,
      pressure_color: color,
      ...result
    });
  } catch (error: any) {
    console.error('computePricingPressure error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
