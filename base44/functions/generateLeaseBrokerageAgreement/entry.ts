// generateLeaseBrokerageAgreement — Lease Brokerage Agreement (RERA Form A
// equivalent) PDF for an Erudite landlord. Server-side render with jsPDF
// 4.0.0 (same pattern as generateAndSendContract), pre-signs the broker
// block, hands off to DocuSign for the owner's signature, and writes the
// status back onto the Landlord record.
//
// Two callers — same function, idempotent (see below):
//   1. Button on the landlord detail sheet (agent-initiated).
//   2. AutomationRule on Landlord pipeline_stage_change → form_a_initiation
//      (hands-off; payload arrives as { event: { entity_id } }).
//
// Body (either call shape):
//   {
//     landlord_id?: string,                  // direct invocation
//     event?: { entity_id: string, ... },    // from AutomationRule
//     force?: boolean,                       // bypass idempotency guard
//     contract_start?: string,               // ISO date — optional
//     contract_end?: string,                 // ISO date — optional
//
//     // ── Manual overrides (all optional) ──────────────────────────────
//     // Precedence everywhere is: override > record > null (rendered '—').
//     // Empty string / undefined / null in body = "no override, use record".
//     owner_name?: string,
//     owner_email?: string,
//     owner_phone?: string,
//     passport_no?: string,
//     agent_name?: string,
//     brn?: string,
//     agent_email?: string,
//     property_type?: string,
//     location?: string,
//     building_name?: string,
//     unit_no?: string,
//     view?: string,
//     bedrooms?: number | string,
//     bathrooms?: number | string,
//     area_sqft?: number | string,
//     price_aed?: number | string,
//     rent_aed?: number | string,
//   }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Public-folder branded assets served at site root. Same approach we use for
// the logo on every other Erudite PDF — Vite serves /public unbundled, so the
// Deno function can fetch them via HTTPS at the deployed app's origin.
const APP_URL = Deno.env.get('APP_URL') || 'https://dubai-estate-pro.base44.app';
const LOGO_URL_ABS      = `${APP_URL}/erudite-logo.png`;
const SIGNATURE_URL_ABS = `${APP_URL}/erudite-signature.png`;
const STAMP_URL_ABS     = `${APP_URL}/erudite-stamp.png`;

const ORN = '29322';
const COMPANY_NAME = 'ERUDITE REAL ESTATE';
const FOOTER_ADDRESS = 'The Burlington Tower, Office 1208, Business Bay, Dubai, U.A.E.';

// Brand palette (matches pdfBrand.js)
const NAVY = [26, 39, 68] as const;
const GOLD = [201, 168, 74] as const;
const TEXT = [30, 41, 59] as const;
const MUTED = [110, 120, 140] as const;

// Property type checkboxes rendered on the form. Order is the form's order.
const PROPERTY_TYPES: { key: string; label: string }[] = [
  { key: 'apartment',  label: 'Apartment' },
  { key: 'villa',      label: 'Villa' },
  { key: 'townhouse',  label: 'Townhouse' },
  { key: 'office',     label: 'Office' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'land',       label: 'Land' },
];

// Owner document checkboxes — drawn from DocumentChecklistItem rows for the
// landlord. Status "received" or "verified" → ticked.
const OWNER_DOC_CHECKBOXES: { key: string; label: string }[] = [
  { key: 'title_deed',          label: 'Title Deed' },
  { key: 'passport',            label: 'Passport Copy' },
  { key: 'emirates_id_front',   label: 'Emirates ID (Front)' },
  { key: 'emirates_id_back',    label: 'Emirates ID (Back)' },
  { key: 'visa_page',           label: 'Visa Page' },
  { key: 'power_of_attorney',   label: 'Power of Attorney (if any)' },
];

async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function checkbox(doc: any, x: number, y: number, ticked: boolean) {
  doc.setDrawColor(80); doc.setLineWidth(0.3);
  doc.rect(x, y - 3, 3, 3);
  if (ticked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    // 'X' is universally renderable in jsPDF's default font; ✓ glyph isn't.
    doc.text('X', x + 0.45, y - 0.4);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Support both direct invocation (button) and AutomationRule trigger.
    const landlord_id: string | undefined = body?.landlord_id || body?.event?.entity_id;
    const force: boolean = !!body?.force;
    const contract_start: string | undefined = body?.contract_start;
    const contract_end: string | undefined = body?.contract_end;

    if (!landlord_id) {
      return Response.json({ error: 'landlord_id is required' }, { status: 400 });
    }

    // ── Load landlord ────────────────────────────────────────────────────
    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    if (!landlord) {
      return Response.json({ error: 'Landlord not found' }, { status: 404 });
    }

    // ── Idempotency guard ────────────────────────────────────────────────
    // Both the button and the AutomationRule can fire this. Don't re-send
    // DocuSign envelopes against the same landlord unless explicitly forced.
    if (!force && (
      landlord.lease_agreement_status === 'sent_for_signature' ||
      landlord.lease_agreement_status === 'signed'
    )) {
      return Response.json({
        ok: false,
        skipped: true,
        reason: `Already ${landlord.lease_agreement_status}. Pass force=true to regenerate.`,
        landlord_id,
        lease_agreement_status: landlord.lease_agreement_status,
      });
    }

    // ── Resolve linked property via LandlordProperty ─────────────────────
    const lpRows = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id });
    const lpRow = lpRows[0] || null;
    let property: any = null;
    if (lpRow?.property_id) {
      property = await base44.asServiceRole.entities.Property.get(lpRow.property_id).catch(() => null);
    }

    // ── Resolve agent (User) via assigned_agent_email ────────────────────
    let agent: any = null;
    if (landlord.assigned_agent_email) {
      const agents = await base44.asServiceRole.entities.User.filter({ email: landlord.assigned_agent_email });
      agent = agents[0] || null;
    }

    // ── Document checklist (owner-doc checkboxes) ────────────────────────
    const docRows = await base44.asServiceRole.entities.DocumentChecklistItem.filter({ landlord_id });
    const hasDoc = (type: string) =>
      docRows.some((r: any) =>
        r.document_type === type && (r.status === 'received' || r.status === 'verified')
      );

    // ── Resolve every renderable field: override > record > null ─────────
    // The body overrides come from the Manual form on the LeaseAgreement page.
    // Empty string / undefined / null in body falls through to the record;
    // any non-empty value (string or number) wins.
    const strOv = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length ? t : null;
    };
    const numOv = (v: unknown): number | null => {
      if (v === undefined || v === null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const f = {
      owner_name:    strOv(body?.owner_name)    ?? landlord.full_name_en ?? landlord.full_name ?? null,
      owner_email:   strOv(body?.owner_email)   ?? landlord.email ?? null,
      owner_phone:   strOv(body?.owner_phone)   ?? landlord.phone ?? null,
      passport_no:   strOv(body?.passport_no)   ?? landlord.passport_no ?? null,
      nationality:   landlord.nationality ?? null, // not exposed in Manual form, record only
      agent_name:    strOv(body?.agent_name)    ?? agent?.full_name ?? agent?.email ?? null,
      brn:           strOv(body?.brn)           ?? agent?.brn ?? null,
      agent_email:   strOv(body?.agent_email)   ?? agent?.email ?? landlord.assigned_agent_email ?? null,
      property_type: strOv(body?.property_type) ?? property?.property_type ?? null,
      location:      strOv(body?.location)      ?? property?.location ?? null,
      building_name: strOv(body?.building_name) ?? property?.building_name ?? null,
      unit_no:       strOv(body?.unit_no)       ?? property?.unit_no ?? null,
      view:          strOv(body?.view)          ?? property?.view ?? null,
      bedrooms:      numOv(body?.bedrooms)      ?? property?.bedrooms ?? null,
      bathrooms:     numOv(body?.bathrooms)     ?? property?.bathrooms ?? null,
      area_sqft:     numOv(body?.area_sqft)     ?? property?.area_sqft ?? null,
      price_aed:     numOv(body?.price_aed)     ?? property?.price_aed ?? null,
      rent_aed:      numOv(body?.rent_aed)      ?? property?.rent_aed ?? null,
    };

    // ── Contract duration ────────────────────────────────────────────────
    const startDate = contract_start ? new Date(contract_start) : new Date();
    const endDate = contract_end ? new Date(contract_end) : (() => {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + 12);
      return d;
    })();
    const durationDays = Math.max(0, (endDate.getTime() - startDate.getTime()) / 86_400_000);
    const durationMonths = Math.round(durationDays / 30.44);

    // ── Load branded images (logo + signature + stamp) ───────────────────
    const [logoData, sigData, stampData] = await Promise.all([
      fetchAsDataUri(LOGO_URL_ABS),
      fetchAsDataUri(SIGNATURE_URL_ABS),
      fetchAsDataUri(STAMP_URL_ABS),
    ]);

    // ── Build PDF ────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, H = 297;
    const pad = 14;
    const refNo = `LBA-${Date.now().toString(36).toUpperCase()}`;

    // Header band — navy with gold stripe (matches pdfBrand.js convention)
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 36, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 36, W, 1.2, 'F');

    // Logo top-left (skipped gracefully if fetch failed)
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', pad, 5, 32, 16); } catch { /* ignore */ }
    }

    // Title block top-right
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('LEASE BROKERAGE AGREEMENT', W - pad, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Ref: ${refNo}`, W - pad, 19, { align: 'right' });
    doc.text(`Date: ${fmtDate(new Date())}`, W - pad, 24, { align: 'right' });
    doc.text(`ORN: ${ORN}`, W - pad, 29, { align: 'right' });

    let y = 46;

    // Section + row helpers
    const section = (title: string) => {
      y += 2;
      doc.setFillColor(...GOLD);
      doc.rect(pad, y - 4, 3, 5, 'F');
      doc.setTextColor(...TEXT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, pad + 6, y);
      y += 2;
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.3);
      doc.line(pad, y, W - pad, y);
      y += 6;
    };
    const row = (label: string, value: string | number | null | undefined) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MUTED);
      doc.text(label, pad, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT);
      doc.text(String(value ?? '—'), pad + 55, y, { maxWidth: W - pad - 55 - pad });
      y += 6;
    };

    // ── BROKER ───────────────────────────────────────────────────────────
    section('BROKER');
    row('Company:', COMPANY_NAME);
    row('ORN:', ORN);
    row('Agent Name:', f.agent_name || '—');
    row('BRN:', f.brn || '—');
    row('Agent Email:', f.agent_email || '—');

    // ── OWNER ────────────────────────────────────────────────────────────
    section('OWNER');
    row('Full Name:', f.owner_name || '—');
    row('Passport No.:', f.passport_no || '—');
    row('Nationality:', f.nationality || '—');
    row('Email:', f.owner_email || '—');
    row('Phone:', f.owner_phone || '—');

    // ── PROPERTY ─────────────────────────────────────────────────────────
    section('PROPERTY');

    // Property Type — checkbox row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Property Type:', pad, y);
    let cbX = pad + 30;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    PROPERTY_TYPES.forEach((t) => {
      checkbox(doc, cbX, y, f.property_type === t.key);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(t.label, cbX + 4.5, y);
      cbX += 28;
    });
    y += 7;

    row('Location:', f.location || '—');
    row('Building / Community:', f.building_name || '—');
    row('Unit No.:', f.unit_no || '—');
    row('View:', f.view || '—');
    row('Bedrooms:', f.bedrooms != null ? String(f.bedrooms) : '—');
    row('Bathrooms:', f.bathrooms != null ? String(f.bathrooms) : '—');
    row('Area (sqft):', f.area_sqft != null ? f.area_sqft.toLocaleString() : '—');
    row('Price (AED):', f.price_aed != null ? `AED ${f.price_aed.toLocaleString()}` : '—');
    row('Rent (AED):', f.rent_aed != null ? `AED ${f.rent_aed.toLocaleString()}` : '—');

    // ── CONTRACT DURATION ────────────────────────────────────────────────
    section('CONTRACT DURATION');
    row('Start Date:', fmtDate(startDate));
    row('End Date:', fmtDate(endDate));
    row('Duration:', `${durationMonths} month${durationMonths === 1 ? '' : 's'}`);
    if (!contract_start && !contract_end) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text('Default term applied: 12 months from generation date. Adjust on signing if needed.', pad, y);
      y += 5;
    }

    // ── OWNER DOCUMENTS CHECKLIST ────────────────────────────────────────
    section('OWNER DOCUMENTS');
    const docStartY = y;
    const docColW = (W - 2 * pad) / 2;
    OWNER_DOC_CHECKBOXES.forEach((d, i) => {
      const col = i % 2;
      const rowIdx = Math.floor(i / 2);
      const x = pad + col * docColW;
      const yy = docStartY + rowIdx * 6;
      checkbox(doc, x, yy, hasDoc(d.key));
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT);
      doc.text(d.label, x + 5, yy);
    });
    y = docStartY + Math.ceil(OWNER_DOC_CHECKBOXES.length / 2) * 6 + 4;

    // ── TERMS ────────────────────────────────────────────────────────────
    section('TERMS & CONDITIONS');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    const terms = [
      `1. This Lease Brokerage Agreement (RERA Form A equivalent) authorises ${COMPANY_NAME} (ORN ${ORN}) to market and lease the above property on behalf of the owner under the terms outlined herein.`,
      '2. All transactions are subject to Dubai Land Department and Real Estate Regulatory Agency (RERA) regulations.',
      '3. Commission and fees are as per the agency agreement and prevailing RERA guidelines.',
      '4. The owner confirms they have legal authority to enter into this agreement and that all property and identity details provided are accurate.',
      '5. This agreement is valid for the contract term stated above unless terminated earlier by either party with written notice as permitted under UAE law.',
    ];
    terms.forEach((t) => {
      const lines = doc.splitTextToSize(t, W - 2 * pad);
      doc.text(lines, pad, y);
      y += lines.length * 4.5 + 1.5;
    });

    // ── SIGNATURES — broker pre-signed, owner block for DocuSign ─────────
    // Reserve ≈45mm for the signature band. If the body has pushed us close
    // to the footer, page-break first.
    const SIG_BAND_H = 45;
    if (y + SIG_BAND_H > H - 18) {
      doc.addPage();
      y = 20;
    }
    section('SIGNATURES');
    const sigColW = (W - 2 * pad) / 2 - 4;
    const c1X = pad;
    const c2X = pad + sigColW + 8;
    const sigTopY = y;

    // ── BROKER block: signature image + stamp (the whole point of this fn) ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('BROKER — ERUDITE REAL ESTATE', c1X, sigTopY);
    doc.setFillColor(...GOLD);
    doc.rect(c1X, sigTopY + 1, 50, 0.4, 'F');

    if (sigData) {
      // Signature sits on the line; aspect-fitted into 38x14mm.
      try { doc.addImage(sigData, 'PNG', c1X + 2, sigTopY + 8, 38, 14); } catch { /* ignore */ }
    }
    if (stampData) {
      // Stamp overlaps the right of the signature like a real wet seal.
      try { doc.addImage(stampData, 'PNG', c1X + 30, sigTopY + 4, 22, 22); } catch { /* ignore */ }
    }

    doc.setDrawColor(...TEXT);
    doc.setLineWidth(0.3);
    doc.line(c1X, sigTopY + 28, c1X + sigColW, sigTopY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(f.agent_name || 'Ahmad Badreddine', c1X, sigTopY + 32);
    doc.setTextColor(...MUTED);
    doc.text(`${COMPANY_NAME} · ORN ${ORN} · BRN ${f.brn || '—'}`, c1X, sigTopY + 36);

    // ── OWNER block: intentionally EMPTY — DocuSign captures the signature ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('OWNER', c2X, sigTopY);
    doc.setFillColor(...GOLD);
    doc.rect(c2X, sigTopY + 1, 16, 0.4, 'F');
    doc.setDrawColor(...TEXT);
    doc.setLineWidth(0.3);
    doc.line(c2X, sigTopY + 28, c2X + sigColW, sigTopY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(f.owner_name || '—', c2X, sigTopY + 32);
    doc.setTextColor(...MUTED);
    // DocuSign anchor tags — recipient signs and dates at these markers.
    doc.text('Signature: /sn1/    Date: /dt1/', c2X, sigTopY + 36);

    // ── Footer ───────────────────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`${COMPANY_NAME} · ORN ${ORN} · ${FOOTER_ADDRESS}`, W / 2, H - 9, { align: 'center' });
    doc.text(`Generated ${new Date().toLocaleString('en-AE')} · Ref ${refNo}`, W / 2, H - 5, { align: 'center' });

    // ── Output → upload to Base44 storage ────────────────────────────────
    const dataUri = doc.output('datauristring'); // data:application/pdf;base64,...
    const base64Data = dataUri.split(',')[1];
    const pdfBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const safeOwner = (f.owner_name || 'landlord')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60) || 'landlord';
    const fileName = `LeaseBrokerageAgreement_${safeOwner}_${refNo}.pdf`;

    const uploadRes = await base44.integrations.Core.UploadFile({
      file: new Blob([pdfBytes], { type: 'application/pdf' }),
    });
    let pdf_url: string | undefined = uploadRes?.file_url;
    if (!pdf_url) throw new Error('PDF upload to Base44 storage failed');

    // Upload to Google Drive "Lease Agreements" folder
    try {
      const driveUpload = await base44.functions.invoke('uploadToGoogleDrive', {
        file_url: pdf_url,
        file_name: fileName,
        folderPath: 'Lease Agreements'
      });
      if (driveUpload?.success) {
        pdf_url = driveUpload.file_url;
      }
    } catch (error) {
      console.error('Google Drive upload failed:', error.message);
      // Continue with Base44 storage URL as fallback
    }

    // ── DocuSign hand-off (owner is the signer; broker block is pre-signed) ──
    const dsRes = await base44.functions.invoke('docusignSendForSignature', {
      form_type: 'A',
      pdf_url,
      subject: `Lease Brokerage Agreement — ${f.building_name || property?.title || 'Erudite Property'} — Please Sign`,
      message:
        `Dear ${f.owner_name || 'Owner'},\n\n` +
        `Please review and sign the attached Lease Brokerage Agreement for the property at ` +
        `${f.location || ''}${f.building_name ? ', ' + f.building_name : ''}.\n\n` +
        `Reference: ${refNo}`,
      signers: [
        {
          role: 'owner',
          name: f.owner_name || 'Owner',
          email: f.owner_email,
          phone: f.owner_phone,
        },
      ],
      property_id: lpRow?.property_id || null,
    });

    // ── Write-back: Landlord.lease_agreement_status → sent_for_signature ──
    await base44.asServiceRole.entities.Landlord.update(landlord_id, {
      lease_agreement_status: 'sent_for_signature',
    });

    // Upsert DocumentChecklistItem with document_type=lease_brokerage_agreement
    const existing = await base44.asServiceRole.entities.DocumentChecklistItem.filter({
      landlord_id,
      document_type: 'lease_brokerage_agreement',
    });
    const docPayload: any = {
      landlord_id,
      document_type: 'lease_brokerage_agreement',
      status: 'requested', // sent to owner; awaiting signature
      file_url: pdf_url,
      requested_at: new Date().toISOString(),
    };
    if (lpRow?.property_id) docPayload.property_id = lpRow.property_id;

    if (existing && existing[0]) {
      await base44.asServiceRole.entities.DocumentChecklistItem.update(existing[0].id, docPayload);
    } else {
      await base44.asServiceRole.entities.DocumentChecklistItem.create(docPayload);
    }

    return Response.json({
      ok: true,
      ref: refNo,
      landlord_id,
      pdf_url,
      file_name: fileName,
      lease_agreement_status: 'sent_for_signature',
      docusign: dsRes,
    });
  } catch (error) {
    console.error('generateLeaseBrokerageAgreement:', error);
    return Response.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 },
    );
  }
});