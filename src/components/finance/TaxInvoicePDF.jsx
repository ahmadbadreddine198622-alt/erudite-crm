// ─── Tax Invoice PDF — navy/gold A4 layout, mirrors PropertyBrochurePDF idiom ──
//
// Renders the invoice client-side with jsPDF, uploads the resulting blob via
// Base44 file storage, then calls the `generateInvoicePDF` Deno function which
// writes `pdf_url` back onto the Invoice (asServiceRole).
//
// The upload step is a deliberate seam: today it goes to Base44 storage via
// `Core.UploadFile`. Once the Google Drive service-account credentials are
// provisioned, the Drive re-upload step moves inside the `generateInvoicePDF`
// function — this button stays unchanged.

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

// Brand palette mirrors PropertyBrochurePDF for visual consistency across docs.
const BRAND = {
  name: 'Erudite Real Estate',
  tagline: 'Premium Dubai Properties',
  trn: '100123456700003', // TODO: replace with the real TRN once provided
  primary: [30, 41, 59],   // navy
  accent: [217, 119, 6],   // gold
  light: [248, 250, 252],
  text: [30, 41, 59],
  muted: [100, 116, 139],
};

// Drop the combined signature + stamp PNG at /public/assets/invoice/signoff.png
// (Vite serves /public at the URL root). The renderer respects the image's
// natural aspect ratio, so cropping the source PNG to taste is fine. If the
// file is missing, the loader returns null and the sign-off band is skipped —
// the PDF still renders cleanly.
const ASSETS = {
  signoffUrl: '/assets/invoice/signoff.png',
};

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

// Browser-only: load a URL into a canvas and return { dataUrl, width, height },
// or null on any failure (404, CORS, decode error). Returning the natural
// dimensions lets the renderer respect the source aspect ratio.
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
// Returns a jsPDF document. Callers do `.output('blob')` or `.save()`.
export async function buildInvoicePDF(invoice, opts = {}) {
  const signoffUrl = opts.signoffUrl ?? ASSETS.signoffUrl;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const pad = 16;

  // ── Header band (navy) + gold accent stripe ───────────────────────────────
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, W, 30, 'F');
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, 30, W, 1.5, 'F');

  // Brand block — left
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(BRAND.name.toUpperCase(), pad, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(BRAND.tagline, pad, 19);
  doc.text(`TRN: ${BRAND.trn}`, pad, 24);

  // TAX INVOICE title — right, gold
  doc.setTextColor(...BRAND.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TAX INVOICE', W - pad, 18, { align: 'right' });

  let y = 42;

  // ── Meta block: invoice # / issue / due ───────────────────────────────────
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('INVOICE #', pad, y);
  doc.text('ISSUE DATE', pad + 65, y);
  doc.text('DUE DATE', pad + 125, y);
  y += 5;
  doc.setTextColor(...BRAND.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.invoice_number || '—', pad, y);
  doc.text(fmtDate(invoice.issue_date), pad + 65, y);
  doc.text(fmtDate(invoice.due_date), pad + 125, y);
  y += 12;

  // ── Bill To block ─────────────────────────────────────────────────────────
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('BILL TO', pad, y);
  y += 5;
  doc.setTextColor(...BRAND.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.payer_name || '—', pad, y);
  y += 12;

  // ── Line items table ─────────────────────────────────────────────────────
  // Header band (navy)
  doc.setFillColor(...BRAND.primary);
  doc.rect(pad, y, W - 2 * pad, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESCRIPTION', pad + 3, y + 5.5);
  doc.text('AMOUNT (AED)', W - pad - 3, y + 5.5, { align: 'right' });
  y += 8;

  // Rows — fall back to a single commission line if line_items is empty/unset.
  const items =
    Array.isArray(invoice.line_items) && invoice.line_items.length
      ? invoice.line_items
      : [{ description: 'Brokerage commission', amount: Number(invoice.commission_amount) || 0 }];

  doc.setTextColor(...BRAND.text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const rowH = 9;
  items.forEach((it, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...BRAND.light);
      doc.rect(pad, y, W - 2 * pad, rowH, 'F');
    }
    const descLines = doc.splitTextToSize(String(it.description || ''), W - 2 * pad - 60);
    doc.text(descLines[0] || '', pad + 3, y + 6);
    doc.text(fmtAED(it.amount), W - pad - 3, y + 6, { align: 'right' });
    y += rowH;
  });

  y += 4;

  // ── Totals block (right-aligned) ─────────────────────────────────────────
  const totalsLabelX = W - pad - 70;
  const drawTotalRow = (label, value, bold = false) => {
    doc.setTextColor(...(bold ? BRAND.primary : BRAND.muted));
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, totalsLabelX, y);
    doc.setTextColor(...BRAND.text);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(`AED ${fmtAED(value)}`, W - pad, y, { align: 'right' });
    y += bold ? 8 : 6;
  };

  drawTotalRow('Subtotal', invoice.commission_amount || 0);
  drawTotalRow('VAT (5%)', invoice.vat_amount || 0);

  // Separator line above Total
  doc.setDrawColor(...BRAND.muted);
  doc.setLineWidth(0.2);
  doc.line(totalsLabelX, y - 2, W - pad, y - 2);
  y += 1;
  drawTotalRow('Total', invoice.total_amount || 0, true);

  // ── Sign-off band (combined signature + stamp PNG) ───────────────────────
  // One image, centered above the footer, scaled to its natural aspect ratio.
  // Bounded by maxW/maxH so an oddly-proportioned source still fits cleanly.
  // Skipped entirely if the asset is missing — the rest of the PDF is unaffected.
  const signoff = await loadImage(signoffUrl);
  if (signoff) {
    const footerTop = H - 18;
    const maxW = 130; // mm
    const maxH = 55;  // mm
    const aspect = signoff.width / signoff.height;
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }
    const x = (W - drawW) / 2;
    const yImg = footerTop - drawH - 6; // 6mm gap above the footer band

    // Small muted caption above the band
    doc.setTextColor(...BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Authorized Signature & Stamp', W / 2, yImg - 3, { align: 'center' });

    try { doc.addImage(signoff.dataUrl, 'PNG', x, yImg, drawW, drawH); } catch { /* ignore bad image */ }
  }

  // ── Footer band ───────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, H - 18, W, 18, 'F');
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, H - 18, W, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${BRAND.name} · Generated ${new Date().toLocaleDateString('en-GB')}`, pad, H - 9);
  doc.setTextColor(...BRAND.accent);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Thank you for your business', W - pad, H - 9, { align: 'right' });

  return doc;
}

// ─── Action buttons (Generate + View) ───────────────────────────────────────
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

      // Today: upload via Base44 storage. Tomorrow (Drive): this whole upload
      // step moves inside the `generateInvoicePDF` function — the button is
      // unchanged.
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Save pdf_url back via the function (asServiceRole + idempotency seam).
      const result = await base44.functions.generateInvoicePDF({
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
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
      title="Open generated PDF in a new tab"
    >
      <ExternalLink className="w-3 h-3" />
      View
    </a>
  );
}
