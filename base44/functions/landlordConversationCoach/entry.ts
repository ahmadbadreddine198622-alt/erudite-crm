import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { landlord_id, conversation_text, conversation_type } = await req.json();
    if (!landlord_id || !conversation_text) {
      return Response.json({ error: 'landlord_id and conversation_text required' }, { status: 400 });
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
    }

    // Score the conversation quality
    const prompt = `You are a Dubai real estate conversation coach. Analyze this ${conversation_type || 'call'} and provide constructive feedback.

Conversation:
${conversation_text}

Provide a JSON response with:
{
  "quality_score": <0-100>,
  "rapport_built": <true/false>,
  "things_done_well": ["thing 1", "thing 2", "thing 3"],
  "missed_opportunities": ["missed 1", "missed 2"],
  "key_questions_asked": ["q1", "q2"],
  "objections_surfaced": ["objection 1"],
  "objections_handled": ["handled 1"],
  "single_best_line_to_use": "What they should have said",
  "next_move_recommended": "What to do next"
}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', // Using haiku for high-volume tasks
        max_tokens: 512,
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
    const coaching = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Save coaching record
    const coachingRecord = await base44.entities.ConversationCoach.create({
      landlord_id,
      quality_score: coaching.quality_score || 0,
      rapport_built: coaching.rapport_built || false,
      key_questions_asked: coaching.key_questions_asked || [],
      missed_opportunities: coaching.missed_opportunities || [],
      objections_surfaced: coaching.objections_surfaced || [],
      objections_handled: coaching.objections_handled || [],
      next_move_recommended: coaching.next_move_recommended || '',
      things_done_well: coaching.things_done_well || [],
      single_best_line_to_use: coaching.single_best_line_to_use || '',
    });

    return Response.json({
      success: true,
      coaching,
      coachingRecordId: coachingRecord.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});