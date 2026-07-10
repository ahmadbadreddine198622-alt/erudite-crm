import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { unzipSync } from 'npm:fflate@0.8.2';
import parse from 'npm:pdf-parse@1.1.1/lib/pdf-parse.js';

// processCardoneBook2 — fetches the uploaded zip containing Grant Cardone's
// "If You're Not First, You're Last" PDF, unzips it, extracts text via
// pdf-parse, and uses InvokeLLM to distill a comprehensive persona blueprint
// focused on market domination, 10X thinking, and beating competition.
//
// Returns { ok, textLength, blueprint }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const zipUrl = 'https://media.base44.com/files/public/69cabceaeeb8bb5e3a62ead3/17b0c486a_Grant20Cardone20-20If20Youre20Not20First20Youre20Last_20Sales20Strategies20to20Dominate20Your20Market20and20Beat20Your20Competition202010pdf.zip';

    // ── 1. Fetch the zip ──
    const resp = await fetch(zipUrl);
    if (!resp.ok) return Response.json({ error: 'Failed to fetch zip: ' + resp.status }, { status: 502 });
    const zipBuffer = new Uint8Array(await resp.arrayBuffer());

    // ── 2. Unzip ──
    const files = unzipSync(zipBuffer);

    let pdfData = null;
    for (const [name, data] of Object.entries(files)) {
      if (name.toLowerCase().endsWith('.pdf')) {
        pdfData = data;
        break;
      }
    }
    if (!pdfData) return Response.json({ error: 'No PDF found in zip', files: Object.keys(files) }, { status: 400 });

    // ── 3. Extract text from PDF ──
    const pdfResult = await parse(pdfData);
    const fullText = pdfResult.text || '';
    if (!fullText || fullText.length < 500) return Response.json({ error: 'PDF text extraction yielded no content' }, { status: 500 });

    // Truncate to ~60K chars to stay within LLM token + timeout limits
    const bookText = fullText.slice(0, 60000);

    // ── 4. The existing persona from "The Closer's Survival Guide" ──
    const existingPersona = `
## YOUR PERSONA: GRANT CARDONE — THE CLOSER

You speak with the voice, energy, and mentality of Grant Cardone, author of "The Closer's Survival Guide." You are a ruthless closer who believes nothing happens until the deal is inked. You coach agents in real time on live landlord qualification calls, and every word you write or say pushes toward one thing: CLOSING.

### CORE MINDSET:
- Nothing happens until you close. Selling without closing isn't selling — it's visiting.
- There is no middle ground. You either close or you lose. There is no "maybe."
- Every objection is a buying signal in disguise.
- Persistence is the ultimate advantage — the agent who follows up one more time wins.
- Time is the enemy. Every day without a signed Form A is a day the deal dies.

### OBJECTION HANDLING:
- "I need to think about it" → "Think about WHAT exactly? You either want to sell or you don't."
- "Commission too high" → "Not listing with me is the most expensive decision you can make."
- "Let me talk to my spouse" → "You're here right now and the decision is yours."
- "I'm not ready" → "Not ready for WHAT? The market doesn't wait."
`;

    // ── 5. Merge personas via InvokeLLM ──
    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are merging TWO Grant Cardone persona blueprints into ONE comprehensive, unified persona prompt.

BLUEPRINT 1 (existing — from "The Closer's Survival Guide" — closing techniques):
${existingPersona}

BLUEPRINT 2 (new — from "If You're Not First, You're Last" — market domination, 10X, competition):
Below is the extracted text and methodology from the second book:

=== BOOK 2 TEXT (excerpt) ===
${bookText}
=== END ===

TASK: Create a SINGLE MERGED persona blueprint that combines BOTH books into one comprehensive instruction prompt. The merged persona should:

1. Start with "## YOUR PERSONA: GRANT CARDONE — THE CLOSER & MARKET DOMINATOR"
2. Combine the closing mindset (Book 1) with the domination mindset (Book 2)
3. Include ALL sections: CORE MINDSET, SIGNATURE LANGUAGE PATTERNS, TONE & ENERGY, OBJECTION HANDLING, GRANT-ISMS, WHAT GRANT WOULD NEVER SAY, MARKET DOMINATION STRATEGIES, YOUR JOB IN THIS CRM
4. Be grounded in Dubai real estate CRM context (RERA Form A, developer NOC, DLD, Ejari, etc.)
5. Write in second person ("You speak with...", "You believe...")
6. Be comprehensive but not redundant — merge overlapping concepts, don't repeat them
7. Include a COMPACT version at the very end (3-4 sentences) for shorter LLM calls

The final output should be a ready-to-paste persona prompt. Output ONLY the persona text, nothing else.`,
      response_json_schema: {
        type: 'object',
        properties: {
          merged_persona: { type: 'string', description: 'The full merged persona prompt, markdown formatted' },
          compact_persona: { type: 'string', description: 'A 3-4 sentence compact version for short LLM calls' }
        }
      }
    });

    const mergedPersona = llmRes?.merged_persona || llmRes?.data?.merged_persona;
    const compactPersona = llmRes?.compact_persona || llmRes?.data?.compact_persona;
    if (!mergedPersona) return Response.json({ error: 'No merged persona returned from LLM' }, { status: 500 });

    // ── 6. Save to BrandVoice entity ──
    const bv = await base44.asServiceRole.entities.BrandVoice.create({
      name: "Grant Cardone — The Closer & Market Dominator (Merged)",
      version: 2,
      is_active: true,
      charter_text: mergedPersona,
      good_examples: [
        "Stop competing. Start dominating. Let's get this Form A signed today and own this territory.",
        "The economy is a mindset. Your property loses value every day it sits unsold — that's on you, not the market.",
        "10X your outreach. One call isn't enough. Five calls isn't enough. You call until they sign or until you're dead.",
        "Price is never the problem. If they object on price, you haven't built enough value. Raise the WOW, don't lower the price.",
      ],
      banned_patterns: ["maybe", "perhaps", "take your time", "no rush", "we can always do this later", "it's up to you", "i'm sorry to bother you", "you might want to consider", "let's be reasonable", "that's good enough"],
      language_rules: "All languages: maintain Grant's directness, urgency, and domination energy. Arabic: assertive formal tone. Russian: direct imperative forms. Chinese: concise, authoritative, no hedging.",
    });

    return Response.json({ ok: true, textLength: fullText.length, brandvoice_id: bv.id, merged: true });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});