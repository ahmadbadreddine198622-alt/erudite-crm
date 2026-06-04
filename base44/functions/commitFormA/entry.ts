import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Writes Form A mandate fields to the MATCHED landlord (the owner the parser
// resolved), NEVER the landlord whose card the PDF was uploaded to.
//
// It re-derives the match by calling parseFormA (single source of truth), so the
// write target is ALWAYS parser.match.landlord_id. PREVIEW by default; pass
// { confirm: true } to write. If an upload-location landlord id is supplied and
// differs from the matched id, it is flagged but the write still targets MATCHED.
//
// Input (POST JSON): { file_url | text, confirm?, expected_landlord_id? }

const PAGE = 200;
async function listAll(entity: any, filter: any) {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const b = await entity.filter(filter, '-created_date', PAGE, p * PAGE);
    out.push(...b);
    if (!b || b.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* none */ }
  const { file_url, text, confirm, expected_landlord_id } = body;
  if (!file_url && !text) return Response.json({ error: 'Provide file_url or text' }, { status: 400 });

  // ---- re-derive the match via parseFormA (the parser is the source of truth) ----
  const origin = new URL(req.url).origin;
  const auth = req.headers.get('Authorization') || '';
  let preview: any;
  try {
    const r = await fetch(`${origin}/functions/parseFormA`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ file_url, text }),
    });
    preview = await r.json();
  } catch (e) {
    return Response.json({ error: 'Could not reach parseFormA', detail: String(e) }, { status: 502 });
  }
  if (preview?.error) return Response.json({ error: 'parse failed', detail: preview }, { status: 422 });

  const match = preview.match || {};
  // Hard guard: no confident match => never write.
  if (!match.tier || !match.landlord_id) {
    return Response.json({ mode: 'refused', reason: 'no_confident_match', match, note: 'No write — owner was not confidently matched.' });
  }

  const matched_landlord_id = match.landlord_id;
  const warnings: string[] = [...(preview.warnings || [])];
  if (expected_landlord_id && expected_landlord_id !== matched_landlord_id) {
    warnings.push(
      `Upload-location landlord (${expected_landlord_id}) differs from the MATCHED landlord ` +
      `(${matched_landlord_id} / ${match.landlord_name}). Writing to the MATCHED landlord per policy; ` +
      `the upload location is ignored as a write target.`,
    );
  }

  const landlordUpdates = preview.proposed_landlord_updates;
  const lpUpdates = preview.proposed_landlordproperty_updates;
  const unit = preview.extracted?.property_number;
  const buildingName = preview.extracted?.building_name;

  // ---- preview (no write) ----
  if (!confirm) {
    return Response.json({
      mode: 'preview_no_write',
      will_write_to: { landlord_id: matched_landlord_id, landlord_name: match.landlord_name, matched_via: match.via, tier: match.tier },
      upload_location_landlord_id: expected_landlord_id || null,
      ignored_upload_location: !!(expected_landlord_id && expected_landlord_id !== matched_landlord_id),
      landlord_updates: landlordUpdates,
      landlordproperty_updates: lpUpdates,
      warnings,
      note: 'Nothing written. Re-call with { confirm: true } to write to the MATCHED landlord above.',
    });
  }

  // ---- WRITE — strictly to the matched landlord ----
  const svc = base44.asServiceRole.entities;
  const written: any = { landlord_id: matched_landlord_id, landlord_name: match.landlord_name, landlord_updated: false, landlordproperty_updated: false };

  if (landlordUpdates) {
    await svc.Landlord.update(matched_landlord_id, landlordUpdates);
    written.landlord_updated = true;
  }

  // title_deed / off-plan onto the matched landlord's link for this unit (best-effort)
  if (lpUpdates && unit) {
    const props = (await listAll(svc.Property, { unit_no: unit })).filter(
      (p: any) => !buildingName || String(p.building_name || '').toUpperCase() === String(buildingName).toUpperCase(),
    );
    for (const p of props) {
      const lps = await listAll(svc.LandlordProperty, { landlord_id: matched_landlord_id, property_id: p.id });
      if (lps.length) { await svc.LandlordProperty.update(lps[0].id, lpUpdates); written.landlordproperty_updated = true; written.landlordproperty_id = lps[0].id; break; }
    }
    if (!written.landlordproperty_updated) warnings.push('Could not locate the matched landlord’s LandlordProperty row for this unit; title-deed/off-plan not written.');
  }

  return Response.json({
    mode: 'written',
    written,
    warnings,
    note: `Mandate written to MATCHED landlord ${match.landlord_name} (${matched_landlord_id}). Upload location was not used as the write target.`,
  });
});
