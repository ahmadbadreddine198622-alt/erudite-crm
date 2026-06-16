import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { extractText, getDocumentProxy } from 'npm:unpdf';

// parseTitleDeed v2 — Vision-based extraction from Dubai DLD Title Deed PDFs.
//
// DLD title deeds are bilingual (Arabic + English) and their two-column layout
// collapses badly when text-extracted. We send the raw PDF bytes as an Anthropic
// native "document" content block so Claude reads the actual certificate layout.
//
// v2 change: returns "owners" array with ALL owner names from the ownership
// section. Single-owner deeds return a 1-element array. ownerName stays for
// backward compat (set to owners[0]).
//
// Input (POST JSON): { file_url, debug? }
// Response shape: { ok, is_title_deed, owners[], property{...}, warnings[], note }

// ─── System prompt ─────────────────────────────────────────────────────────────
const AI_SYSTEM = `You are a document extraction assistant for a Dubai real estate CRM.
Extract property and ownership details from a Dubai Land Department (DLD) Title Deed certificate.

Return ONLY a raw JSON object — no markdown fences, no explanation, no text before or after the JSON.

The certificate is bilingual (Arabic + English). Read ONLY the English text; ignore the Arabic mirror text entirely.

The deed may list multiple owners. In the "Owners numbers and their shares" section, look for every owner name and collect them all.

Return this exact JSON with no extra fields:
{
  "issueDate": "",
  "propertyType": "",
  "community": "",
  "plotNo": "",
  "municipalityNo": "",
  "buildingNo": "",
  "buildingName": "",
  "propertyNo": "",
  "floorNo": "",
  "parkings": "",
  "suiteAreaSqm": "",
  "balconyAreaSqm": "",
  "areaSqm": "",
  "areaSqft": "",
  "commonAreaSqm": "",
  "mortgageStatus": "",
  "ownerName": "",
  "owners": [],
  "ownerIdNumber": "",
  "ownerSharePct": "",
  "purchasedFrom": "",
  "landRegistrationNo": "",
  "purchaseAmountAed": "",
  "certificateNo": ""
}

Field guidance:
- issueDate: the date of issue printed on the certificate (DD/MM/YYYY format if present)
- propertyType: e.g. "Flat", "Villa", "Land", "Office" — as printed in English
- community: the community/area name (e.g. "Marsa Dubai", "Downtown Dubai")
- plotNo: the plot number
- municipalityNo: the municipality number (often formatted like "392-5335")
- buildingNo: numeric building identifier (separate from building name)
- buildingName: full building name in English (e.g. "THE RESIDENCES AT MARINA GATE 1")
- propertyNo: the property/unit number within the building
- floorNo: floor number
- parkings: parking space designation (e.g. "P5-020")
- suiteAreaSqm: suite/interior area in square metres
- balconyAreaSqm: balcony area in square metres
- areaSqm: total area in square metres
- areaSqft: total area in square feet
- commonAreaSqm: common area in square metres
- mortgageStatus: mortgage status as printed (e.g. "Not mortgaged", "Mortgaged")
- ownerName: the FIRST owner's full name in English (ALL CAPS as printed) — same as owners[0]
- owners: EVERY owner full name found in the ownership section, as a string array. If only one owner, return a single-element array. NEVER invent names — only include names explicitly printed in the document. Preserve the order shown on the deed.
- ownerIdNumber: owner Emirates ID or passport number as printed
- ownerSharePct: ownership share percentage as a plain string (e.g. "100" not "100%")
- purchasedFrom: name of the seller/developer the owner purchased from
- landRegistrationNo: land/title registration number (e.g. "13624/2016")
- purchaseAmountAed: purchase price in AED as a plain number string (digits only, no commas or currency symbols)
- certificateNo: certificate or document number (e.g. "73953/2018")

STRICT RULES:
1. Use empty string "" for any field not explicitly present in the document.
2. owners must always be an array — use empty array [] only if absolutely zero owner names are found.
3. NEVER copy a field label as its own value.
4. NEVER invent, infer, or guess values not printed in the document.
5. NEVER copy boilerplate legal text as field values.
6. All numbers must be plain strings — no commas, no currency symbols, no units.
7. ownerSharePct: digits only, no "%" sign.
8. purchaseAmountAed: digits only (e.g. "1563925" not "1,563,925 AED").`;

// ─── HTTP handler ─────────────────────────────────────────────────────────────
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
    return Response.json(
      { error: 'Provide file_url (Base44 storage URL of the Title Deed PDF).' },
      { status: 400 }
    );
  }

  // ── Fetch PDF bytes ──────────────────────────────────────────────────────────
  let pdfBytes;
  try {
    pdfBytes = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
  } catch (e) {
    return Response.json({ error: 'Failed to fetch PDF.', detail: String(e) }, { status: 422 });
  }

  // ── Raw text extraction (for debug:true and is_title_deed check only) ────────
  let rawText = '';
  try {
    const pdf = await getDocumentProxy(pdfBytes);
    const r   = await extractText(pdf, { mergePages: true });
    rawText   = Array.isArray(r.text) ? r.text.join('\n') : r.text;
  } catch (_) {
    rawText = '';
  }

  const warnings = [];

  const isTitleDeed =
    /title\s*deed/i.test(rawText) ||
    /dubai\s*land\s*department/i.test(rawText) ||
    /dld/i.test(rawText) ||
    /\bDLD\b/.test(rawText);

  if (!isTitleDeed) {
    warnings.push(
      'Document header did not match expected Title Deed patterns ' +
      '("Title Deed" / "Dubai Land Department") — verify the correct PDF was uploaded.'
    );
  }

  // ── Anthropic API key check ──────────────────────────────────────────────────
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return Response.json({
      ok: false,
      is_title_deed: isTitleDeed,
      error: 'ANTHROPIC_API_KEY is not configured on this function.',
      warnings,
    }, { status: 500 });
  }

  // ── Base64-encode PDF for Anthropic document block ───────────────────────────
  let pdfBase64;
  try {
    const binStr = Array.from(pdfBytes).map(b => String.fromCharCode(b)).join('');
    pdfBase64 = btoa(binStr);
  } catch (e) {
    return Response.json({
      ok: false,
      is_title_deed: isTitleDeed,
      error: 'Failed to base64-encode PDF.',
      detail: String(e),
      warnings,
    }, { status: 422 });
  }

  // ── Claude API call with PDF document block ──────────────────────────────────
  let aiRawText = '';
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
              text: 'Extract the property and ownership details from this Dubai DLD Title Deed and return the JSON as instructed.',
            },
          ],
        }],
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => '');
      const errResponse = {
        ok: false,
        is_title_deed: isTitleDeed,
        error: `Anthropic API returned HTTP ${apiRes.status}`,
        detail: errBody.slice(0, 500),
        warnings,
      };
      if (body.debug === true && rawText) {
        errResponse.raw_text_length = rawText.length;
        errResponse.raw_text_first_4000 = rawText.slice(0, 4000);
        if (rawText.length <= 8000) errResponse.raw_text_full = rawText;
      }
      return Response.json(errResponse);
    }

    const apiJson = await apiRes.json();
    aiRawText = apiJson?.content?.[0]?.text ?? '';
  } catch (e) {
    const errResponse = {
      ok: false,
      is_title_deed: isTitleDeed,
      error: 'Anthropic API network error — check connectivity.',
      detail: String(e),
      warnings,
    };
    if (body.debug === true && rawText) {
      errResponse.raw_text_length = rawText.length;
      errResponse.raw_text_first_4000 = rawText.slice(0, 4000);
      if (rawText.length <= 8000) errResponse.raw_text_full = rawText;
    }
    return Response.json(errResponse);
  }

  // ── Parse AI response defensively ───────────────────────────────────────────
  const emptyProperty = {
    issueDate: '', propertyType: '', community: '', plotNo: '',
    municipalityNo: '', buildingNo: '', buildingName: '', propertyNo: '',
    floorNo: '', parkings: '', suiteAreaSqm: '', balconyAreaSqm: '',
    areaSqm: '', areaSqft: '', commonAreaSqm: '', mortgageStatus: '',
    ownerName: '', ownerIdNumber: '', ownerSharePct: '', purchasedFrom: '',
    landRegistrationNo: '', purchaseAmountAed: '', certificateNo: '',
  };

  let aiData = null;
  try {
    const stripped = aiRawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    aiData = JSON.parse(stripped);
  } catch (_) {
    warnings.push('ai_parse_failed: AI response could not be parsed as JSON — fields left empty for manual entry.');
    if (body.debug_ai === true) {
      warnings.push('ai_raw_response: ' + aiRawText.slice(0, 800));
    }
    const failResponse = {
      parser_version: 'v2-title-deed-vision',
      ok: true,
      is_title_deed: isTitleDeed,
      owners: [],
      property: emptyProperty,
      warnings,
      note: 'AI extraction failed — see warnings. Fill fields manually.',
    };
    if (body.debug === true && rawText) {
      failResponse.raw_text_length = rawText.length;
      failResponse.raw_text_first_4000 = rawText.slice(0, 4000);
      if (rawText.length <= 8000) failResponse.raw_text_full = rawText;
    }
    return Response.json(failResponse);
  }

  // ── Build + validate property object ────────────────────────────────────────
  const raw = aiData ?? {};
  const property = {
    issueDate: String(raw.issueDate || ''),
    propertyType: String(raw.propertyType || ''),
    community: String(raw.community || ''),
    plotNo: String(raw.plotNo || ''),
    municipalityNo: String(raw.municipalityNo || ''),
    buildingNo: String(raw.buildingNo || ''),
    buildingName: String(raw.buildingName || ''),
    propertyNo: String(raw.propertyNo || ''),
    floorNo: String(raw.floorNo || ''),
    parkings: String(raw.parkings || ''),
    suiteAreaSqm: String(raw.suiteAreaSqm || ''),
    balconyAreaSqm: String(raw.balconyAreaSqm || ''),
    areaSqm: String(raw.areaSqm || ''),
    areaSqft: String(raw.areaSqft || ''),
    commonAreaSqm: String(raw.commonAreaSqm || ''),
    mortgageStatus: String(raw.mortgageStatus || ''),
    ownerName: String(raw.ownerName || ''),
    ownerIdNumber: String(raw.ownerIdNumber || ''),
    ownerSharePct: String(raw.ownerSharePct || ''),
    purchasedFrom: String(raw.purchasedFrom || ''),
    landRegistrationNo: String(raw.landRegistrationNo || ''),
    purchaseAmountAed: String(raw.purchaseAmountAed || ''),
    certificateNo: String(raw.certificateNo || ''),
  };

  // ── Build owners array ──────────────────────────────────────────────────────
  let rawOwners = raw.owners;
  if (!Array.isArray(rawOwners)) {
    rawOwners = [];
  }
  // Filter out empties and trim
  const owners = rawOwners
    .map(n => String(n || '').trim())
    .filter(n => n.length > 0);

  // Backward compat: if owners[] is non-empty but ownerName is blank, use owners[0]
  if (!property.ownerName && owners.length > 0) {
    property.ownerName = owners[0];
  }
  // If ownerName is set but owners is empty, seed owners from ownerName
  if (owners.length === 0 && property.ownerName) {
    owners.push(property.ownerName);
  }

  // Minimal-data guard
  if (!property.ownerName && !property.buildingName && !property.certificateNo) {
    warnings.push(
      'No owner name, building name, or certificate number found. ' +
      'Verify this PDF is a DLD Title Deed.'
    );
  }

  // ── Response ─────────────────────────────────────────────────────────────────
  const response = {
    parser_version: 'v2-title-deed-vision',
    ok: true,
    is_title_deed: isTitleDeed,
    owners,
    property,
    warnings,
    note: isTitleDeed
      ? 'Title Deed detected — property and ownership details extracted. Review before use.'
      : 'Document type unclear — see warnings.',
  };

  if (body.debug === true && rawText) {
    response.raw_text_length = rawText.length;
    response.raw_text_first_4000 = rawText.slice(0, 4000);
    if (rawText.length <= 8000) {
      response.raw_text_full = rawText;
    }
  }

  return Response.json(response);
});