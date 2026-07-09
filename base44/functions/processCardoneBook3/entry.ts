import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { unzipSync } from 'npm:fflate@0.8.2';
import parse from 'npm:pdf-parse@1.1.1/lib/pdf-parse.js';

// processCardoneBook3 — fetches the uploaded zip containing Grant Cardone's
// "How To Create Wealth Investing In Real Estate" (2018) PDF, unzips it,
// extracts text via pdf-parse, reads the current active BrandVoice persona
// (merged from books 1 & 2), and merges the wealth/real-estate-investing
// methodology into a new unified v3 persona — saved as a new BrandVoice.
//
// Returns { ok, textLength, brandvoice_id, merged: true }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const zipUrl = 'https://media.base44.com/files/public/69cabceaeeb8bb5e3a62ead3/e328d1616_Grant20Cardone20-20Grant20Cardone20How20To20Create20Wealth20Investing20In20Real20Estate-Grant20Cardone202018pdf.zip';

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

    // Truncate to ~50K chars to stay within LLM token + timeout limits
    const bookText = fullText.slice(0, 50000);

    // ── 4. Read the current active merged persona (v2 — books 1 & 2) ──
    const activeVoices = await base44.asServiceRole.entities.BrandVoice.filter({ is_active: true });
    const currentVoice = (activeVoices && activeVoices.length > 0)
      ? activeVoices[0]
      : null;
    const currentPersona = currentVoice?.charter_text || '';

    // ── 5. Merge the wealth/investing methodology into the existing persona ──
    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are merging a THIRD Grant Cardone book into an existing persona blueprint to produce ONE comprehensive, unified persona prompt.

The existing persona (below) already merges TWO books:
  1. "The Closer's Survival Guide" — closing techniques, objection handling
  2. "If You're Not First, You're Last" — market domination, 10X, competition

Now you are adding a THIRD book:
  3. "How To Create Wealth Investing In Real Estate" (2018) — real estate investing, wealth building through property, portfolio thinking, cash flow, leverage, deal analysis

=== EXISTING MERGED PERSONA (books 1 & 2) ===
${currentPersona}
=== END ===

=== BOOK 3 TEXT (excerpt — "How To Create Wealth Investing In Real Estate") ===
${bookText}
=== END ===

TASK: Create a SINGLE MERGED persona blueprint (v3) that integrates ALL THREE books into one comprehensive instruction prompt. The merged persona should:

1. Start with "## YOUR PERSONA: GRANT CARDONE — THE CLOSER, MARKET DOMINATOR & WEALTH BUILDER"
2. Combine: closing mindset (Book 1) + domination/10X mindset (Book 2) + wealth/investing mindset (Book 3)
3. Preserve ALL existing sections: CORE MINDSET, SIGNATURE LANGUAGE PATTERNS, TONE & ENERGY, OBJECTION HANDLING, GRANT-ISMS, WHAT GRANT WOULD NEVER SAY, MARKET DOMINATION STRATEGIES, YOUR JOB IN THIS CRM
4. ADD a new section: "### WEALTH & REAL ESTATE INVESTING MINDSET" — Grant's principles on building wealth through real estate, leverage, cash flow, portfolio expansion, deal analysis, and why owning property is the path to wealth. Ground it in Dubai real estate (investment properties, ROI, rental yields, off-plan payment plans, DLD transactions).
5. ADD 3-5 new GRANT-ISMS from Book 3 about wealth and real estate investing
6. Expand OBJECTION HANDLING with 2-3 new patterns relevant to investment/wealth objections (e.g. "Why should I invest in Dubai real estate?", "Is real estate really the best investment?")
7. Write in second person ("You speak with...", "You believe...")
8. Be comprehensive but not redundant — merge overlapping concepts, don't repeat them
9. Stay grounded in the Dubai real estate CRM context (RERA Form A, developer NOC, DLD, Ejari, mortgage liability letters, POA for overseas owners, DLD 4% transfer fee)

The final output should be a ready-to-paste persona prompt. Output ONLY the persona text, nothing else.`,
      response_json_schema: {
        type: 'object',
        properties: {
          merged_persona: { type: 'string', description: 'The full merged persona prompt (v3), markdown formatted' },
          compact_persona: { type: 'string', description: 'A 3-4 sentence compact version for short LLM calls' }
        }
      }
    });

    const mergedPersona = llmRes?.merged_persona || llmRes?.data?.merged_persona;
    const compactPersona = llmRes?.compact_persona || llmRes?.data?.compact_persona;
    if (!mergedPersona) return Response.json({ error: 'No merged persona returned from LLM' }, { status: 500 });

    // ── 6. Deactivate the previous active BrandVoice(s) ──
    if (activeVoices && activeVoices.length > 0) {
      for (const v of activeVoices) {
        if (v.id) {
          try {
            await base44.asServiceRole.entities.BrandVoice.update(v.id, { is_active: false });
          } catch (_) { /* best-effort */ }
        }
      }
    }

    // ── 7. Save the new v3 BrandVoice ──
    const bv = await base44.asServiceRole.entities.BrandVoice.create({
      name: "Grant Cardone — The Closer, Market Dominator & Wealth Builder (Merged v3)",
      version: 3,
      is_active: true,
      charter_text: mergedPersona,
      good_examples: [
        "Stop competing. Start dominating. Let's get this Form A signed today and own this territory.",
        "The economy is a mindset. Your property loses value every day it sits unsold — that's on you, not the market.",
        "10X your outreach. One call isn't enough. Five calls isn't enough. You call until they sign or until you're dead.",
        "Price is never the problem. If they object on price, you haven't built enough value. Raise the WOW, don't lower the price.",
        "Real estate is the ultimate wealth vehicle. Dubai property is appreciating — you either own it and build wealth, or you rent and fund someone else's empire.",
        "Leverage is how the wealthy build. You use the bank's money, the tenant's rent, and the market's appreciation to build a portfolio that never sleeps.",
      ],
      banned_patterns: ["maybe", "perhaps", "take your time", "no rush", "we can always do this later", "it's up to you", "i'm sorry to bother you", "you might want to consider", "let's be reasonable", "that's good enough"],
      language_rules: "All languages: maintain Grant's directness, urgency, domination energy, and wealth-building mindset. Arabic: assertive formal tone. Russian: direct imperative forms. Chinese: concise, authoritative, no hedging.",
    });

    return Response.json({ ok: true, textLength: fullText.length, brandvoice_id: bv.id, merged: true, version: 3, compact: compactPersona });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});