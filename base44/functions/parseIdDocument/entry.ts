// parseIdDocument v1 — UAE Emirates ID / passport extraction via Anthropic vision.
//
// Mirrors the proven parseFormI engine: native Anthropic document/image block,
// chunked 8KB base64 encoding, robust JSON parse (strip fences → direct →
// first-{ to last-} fallback), iterates content[] for type==="text" rather than
// blindly reading content[0]. Returns owner-identity fields the Lease Brokerage
// PDF reads + extra fields (emirates_id, date_of_birth, id_expiry_date) which
// the Landlord schema may or may not store today.
//
// Input  (POST JSON): { file_url, debug?, debug_ai? }
// Output (JSON):
//   {
//     parser_version: 'v1-id-vision',
//     ok: true,
//     is_id_document: bool,
//     doc_type: 'emirates_id' | 'passport' | 'unknown',
//     owner: { full_name_en, full_name_ar, nationality, emirates_id,
//              passport_no, date_of_birth, id_expiry_date },
//     anthropic_http_status: number | null,
//     warnings: string[],
//     note: string,
//   }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function blankEmpty(v) {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t || t === '-' || t === '_' || t.toLowerCase() === 'n/a' || t === 'N/A') return '';
  return t;
}

// Chunked base64 encoder — required for large files; Array.from().map().join()
// or apply()-spread on a Uint8Array blows the call-stack at ~100 KB.
function toBase64(bytes) {
  const CHUNK = 8192;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Detect document kind from URL/extension OR content-type header (the URL may
// have query params or no extension at all if it's a Base44 file_url).
function detectKind(fileUrl, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('application/pdf')) return { kind: 'pdf', mediaType: 'application/pdf' };
  if (ct.includes('image/png'))       return { kind: 'image', mediaType: 'image/png' };
  if (ct.includes('image/jpeg') || ct.includes('image/jpg'))
                                      return { kind: 'image', mediaType: 'image/jpeg' };
  if (ct.includes('image/webp'))      return { kind: 'image', mediaType: 'image/webp' };

  // Fall back to extension sniffing
  const lower = fileUrl.toLowerCase().split('?')[0];
  if (lower.endsWith('.pdf'))                          return { kind: 'pdf', mediaType: 'application/pdf' };
  if (lower.endsWith('.png'))                          return { kind: 'image', mediaType: 'image/png' };
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { kind: 'image', mediaType: 'image/jpeg' };
  if (lower.endsWith('.webp'))                         return { kind: 'image', mediaType: 'image/webp' };
  return null;
}

// ─── System prompt sent to Claude ────────────────────────────────────────────
const AI_SYSTEM = `You are a document extraction assistant for a Dubai real estate CRM.
Extract owner identity from a UAE Emirates ID (front and/or back) OR a passport biodata page.

Return ONLY a raw JSON object — no markdown fences, no explanation, no text before or after the JSON.

Return this exact JSON with no extra fields:
{
  "is_id_document": true,
  "doc_type": "emirates_id",
  "owner": {
    "full_name_en": "",
    "full_name_ar": "",
    "nationality": "",
    "emirates_id": "",
    "passport_no": "",
    "date_of_birth": "",
    "id_expiry_date": ""
  }
}

DETECTION:
- doc_type = "emirates_id" if you see "United Arab Emirates" + an ID Number in 784-YYYY-NNNNNNN-N format, or the gold/silver UAE ID card layout.
- doc_type = "passport" if you see a passport biodata page (MRZ at bottom, country code, passport number, dates).
- doc_type = "unknown" + is_id_document=false if the document is neither an Emirates ID nor a passport.

FIELD RULES:
1. full_name_en: the Latin-script full name exactly as printed.
2. full_name_ar: the Arabic-script name if present, else "".
3. nationality: the country printed on the document (e.g. "United Arab Emirates", "India", "Pakistan", "United Kingdom"). For passports use the issuing country.
4. emirates_id: ONLY if Emirates ID — the 784-YYYY-NNNNNNN-N number. Empty string for passports.
5. passport_no: ONLY if passport — as printed. Empty string for Emirates IDs.
6. date_of_birth: as printed on the doc (string — do NOT reformat or convert).
7. id_expiry_date: the document's expiry/validity date as printed (string — do NOT reformat).

STRICT RULES:
- Use empty string "" for any field you cannot read with confidence.
- NEVER invent values or guess. Only extract what is printed.
- NEVER copy field labels (e.g. "Name", "Date of Birth") as values.
- Extract only concrete printed text. If a field is illegible, return "".`;

// ─── HTTP handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate */ }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch (_) {}

  const url = new URL(req.url);
  const fileUrl = body.file_url || url.searchParams.get('file_url') || null;

  if (!fileUrl) {
    return Response.json({ error: 'file_url is required (PDF or image of ID/passport).' }, { status: 400 });
  }

  // ── Fetch file bytes + detect kind ───────────────────────────────────────
  let bytes;
  let kind;
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return Response.json({
        error: `Failed to fetch file — HTTP ${res.status}`,
        anthropic_http_status: null,
      }, { status: 422 });
    }
    const contentType = res.headers.get('content-type');
    bytes = new Uint8Array(await res.arrayBuffer());
    kind = detectKind(fileUrl, contentType);
    if (!kind) {
      return Response.json({
        error: 'Unsupported file type — accepted: PDF, JPG, PNG, WebP.',
        content_type: contentType,
        anthropic_http_status: null,
      }, { status: 422 });
    }
  } catch (e) {
    return Response.json({
      error: 'Failed to fetch file.',
      detail: String(e),
      anthropic_http_status: null,
    }, { status: 422 });
  }

  const warnings = [];

  // ── Anthropic API key check ──────────────────────────────────────────────
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return Response.json({
      ok: false,
      is_id_document: false,
      error: 'ANTHROPIC_API_KEY is not configured on this function.',
      warnings,
    }, { status: 500 });
  }

  // ── Base64-encode for Anthropic content block ────────────────────────────
  let fileBase64;
  try {
    fileBase64 = toBase64(bytes);
  } catch (e) {
    return Response.json({
      ok: false,
      is_id_document: false,
      error: 'Failed to base64-encode file.',
      detail: String(e),
      warnings,
    }, { status: 422 });
  }

  // ── Build the Anthropic content block (document vs image) ────────────────
  const fileBlock = kind.kind === 'pdf'
    ? {
        type: 'document',
        source: { type: 'base64', media_type: kind.mediaType, data: fileBase64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: kind.mediaType, data: fileBase64 },
      };

  const anthropicHeaders = {
    'x-api-key': anthropicApiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
  // Beta header only needed for PDF documents
  if (kind.kind === 'pdf') anthropicHeaders['anthropic-beta'] = 'pdfs-2024-09-25';

  // ── Claude API call ──────────────────────────────────────────────────────
  let aiRawText = '';
  let anthropicHttpStatus = null;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: AI_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: 'Extract the owner identity fields from this ID/passport image or PDF and return the JSON as instructed.',
            },
          ],
        }],
      }),
    });

    anthropicHttpStatus = apiRes.status;

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => '');
      return Response.json({
        ok: false,
        is_id_document: false,
        error: `Anthropic API returned HTTP ${apiRes.status}`,
        detail: errBody.slice(0, 500),
        anthropic_http_status: apiRes.status,
        warnings,
      });
    }

    const apiJson = await apiRes.json();
    // Iterate content[] for the first text block (mirrors parseFormI's fix).
    aiRawText = Array.isArray(apiJson?.content)
      ? apiJson.content
          .filter((c) => c?.type === 'text')
          .map((c) => (typeof c?.text === 'string' ? c.text : ''))
          .join('')
          .trim()
      : '';
  } catch (e) {
    return Response.json({
      ok: false,
      is_id_document: false,
      error: 'Anthropic API network error — check connectivity.',
      detail: String(e),
      anthropic_http_status: anthropicHttpStatus,
      warnings,
    });
  }

  // ── Robust JSON parse (mirrors parseFormI: strip fences → direct → first-{ to last-}) ──
  let aiData = null;
  try {
    const stripped = aiRawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    try {
      aiData = JSON.parse(stripped);
    } catch (_) {
      const first = stripped.indexOf('{');
      const last  = stripped.lastIndexOf('}');
      if (first === -1 || last === -1 || last <= first) {
        throw new Error('No JSON object found in AI response.');
      }
      aiData = JSON.parse(stripped.slice(first, last + 1));
    }
  } catch (_) {
    warnings.push('ai_parse_failed: AI response could not be parsed as JSON — fields left empty for manual entry.');
    if (body.debug_ai === true) {
      warnings.push('ai_raw_response: ' + aiRawText.slice(0, 800));
    }
    return Response.json({
      parser_version: 'v1-id-vision',
      ok: true,
      is_id_document: false,
      doc_type: 'unknown',
      owner: {
        full_name_en: '', full_name_ar: '', nationality: '',
        emirates_id: '', passport_no: '',
        date_of_birth: '', id_expiry_date: '',
      },
      anthropic_http_status: anthropicHttpStatus,
      warnings,
      note: 'AI extraction failed — see warnings. Fill fields manually.',
      ai_raw_response_debug: aiRawText.slice(0, 2000),
    });
  }

  // ── Normalize doc_type + is_id_document ──────────────────────────────────
  const rawDocType = typeof aiData?.doc_type === 'string' ? aiData.doc_type.toLowerCase().trim() : '';
  const doc_type =
    rawDocType === 'emirates_id' ? 'emirates_id' :
    rawDocType === 'passport'    ? 'passport'    : 'unknown';
  const is_id_document = doc_type !== 'unknown' && aiData?.is_id_document !== false;

  // ── Build + sanity-check owner object ────────────────────────────────────
  const rawOwner = (aiData?.owner ?? {});
  const owner = {
    full_name_en:   blankEmpty(rawOwner.full_name_en),
    full_name_ar:   blankEmpty(rawOwner.full_name_ar),
    nationality:    blankEmpty(rawOwner.nationality),
    emirates_id:    blankEmpty(rawOwner.emirates_id),
    passport_no:    blankEmpty(rawOwner.passport_no),
    date_of_birth:  blankEmpty(rawOwner.date_of_birth),
    id_expiry_date: blankEmpty(rawOwner.id_expiry_date),
  };

  // Cross-field consistency warnings (don't mutate, just flag)
  if (doc_type === 'emirates_id' && owner.passport_no) {
    warnings.push('doc_type is emirates_id but passport_no was also extracted — verify which is correct.');
  }
  if (doc_type === 'passport' && owner.emirates_id) {
    warnings.push('doc_type is passport but emirates_id was also extracted — verify which is correct.');
  }
  if (doc_type === 'emirates_id' && owner.emirates_id && !/^784[- ]?\d{4}[- ]?\d{7}[- ]?\d$/.test(owner.emirates_id)) {
    warnings.push(`emirates_id "${owner.emirates_id}" does not match the expected 784-YYYY-NNNNNNN-N format — verify before saving.`);
  }
  if (!owner.full_name_en) {
    warnings.push('full_name_en is empty — owner name could not be extracted. Manual entry required.');
  }

  return Response.json({
    parser_version: 'v1-id-vision',
    ok: true,
    is_id_document,
    doc_type,
    owner,
    anthropic_http_status: anthropicHttpStatus,
    warnings,
    note: is_id_document
      ? `Identified as ${doc_type === 'emirates_id' ? 'Emirates ID' : 'passport'}. Review extracted fields before saving.`
      : 'Document not recognised as Emirates ID or passport.',
  });
});