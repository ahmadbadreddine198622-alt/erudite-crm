// generateTenancyContractPDF — overlay TenancyContract data on the official
// DLD Ejari Unified Tenancy Contract template (3-page A4 PDF).
//
// All three assets (template PDF, stamp PNG, signature PNG) are fetched at
// runtime from Base44 storage, keeping this function small enough to deploy.
//
// ONE-TIME SETUP (run once from the Tenancy Contracts page):
//   Click "Upload & Configure Assets" — the UI uploads the three files,
//   saves stamp/sig URLs to the EjariSetup entity, and shows the template URL
//   to copy into the EJARI_TEMPLATE_FILE_URL app secret.
//
// Input: { tenancyContractId } — also accepts { event: { entity_id } }
// Idempotent — regenerating overwrites pdf_url.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    return `${day} ${month} ${d.getUTCFullYear()}`;
  } catch { return String(s); }
}

function fmtAED(n) {
  if (n == null || n === '') return '';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '';
  return `AED ${num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeSeg(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'contract';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tenancyContractId =
      body?.tenancyContractId ||
      body?.tenancy_contract_id ||
      body?.event?.entity_id;

    if (!tenancyContractId) {
      return Response.json({ error: 'tenancyContractId is required' }, { status: 400 });
    }

    // Fetch the tenancy contract record
    const contracts = await base44.asServiceRole.entities.TenancyContract.filter({ id: tenancyContractId });
    const contract = contracts?.[0];
    if (!contract) {
      return Response.json({ error: 'TenancyContract not found' }, { status: 404 });
    }

    // ── Resolve asset URLs ───────────────────────────────────────────────
    // Template: prefer EJARI_TEMPLATE_FILE_URL secret, fall back to EjariSetup entity
    // Stamp / sig: from EjariSetup entity (uploaded once via the TenancyContracts setup UI)
    const setups = await base44.asServiceRole.entities.EjariSetup.filter({});
    const setup = setups?.[0];

    const templateUrl = Deno.env.get('EJARI_TEMPLATE_FILE_URL') || setup?.template_url;
    const stampUrl    = setup?.stamp_url;
    const sigUrl      = setup?.sig_url;

    if (!templateUrl) {
      return Response.json({
        error: 'Template not configured. Open the Tenancy Contracts page, click "Upload & Configure Assets", then set EJARI_TEMPLATE_FILE_URL to the displayed URL.',
      }, { status: 500 });
    }
    // Stamp/sig are optional — PDF is still valid without them

    // ── Fetch template (required) and brand assets (optional) ───────────
    const templateResp = await fetch(templateUrl);
    if (!templateResp.ok) throw new Error(`Template fetch failed: HTTP ${templateResp.status}`);
    const templateBytes = new Uint8Array(await templateResp.arrayBuffer());

    let stampBytes = null;
    let sigBytes   = null;
    if (stampUrl && sigUrl) {
      const [stampResp, sigResp] = await Promise.all([fetch(stampUrl), fetch(sigUrl)]);
      if (stampResp.ok) stampBytes = new Uint8Array(await stampResp.arrayBuffer());
      if (sigResp.ok)   sigBytes   = new Uint8Array(await sigResp.arrayBuffer());
    }

    // ── Load the official DLD Ejari template + embed brand assets ────────
    const pdf      = await PDFDocument.load(templateBytes);
    const pages    = pdf.getPages();
    if (!pages.length) return Response.json({ error: 'Template has no pages' }, { status: 500 });

    const page1    = pages[0];
    const font     = await pdf.embedFont(StandardFonts.Helvetica);
    const stampImg = stampBytes ? await pdf.embedPng(stampBytes) : null;
    const sigImg   = sigBytes   ? await pdf.embedPng(sigBytes)   : null;

    // Draw helper — origin is BOTTOM-LEFT in pdf-lib, Helvetica 9pt black
    const black = rgb(0, 0, 0);
    const draw = (text, x, y, size = 9) => {
      const s = text == null ? '' : String(text);
      if (!s) return;
      page1.drawText(s, { x, y, size, font, color: black });
    };

    // ── Page 1 overlay ───────────────────────────────────────────────────
    draw(fmtDate(contract.contract_date), 70, 722);

    // Lessor block
    draw(contract.owner_name,                 150, 659);
    draw(contract.lessor_name,                150, 637);
    draw(contract.lessor_emirates_id,         150, 614);
    draw(contract.lessor_license_no,          150, 592);
    draw(contract.lessor_licensing_authority, 360, 592);
    draw(contract.lessor_email,               150, 567);
    draw(contract.lessor_phone,               150, 545);

    // Tenant block
    draw(contract.tenant_name,                150, 489);
    draw(contract.tenant_emirates_id,         150, 467);
    draw(contract.tenant_license_no,          150, 444);
    draw(contract.tenant_licensing_authority, 360, 444);
    draw(contract.tenant_email,               150, 419);
    draw(contract.tenant_phone,               150, 397);

    // Property usage tick — pick the radio circle by enum
    const usage = String(contract.property_usage || '').toLowerCase();
    const usageX =
      usage === 'industrial'  ? 218 :
      usage === 'commercial'  ? 335 :
      usage === 'residential' ? 448 :
      null;
    if (usageX !== null) draw('X', usageX - 2, 339, 10);

    // Property block
    draw(contract.plot_no,              150, 317);
    draw(contract.makani_no,            360, 317);
    draw(contract.building_name,        150, 294);
    draw(contract.property_no,          360, 294);
    draw(contract.property_type,        150, 271);
    draw(contract.property_area_sqm != null ? String(contract.property_area_sqm) : '', 360, 271);
    draw(contract.location,             150, 248);
    draw(contract.dewa_premises_no,     360, 248);

    // Contract terms
    draw(fmtDate(contract.contract_period_from), 150, 184);
    draw(fmtDate(contract.contract_period_to),   240, 184);
    draw(fmtAED(contract.contract_value_aed),    360, 191);
    draw(fmtAED(contract.annual_rent_aed),       150, 167);
    draw(fmtAED(contract.security_deposit_aed),  360, 167);
    draw(contract.mode_of_payment,               150, 144);

    // Lessor signature block — stamp + signature bottom-right (skipped if not configured)
    if (stampImg) page1.drawImage(stampImg, { x: 360, y: 38, width: 72, height: 75 });
    if (sigImg)   page1.drawImage(sigImg,   { x: 432, y: 44, width: 92, height: 40 });

    // ── Save → upload directly to Google Drive → write back ────────────────
    const outBytes = await pdf.save();
    const fileName = `EjariTenancyContract_${safeSeg(contract.tenant_name)}_${tenancyContractId.slice(0, 8)}.pdf`;

    const { accessToken: driveToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    if (!driveToken) throw new Error('Google Drive connector not connected');

    // Ensure the Tenancy Contracts folder exists
    const folderSearch = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Tenancy Contracts' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
      { headers: { Authorization: `Bearer ${driveToken}` } },
    );
    const folderData = await folderSearch.json();
    let folderId;
    if (folderData.files?.length > 0) {
      folderId = folderData.files[0].id;
    } else {
      const createFolder = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tenancy Contracts', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] }),
      });
      const createdFolder = await createFolder.json();
      folderId = createdFolder.id;
    }

    // Upload the PDF
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
    form.append('file', new Blob([outBytes], { type: 'application/pdf' }));

    const driveUpload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${driveToken}` },
      body: form,
    });
    if (!driveUpload.ok) {
      const errText = await driveUpload.text();
      throw new Error(`Google Drive upload failed: ${driveUpload.status} ${errText}`);
    }
    const driveFile = await driveUpload.json();
    const pdf_url = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;

    // Idempotent: overwrites pdf_url, status, generated_at on every run
    await base44.asServiceRole.entities.TenancyContract.update(tenancyContractId, {
      pdf_url,
      status: 'generated',
      generated_at: new Date().toISOString(),
    });

    // Also encode the PDF bytes as base64 so the caller can open it directly in the browser
    let b64 = '';
    const CHUNK = 8192;
    for (let i = 0; i < outBytes.length; i += CHUNK) {
      b64 += String.fromCharCode(...outBytes.subarray(i, i + CHUNK));
    }
    const pdf_base64 = btoa(b64);

    return Response.json({ success: true, tenancyContractId, pdf_url, file_name: fileName, pdf_base64 });
  } catch (error) {
    console.error('generateTenancyContractPDF:', error);
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
});