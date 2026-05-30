/**
 * buildHandoverPDF.js
 * Generates the Key & Access Handover PDF using jsPDF.
 * Uses lib/pdfBrand.js for all Erudite branding constants.
 */
import jsPDF from 'jspdf';
import { BRAND, loadImage, drawCompanyFooter, applyEruditeBranding } from '@/lib/pdfBrand';

// Scenarios where Erudite/agent is the handing-over party (Block 1 = us).
// In every other scenario the handing-over party signs physically — no stamp.
// Hardcoded set so future scenarios don't auto-stamp by accident.
const ERUDITE_HANDING_OVER = new Set([
  'agent_to_buyer_sale',
  'agent_to_tenant_movein',
  'agent_to_agent_transfer',
  'agent_to_owner_return',
  'agent_to_tenant_commercial',
  'agent_to_buyer_commercial_sale',
]);

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

  // ── Load logo (signature + stamp are loaded inside applyEruditeBranding) ──
  const logo = await loadImage(logoUrl);

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

  // ── Page break if the SIGNATURES section won't fit on the current page ──
  // The section needs roughly 45mm (band header + image band + three sub-lines).
  // If the items checklist + notes have pushed the cursor too low, paint the
  // footer on the current page, start a new page, and continue. The footer at
  // the end of this function then paints on the new page. Without this guard,
  // long-list handovers (e.g. 16-row item checklist) silently clip the entire
  // signatures section behind the fixed-position footer band.
  const SIG_SECTION_H = 45;
  if (y + SIG_SECTION_H > footerTop) {
    drawCompanyFooter(doc, footerTop, W, pad);
    doc.addPage();
    y = 20;
  }

  // ── Signatures (3 evenly spaced blocks) ──────────────────────────────────
  // Block 1: HANDED OVER BY (label from scenario fromLabel). Conditionally
  //          stamped with Erudite signature + stamp when handoverType is in
  //          ERUDITE_HANDING_OVER. Otherwise blank for physical signing.
  // Block 2: RECEIVED BY (label from scenario toLabel). Always blank.
  // Block 3: WITNESS / AGENT. Always blank.
  y = bandHeader(doc, 'SIGNATURES', y, W, pad);
  y += 5;

  const eruditeIsHandingOver = ERUDITE_HANDING_OVER.has(data.handoverType);

  const sigGap = 4;
  const sigBlockW = (W - 2 * pad - 2 * sigGap) / 3;
  const c1X = pad;
  const c2X = c1X + sigBlockW + sigGap;
  const c3X = c2X + sigBlockW + sigGap;

  const blockTopY  = y;
  const imageBandH = 22;          // reserved vertical space for sig/stamp image
  const lineY      = blockTopY + imageBandH;

  // Title + auto-width gold underline, anchored at the block's top edge.
  const drawBlockTitle = (label, x) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(String(label), x, blockTopY);
    const titleW = doc.getTextWidth(String(label)) + 2;
    doc.setFillColor(...GOLD);
    doc.rect(x, blockTopY + 1, titleW, 0.4, 'F');
  };

  const drawSignatureLine = (x) => {
    doc.setDrawColor(...BRAND.text);
    doc.setLineWidth(0.3);
    doc.line(x, lineY, x + sigBlockW, lineY);
  };

  const drawSubLine = (text, x, dy, color = BRAND.text) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...color);
    doc.text(String(text || ''), x, lineY + dy);
  };

  // ─── Block 1: HANDED OVER BY ──────────────────────────────────────────────
  drawBlockTitle(data.fromLabel || 'HANDED OVER BY', c1X);
  if (eruditeIsHandingOver) {
    await applyEruditeBranding(
      doc,
      { x: c1X, y: blockTopY + 5, sigMaxW: 34, sigMaxH: 14, stampMax: 18 },
      { signatureUrl, stampUrl },
    );
    drawSignatureLine(c1X);
    drawSubLine(eruditeAgent, c1X, 4);
    drawSubLine('Erudite Real Estate — ORN 29322', c1X, 8, BRAND.muted);
  } else {
    drawSignatureLine(c1X);
    drawSubLine(fromParty.name || '', c1X, 4);
    drawSubLine('Date: ___________________', c1X, 8, BRAND.muted);
  }

  // ─── Block 2: RECEIVED BY (always blank) ──────────────────────────────────
  drawBlockTitle(data.toLabel || 'RECEIVED BY', c2X);
  drawSignatureLine(c2X);
  drawSubLine(toParty.name || '', c2X, 4);
  drawSubLine('Date: ___________________', c2X, 8, BRAND.muted);

  // ─── Block 3: WITNESS / AGENT (always blank) ──────────────────────────────
  drawBlockTitle('WITNESS / AGENT', c3X);
  drawSignatureLine(c3X);
  drawSubLine('', c3X, 4);
  drawSubLine('Date: ___________________', c3X, 8, BRAND.muted);

  // ── Footer ────────────────────────────────────────────────────────────────
  drawCompanyFooter(doc, footerTop, W, pad);

  return doc;
}