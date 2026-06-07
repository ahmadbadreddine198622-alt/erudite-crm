import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * detectLandlordStakeholders — scans the landlord's last 50 messages with Claude
 * to extract mentioned third parties (spouse, brother, lawyer, etc.) and
 * upserts them as LandlordStakeholder records (source='auto').
 *
 * Body: { landlord_id }
 * Returns: { added, skipped, stakeholders }
 */

function normalize(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const { landlord_id } = body;
  if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  // Load last 50 messages
  const messages = await svc.entities.Message.filter({ landlord_id }, '-timestamp', 50).catch(() => []);
  if (!messages || messages.length === 0) {
    return Response.json({ added: 0, skipped: 0, stakeholders: [], reason: 'no_messages' });
  }

  const transcript = messages
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(m => `[${m.direction === 'outgoing' ? 'Agent' : 'Landlord'}]: ${m.text || ''}`)
    .join('\n');

  // Load existing stakeholders for dedup
  const existing = await svc.entities.LandlordStakeholder.filter({ landlord_id }).catch(() => []);
  const existingNames = new Set(existing.map(s => normalize(s.name)));

  // Ask Claude to extract stakeholders
  const prompt = `You are analyzing a WhatsApp conversation between a Dubai real estate agent and a property owner.
Extract any third parties MENTIONED by the landlord who may influence the sale/rental decision.

Look for phrases like:
- "my wife", "my husband", "my brother", "my sister", "my children"  
- "need to check with [name]", "my lawyer will review", "my business partner"
- "my family", "my accountant", "[name] is handling it"

Return ONLY a strict JSON array (no prose, no fences). Each item:
{
  "name": string,           // descriptor or name, e.g. "Wife", "Brother Mohammed", "Lawyer"
  "role": "spouse" | "sibling" | "business_partner" | "lawyer" | "financial_advisor" | "child" | "parent" | "property_manager" | "other",
  "influence": "decision_maker" | "influencer" | "blocker" | "neutral",
  "supporting_quote": string,  // exact short quote from the transcript that revealed this person
  "decision_power": number     // 0-100 estimate
}

If no stakeholders detected, return [].`;

  let detected = [];
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        system: prompt,
        messages: [{ role: 'user', content: `Conversation:\n\n${transcript}` }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return Response.json({ error: 'Anthropic API error', detail: t.slice(0, 400) }, { status: 502 });
    }

    const data = await resp.json();
    const raw = (data?.content || []).map(b => b?.text || '').join('').trim();
    const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    detected = JSON.parse(cleaned);
    if (!Array.isArray(detected)) detected = [];
  } catch (e) {
    return Response.json({ error: 'Claude call or parse failed', detail: String(e?.message || e) }, { status: 502 });
  }

  let added = 0;
  let skipped = 0;
  const upserted = [];

  for (const d of detected) {
    if (!d.name) continue;
    const key = normalize(d.name);
    if (existingNames.has(key)) { skipped++; continue; }
    existingNames.add(key);

    const validRoles = ['spouse', 'sibling', 'business_partner', 'lawyer', 'financial_advisor', 'child', 'parent', 'property_manager', 'other'];
    const validInfluences = ['decision_maker', 'influencer', 'blocker', 'neutral'];

    const record = await svc.entities.LandlordStakeholder.create({
      landlord_id,
      name: d.name,
      role: validRoles.includes(d.role) ? d.role : 'other',
      influence: validInfluences.includes(d.influence) ? d.influence : 'neutral',
      decision_power: typeof d.decision_power === 'number' ? Math.min(100, Math.max(0, d.decision_power)) : 50,
      sentiment: d.influence === 'blocker' ? 'skeptical' : d.influence === 'decision_maker' ? 'supportive' : 'neutral',
      supporting_quote: d.supporting_quote || '',
      source: 'auto',
    }).catch(() => null);

    if (record) { added++; upserted.push(record); }
  }

  return Response.json({ added, skipped, stakeholders: upserted });
});