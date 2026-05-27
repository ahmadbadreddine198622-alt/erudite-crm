import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * Portfolio Radar — for a landlord, scans public DLD records (and our own
 * Property database) to find every OTHER property they own. Surfaces a
 * "Portfolio Opportunity" card: turn a one-mandate client into a 5-mandate client.
 *
 * Body: { landlord_id }
 * Returns: { portfolio: [{ property_id, source, ...details }], opportunity_score, pitch }
 */

async function searchDLDByOwner(name: string, emiratesId: string | null) {
  // PLACEHOLDER: Real DLD owner-lookup API requires a brokerage agreement with DLD.
  // For now we return empty. Production: integrate with https://www.dubailand.gov.ae APIs.
  // Some 3rd-party services aggregate DLD data:
  //   - Reidin (https://www.reidin.com)
  //   - PropertyMonitor
  //   - DataGuru
  // Replace this stub with one of those once API keys are configured.
  return [];
}

async function searchInternalProperty(base44: any, landlordName: string) {
  // Search our own Property entity for any record where landlord_name matches
  try {
    const matches = await base44.asServiceRole.entities.Property.filter({
      landlord_name: landlordName
    });
    return matches || [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // Already-known properties (linked to this landlord in our system)
    const knownLinks = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id });
    const knownPropertyIds = new Set(knownLinks.map((l: any) => l.property_id).filter(Boolean));

    // Scan internal first
    const internalMatches = await searchInternalProperty(base44, landlord.full_name_en || landlord.full_name);
    const newInternal = internalMatches.filter((p: any) => !knownPropertyIds.has(p.id));

    // Scan DLD (stub for now)
    const dldMatches = await searchDLDByOwner(landlord.full_name_en || landlord.full_name, null);

    const portfolio = [
      ...newInternal.map((p: any) => ({
        property_id: p.id,
        source: 'internal_crm',
        title: p.title,
        community: p.community,
        type: p.type,
        bedrooms: p.bedrooms,
        size_sqft: p.size_sqft,
        estimated_value_aed: p.price,
        listing_status: p.status
      })),
      ...dldMatches.map((d: any) => ({
        property_id: null,
        source: 'dld',
        title: d.title,
        community: d.community,
        type: d.type,
        bedrooms: d.bedrooms,
        size_sqft: d.size_sqft,
        estimated_value_aed: d.estimated_value
      }))
    ];

    // Score the opportunity
    const totalEstValue = portfolio.reduce((sum, p) => sum + (p.estimated_value_aed || 0), 0);
    const opportunityScore = Math.min(100, Math.floor(portfolio.length * 15 + (totalEstValue / 10_000_000) * 10));

    // Generate a pitch
    let pitch = '';
    if (portfolio.length > 0) {
      try {
        const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
        const aiResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 512,
          system: 'You are AURORA — generate a short (2-3 sentences) portfolio pitch the agent can use with the landlord. Mention the specific properties and propose a preferential commission for a portfolio mandate. Respond in the landlord\'s language. Just the pitch text, no preamble.',
          messages: [{ role: 'user', content: `Landlord: ${landlord.full_name_en || landlord.full_name}, archetype: ${landlord.landlord_archetype}, language: ${landlord.preferred_language || 'en'}
Properties detected: ${portfolio.map((p: any) => `${p.bedrooms}BR ${p.type} in ${p.community} (~${p.estimated_value_aed} AED)`).join(', ')}
Total portfolio value: ${totalEstValue} AED` }]
        });
        pitch = aiResponse.content[0].text.trim();
      } catch (err) {
        console.warn('pitch generation failed', err);
      }
    }

    return Response.json({
      ok: true,
      portfolio,
      opportunity_score: opportunityScore,
      total_estimated_value_aed: totalEstValue,
      pitch,
      detected_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('scanPortfolio error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
