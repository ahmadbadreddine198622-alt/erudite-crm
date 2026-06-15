import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { extractText, getDocumentProxy } from 'npm:unpdf';

// parseFormI v3 — PDF-document extraction via Anthropic's native PDF support.
//
// Sends the raw PDF bytes (base64-encoded) as an Anthropic "document" content
// block so Claude reads the actual two-column Form I layout rather than
// flattened text. Fixes field misassignment caused by unpdf collapsing the
// two-column layout (brn, dateIssued, agentMobile, agentEmail came back empty
// or landed in the wrong party block when using text extraction).
//
// Input (POST JSON): { file_url, debug?, debug_ai? }
// Response shape: UNCHANGED from v1/v2 — FormIGenerator UI maps directly onto it.

const ERUDITE_ORN = '29322';
const ERUDITE_BRN = '34625';

function normSpaces(s: string): string {
  return s.replace(/ /g, ' ').replace(/­/g, '-');
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
Extract party details from a RERA Form I (Agent-to-Agent Agreement – Sales) PDF.

Return ONLY a raw JSON object — no markdown fences, no explanation, no text before or after the JSON.

ERUDITE REAL ESTATE is ONE of the two parties. Its identifiers:
- ORN: ${ERUDITE_ORN}
- BRN: ${ERUDITE_BRN}
- Establishment name contains "erudite" (case-insensitive)
- Email domain: @erudite-estate.com

Form I has two columns — Agent A (Seller's Agent) and Agent B (Buyer's Agent).
Each column has an "Authorised Agent" sub-section with the registered agent's name, BRN, date of issue, mobile, and email.

ASSIGNMENT RULES — critical:
- erudite{}: values from the column that belongs to Erudite ONLY.
- counterparty{}: values from the column that belongs to the OTHER party ONLY.
- NEVER put the counterparty's agent name, BRN, or any field into erudite{}.
- NEVER put Erudite's values into counterparty{}.
- If you cannot determine which column is Erudite, return erudite_side and their_side as null.

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
2. Use empty string "" for any field not found in that party's column.
3. NEVER copy a field label as its own value (e.g. do not put "Establishment" as the value of establishment).
4. NEVER invent, infer, or guess values not present in the document.
5. NEVER copy boilerplate form text or legal clauses as field values.
6. Extract only concrete values — names, numbers, addresses, emails — as printed.`;

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

  // ── Fetch PDF bytes ──────────────────────────────────────────────────────────
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
  } catch (e) {
    return Response.json({ error: 'Failed to fetch PDF.', detail: String(e) }, { status: 422 });
  }

  // ── Raw text extraction (for debug:true and is_form_i check only) ────────────
  // unpdf still used here, but is NOT the source of extracted field values.
  // Extraction is done by Claude reading the PDF document directly (below).
  let rawText = '';
  try {
    const pdf = await getDocumentProxy(pdfBytes);
    const r   = await extractText(pdf, { mergePages: true });
    rawText   = normSpaces(Array.isArray(r.text) ? r.text.join('\n') : (r.text as string));
  } catch (_) {
    rawText = '';
  }

  const warnings: string[] = [];

  const isFormI =
    /AGENT TO AGENT AGREEMENT/i.test(rawText) ||
    /FORM\s*I\s*[–\-]\s*SALES/i.test(rawText) ||
    /FORM\s*I\s*[\(\–]/i.test(rawText);

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

  // ── Base64-encode PDF for Anthropic document block ───────────────────────────
  let pdfBase64: string;
  try {
    const CHUNK = 8192;
    let binStr = '';
    for (let i = 0; i < pdfBytes.length; i += CHUNK) {
      binStr += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK));
    }
    pdfBase64 = btoa(binStr);
  } catch (e) {
    return Response.json({
      ok: false, is_form_i: isFormI,
      error: 'Failed to base64-encode PDF.',
      detail: String(e),
      warnings,
    }, { status: 422 });
  }

  // ── Claude API call with PDF document block ──────────────────────────────────
  let aiRawText = '';
  let anthropicHttpStatus: number | null = null;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: AI_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract the party details from this Form I PDF and return the JSON as instructed.',
            },
          ],
        }],
      }),
    });

    anthropicHttpStatus = apiRes.status;

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => '');
      const errResponse: Record<string, unknown> = {
        ok: false, is_form_i: isFormI,
        error: `Anthropic API returned HTTP ${apiRes.status}`,
        detail: errBody.slice(0, 500),
        anthropic_http_status: apiRes.status,
        warnings,
      };
      if (body.debug === true) {
        errResponse.raw_text_length = rawText.length;
        errResponse.raw_text_first_4000 = rawText.slice(0, 4000);
        if (rawText.length <= 8000) errResponse.raw_text_full = rawText;
      }
      return Response.json(errResponse);
    }

    const apiJson = await apiRes.json();
    aiRawText = apiJson?.content?.[0]?.text ?? '';
  } catch (e) {
    const errResponse: Record<string, unknown> = {
      ok: false, is_form_i: isFormI,
      error: 'Anthropic API network error — check connectivity.',
      detail: String(e),
      anthropic_http_status: anthropicHttpStatus,
      warnings,
    };
    if (body.debug === true) {
      errResponse.raw_text_length = rawText.length;
      errResponse.raw_text_first_4000 = rawText.slice(0, 4000);
      if (rawText.length <= 8000) errResponse.raw_text_full = rawText;
    }
    return Response.json(errResponse);
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
    const failResponse: Record<string, unknown> = {
      parser_version: 'v3-form-i-vision',
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
      ai_raw_response_debug: aiRawText.slice(0, 2000),
      anthropic_http_status: anthropicHttpStatus,
    };
    if (body.debug === true) {
      failResponse.raw_text_length = rawText.length;
      failResponse.raw_text_first_4000 = rawText.slice(0, 4000);
      if (rawText.length <= 8000) failResponse.raw_text_full = rawText;
    }
    return Response.json(failResponse);
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

  // ── Response (shape identical to v1/v2, plus raw_text fields when debug:true) ──
  const response: Record<string, unknown> = {
    parser_version: 'v3-form-i-vision',
    ok:           true,
    is_form_i:    isFormI,
    erudite_side,
    their_side,
    anthropic_http_status: anthropicHttpStatus,
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
  };

  // Add raw text fields for debugging when debug:true
  if (body.debug === true) {
    response.raw_text_length = rawText.length;
    response.raw_text_first_4000 = rawText.slice(0, 4000);
    if (rawText.length <= 8000) {
      response.raw_text_full = rawText;
    }
  }

  return Response.json(response);
});