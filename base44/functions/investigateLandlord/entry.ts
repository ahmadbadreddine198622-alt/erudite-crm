import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * investigateLandlord — on-demand online identity research on a landlord.
 *
 * Uses Claude (claude-sonnet-4-6) WITH the web_search tool to research the
 * person behind a landlord record: profession, companies, LinkedIn, social
 * profiles, news mentions, and wealth signals. Only public information is used.
 * The result is stored in investigation_profile on the Landlord entity.
 *
 * Identity inputs gathered from the record:
 *   full_name_en, full_name_ar, nationality, residence_country,
 *   email + additional_emails (company domain extracted if not a free provider),
 *   project_name, unit info, landlord_archetype, and investigation_hint.
 *
 * Error handling: investigation_status is set to "failed" on any error, with
 * the error message stored in investigation_profile.summary. The status is
 * never left stuck on "in_progress".
 */

const MODEL = 'claude-sonnet-4-6';

const FREE_EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'live.com', 'msn.com', 'aol.com', 'proton.me', 'protonmail.com'];

function extractCompanyDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain || FREE_EMAIL_DOMAINS.includes(domain)) return null;
  return domain;
}

Deno.serve(async (req) => {
  let landlord_id = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    landlord_id = body?.landlord_id;
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const landlord = await svc.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // ── Mark as in_progress immediately ──
    await svc.entities.Landlord.update(landlord_id, {
      investigation_status: 'in_progress',
    });

    // ── Gather identity inputs ──
    const fullNameEn = landlord.full_name_en || '';
    const fullNameAr = landlord.full_name_ar || '';
    const nationality = landlord.nationality || '';
    const residenceCountry = landlord.residence_country || '';
    const archetype = landlord.landlord_archetype || '';
    const projectName = landlord.project_name || '';
    const unitReference = landlord.unit_reference || '';
    const hint = landlord.investigation_hint || '';

    // Collect all emails and extract any company domain
    const allEmails = [landlord.email, ...(Array.isArray(landlord.additional_emails) ? landlord.additional_emails : [])]
      .filter(e => e && typeof e === 'string' && e.includes('@'));
    const companyDomains = [...new Set(allEmails.map(extractCompanyDomain).filter(Boolean))];

    // Build the research prompt
    const nameVariants = [fullNameEn, fullNameAr].filter(n => n && n.trim());
    const searchContext = [
      `Person name (English): ${fullNameEn || '(not provided)'}`,
      fullNameAr ? `Person name (Arabic): ${fullNameAr}` : '',
      nationality ? `Nationality: ${nationality}` : '',
      residenceCountry ? `Residence country: ${residenceCountry}` : '',
      archetype ? `Likely archetype: ${archetype}` : '',
      projectName ? `Property project: ${projectName}` : '',
      unitReference ? `Unit reference: ${unitReference}` : '',
      companyDomains.length ? `Company email domain(s): ${companyDomains.join(', ')}` : '',
      allEmails.length ? `Email addresses: ${allEmails.join(', ')}` : '',
      hint ? `Agent hint (company name / profession / context to focus on): ${hint}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are a professional due-diligence researcher for a Dubai real estate agency. You investigate the identity and background of property owners (landlords) using ONLY publicly available information. Your research helps agents understand who they are about to contact — their profession, business interests, and potential talking points — so the first contact is informed and respectful.

CRITICAL RULES:
1. Use ONLY public information (LinkedIn, company websites, news articles, public registries, social media profiles that are publicly visible).
2. NEVER invent or fabricate details. If you cannot find something, omit it or state the uncertainty.
3. Be honest about ambiguity — if multiple people share the name and you cannot establish identity with reasonable confidence, set confidence to "low" and explain why in confidence_reason.
4. Focus on the Dubai/UAE real estate context: search the person's name with "Dubai", "UAE", "real estate", "property" qualifiers when relevant.
5. If a company email domain is provided, search for the company and the person's role there.
6. Search both English and Arabic name spellings if both are provided.
7. Include source URLs for EVERY claim you make. Claims without sources should not be included.
8. talking_points should be 3-4 specific conversation hooks the agent can use to build rapport (e.g. "Mention their recent expansion to Abu Dhabi" or "Ask about their experience with the X project").
9. wealth_signals should be specific, factual indicators (e.g. "Owns multiple properties in Dubai Marina", "CEO of a company with AED 50M+ revenue") — never speculative.

You have the web_search tool available. Use it to search for the person, their company, LinkedIn profile, news articles, and social media. Conduct multiple searches as needed to build a complete picture.

After your research, respond with ONLY a JSON object (no markdown fences, no preamble, no commentary) matching this exact structure:
{
  "summary": "3-5 sentence plain-English description of who this person is",
  "occupation": "Their profession or role",
  "companies": ["Company names they are associated with"],
  "linkedin_url": "Their LinkedIn profile URL if found, or empty string",
  "social_links": [{"platform": "Twitter/Instagram/etc", "url": "https://..."}],
  "articles": [{"title": "Article title", "url": "https://...", "note": "Brief note on why this is relevant"}],
  "wealth_signals": ["Specific factual indicators of wealth or property portfolio"],
  "talking_points": ["3-4 specific conversation hooks for the agent"],
  "confidence": "high|medium|low",
  "confidence_reason": "Why this confidence level — explain what was found or what is missing",
  "sources": ["All URLs consulted"]
}`;

    const userPrompt = `Research this landlord's identity and background using public information:

${searchContext}

Context: This person is a property owner (landlord) in Dubai who is being contacted about listing their property for sale or rent. The agent needs to understand who they are before making contact.

Conduct web searches to find:
1. Their profession and current role
2. Companies they are associated with (especially if a company email domain is provided)
3. Their LinkedIn profile URL and other public social profiles
4. News articles or business mentions
5. Wealth or investor signals (property portfolio, business scale, etc.)
6. Talking points the agent can use to build rapport

Remember: respond with ONLY the JSON object, no markdown fences, no preamble.`;

    // ── Call Claude with web_search tool ──
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });

    // ── Extract the final text block from the response ──
    const textBlocks = response.content.filter(b => b.type === 'text');
    const rawText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : '';

    if (!rawText || !rawText.trim()) {
      throw new Error('Claude returned no text content');
    }

    // ── Parse JSON (defensively strip ```json fences) ──
    let profile;
    let jsonStr = rawText.trim();

    // Strip markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Find the first { and last } to extract just the JSON object
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    profile = JSON.parse(jsonStr);

    // ── Validate and normalize the profile ──
    const investigation_profile = {
      summary: typeof profile.summary === 'string' ? profile.summary : '',
      occupation: typeof profile.occupation === 'string' ? profile.occupation : '',
      companies: Array.isArray(profile.companies) ? profile.companies.filter(c => typeof c === 'string') : [],
      linkedin_url: typeof profile.linkedin_url === 'string' ? profile.linkedin_url : '',
      social_links: Array.isArray(profile.social_links)
        ? profile.social_links.filter(s => s && typeof s === 'object' && typeof s.url === 'string').map(s => ({ platform: typeof s.platform === 'string' ? s.platform : '', url: s.url }))
        : [],
      articles: Array.isArray(profile.articles)
        ? profile.articles.filter(a => a && typeof a === 'object').map(a => ({ title: typeof a.title === 'string' ? a.title : '', url: typeof a.url === 'string' ? a.url : '', note: typeof a.note === 'string' ? a.note : '' }))
        : [],
      wealth_signals: Array.isArray(profile.wealth_signals) ? profile.wealth_signals.filter(w => typeof w === 'string') : [],
      talking_points: Array.isArray(profile.talking_points) ? profile.talking_points.filter(t => typeof t === 'string') : [],
      confidence: ['high', 'medium', 'low'].includes(profile.confidence) ? profile.confidence : 'low',
      confidence_reason: typeof profile.confidence_reason === 'string' ? profile.confidence_reason : '',
      sources: Array.isArray(profile.sources) ? profile.sources.filter(s => typeof s === 'string') : [],
    };

    // ── Save to the landlord record ──
    await svc.entities.Landlord.update(landlord_id, {
      investigation_profile,
      investigation_status: 'completed',
      investigated_at: new Date().toISOString(),
      investigation_match_status: 'unconfirmed',
    });

    return Response.json({ ok: true, investigation_profile, investigated_at: new Date().toISOString() });
  } catch (error) {
    console.error('investigateLandlord error:', error);

    // ── On any error: set status to "failed", store error in summary ──
    try {
      if (landlord_id) {
        const base44 = createClientFromRequest(req);
        const svc = base44.asServiceRole;
        await svc.entities.Landlord.update(landlord_id, {
          investigation_status: 'failed',
          investigation_profile: { summary: `Investigation failed: ${error?.message || 'unknown error'}`, confidence: 'low', confidence_reason: 'The research call encountered an error.', companies: [], social_links: [], articles: [], wealth_signals: [], talking_points: [], sources: [], occupation: '', linkedin_url: '' },
        });
      }
    } catch (recoveryErr) {
      console.error('investigateLandlord recovery failed:', recoveryErr);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});