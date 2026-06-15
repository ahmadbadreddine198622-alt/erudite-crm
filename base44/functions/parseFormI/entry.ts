import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { extractText, getDocumentProxy } from 'npm:unpdf';

// parseFormI v2 — AI-powered extraction of the counterparty agency's details
// from any Form I (Agent-to-Agent Agreement – Sales) PDF, regardless of template.
//
// PDF → text step is unchanged. Field extraction is now done via Claude instead
// of regex position-matching, which failed on third-party templates (e.g. FAM).
//
// Input (POST JSON): { file_url | text, debug?, debug_ai? }
// Response shape is UNCHANGED from v1 — FormIGenerator UI maps directly onto it.

const ERUDITE_ORN = '29322';
const ERUDITE_BRN = '34625';

function normSpaces(s: string): string {
  return s.replace(/ /g, ' ').replace(/­/g, '-');
}

// Coerce any AI-returned value: trim, blank out placeholder non-values.
function blankEmpty(v: unknown): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t || t === '-' || t.toLowerCase() === 'n/a' || t === '_' || t === 'N/A') return '';
  return t;
}

// Sanity-check extracted fields; clear obviously wrong values and log warnings.
function validateFields(cp: Record<string, string>, warnings: string[]): void {
  if (cp.orn && !/^\d+$/.test(cp.orn.replace(/\s/g, ''))) {
    warnings.push(`orn "${cp.orn}" is not purely numeric — cleared.`);
    cp.orn = '';
  }
  for (const key of ['email', 'agentEmail'] as const) {
    if (cp[key] && !cp[key].includes('@')) {
      warnings.push(`${key} "${cp[key]}" does not look like an email address — cleared.`);
      cp[key] = '';
    }
  }
  for (const key of ['phone', 'mobile', 'agentMobile', 'fax'] as const) {
    if (cp[key] && !/\d{3}/.test(cp[key])) {
      warnings.push(`${key} "${cp[key]}" contains fewer than 3 consecutive digits — cleared.`);
      cp[key] = '';
    }
  }
}

// ─── System prompt sent to Claude ─────────────────────────────────────────────
const AI_SYSTEM = `You are a document extraction assistant for a Dubai real estate CRM.
Extract party details from a RERA Form I (Agent-to-Agent Agreement – Sales) PDF text.

Return ONLY a raw JSON object — no markdown fences, no explanation, no text before or after the JSON.

ERUDITE REAL ESTATE identifiers (this is ONE party — exclude it from counterparty output):
- ORN: ${ERUDITE_ORN}
- BRN: ${ERUDITE_BRN}
- Establishment name contains "erudite" (case-insensitive)
- Email domain: @erudite-estate.com

Form I structure: two columns — Agent A (Seller's Agent) and Agent B (Buyer's Agent).
Identify which column belongs to Erudite and which belongs to the counterparty.

Return this exact JSON with no extra fields:
{
  "erudite_side": "seller",
  "their_side": "buyer",
  "counterparty": {
    "establishment": "",
    "address": "",
    "phone": "",
    "mobile": "",
    "fax": "",
    "email": "",
    "orn": "",
    "ded": "",
    "poBox": "",
    "agentName": "",
    "brn": "",
    "dateIssued": "",
    "agentMobile": "",
    "agentEmail": ""
  },
  "erudite": {
    "establishment": "",
    "orn": "",
    "agentName": "",
    "brn": ""
  }
}

STRICT RULES:
1. erudite_side is "seller" if Erudite is Agent A, "buyer" if Agent B. their_side is always the opposite.
2. Use empty string "" for any field not explicitly present in the document.
3. NEVER copy a field label as its own value (e.g. do not put "Establishment" as the value of establishment).
4. NEVER invent, infer, or guess values not present in the text.
5. NEVER copy boilerplate form text or legal clauses as field values.
6. Extract only concrete values — names, numbers, addresses, emails — as printed in the document.`;

// ─── HTTP handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate */ }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const url = new URL(req.url);
  const fileUrl = (body.file_url as string | undefined) || url.searchParams.get('file_url') || null;
  let rawText = (body.text as string | undefined) || null;

  // ── PDF → text (unchanged from v1) ──────────────────────────────────────────
  if (!rawText) {
    if (!fileUrl) {
      return Response.json(
        { error: 'Provide file_url (Base44 storage URL of the Form I PDF) or a text body.' },
        { status: 400 }
      );
    }
    try {
      const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const r   = await extractText(pdf, { mergePages: true });
      rawText   = Array.isArray(r.text) ? r.text.join('\n') : (r.text as string);
    } catch (e) {
      return Response.json({
        error: 'PDF extraction failed',
        detail: String(e),
        hint: 'Retry with a { text: "..." } body, or verify the file_url is accessible.',
      }, { status: 422 });
    }
  }

  // ── Debug mode — return raw text for inspection (unchanged from v1) ─────────
  if (body.debug === true) {
    return Response.json({
      parser_version: 'v2-form-i-ai',
      raw_text_length: rawText.length,
      raw_text_first_4000: rawText.slice(0, 4000),
      raw_text_full: rawText.length <= 8000 ? rawText : undefined,
    });
  }

  const text = normSpaces(rawText);
  const warnings: string[] = [];

  // Quick document-type check (no change from v1)
  const isFormI =
    /AGENT TO AGENT AGREEMENT/i.test(text) ||
    /FORM\s*I\s*[–\-]\s*SALES/i.test(text) ||
    /FORM\s*I\s*[\(\–]/i.test(text);

  if (!isFormI) {
    warnings.push(
      'Document header did not match expected Form I patterns ' +
      '("AGENT TO AGENT AGREEMENT" / "FORM I – SALES") — verify the correct PDF was uploaded.'
    );
  }

  // ── Anthropic API key check ──────────────────────────────────────────────────
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return Response.json({
      ok: false, is_form_i: isFormI,
      error: 'ANTHROPIC_API_KEY is not configured on this function.',
      warnings,
    }, { status: 500 });
  }

  // ── Claude API call ──────────────────────────────────────────────────────────
  let aiRawText = '';
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: AI_SYSTEM,
        messages: [{
          role: 'user',
          content: 'Extract from this Form I text:\n\n' + text.slice(0, 6000),
        }],
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => '');
      return Response.json({
        ok: false, is_form_i: isFormI,
        error: `Anthropic API returned HTTP ${apiRes.status}`,
        detail: errBody.slice(0, 500),
        warnings,
      });
    }

    const apiJson = await apiRes.json();
    aiRawText = apiJson?.content?.[0]?.text ?? '';
  } catch (e) {
    return Response.json({
      ok: false, is_form_i: isFormI,
      error: 'Anthropic API network error — check connectivity.',
      detail: String(e),
      warnings,
    });
  }

  // ── Parse AI response defensively ───────────────────────────────────────────
  let aiData: Record<string, unknown> | null = null;
  try {
    // Strip markdown fences if the model wrapped the JSON anyway
    const stripped = aiRawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/,        '')
      .trim();
    aiData = JSON.parse(stripped);
  } catch (_) {
    warnings.push('ai_parse_failed: AI response could not be parsed as JSON — fields left empty for manual entry.');
    if (body.debug_ai === true) {
      warnings.push('ai_raw_response: ' + aiRawText.slice(0, 800));
    }
    // Return ok:true with empty counterparty so the UI opens the review modal
    // with blank fields rather than crashing.
    return Response.json({
      parser_version: 'v2-form-i-ai',
      ok: true,
      is_form_i: isFormI,
      erudite_side: null,
      their_side: null,
      counterparty: {
        their_side: null,
        establishment: '', address: '', phone: '', mobile: '', fax: '',
        email: '', orn: '', ded: '', poBox: '', agentName: '',
        brn: '', dateIssued: '', agentMobile: '', agentEmail: '',
      },
      erudite: null,
      warnings,
      note: 'AI extraction failed — see warnings. Fill fields manually.',
    });
  }

  // ── Build + validate counterparty object ────────────────────────────────────
  const raw = (aiData?.counterparty ?? {}) as Record<string, unknown>;
  const cp: Record<string, string> = {
    establishment: blankEmpty(raw.establishment),
    address:       blankEmpty(raw.address),
    phone:         blankEmpty(raw.phone),
    mobile:        blankEmpty(raw.mobile),
    fax:           blankEmpty(raw.fax),
    email:         blankEmpty(raw.email),
    orn:           blankEmpty(raw.orn),
    ded:           blankEmpty(raw.ded),
    poBox:         blankEmpty(raw.poBox),
    agentName:     blankEmpty(raw.agentName),
    brn:           blankEmpty(raw.brn),
    dateIssued:    blankEmpty(raw.dateIssued),
    agentMobile:   blankEmpty(raw.agentMobile),
    agentEmail:    blankEmpty(raw.agentEmail),
  };
  validateFields(cp, warnings);

  // ── Erudite side resolution ──────────────────────────────────────────────────
  const rawErudite = (aiData?.erudite ?? {}) as Record<string, unknown>;
  const erudite_side =
    aiData?.erudite_side === 'seller' ? 'seller' :
    aiData?.erudite_side === 'buyer'  ? 'buyer'  : null;
  const their_side =
    aiData?.their_side === 'seller' ? 'seller' :
    aiData?.their_side === 'buyer'  ? 'buyer'  : null;

  if (!erudite_side || !their_side) {
    warnings.push(
      'AI did not return a clear erudite_side / their_side — side-mismatch guard will not fire.'
    );
  } else if (erudite_side === their_side) {
    warnings.push(
      `AI returned both erudite_side and their_side as "${erudite_side}" — invalid. Side guard disabled.`
    );
  }

  // Minimal-data guard
  if (!cp.establishment && !cp.orn && !cp.agentName) {
    warnings.push(
      'No establishment name, ORN, or agent name found in the counterparty block. ' +
      'Verify this PDF is a Form I with Erudite as one of the two parties.'
    );
  }

  // ── Response (shape identical to v1) ────────────────────────────────────────
  return Response.json({
    parser_version: 'v2-form-i-ai',
    ok:           true,
    is_form_i:    isFormI,
    erudite_side,
    their_side,
    counterparty: {
      their_side,
      establishment: cp.establishment,
      address:       cp.address,
      phone:         cp.phone,
      mobile:        cp.mobile,
      fax:           cp.fax,
      email:         cp.email,
      orn:           cp.orn,
      ded:           cp.ded,
      poBox:         cp.poBox,
      agentName:     cp.agentName,
      brn:           cp.brn,
      dateIssued:    cp.dateIssued,
      agentMobile:   cp.agentMobile,
      agentEmail:    cp.agentEmail,
    },
    erudite: erudite_side ? {
      erudite_side,
      establishment: blankEmpty(rawErudite.establishment),
      orn:           blankEmpty(rawErudite.orn),
      agentName:     blankEmpty(rawErudite.agentName),
      brn:           blankEmpty(rawErudite.brn),
    } : null,
    warnings,
    note: erudite_side
      ? `Erudite is the ${erudite_side}'s agent. Counterparty (${their_side}'s agent) details extracted — review before use.`
      : 'Side detection incomplete — see warnings.',
  });
});
