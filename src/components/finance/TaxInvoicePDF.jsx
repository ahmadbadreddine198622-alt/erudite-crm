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
// Brand palette (per spec): navy #1a2744, gold #c9a84a.

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const BRAND = {
  name: 'ERUDITE REAL ESTATE',
  addressLines: ['Office, Dubai, U.A.E.'],
  vatRegNo: '104029757200003',
  navy: [26, 39, 68],
  gold: [201, 168, 74],
  light: [248, 250, 252],
  text: [30, 41, 59],
  muted: [110, 120, 140],
  hairline: [220, 225, 235],
};

const BANK = {
  name: 'ADCB',
  account: '12366874920001',
  iban: 'AE780030012366874920001',
  swift: 'ADCBAEAAXXX',
  branch: '261 / Khaled Bin Waleed St',
};

const ASSETS = import.meta.glob('/src/assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const SIGNATURE_URL = ASSETS['/src/assets/signature.png'] || null;
const STAMP_URL = ASSETS['/src/assets/stamp.png'] || null;

function fmtAED(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(s);
  }
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function sanitizeFileSegment(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'invoice';
}

// ─── Renderer ────────────────────────────────────────────────────────────────
export async function buildInvoicePDF(invoice, opts = {}) {
  const signatureUrl = opts.signatureUrl ?? SIGNATURE_URL;
  const stampUrl = opts.stampUrl ?? STAMP_URL;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const pad = 14;

  const headerH = 36;
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, W, headerH, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(BRAND.name, pad, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let addrY = 18;
  for (const line of BRAND.addressLines) {
    doc.text(line, pad, addrY);
    addrY += 4;
  }
  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`VAT Reg No: ${BRAND.vatRegNo}`, pad, headerH - 5);

  const boxW = 56;
  const boxH = 18;
  const boxX = W - pad - boxW;
  const boxY = 9;
  doc.setFillColor(...BRAND.gold);
  doc.rect(boxX, boxY, boxW, boxH, 'F');
  doc.setTextColor(...BRAND.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('TAX INVOICE', boxX + boxW / 2, boxY + boxH / 2 + 2, { align: 'center' });

  doc.setFillColor(...BRAND.gold);
  doc.rect(0, headerH, W, 1.2, 'F');

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
    ['Email', invoice.payer_email || '—'],
    ['Phone', invoice.payer_phone || '—'],
    ['TRN',   invoice.payer_trn   || '—'],
  ];
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

  const items =
    Array.isArray(invoice.line_items) && invoice.line_items.length
      ? invoice.line_items
      : [{
          description: 'Brokerage commission',
          unit_property: '',
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
  y += 8;

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

  const footerTop = H - 18;
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

  doc.setFillColor(...BRAND.navy);
  doc.rect(0, footerTop, W, 18, 'F');
  doc.setFillColor(...BRAND.gold);
  doc.rect(0, footerTop, W, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${BRAND.name} · ${BRAND.addressLines[0]}`, pad, footerTop + 8);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, pad, footerTop + 13);
  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.text('Thank you for your business', W - pad, footerTop + 11, { align: 'right' });

  return doc;
}

// ─── Action buttons ──────────────────────────────────────────────────────────
export function GeneratePDFButton({ invoice }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const doc = await buildInvoicePDF(invoice);
      const blob = doc.output('blob');
      const fileName = `${invoice.invoice_number || 'INV'}_${sanitizeFileSegment(invoice.payer_name)}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const result = await base44.functions.invoke('generateInvoicePDF', {
        invoice_id: invoice.id,
        file_url,
        file_name: fileName,
      });
      const finalUrl = result?.data?.pdf_url || file_url;

      toast.success('Invoice PDF saved', { description: invoice.invoice_number || fileName });
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