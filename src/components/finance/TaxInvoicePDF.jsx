// ─── Tax Invoice PDF — Erudite Real Estate ────────────────────────────────────
//
// Renders the styled A4 TAX INVOICE client-side with jsPDF, uploads the
// resulting blob to Base44 file storage via Core.UploadFile, then calls the
// `generateInvoicePDF` Deno function — which writes `pdf_url` back onto the
// Invoice (asServiceRole).
//
// Architecture note: the user-facing flow conceptually is
// "fetch → build → upload → save". In this codebase rendering happens in the
// browser because jsPDF + image embedding via Image/canvas require a DOM. The
// Deno function owns the canonical pdf_url write (idempotency seam) and is the
// place where a future Google Drive re-upload step lives (DRIVE SWAP SEAM
// comment in entry.ts). When that swap happens the button stays unchanged.
//
// Brand palette (per spec): navy #1a2744, gold #c9a84a, cream #f7f4ec.

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

import {
  BRAND, BANK, SIGNATURE_URL, STAMP_URL,
  fmtAED, fmtDate, loadImage, sanitizeFileSegment, drawCompanyFooter, placeLogo,
} from '@/lib/pdfBrand';

// ─── Renderer ────────────────────────────────────────────────────────────────
export async function buildInvoicePDF(invoice, opts = {}) {
  const signatureUrl = opts.signatureUrl ?? SIGNATURE_URL;
  const stampUrl = opts.stampUrl ?? STAMP_URL;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const pad = 14;

  const headerH = 36;
  // Light cream header band (#F7F4EC)
  doc.setFillColor(247, 244, 236);
  doc.rect(0, 0, W, headerH, 'F');

  // Navy text on cream background
  doc.setTextColor(26, 39, 68);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(BRAND.name, pad, 13);
  doc.setTextColor(201, 168, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`VAT Reg No: ${BRAND.vatRegNo}`, pad, headerH - 5);

  // TAX INVOICE badge: navy block, gold border, gold text
  const boxW = 56;
  const boxH = 18;
  const boxX = W - pad - boxW;
  const boxY = 9;
  doc.setFillColor(26, 39, 68);
  doc.rect(boxX, boxY, boxW, boxH, 'F');
  // Gold border (drawn on top of fill)
  doc.setLineWidth(0.5);
  doc.setDrawColor(201, 168, 74);
  doc.rect(boxX, boxY, boxW, boxH, 'S');
  doc.setTextColor(201, 168, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('TAX INVOICE', boxX + boxW / 2, boxY + boxH / 2 + 2, { align: 'center' });

  // Gold rule beneath header
  doc.setFillColor(201, 168, 74);
  doc.rect(0, headerH, W, 1.2, 'F');

  // Logo: placed on the left side of the header
  await placeLogo(doc, { x: pad, y: 6, maxW: 48, maxH: 24 });

  let y = headerH + 10;

  const colGap = 10;
  const colW = (W - 2 * pad - colGap) / 2;
  const leftX = pad;
  const rightX = pad + colW + colGap;

  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BILL TO', leftX, y);
  doc.text('INVOICE DETAILS', rightX, y);
  y += 1;

  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.4);
  doc.line(leftX, y + 0.5, leftX + 16, y + 0.5);
  doc.line(rightX, y + 0.5, rightX + 26, y + 0.5);
  y += 5;

  const billToStartY = y;

  doc.setTextColor(...BRAND.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.payer_name || '—', leftX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const billLines = [
    ['Email', invoice.payer_email],
    ['Phone', invoice.payer_phone],
    ['TRN',   invoice.payer_trn],
  ].filter(([, v]) => v);
  for (const [label, val] of billLines) {
    doc.setTextColor(...BRAND.muted);
    doc.text(`${label}:`, leftX, y);
    doc.setTextColor(...BRAND.text);
    doc.text(String(val), leftX + 14, y);
    y += 4.5;
  }

  let ry = billToStartY;
  const detailRow = (label, val) => {
    doc.setTextColor(...BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, rightX, ry);
    doc.setTextColor(...BRAND.text);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), rightX + 32, ry);
    ry += 5;
  };
  detailRow('Invoice #:', invoice.invoice_number || '—');
  detailRow('Issue Date:', fmtDate(invoice.issue_date));
  detailRow('Due Date:', fmtDate(invoice.due_date));
  detailRow('P.O.:', invoice.po_number || '—');

  y = Math.max(y, ry) + 6;

  const tableX = pad;
  const tableW = W - 2 * pad;
  const colDescW  = tableW * 0.42;
  const colUnitW  = tableW * 0.22;
  const colPriceW = tableW * 0.18;
  const colAmtW   = tableW * 0.18;
  const colDescX  = tableX;
  const colUnitX  = colDescX + colDescW;
  const colPriceX = colUnitX + colUnitW;
  const colAmtX   = colPriceX + colPriceW;

  const headerRowH = 8;
  doc.setFillColor(...BRAND.navy);
  doc.rect(tableX, y, tableW, headerRowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DESCRIPTION', colDescX + 2, y + 5.5);
  doc.text('UNIT / PROPERTY', colUnitX + 2, y + 5.5);
  doc.text('SELL PRICE (AED)', colPriceX + colPriceW - 2, y + 5.5, { align: 'right' });
  doc.text('AMOUNT (AED)', colAmtX + colAmtW - 2, y + 5.5, { align: 'right' });
  y += headerRowH;

  const propertyLabel = opts.propertyLabel || '';
  const items =
    Array.isArray(invoice.line_items) && invoice.line_items.length
      ? invoice.line_items
      : [{
          description: 'Brokerage commission',
          unit_property: propertyLabel,
          sell_price: null,
          amount: Number(invoice.commission_amount) || 0,
        }];

  const rowH = 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  items.forEach((it, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...BRAND.light);
      doc.rect(tableX, y, tableW, rowH, 'F');
    }
    doc.setTextColor(...BRAND.text);
    const desc = doc.splitTextToSize(String(it.description || ''), colDescW - 4)[0] || '';
    const unit = doc.splitTextToSize(String(it.unit_property || ''), colUnitW - 4)[0] || '';
    doc.text(desc, colDescX + 2, y + 6);
    doc.text(unit, colUnitX + 2, y + 6);
    doc.text(it.sell_price != null ? fmtAED(it.sell_price) : '—', colPriceX + colPriceW - 2, y + 6, { align: 'right' });
    doc.text(it.amount != null ? fmtAED(it.amount) : '—', colAmtX + colAmtW - 2, y + 6, { align: 'right' });
    y += rowH;
  });

  doc.setDrawColor(...BRAND.hairline);
  doc.setLineWidth(0.2);
  doc.line(tableX, y, tableX + tableW, y);
  y += 6;

  // ── Notes / Remarks ───────────────────────────────────────────────────────
  const notesText = opts.notes || invoice.notes || '';
  if (notesText) {
    doc.setTextColor(...BRAND.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('NOTES / REMARKS', tableX, y);
    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(0.4);
    doc.line(tableX, y + 1, tableX + 30, y + 1);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.text);
    const noteLines = doc.splitTextToSize(notesText, tableW);
    doc.text(noteLines, tableX, y);
    y += noteLines.length * 4.5 + 4;
  } else {
    y += 2;
  }

  // ── Property Details block ────────────────────────────────────────────────
  const pd = opts.propertyDetails || {};
  const pdRows = [
    ['Unit No.',              pd.unit_number],
    ['Building / Tower',      pd.building_name],
    ['Project / Community',   pd.location],
    ['Property Type',         pd.property_type],
    ['Permit / Ref No',       pd.permit_number],
    ['Address',               pd.address],
  ].filter(([, v]) => v);

  if (pdRows.length) {
    doc.setFillColor(...BRAND.navy);
    doc.rect(tableX, y, tableW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('PROPERTY DETAILS', tableX + 3, y + 5.5);
    y += 8;

    pdRows.forEach(([label, val], i) => {
      if (i % 2 === 0) {
        doc.setFillColor(...BRAND.light);
        doc.rect(tableX, y, tableW, 7, 'F');
      }
      doc.setTextColor(...BRAND.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(label, tableX + 3, y + 5);
      doc.setTextColor(...BRAND.text);
      doc.setFont('helvetica', 'bold');
      const valStr = doc.splitTextToSize(String(val), tableW - 64)[0] || '';
      doc.text(valStr, tableX + 62, y + 5);
      y += 7;
    });

    doc.setDrawColor(...BRAND.hairline);
    doc.setLineWidth(0.2);
    doc.line(tableX, y, tableX + tableW, y);
    y += 8;
  }

  const blockStartY = y;
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PAYMENT METHOD', leftX, blockStartY);
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.4);
  doc.line(leftX, blockStartY + 1, leftX + 32, blockStartY + 1);

  let py = blockStartY + 6;
  const bankRow = (label, val) => {
    doc.setTextColor(...BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, leftX, py);
    doc.setTextColor(...BRAND.text);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), leftX + 18, py);
    py += 4.8;
  };
  bankRow('Bank:', BANK.name);
  bankRow('Account:', BANK.account);
  bankRow('IBAN:', BANK.iban);
  bankRow('SWIFT:', BANK.swift);
  bankRow('Branch:', BANK.branch);

  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AMOUNT SUMMARY', rightX, blockStartY);
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.4);
  doc.line(rightX, blockStartY + 1, rightX + 30, blockStartY + 1);

  let sy = blockStartY + 6;
  const totalsLabelX = rightX;
  const totalsValueX = rightX + colW;
  const totalRow = (label, value, rowOpts = {}) => {
    doc.setTextColor(...(rowOpts.emphasis ? BRAND.navy : BRAND.muted));
    doc.setFont('helvetica', rowOpts.emphasis ? 'bold' : 'normal');
    doc.setFontSize(rowOpts.emphasis ? 10.5 : 9.5);
    doc.text(label, totalsLabelX, sy);
    doc.setTextColor(...(rowOpts.emphasis ? BRAND.navy : BRAND.text));
    doc.text(`AED ${fmtAED(value)}`, totalsValueX, sy, { align: 'right' });
    sy += rowOpts.emphasis ? 8 : 6;
  };
  totalRow('Subtotal', invoice.commission_amount || 0);
  totalRow('VAT (5%)', invoice.vat_amount || 0);
  doc.setDrawColor(...BRAND.hairline);
  doc.setLineWidth(0.3);
  doc.line(totalsLabelX, sy - 2, totalsValueX, sy - 2);
  sy += 1;
  const dueH = 9;
  doc.setFillColor(...BRAND.gold);
  doc.rect(totalsLabelX - 2, sy - 5.5, colW + 2, dueH, 'F');
  doc.setTextColor(...BRAND.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DUE', totalsLabelX, sy);
  doc.text(`AED ${fmtAED(invoice.total_amount || 0)}`, totalsValueX, sy, { align: 'right' });

  y = Math.max(py, sy + 4) + 6;

  const footerTop = H - 44;
  const sigBandY = footerTop - 38;

  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AUTHORIZED SIGNATURE', leftX, sigBandY);
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.4);
  doc.line(leftX, sigBandY + 1, leftX + 40, sigBandY + 1);

  const lineY = sigBandY + 26;
  const lineEnd = leftX + 70;
  doc.setDrawColor(...BRAND.text);
  doc.setLineWidth(0.3);
  doc.line(leftX, lineY, lineEnd, lineY);

  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('For Erudite Real Estate', leftX, lineY + 4);

  const [signature, stamp] = await Promise.all([loadImage(signatureUrl), loadImage(stampUrl)]);

  if (signature) {
    const sigMaxW = 55;
    const sigMaxH = 22;
    const aspect = signature.width / signature.height;
    let sw = sigMaxW;
    let sh = sw / aspect;
    if (sh > sigMaxH) { sh = sigMaxH; sw = sh * aspect; }
    const sx = leftX + 2;
    const sy0 = lineY - sh + 4;
    try { doc.addImage(signature.dataUrl, 'PNG', sx, sy0, sw, sh); } catch { /* ignore */ }
  }

  if (stamp) {
    const stampMax = 30;
    const aspect = stamp.width / stamp.height;
    let stW = stampMax;
    let stH = stW / aspect;
    if (stH > stampMax) { stH = stampMax; stW = stH * aspect; }
    const stX = lineEnd - 20;
    const stY = lineY - stH + 10;
    try { doc.addImage(stamp.dataUrl, 'PNG', stX, stY, stW, stH); } catch { /* ignore */ }
  }

  drawCompanyFooter(doc, footerTop, W, pad);

  return doc;
}

// ─── Action buttons ──────────────────────────────────────────────────────────
export function GeneratePDFButton({ invoice }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      // Use stored property_details if available, otherwise resolve from linked Deal → Property
      let propertyLabel = '';
      let propertyDetails = {};

      if (invoice.property_details && Object.values(invoice.property_details).some(Boolean)) {
        const pd = invoice.property_details;
        propertyDetails = {
          unit_number: pd.unit_number || '',
          building_name: pd.building_name || '',
          location: pd.community || '',
          property_type: pd.property_type || '',
          permit_number: pd.reference_no || '',
          address: pd.address || '',
        };
        propertyLabel = [pd.building_name, pd.community].filter(Boolean).join(' — ');
      } else if (invoice.deal_id) {
        try {
          const deal = await base44.entities.Deal.get(invoice.deal_id);
          if (deal?.property_id) {
            const prop = await base44.entities.Property.get(deal.property_id);
            if (prop) {
              propertyLabel = [prop.building_name, prop.location].filter(Boolean).join(' — ');
              propertyDetails = {
                building_name: prop.building_name || '',
                location: prop.location || '',
                property_type: prop.property_type ? prop.property_type.replace(/_/g, ' ') : '',
                permit_number: prop.permit_number || '',
                address: prop.address || '',
              };
            }
          }
        } catch { /* non-fatal — leave blank */ }
      }

      const doc = await buildInvoicePDF(invoice, { propertyLabel, propertyDetails });
      const pdfBase64 = doc.output('datauristring');
      const base64Data = pdfBase64.split(',')[1];
      const fileName = `${invoice.invoice_number || 'INV'}_${sanitizeFileSegment(invoice.payer_name)}.pdf`;

      // Upload to Google Drive directly with base64 content
      let finalUrl;
      let uploadedToDrive = false;
      try {
        const driveUpload = await base44.functions.invoke('uploadToGoogleDrive', {
          base64Content: base64Data,
          fileName,
          folderPath: 'Finance/Invoices',
          mimeType: 'application/pdf'
        });
        if (driveUpload?.data?.file_url) {
          finalUrl = driveUpload.data.file_url;
          uploadedToDrive = true;
          console.log('Invoice uploaded to Google Drive:', finalUrl);
        } else {
          throw new Error('No file URL returned from Google Drive');
        }
      } catch (driveError) {
        console.error('Google Drive upload failed, falling back to Base44:', driveError.message);
        const blob = doc.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        finalUrl = uploadRes?.file_url;
        if (!finalUrl) throw new Error('PDF upload failed (both Drive and Base44 storage)');
      }

      // Update invoice record with PDF URL
      if (finalUrl && invoice.id) {
        await base44.entities.Invoice.update(invoice.id, { pdf_url: finalUrl });
      }

      // Download PDF locally as well
      doc.save(fileName);

      toast.success(uploadedToDrive ? 'Invoice saved to Google Drive & downloaded' : 'Invoice PDF saved & downloaded', { description: invoice.invoice_number || fileName });
      queryClient.invalidateQueries({ queryKey: ['invoices-live'] });
      return finalUrl;
    } catch (err) {
      console.error('Invoice PDF generation failed:', err);
      toast.error("Couldn't generate PDF", { description: err?.message || 'unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="gap-1 h-8"
      title={invoice.pdf_url ? 'Regenerate PDF (overwrites stored URL)' : 'Generate PDF'}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      {invoice.pdf_url ? 'Regenerate' : 'Generate PDF'}
    </Button>
  );
}

export function ViewPDFLink({ invoice }) {
  if (!invoice.pdf_url) return null;
  return (
    <a
      href={invoice.pdf_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button
        size="sm"
        variant="ghost"
        className="gap-1 h-8 text-accent hover:text-accent"
        title="Open generated PDF in a new tab"
        type="button"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View PDF
      </Button>
    </a>
  );
}