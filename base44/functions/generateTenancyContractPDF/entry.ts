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
    if (!stampUrl || !sigUrl) {
      return Response.json({
        error: 'Brand assets (stamp / signature) not configured. Open the Tenancy Contracts page and click "Upload & Configure Assets".',
      }, { status: 500 });
    }

    // ── Fetch all three assets in parallel ───────────────────────────────
    const [templateResp, stampResp, sigResp] = await Promise.all([
      fetch(templateUrl),
      fetch(stampUrl),
      fetch(sigUrl),
    ]);

    if (!templateResp.ok) throw new Error(`Template fetch failed: HTTP ${templateResp.status}`);
    if (!stampResp.ok)   throw new Error(`Stamp fetch failed: HTTP ${stampResp.status}`);
    if (!sigResp.ok)     throw new Error(`Signature fetch failed: HTTP ${sigResp.status}`);

    const [templateBytes, stampBytes, sigBytes] = await Promise.all([
      templateResp.arrayBuffer().then(b => new Uint8Array(b)),
      stampResp.arrayBuffer().then(b => new Uint8Array(b)),
      sigResp.arrayBuffer().then(b => new Uint8Array(b)),
    ]);

    // ── Load the official DLD Ejari template + embed brand assets ────────
    const pdf      = await PDFDocument.load(templateBytes);
    const pages    = pdf.getPages();
    if (!pages.length) return Response.json({ error: 'Template has no pages' }, { status: 500 });

    const page1    = pages[0];
    const font     = await pdf.embedFont(StandardFonts.Helvetica);
    const stampImg = await pdf.embedPng(stampBytes);
    const sigImg   = await pdf.embedPng(sigBytes);

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

    // Lessor signature block — stamp + signature bottom-right
    page1.drawImage(stampImg, { x: 360, y: 38, width: 72, height: 75 });
    page1.drawImage(sigImg,   { x: 432, y: 44, width: 92, height: 40 });

    // ── Save → upload → write back ───────────────────────────────────────
    const outBytes = await pdf.save();
    const fileName = `EjariTenancyContract_${safeSeg(contract.tenant_name)}_${tenancyContractId.slice(0, 8)}.pdf`;

    const uploadRes = await base44.integrations.Core.UploadFile({
      file: new Blob([outBytes], { type: 'application/pdf' }),
    });
    const pdf_url = uploadRes?.file_url;
    if (!pdf_url) throw new Error('PDF upload to Base44 storage failed');

    // Idempotent: overwrites pdf_url, status, generated_at on every run
    await base44.asServiceRole.entities.TenancyContract.update(tenancyContractId, {
      pdf_url,
      status: 'generated',
      generated_at: new Date().toISOString(),
    });

    return Response.json({ success: true, tenancyContractId, pdf_url, file_name: fileName });
  } catch (error) {
    console.error('generateTenancyContractPDF:', error);
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
});