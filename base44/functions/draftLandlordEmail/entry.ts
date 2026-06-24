import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * draftLandlordEmail — generate a professional, project-aware email draft to a
 * landlord in their preferred_language, plus an English back-translation so the
 * agent can read it before sending.
 *
 * DRAFT ONLY: this function does NOT send and does NOT touch Gmail.
 *
 * Body: { landlord_id (required), intent (required), tone (optional, default "professional_warm") }
 * Returns: {
 *   language,                // ISO code of the landlord's preferred language
 *   subject,                 // subject line in the landlord's language
 *   body,                    // email body in the landlord's language
 *   english_subject,         // back-translation of the subject
 *   english_body,            // back-translation of the body
 *   landlord_name
 * }
 */

const LANGUAGE_NAMES = {
  en: 'English',
  ar: 'Arabic',
  ru: 'Russian',
  zh: 'Chinese (Simplified)',
  hi: 'Hindi',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id, intent } = body;
    const tone = body.tone || 'professional_warm';

    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });
    if (!intent || !String(intent).trim()) return Response.json({ error: 'intent required' }, { status: 400 });

    // Step 1: Load the landlord record.
    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id).catch(() => null);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    const langCode = landlord.preferred_language || 'en';
    const langName = LANGUAGE_NAMES[langCode] || 'English';
    const landlordName = landlord.full_name_en || landlord.first_name || 'the owner';

    const projectName = landlord.project_name || '';
    const unitRef = landlord.unit_reference || '';
    const agentName = user.full_name || '';
    const askingPrice = landlord.asking_price_aed
      ? `AED ${Number(landlord.asking_price_aed).toLocaleString('en-US')}`
      : '';

    const systemPrompt = `You are an expert real-estate communications writer for a premium Dubai brokerage.
You draft polished, ${tone.replace(/_/g, ' ')} emails from an agent to a property owner (landlord).

Rules:
- Write the email in ${langName}. It must read naturally to a native speaker, not like a translation.
- Be concise, respectful and clear. Use the landlord's name. Sign off as the agent if an agent name is provided.
- Stay on topic: cover exactly what the agent's intent describes. Do not invent facts, prices, dates or commitments not given.
- Reference the project/unit context naturally when relevant.
- Do NOT include placeholders like [Name] — use the real values provided, or omit gracefully.
- Then provide a faithful English back-translation of the subject and body so the agent can verify before sending.
- Output STRICT JSON only.`;

    const userPrompt = `LANDLORD: ${landlordName}
Preferred language: ${langName} (${langCode})
${projectName ? `Project: ${projectName}` : ''}
${unitRef ? `Unit reference: ${unitRef}` : ''}
${askingPrice ? `Asking price: ${askingPrice}` : ''}
${agentName ? `Agent (sender): ${agentName}` : ''}

AGENT INTENT (what this email should say): ${intent}
TONE: ${tone}

Produce a JSON object with EXACTLY these keys:
{
  "subject": "subject line in ${langName}",
  "body": "full email body in ${langName}, with greeting and sign-off",
  "english_subject": "English back-translation of the subject",
  "english_body": "English back-translation of the body"
}

Respond ONLY with valid JSON. No prose, no markdown.`;

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = aiResponse.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Failed to parse AI response', raw: text }, { status: 502 });
    }
    const draft = JSON.parse(jsonMatch[0]);

    return Response.json({
      language: langCode,
      landlord_name: landlordName,
      subject: draft.subject || '',
      body: draft.body || '',
      english_subject: draft.english_subject || '',
      english_body: draft.english_body || '',
    });
  } catch (error) {
    console.error('draftLandlordEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});