import { extractText, getDocumentProxy } from 'npm:unpdf';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PARSER_VERSION = 'v1-form-f';

// ---- helpers (mirrored from parseFormA) ----
const normSpaces = (s) =>
  (s || '')
    .replace(/\u00a0/g, ' ')   // NBSP
    .replace(/\u00ad/g, '')    // soft hyphen
    .replace(/[ \t]+/g, ' ');

// carve the block between two anchor strings (first occurrence)
function between(text, start, end) {
  const i = text.indexOf(start);
  if (i < 0) return '';
  const from = i + start.length;
  const j = end ? text.indexOf(end, from) : -1;
  return j < 0 ? text.slice(from) : text.slice(from, j);
}

// first-capture-group matcher against a source string
function f(pattern, src) {
  const m = new RegExp(pattern).exec(src || '');
  return m && m[1] ? m[1].trim() : null;
}

// first ALL-CAPS Latin name run in a block (fallback for names)
function firstAllCaps(src) {
  const m = /([A-Z][A-Z .'\-]{3,})/.exec(src || '');
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

// boundary: stop at next non-ASCII (Arabic) char, newline, or EOL
const TERM = "(?=[^\\x00-\\x7f]|\\n|$)";

const num = (s) =>
  s == null ? null : Number(String(s).replace(/,/g, '')) || null;

function toISO(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(ddmmyyyy);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`;
}

// ---- the extraction core ----
function parseFormF(raw) {
  const text = normSpaces(raw);

  // Section blocks (anchors verified against real Form F text stream)
  const ownerBlock  = between(text, 'Owner Details', 'Buyers Share Details');
  const buyerBlock  = between(text, 'Buyers Share Details', 'Buyer 1');      // 'Buyer 1 of 1' follows
  const buyerBlockA = between(text, 'Buyers Share Details', 'Person Details'); // fallback boundary
  const propBlock   = between(text, 'Property Details', 'Additional Information');
  const finBlock    = between(text, 'Property Financial Information', 'Escrowee');
  const contractBlk = between(text, 'Contract Information', 'Owner Details');

  // Seller (Owner Details → "Seller Name <arabic> <LATIN NAME> ...")
  const seller_name =
    f("Seller Name[^A-Z]*([A-Z][A-Z .'\\-]+?)" + TERM, ownerBlock) ||
    firstAllCaps(ownerBlock);

  // Buyer (Buyers Share Details → "Buyer Name <arabic> <LATIN NAME>")
  const buyerSrc = buyerBlock || buyerBlockA;
  const buyer_name =
    f("Buyer Name[^A-Z]*([A-Z][A-Z .'\\-]+?)" + TERM, buyerSrc) ||
    firstAllCaps(buyerSrc);

  // Price (Financial block, tight anchor; .\d{2} avoids deposit/tenancy decoys)
  const sell_price_aed = num(f("Sell Price AED\\s+([\\d,]+\\.\\d{2})", finBlock || text));

  // Property / unit
  const property_number = f("Property\\s+Number\\s+(\\d+)", propBlock);
  const building_name   = f("Building Name\\s+([A-Za-z0-9 .'\\-]+?)" + TERM, propBlock);
  const project_name    = f("Project Name\\s+([A-Za-z0-9 .'\\-]+?)" + TERM, propBlock);
  const floor_number    = f("Floor\\s+Number\\s+(\\d+)", propBlock);

  // Dates (Contract Information). Real Form F reverses these: the value
  // precedes the label ("21/05/2026 Date Start"). Try reversed first, then
  // forward layout as a fallback for other exports.
  const dsrc = contractBlk || text;
  const start_date =
    f("(\\d{2}/\\d{2}/\\d{4})\\s+Date Start", dsrc) ||
    f("Start Date\\s+(\\d{2}/\\d{2}/\\d{4})", dsrc);
  const end_date =
    f("(\\d{2}/\\d{2}/\\d{4})\\s+Date End", dsrc) ||
    f("End Date\\s+(\\d{2}/\\d{2}/\\d{4})", dsrc);
  const contract_number = f("Contract Number\\s+([A-Z]{2}\\d+)", dsrc);

  // Compose a unit reference: prefer property number; include building for context
  const unit_reference =
    property_number
      ? (building_name ? `${building_name} - ${property_number}` : property_number)
      : null;

  return {
    contract_number,
    buyer_name,
    seller_name,
    property_number,
    building_name,
    project_name,
    floor_number,
    unit_reference,
    sell_price_aed,
    start_date: toISO(start_date),
    end_date: toISO(end_date),
    // raw date strings kept for the notes append (human-readable)
    start_date_raw: start_date,
    end_date_raw: end_date,
  };
}

// ---- HTTP handler ----
Deno.serve(async (req) => {
  try {
    // soft auth — mirror parseFormA; do NOT 403 (per-lead context, caller already authed)
    try { await globalThis.base44?.auth?.me?.(); } catch (_) { /* allow */ }

    const url = new URL(req.url);
    let body = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch (_) { body = {}; } }

    const fileUrl    = body.file_url || url.searchParams.get('file_url') || null;
    const lead_id    = body.lead_id  || null;
    const wantWrite  = body.confirm  === true;
    const inlineText = body.text     || null;

    if (!fileUrl && !inlineText) {
      return Response.json({ error: 'Provide file_url (PDF) or text' }, { status: 400 });
    }
    if (wantWrite && !lead_id) {
      return Response.json({ error: 'lead_id required to write' }, { status: 400 });
    }

    // PDF -> text
    let rawText = inlineText || '';
    if (!rawText && fileUrl) {
      try {
        const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const r   = await extractText(pdf, { mergePages: true });
        rawText   = Array.isArray(r.text) ? r.text.join('\n') : r.text;
      } catch (e) {
        return Response.json(
          { error: 'PDF extraction failed', detail: String(e), hint: 'Retry with a {text} body.' },
          { status: 422 },
        );
      }
    }

    const extracted = parseFormF(rawText);

    // Build the proposed Lead patch from extracted values (only non-null)
    const proposed = {};
    if (extracted.buyer_name)     proposed.full_name            = extracted.buyer_name;
    if (extracted.sell_price_aed) proposed.deal_value_aed       = extracted.sell_price_aed;
    if (extracted.unit_reference) proposed.closing_property_ref = extracted.unit_reference;
    if (extracted.project_name)   proposed.closing_project_id   = extracted.project_name; // NAME as-is (v1)

    // seller + date appended to notes at write time so we merge, not overwrite
    const noteLine =
      `Form F ${extracted.contract_number || ''}`.trim() +
      (extracted.seller_name  ? ` — Seller: ${extracted.seller_name}`    : '') +
      (extracted.start_date_raw ? ` — Start: ${extracted.start_date_raw}` : '') +
      (extracted.end_date_raw   ? ` — End: ${extracted.end_date_raw}`     : '');

    const preview = {
      parser_version: PARSER_VERSION,
      mode: wantWrite ? undefined : 'preview_no_write',
      extracted,
      proposed_lead_updates: Object.keys(proposed).length ? proposed : null,
      proposed_note_append: noteLine || null,
      will_write_to: lead_id || null,
      written: null,
      warnings: [],
    };

    if (!extracted.buyer_name && !extracted.sell_price_aed && !extracted.unit_reference) {
      preview.warnings.push('No core fields extracted — check the PDF layout or use {text} fallback.');
    }

    if (!wantWrite) {
      return Response.json(preview);
    }

    // ---- write path (confirm === true) ----
    if (!preview.proposed_lead_updates && !preview.proposed_note_append) {
      return Response.json({ ...preview, mode: 'refused', reason: 'nothing_to_write' });
    }

    try {
      const base44 = createClientFromRequest(req);
      const svc  = base44.asServiceRole.entities;
      const lead = await svc.Lead.get(lead_id);

      const patch = { ...(preview.proposed_lead_updates || {}) };
      if (preview.proposed_note_append) {
        const existing = (lead && lead.notes) ? String(lead.notes).trim() : '';
        patch.notes = existing
          ? `${existing}\n${preview.proposed_note_append}`
          : preview.proposed_note_append;
      }

      await svc.Lead.update(lead_id, patch);

      return Response.json({
        ...preview,
        mode: 'written',
        written: { lead_id, fields: Object.keys(patch) },
      });
    } catch (e) {
      return Response.json({
        ...preview,
        mode: 'write_error',
        step: 'lead_update',
        error: String(e),
      });
    }
  } catch (e) {
    return Response.json({ error: 'Unhandled', detail: String(e) }, { status: 500 });
  }
});