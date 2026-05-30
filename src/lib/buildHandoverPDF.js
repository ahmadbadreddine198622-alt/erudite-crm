/**
 * buildHandoverPDF.js
 * Generates the Key & Access Handover PDF using jsPDF.
 * Uses lib/pdfBrand.js for all Erudite branding constants.
 */
import jsPDF from 'jspdf';
import { BRAND, loadImage, drawCompanyFooter } from '@/lib/pdfBrand';

const NAVY = BRAND.navy;   // [26,39,68]
const GOLD = BRAND.gold;   // [201,168,74]

function cell(doc, text, x, y, w, opts = {}) {
  const { align = 'left', bold = false, size = 9, color = BRAND.text } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const str = String(text ?? '—');
  doc.text(str, align === 'right' ? x + w : align === 'center' ? x + w / 2 : x, y, { align });
}

function bandHeader(doc, label, y, W, pad) {
  doc.setFillColor(...NAVY);
  doc.rect(0, y, W, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(label, pad, y + 5.5);
  return y + 8;
}

function kv(doc, label, value, x, y, labelW = 36) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(label, x, y);
  doc.setTextColor(...BRAND.text);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value || '—'), x + labelW, y);
}

export async function buildHandoverPDF(data, assets = {}) {
  const {
    property,   // { address, building, unit, date, reference }
    handoverType,
    fromParty,  // { name, contact }
    toParty,    // { name, contact }
    items = [],
    notes = '',
    eruditeAgent = 'Ahmad Badreddine',
  } = data;

  const { logoUrl, signatureUrl, stampUrl } = assets;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const pad = 14;
  const footerH = 44;
  const footerTop = 297 - footerH;

  // ── Load images in parallel ──────────────────────────────────────────────
  const [logo, signature, stamp] = await Promise.all([
    loadImage(logoUrl),
    loadImage(signatureUrl),
    loadImage(stampUrl),
  ]);

  // ── Header: logo + title ──────────────────────────────────────────────────
  let y = 10;

  // Logo top-left
  if (logo) {
    const maxH = 16;
    const aspect = logo.width / logo.height;
    const lW = maxH * aspect;
    try { doc.addImage(logo.dataUrl, 'PNG', pad, y, lW, maxH); } catch { /* ignore */ }
  }

  // Gold title block top-right
  const titleW = 90;
  const titleH = 20;
  const titleX = W - pad - titleW;
  doc.setFillColor(...GOLD);
  doc.rect(titleX, y, titleW, titleH, 'F');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('KEY & ACCESS', titleX + titleW / 2, y + 7.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text('HANDOVER', titleX + titleW / 2, y + 14.5, { align: 'center' });

  y += 26;

  // Thin navy rule under header
  doc.setFillColor(...NAVY);
  doc.rect(0, y, W, 1, 'F');
  y += 6;

  // ── Property Details ─────────────────────────────────────────────────────
  y = bandHeader(doc, 'PROPERTY DETAILS', y, W, pad);
  y += 6;

  const col1X = pad;
  const col2X = W / 2 + 4;
  kv(doc, 'Address:', property.address, col1X, y);
  kv(doc, 'Reference No:', property.reference, col2X, y);
  y += 5.5;
  kv(doc, 'Building / Project:', property.building, col1X, y);
  kv(doc, 'Handover Date:', property.date, col2X, y);
  y += 5.5;
  kv(doc, 'Unit / Villa No:', property.unit, col1X, y);

  y += 9;

  // ── Parties ───────────────────────────────────────────────────────────────
  y = bandHeader(doc, 'PARTIES', y, W, pad);
  y += 6;

  const halfW = (W - 2 * pad - 8) / 2;

  // From party
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(data.fromLabel || 'HANDED OVER BY', col1X, y);
  doc.setFillColor(...GOLD);
  doc.rect(col1X, y + 1, 24, 0.4, 'F');
  y += 5;
  kv(doc, 'Name:', fromParty.name, col1X, y, 20);
  y += 5;
  kv(doc, 'Contact:', fromParty.contact, col1X, y, 20);

  // To party
  const r = y - 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(data.toLabel || 'RECEIVED BY', col2X, r);
  doc.setFillColor(...GOLD);
  doc.rect(col2X, r + 1, 22, 0.4, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  kv(doc, 'Name:', toParty.name, col2X, r + 5, 20);
  kv(doc, 'Contact:', toParty.contact, col2X, r + 10, 20);

  y += 9;

  // ── Items Table ───────────────────────────────────────────────────────────
  y = bandHeader(doc, 'ITEMS CHECKLIST', y, W, pad);

  const tW = W - 2 * pad;
  const cols = { type: tW * 0.17, desc: tW * 0.35, qty: tW * 0.1, remarks: tW * 0.38 };
  const colX = {
    type: pad,
    desc: pad + cols.type,
    qty: pad + cols.type + cols.desc,
    remarks: pad + cols.type + cols.desc + cols.qty,
  };

  // Sub-header row
  doc.setFillColor(240, 243, 248);
  doc.rect(pad, y, tW, 7, 'F');
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('TYPE', colX.type + 2, y + 4.8);
  doc.text('DESCRIPTION', colX.desc + 2, y + 4.8);
  doc.text('QTY', colX.qty + cols.qty / 2, y + 4.8, { align: 'center' });
  doc.text('REMARKS / CODE', colX.remarks + 2, y + 4.8);
  y += 7;

  const TYPE_COLORS = {
    'Key':             NAVY,
    'Access Card':     [34, 139, 87],
    'Smart Lock Code': [...GOLD],
  };

  items.forEach((item, i) => {
    const rowH = 8;
    if (i % 2 === 0) {
      doc.setFillColor(...BRAND.light);
      doc.rect(pad, y, tW, rowH, 'F');
    }

    const typeColor = TYPE_COLORS[item.type] || BRAND.text;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...typeColor);
    doc.text(item.type || '', colX.type + 2, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.text);
    doc.setFontSize(8.5);
    doc.text(String(item.description || ''), colX.desc + 2, y + 5.5);

    if (item.type !== 'Smart Lock Code') {
      doc.text(String(item.qty ?? ''), colX.qty + cols.qty / 2, y + 5.5, { align: 'center' });
    }
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    const remarksStr = item.type === 'Smart Lock Code'
      ? `Code: ${item.remarks || '—'}`
      : (item.remarks || '');
    doc.text(remarksStr, colX.remarks + 2, y + 5.5);

    y += rowH;
  });

  doc.setDrawColor(...BRAND.hairline);
  doc.setLineWidth(0.2);
  doc.line(pad, y, pad + tW, y);
  y += 8;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (notes && notes.trim()) {
    y = bandHeader(doc, 'NOTES', y, W, pad);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.text);
    const noteLines = doc.splitTextToSize(notes.trim(), tW);
    doc.text(noteLines, pad, y);
    y += noteLines.length * 4.5 + 8;
  }

  // ── Declaration ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    'The receiving party confirms receipt of all keys, access cards and access codes listed above in good working condition.',
    pad, y, { maxWidth: tW }
  );
  y += 10;

  // ── Signatures ────────────────────────────────────────────────────────────
  y = bandHeader(doc, 'SIGNATURES', y, W, pad);
  y += 5;

  const sigColW = halfW;

  // Erudite side (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text('ERUDITE REAL ESTATE', col1X, y);
  doc.setFillColor(...GOLD);
  doc.rect(col1X, y + 1, 36, 0.4, 'F');
  y += 5;

  // Place signature image
  if (signature) {
    const sigMaxW = 48;
    const sigMaxH = 18;
    const aspect = signature.width / signature.height;
    let sw = sigMaxW;
    let sh = sw / aspect;
    if (sh > sigMaxH) { sh = sigMaxH; sw = sh * aspect; }
    try { doc.addImage(signature.dataUrl, 'PNG', col1X, y, sw, sh); } catch { /* ignore */ }
  }

  // Place stamp (circular) — overlay to the right of sig
  if (stamp) {
    const stMax = 26;
    const aspect = stamp.width / stamp.height;
    let stW = stMax;
    let stH = stW / aspect;
    try { doc.addImage(stamp.dataUrl, 'PNG', col1X + 46, y - 2, stW, stH); } catch { /* ignore */ }
  }

  const lineY = y + 22;
  doc.setDrawColor(...BRAND.text);
  doc.setLineWidth(0.3);
  doc.line(col1X, lineY, col1X + sigColW, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.text);
  doc.text(eruditeAgent, col1X, lineY + 4);
  doc.setTextColor(...BRAND.muted);
  doc.text('Erudite Real Estate — ORN 29322', col1X, lineY + 8);

  // Other party side (right)
  const sigY0 = y - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(data.toLabel || 'RECEIVED BY', col2X, sigY0);
  doc.setFillColor(...GOLD);
  doc.rect(col2X, sigY0 + 1, 22, 0.4, 'F');
  doc.setDrawColor(...BRAND.text);
  doc.setLineWidth(0.3);
  doc.line(col2X, lineY, col2X + sigColW - 4, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.text);
  doc.text(toParty.name || '', col2X, lineY + 4);
  doc.setTextColor(...BRAND.muted);
  doc.text('Date: ___________________', col2X, lineY + 8);

  // ── Footer ────────────────────────────────────────────────────────────────
  drawCompanyFooter(doc, footerTop, W, pad);

  return doc;
}