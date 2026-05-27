import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Classifies an inbound WhatsApp message from an unknown sender.
 * Returns the intent + extracted entities so routeWhatsAppMessage knows
 * which pipeline to drop the lead into and what data to pre-populate.
 *
 * Body: { message: string, sender_phone?: string, recent_thread?: string[] }
 * Returns: {
 *   intent: "buyer" | "tenant" | "landlord_sale" | "landlord_rent" | "agent_other_brokerage" | "investor" | "general_inquiry" | "spam",
 *   confidence: 0-1,
 *   language: ISO 639-1,
 *   urgency: "low" | "medium" | "high" | "urgent",
 *   first_message_strength: "weak" | "medium" | "strong" | "exceptional",
 *   entities: { budget_min, budget_max, currency, preferred_locations[], bedrooms_min, bedrooms_max, property_types[], move_in_timeline },
 *   suggested_name: string | null,
 *   suggested_first_reply: string,
 *   reasoning: string
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // No auth check — called internally by routeWhatsAppMessage which IS authed.
    // Allow service-role invocations.

    const { message, sender_phone, recent_thread = [] } = await req.json();
    if (!message) return Response.json({ error: 'message required' }, { status: 400 });

    const systemPrompt = `You are AURORA INBOX TRIAGE — first-line classifier for inbound WhatsApp messages to a Dubai real-estate brokerage.

You read 1 message (plus optional prior thread) and emit STRICT JSON with:

1. INTENT — one of:
   - "buyer": wants to BUY a property (any price)
   - "tenant": wants to RENT a property
   - "landlord_sale": owns property and wants to SELL it via us
   - "landlord_rent": owns property and wants to RENT it out via us
   - "agent_other_brokerage": another broker asking about co-broking or referrals
   - "investor": specifically discussing investment/yield/portfolio (subset of buyer but flagged)
   - "general_inquiry": vague — needs human qualification
   - "spam": automated, scam, promotional, or off-topic

2. CONFIDENCE 0-1 in your classification.

3. LANGUAGE — ISO 639-1 (en, ar, ru, hi, zh, fr, ur, fa). For Arabic, detect if Gulf/Levantine/Egyptian dialect.

4. URGENCY:
   - "urgent" = needs reply in <1h ("can you call me NOW", "I have a flight tonight", "viewing in 2 hours")
   - "high" = needs reply same day ("I'm in Dubai this week", "decision by Friday")
   - "medium" = standard
   - "low" = browsing/casual

5. FIRST_MESSAGE_STRENGTH (signal strength of the very first message):
   - "exceptional" = budget + location + timeline + decision authority all clear, ready to transact
   - "strong" = at least 2 of those 4
   - "medium" = single clear signal
   - "weak" = just "hi" or vague "info about property"

6. ENTITIES — extract any of these mentioned:
   - budget_min, budget_max, currency (default AED)
   - preferred_locations (Dubai communities: Marina, Downtown, JVC, etc.)
   - bedrooms_min, bedrooms_max
   - property_types (apartment, villa, townhouse, etc.)
   - move_in_timeline (immediate, 1_month, 3_months, etc.)

7. SUGGESTED_NAME — if a name is mentioned in the message, extract it. Otherwise null.

8. SUGGESTED_FIRST_REPLY — a ready-to-send reply in the detected language, tone matched to urgency, that:
   - Acknowledges what they said
   - Asks 1-2 clarifying questions
   - Sets a clear next step
   - Max 4 sentences

9. REASONING — 1-2 sentences explaining the classification.

Rules:
- STRICT JSON only.
- Default to "general_inquiry" if uncertain rather than guessing wrong.
- For landlords, MUST distinguish sale vs rent based on language ("looking to sell" vs "looking to rent out").
- For Arabic messages, suggested_first_reply MUST be in Arabic with proper script.`;

    const userPrompt = `INBOUND MESSAGE (from ${sender_phone || 'unknown'}):
"""
${message}
"""

${recent_thread.length > 0 ? `PRIOR THREAD CONTEXT:
${recent_thread.slice(-10).map((m, i) => `[${i+1}] ${m}`).join('\n')}` : '(no prior messages)'}

Classify and return JSON.`;

    const res = await base44.functions.invoke('claudeAI', {
      action: 'generate',
      system: systemPrompt,
      prompt: userPrompt,
      model: 'claude-haiku-4-5', // fast for high-volume webhook
      response_format: {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: ['buyer', 'tenant', 'landlord_sale', 'landlord_rent', 'agent_other_brokerage', 'investor', 'general_inquiry', 'spam'] },
          confidence: { type: 'number' },
          language: { type: 'string' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          first_message_strength: { type: 'string', enum: ['weak', 'medium', 'strong', 'exceptional'] },
          entities: {
            type: 'object',
            properties: {
              budget_min: { type: ['number', 'null'] },
              budget_max: { type: ['number', 'null'] },
              currency: { type: ['string', 'null'] },
              preferred_locations: { type: 'array', items: { type: 'string' } },
              bedrooms_min: { type: ['number', 'null'] },
              bedrooms_max: { type: ['number', 'null'] },
              property_types: { type: 'array', items: { type: 'string' } },
              move_in_timeline: { type: ['string', 'null'] }
            }
          },
          suggested_name: { type: ['string', 'null'] },
          suggested_first_reply: { type: 'string' },
          reasoning: { type: 'string' }
        },
        required: ['intent', 'confidence', 'language', 'urgency', 'first_message_strength', 'suggested_first_reply']
      }
    });

    const result = res?.data || res;
    return Response.json(result);
  } catch (error: any) {
    console.error('classifyInboundMessage error:', error);
    // Fallback — return a safe default so webhook doesn't break
    return Response.json({
      intent: 'general_inquiry',
      confidence: 0,
      language: 'en',
      urgency: 'medium',
      first_message_strength: 'weak',
      entities: {},
      suggested_name: null,
      suggested_first_reply: 'Hi! Thanks for reaching out. How can we help with property in Dubai?',
      reasoning: `Classification failed: ${error.message}`
    });
  }
});
