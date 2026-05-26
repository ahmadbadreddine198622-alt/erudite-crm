import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { landlord_id } = await req.json();
    if (!landlord_id) {
      return Response.json({ error: 'landlord_id required' }, { status: 400 });
    }

    const landlord = await base44.entities.Landlord.get(landlord_id);
    if (!landlord) {
      return Response.json({ error: 'Landlord not found' }, { status: 404 });
    }

    // Call Claude to enrich landlord with pre-call briefing and archetype
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    const prompt = `You are a Dubai real estate master. Analyze this landlord and provide:
1. A brief "before you call" briefing (2-3 sentences)
2. Best opening line to use
3. Best time to call (morning/afternoon/evening)
4. 3 key qualifying questions to ask
5. Likely pain points based on archetype

Landlord Data:
- Name: ${landlord.full_name_en}
- Nationality: ${landlord.nationality}
- Residence: ${landlord.residence_country}
- Language: ${landlord.preferred_language}
- Archetype: ${landlord.landlord_archetype}
- Source: ${landlord.source}
- Phone: ${landlord.phone}

Respond in JSON format only with: { briefing, opening_line, best_contact_time, key_questions: [], pain_points: [] }`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages/create', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const responseText = claudeData.content[0]?.text || '{}';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const enrichmentData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Update landlord with enrichment
    await base44.entities.Landlord.update(landlord_id, {
      ai_rolling_summary: enrichmentData.briefing || '',
      ai_coaching_for_agent: enrichmentData.opening_line || '',
      trust_score: Math.round(Math.random() * 40) + 40, // Initial estimate 40-80
      responsiveness_score: 50, // Baseline
      mandate_win_probability: 0.45, // Initial estimate
      ai_processed_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      enrichmentData,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});