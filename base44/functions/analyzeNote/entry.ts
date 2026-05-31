import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { note_id } = await req.json();
    if (!note_id) return Response.json({ error: 'note_id required' }, { status: 400 });

    const note = await base44.entities.Note.get(note_id);
    if (!note) return Response.json({ error: 'Note not found' }, { status: 404 });
    if (!note.body || note.body.trim().length < 5) {
      return Response.json({ error: 'Note body is too short to analyze' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const systemPrompt = `You are a real estate CRM assistant for a Dubai property brokerage. 
Analyze notes and extract structured insight. Always respond with valid JSON only — no markdown, no prose outside JSON.`;

    const userPrompt = `Analyze this note and return a JSON object with exactly these keys:
- "summary": a concise 2–4 sentence plain-English summary of the note content
- "action_items": array of strings, each a concrete actionable task extracted from the note (empty array if none)
- "entities_mentioned": array of strings for every person name, property name, project, company, or location mentioned (empty array if none)

Note category: ${note.category}
Note title: ${note.title}

Note body:
${note.body}`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let parsed;
    try {
      const raw = message.content[0].text.trim();
      const jsonStr = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr);
    } catch {
      return Response.json({ error: 'Claude returned unparseable response' }, { status: 500 });
    }

    const updated = await base44.entities.Note.update(note_id, {
      ai_summary: parsed.summary || '',
      ai_action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      ai_entities_mentioned: Array.isArray(parsed.entities_mentioned) ? parsed.entities_mentioned : [],
    });

    return Response.json({ ok: true, note: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});