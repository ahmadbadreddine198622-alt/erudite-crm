import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const VALID_MODES = [
  'asset_proof', 'real_buyer', 'market_gift',
  'no_ask_interrupt', 'collaboration', 'funds_ready'
];

const AHMAD_LANGUAGES = ['en', 'ar', 'fr', 'ru', 'zh'];

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: "Email subject line, in the owner's language." },
    body_native: { type: 'string', description: "Email body in the owner's preferred_language. Plain text. No signature/footer." },
    body_english_gloss: { type: 'string', description: 'Faithful English translation of body_native for the agent. If the body is already English, repeat it verbatim.' },
    language: { type: 'string', description: 'Language code used for the body (e.g. "ru", "en").' },
    mode_used: { type: 'string', description: 'Echo of the requested mode.' }
  },
  required: ['subject', 'body_native', 'body_english_gloss', 'language', 'mode_used']
};

const CREDIBILITY_BLOCK = `ERUDITE CREDIBILITY — the ONLY credibility facts you may use. Each MUST be expressed as an owner-benefit, never a standalone boast. Weave in only what fits this mode; do not list them all.
- Ahmad Badreddine: SuperAgent on Property Finder, 4.3★ rating, 12+ years in Dubai real estate (since 2014), Dubai BRN 34625, CEO of Erudite Real Estate. Frame as: a senior, accountable principal handling the owner's unit personally.
- Erudite is a 25-agent brokerage. Frame as: "25 active buyer-handlers working your unit from day one" — never just "we are a big team."
- Peninsula specialists with a real track record. If a comp reference is supplied in agent inputs, reference THAT specific Peninsula comp. If none is supplied, speak to Peninsula specialization generally — do NOT invent a comp, figure, or transaction.
- Ahmad personally speaks the owner's language. If the owner's preferred_language is English, Arabic, French, Russian or Mandarin, mention that the owner can deal directly with the principal in their own language — a trust/benefit point.
- Erudite responds within 5 minutes. Frame as reliability/responsiveness FOR THE OWNER, not as a slogan.
- Verify-me anchor: you MAY include the Property Finder profile (https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264) and/or LinkedIn (https://www.linkedin.com/in/badreddine-ahmad-34b4679b) as a low-key "you are welcome to look me up" line.

VERIFIED PUBLIC FIGURES (an owner can confirm these on the PF profile — safe to use, always as owner-benefit, never as a standalone brag):
- 56 closed deals, AED 87.9M total deals value, 56 listings for sale + 17 for rent currently live.
- Example framing: "a brokerage that has closed 56 deals worth nearly AED 88M is already bringing that buyer demand to your unit."

HARD GUARDRAIL: NEVER use larger or rounder figures (e.g. "200+ deals", "AED 1 billion", "hundreds of clients"). They exceed the publicly shown numbers, so a cross-checking owner sees a mismatch and the claim backfires. Never fabricate or inflate any number, price, date, or transaction. If you are unsure of a fact, leave it out.`;

const MODE_GUIDANCE = {
  asset_proof: `MODE: asset_proof (safe default). OPEN by demonstrating exact, specific knowledge of the owner's unit — name the project and unit reference and (only if genuinely known) bed/size context — so the owner immediately sees this is about THEIR specific asset, not a blast. Make NO buyer claim. Intent: prove you actually know and follow this unit, and that a senior principal is paying attention to it.`,
  real_buyer: `MODE: real_buyer. OPEN by referencing the specific, real buyer behaviour supplied by the agent (the buyer detail). Build the email around that concrete buyer. NEVER write a generic "I have a serious buyer" line. Intent: a real, specific buyer interest in this exact unit, made credible by the supplied detail.`,
  market_gift: `MODE: market_gift. LEAD with ONE specific market/transaction insight (the supplied market figure) about this owner's unit type in their project — offered as a useful gift, not a pitch. Intent: give the owner genuinely useful intelligence about their own asset; the relationship is the point, not an immediate ask.`,
  no_ask_interrupt: `MODE: no_ask_interrupt. EXPLICITLY state, early and plainly, that you are NOT asking for their listing/mandate. Lead with a specific reason for writing — a concrete buyer interest or a concrete market fact about their unit. Intent: lower the owner's guard by removing the ask entirely; this is a no-pressure, value-first note.`,
  collaboration: `MODE: collaboration (for owners who may already be listed with another broker). OFFER to work ALONGSIDE their existing broker, not to replace them — bring Erudite's buyer network and 25 buyer-handlers to the unit in an additive, non-competing way. Be disarming and respectful of the existing arrangement. Intent: additive collaboration that brings more qualified buyers without asking the owner to switch.`,
  funds_ready: `MODE: funds_ready. OPEN around the supplied buyer detail of a buyer who is ready to place a deposit on signing — emphasise readiness and seriousness grounded in that specific detail. NEVER a generic "serious buyer" line. Intent: a transaction-ready buyer, made credible by the supplied detail.`
};

const PSYCHOLOGY_PROFILES = {
  stubborn: `READER PSYCHOLOGY — stubborn / set in their ways: They resist anything that feels like being "sold" or pushed. Give them full control and zero pressure. State facts plainly, make no demands, and explicitly leave the next move entirely to them. No persuasion language.`,
  dislikes_email: `READER PSYCHOLOGY — dislikes email: They find email a chore. Keep it to a few short lines, one clear point, easy to skim, and make replying effortless (a one-line reply is enough). Get to the point in the first sentence.`,
  avoids_talking: `READER PSYCHOLOGY — avoids calls and meetings: Do NOT ask them to call, meet, or "hop on a quick chat". Make clear everything can be handled in writing, at their pace, with no phone pressure whatsoever.`,
  stressed: `READER PSYCHOLOGY — stressed / overwhelmed: Be calm and reassuring. Reduce their mental load — make clear you carry the heavy lifting. No urgency, no deadlines, no long lists. At most one small, easy step.`,
  skeptical: `READER PSYCHOLOGY — skeptical / distrustful: Lead with what they can independently verify and use the look-me-up anchor. No hype, no superlatives, no adjectives — only checkable facts, framed as their reassurance.`,
  time_poor: `READER PSYCHOLOGY — busy / time-poor: Bottom line in the first sentence. One decision, clearly stated. Respect their time explicitly. No preamble.`,
  analytical: `READER PSYCHOLOGY — analytical / data-driven: Be precise and structured. Use only verified figures; never invent data. Lead with the concrete over the relational.`,
  emotionally_attached: `READER PSYCHOLOGY — emotionally attached to the home: Acknowledge that this is more than an asset to them. Warm and respectful, never coldly transactional. Move gently.`,
  price_anchored: `READER PSYCHOLOGY — high price expectation: Do NOT challenge or correct their price. If you mention any market reality, frame it as a useful gift, never as "you are wrong". Protect their pride.`,
  previously_burned: `READER PSYCHOLOGY — burned by a past broker: Acknowledge (without naming anyone) that their previous experience may have been frustrating. Differentiate through accountability and responsiveness shown, not claimed. Low pressure; earn trust.`,
  non_committal: `READER PSYCHOLOGY — slow to respond / went quiet: Make re-entry easy and guilt-free — no "just following up again". One low-friction, specific question they can answer in seconds.`,
  status_conscious: `READER PSYCHOLOGY — proud / status-conscious: Treat them as a valued principal — respectful, a touch of exclusivity, never fawning. Make them feel handled at a senior level.`
};
const VALID_PSYCHOLOGIES = Object.keys(PSYCHOLOGY_PROFILES);

async function callClaude(system, prompt, model = 'claude-opus-4-7') {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      name: 'emit_landlord_email',
      description: "Emit the drafted landlord email with the subject, native-language body, English gloss, language code and mode.",
      input_schema: DRAFT_SCHEMA
    }],
    tool_choice: { type: 'tool', name: 'emit_landlord_email' }
  });
  const toolBlock = response.content.find(b => b.type === 'tool_use');
  return toolBlock ? toolBlock.input : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { landlord_id, mode, agent_inputs = {}, tone = 'senior_courteous', psychology = null } = body || {};

    if (!landlord_id) {
      return Response.json({ ok: false, error: 'landlord_id is required' }, { status: 400 });
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return Response.json({ ok: false, error: `mode is required and must be one of: ${VALID_MODES.join(', ')}` }, { status: 400 });
    }
    if (psychology && !VALID_PSYCHOLOGIES.includes(psychology)) {
      return Response.json({ ok: false, error: `psychology must be one of: ${VALID_PSYCHOLOGIES.join(', ')}` }, { status: 400 });
    }

    const inputs = agent_inputs && typeof agent_inputs === 'object' ? agent_inputs : {};

    if ((mode === 'real_buyer' || mode === 'funds_ready') && !inputs.buyer_detail) {
      return Response.json({ ok: false, error: `${mode} mode requires agent_inputs.buyer_detail` }, { status: 400 });
    }
    if (mode === 'market_gift' && !inputs.market_figure) {
      return Response.json({ ok: false, error: 'market_gift mode requires agent_inputs.market_figure' }, { status: 400 });
    }

    let landlord;
    try {
      landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    } catch (_) {
      landlord = null;
    }
    if (!landlord) {
      return Response.json({ ok: false, error: 'landlord not found' }, { status: 404 });
    }

    const safe = {
      full_name_en: landlord.full_name_en || null,
      full_name_ar: landlord.full_name_ar || null,
      preferred_language: landlord.preferred_language || 'en',
      project_name: landlord.project_name || null,
      unit_reference: landlord.unit_reference || null,
      landlord_archetype: landlord.landlord_archetype || null,
      assigned_agent_email: landlord.assigned_agent_email || null,
      stage: landlord.stage || null,
      is_currently_listed_with_others: !!landlord.is_currently_listed_with_others
    };

    if (!safe.full_name_en) {
      return Response.json({ ok: false, error: 'landlord has no full_name_en to address' }, { status: 400 });
    }

    const lang = safe.preferred_language;
    const ahmadSpeaksOwnerLang = AHMAD_LANGUAGES.includes(lang);

    const systemPrompt = `You are Ahmad Badreddine, CEO of Erudite Real Estate in Dubai, drafting a personal, standout email to a property OWNER (landlord). You write like a senior, courteous principal — concise, specific, never salesy, never a template.

${CREDIBILITY_BLOCK}

GLOBAL RULES:
- Address the owner by their English full name.
- Be specific to the named project and unit reference. NEVER generic — a generic email is a failure.
- Write the body in the owner's preferred language. If the language code is "ru", write natural, native-quality Russian. If "ar", Arabic. If "fr", French. If "zh", Mandarin. If "en", English.
- Tone: senior, courteous, concise. No emojis. No exclamation-heavy hype.
- LENGTH — STRICT: keep the body SHORT — roughly 110-170 words, and never more than ~1,400 characters. A busy owner must be able to read it in under a minute. Brevity signals seniority; a long email reads as a junior pitch. Pick the ONE or TWO credibility points that fit this mode and stop — do not stack every fact, do not repeat yourself, do not pad with filler.
- Do NOT fabricate any fact, price, date, number, comp, or transaction. Use only the credibility facts above and the real agent-supplied specifics.
- Credibility must appear woven in as an OWNER-BENEFIT appropriate to this mode — never a brag, and never as the opener. Do NOT open with "I have a serious buyer."
- If a READER PSYCHOLOGY is provided, let it shape tone, emphasis, and what to avoid — but it NEVER overrides the mode's core intent, the brevity ceiling, the no-fabrication rule, or the no-signature rule.
- Do NOT include any signature, sign-off block, footer, or contact details — the template layer adds that identically every time. End the body on the last substantive sentence.
- body_english_gloss must be a faithful English translation of body_native (verbatim if the body is already English).`;

    const agentInputLines = [];
    if (inputs.buyer_detail) agentInputLines.push(`- buyer_detail (real, specific buyer behaviour): ${inputs.buyer_detail}`);
    if (inputs.market_figure) agentInputLines.push(`- market_figure (real market/transaction insight): ${inputs.market_figure}`);
    if (inputs.comp_reference) agentInputLines.push(`- comp_reference (real Peninsula comparable — you MAY reference this specifically): ${inputs.comp_reference}`);

    const psychologyGuidance = psychology ? PSYCHOLOGY_PROFILES[psychology] : null;

    const userPrompt = `Draft the email now.

${MODE_GUIDANCE[mode]}
${psychologyGuidance ? `\n${psychologyGuidance}\n` : ''}
OWNER & UNIT (the only facts about them you may use):
- Owner English name (address them by this): ${safe.full_name_en}
- Project: ${safe.project_name || '(unknown — do not invent one)'}
- Unit reference: ${safe.unit_reference || '(unknown — do not invent one)'}
- Owner's preferred language code (write the body in this): ${lang}
- Owner archetype (context for tone only, do not name it back to them): ${safe.landlord_archetype || 'unknown'}
- Currently listed with another broker: ${safe.is_currently_listed_with_others ? 'YES' : 'no/unknown'}
- Ahmad personally speaks this owner's language: ${ahmadSpeaksOwnerLang ? 'YES — you may make direct-in-their-language a trust/benefit point' : 'no — do not claim to speak this language'}

REAL AGENT-SUPPLIED SPECIFICS${agentInputLines.length ? ':' : ' (none supplied — rely on what this mode allows; do NOT invent specifics):'}
${agentInputLines.join('\n') || '(none)'}

TONE PREFERENCE: ${tone}

Produce: a SHORT subject line in the owner's language, a CONCISE body in the owner's language (110-170 words, under ~1,400 characters, no signature), and a faithful English gloss of that body. Set language to "${lang}" and mode_used to "${mode}".`;

    const result = await callClaude(systemPrompt, userPrompt);

    if (!result || !result.subject || !result.body_native) {
      return Response.json({ ok: false, error: 'draft generation failed' }, { status: 502 });
    }

    const language = result.language || lang;
    const draft = {
      subject: result.subject,
      body_native: result.body_native,
      body_english_gloss: (lang === 'en')
        ? result.body_native
        : (result.body_english_gloss || ''),
      language,
      mode_used: mode,
      psychology_used: psychology || null
    };

    return Response.json({ ok: true, draft });
  } catch (error) {
    console.error('draftLandlordEmail error:', error);
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
});