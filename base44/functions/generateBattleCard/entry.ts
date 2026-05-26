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

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    // Generate mandate battle card
    const prompt = `You are a Dubai real estate mandate negotiation expert. Create a "Mandate Battle Card" for this landlord.

Landlord Profile:
- Name: ${landlord.full_name_en}
- Archetype: ${landlord.landlord_archetype}
- Nationality: ${landlord.nationality}
- Pain Level (Urgency): ${landlord.urgency_score}/100
- Rapport: ${landlord.rapport_level}

Generate a JSON response with:
{
  "pain_point": "What is this landlord's #1 pain point?",
  "top_3_motivators": ["motivator 1", "motivator 2", "motivator 3"],
  "likely_competitor_pitch": "What are other brokers likely pitching?",
  "winning_pitch": "Our winning pitch using archetype insights",
  "three_closing_techniques": ["technique 1", "technique 2", "technique 3"],
  "red_flag_warning": "Any concerns we should watch for",
  "confidence_level": "High/Medium/Low"
}`;

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
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const battleCard = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return Response.json({
      success: true,
      battleCard,
      landlord_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});