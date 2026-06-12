import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const COMPANY = {
  name_en: "ERUDITE REAL ESTATE",
  name_ar: "الإرودايت للعقارات",
  address: "",
  po_box:  "",
  phone:   "+971 58 180 6000",
  email:   "",
  website: "",
  orn:     "29322",
  brn:     "34625",
};

const PAGE_W = 595.28, PAGE_H = 841.89, M = 48;
const NAVY  = rgb(0.058, 0.089, 0.162);
const GOLD  = rgb(0.96, 0.623, 0.04);
const GRAY  = rgb(0.42, 0.45, 0.50);
const INK   = rgb(0.10, 0.12, 0.16);
const LIGHT = rgb(0.95, 0.96, 0.98);
const WHITE = rgb(1, 1, 1);

function isFilled(v) {
  return typeof v === "string" && v.trim() !== "" && !/<<<|FILL/i.test(v);
}

function sanitize(s) {
  return String(s ?? "").replace(/[^\x00-\xFF]/g, "?");
}

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getUTCMonth()];
  return `${String(dt.getUTCDate()).padStart(2,"0")} ${mon} ${dt.getUTCFullYear()}`;
}

function formatAED(amount) {
  const num = Number(amount) || 0;
  const hasFraction = Math.round(num * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function intToWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const below1000 = (num) => {
    let s = "";
    if (num >= 100) { s += ones[Math.floor(num/100)] + " Hundred"; num %= 100; if (num) s += " "; }
    if (num >= 20) { s += tens[Math.floor(num/10)]; num %= 10; if (num) s += " " + ones[num]; }
    else if (num > 0) s += ones[num];
    return s;
  };
  if (n === 0) return "Zero";
  const groups = ["","Thousand","Million","Billion","Trillion"];
  let s = "", g = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) s = below1000(chunk) + (groups[g] ? " " + groups[g] : "") + (s ? " " + s : "");
    n = Math.floor(n / 1000); g++;
  }
  return s.trim();
}

function amountInWords(amount) {
  const num = Math.max(0, Number(amount) || 0);
  const dirhams = Math.floor(num);
  const fils = Math.round((num - dirhams) * 100);
  let w = intToWords(dirhams) + " Dirham" + (dirhams === 1 ? "" : "s");
  if (fils > 0) w += " and " + intToWords(fils) + " Fils";
  return w + " Only";
}

function wrapText(text, font, size, maxW) {
  const out = [];
  for (const para of String(text ?? "").split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      let w;
      try { w = font.widthOfTextAtSize(test, size); } catch { w = font.widthOfTextAtSize(sanitize(test), size); }
      if (w > maxW && line) { out.push(line); line = word; } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function fitInto(img, maxW, maxH) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  return { width: img.width * s, height: img.height * s };
}

async function embedImage(pdf, b64) {
  if (!b64 || typeof b64 !== "string") return null;
  try {
    let raw = b64.trim();
    let mime = null;
    const m = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is);
    if (m) { mime = m[1].toLowerCase(); raw = m[2]; }
    raw = raw.replace(/\s/g, "");
    const bytes = decodeBase64(raw);
    if (!bytes || !bytes.length) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xFF && bytes[1] === 0xD8;
    if (isPng || mime?.includes("png")) return await pdf.embedPng(bytes);
    if (isJpg || mime?.includes("jpeg") || mime?.includes("jpg")) return await pdf.embedJpg(bytes);
    try { return await pdf.embedPng(bytes); } catch { return await pdf.embedJpg(bytes); }
  } catch { return null; }
}

function drawText(page, str, x, yTop, opts = {}) {
  const { size = 10, font, color = INK, align = "left" } = opts;
  if (!font) return;
  let s = sanitize(String(str ?? ""));
  let w;
  try { w = font.widthOfTextAtSize(s, size); } catch { w = size * s.length * 0.5; }
  let drawX = x;
  if (align === "right") drawX = x - w;
  else if (align === "center") drawX = x - w / 2;
  try { page.drawText(s, { x: drawX, y: PAGE_H - yTop - size, size, font, color }); } catch {}
}

async function buildPdf({ record, company, logoB64, signatureB64, stampB64 }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logo = await embedImage(pdf, logoB64);
  const signature = await embedImage(pdf, signatureB64);
  const stamp = await embedImage(pdf, stampB64);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const rightX = PAGE_W - M;
  const contentW = PAGE_W - 2 * M;

  // Header
  const headerTop = M;
  if (logo) {
    const d = fitInto(logo, 150, 72);
    page.drawImage(logo, { x: M, y: PAGE_H - headerTop - d.height, width: d.width, height: d.height });
  } else {
    drawText(page, company.name_en, M, headerTop + 8, { size: 20, font: bold, color: NAVY });
  }

  drawText(page, company.name_en, rightX, headerTop, { size: 13, font: bold, color: NAVY, align: "right" });
  let lineY = headerTop + 17;
  const letterhead = [company.phone, company.email, company.website, `ORN ${company.orn}  |  BRN ${company.brn}`].filter(isFilled);
  for (const line of letterhead) {
    drawText(page, line, rightX, lineY, { size: 7.5, font: helv, color: GRAY, align: "right" });
    lineY += 10;
  }

  const ruleY = Math.max(lineY + 6, headerTop + 80);
  page.drawRectangle({ x: M, y: PAGE_H - ruleY, width: contentW, height: 2, color: GOLD });

  let y = ruleY + 18;

  // Title band
  const bandH = 42;
  page.drawRectangle({ x: M, y: PAGE_H - y - bandH, width: contentW, height: bandH, color: NAVY });
  page.drawRectangle({ x: M, y: PAGE_H - y - bandH, width: 4, height: bandH, color: GOLD });
  drawText(page, "ACKNOWLEDGEMENT / RECEIPT", M + 16, y + 10, { size: 14, font: bold, color: WHITE });
  if (record.ack_number) {
    drawText(page, String(record.ack_number), rightX - 14, y + 7, { size: 12, font: bold, color: GOLD, align: "right" });
  }
  const dateStr = formatDate(record.ack_date);
  if (dateStr) {
    drawText(page, dateStr, rightX - 14, y + 24, { size: 9, font: helv, color: rgb(0.85, 0.87, 0.9), align: "right" });
  }
  y += bandH + 24;

  // Body fields
  const field = (label, value, size = 11) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    drawText(page, label.toUpperCase(), M, y, { size: 8, font: bold, color: GRAY });
    y += 13;
    for (const ln of wrapText(value, helv, size, contentW)) {
      drawText(page, ln, M, y, { size, font: helv, color: INK });
      y += size + 4;
    }
    y += 8;
  };

  field("Client", record.client_name);
  if (record.client_phone) field("Phone", record.client_phone);
  field("Subject", record.subject);
  field("Details", record.details);

  const isPayment = ["payment_received", "cheque_received"].includes(record.ack_type);
  if (isPayment && record.amount_aed) {
    const boxTop = y;
    const boxH = 96;
    page.drawRectangle({ x: M, y: PAGE_H - boxTop - boxH, width: contentW, height: boxH, color: LIGHT });
    page.drawRectangle({ x: M, y: PAGE_H - boxTop - boxH, width: 4, height: boxH, color: GOLD });
    drawText(page, "AMOUNT RECEIVED", M + 16, boxTop + 12, { size: 8, font: bold, color: GRAY });
    drawText(page, "AED " + formatAED(record.amount_aed), M + 16, boxTop + 24, { size: 20, font: bold, color: NAVY });
    drawText(page, amountInWords(record.amount_aed), M + 16, boxTop + 52, { size: 9, font: helv, color: INK });
    const meta = [];
    if (isFilled(record.payment_method)) meta.push("Method: " + record.payment_method);
    if (isFilled(record.reference)) meta.push("Ref: " + record.reference);
    if (isFilled(record.property_ref)) meta.push("Property: " + record.property_ref);
    if (meta.length) drawText(page, meta.join("     "), M + 16, boxTop + 70, { size: 9, font: helv, color: GRAY });
    y = boxTop + boxH + 22;
  } else if (record.property_ref) {
    field("Property Reference", record.property_ref);
  }

  // Footer sign-off
  let fy = Math.max(y + 24, PAGE_H - 210);
  drawText(page, "Acknowledged by:", M, fy, { size: 9, font: bold, color: NAVY });
  fy += 18;

  let blockBottom = fy;
  if (signature) {
    const d = fitInto(signature, 150, 56);
    page.drawImage(signature, { x: M, y: PAGE_H - fy - d.height, width: d.width, height: d.height });
    blockBottom = fy + d.height;
    if (stamp) {
      const sd = fitInto(stamp, 120, 120);
      page.drawImage(stamp, { x: M + d.width - 30, y: PAGE_H - (fy - 12) - sd.height, width: sd.width, height: sd.height, opacity: 0.92 });
      blockBottom = Math.max(blockBottom, (fy - 12) + sd.height);
    }
  } else if (stamp) {
    const sd = fitInto(stamp, 120, 120);
    page.drawImage(stamp, { x: M, y: PAGE_H - fy - sd.height, width: sd.width, height: sd.height, opacity: 0.92 });
    blockBottom = fy + sd.height;
  }

  let by = blockBottom + 16;
  page.drawRectangle({ x: M, y: PAGE_H - by, width: 220, height: 0.8, color: GRAY });
  by += 6;
  if (isFilled(record.issued_by_email)) {
    drawText(page, record.issued_by_email + "   (Issuing Agent)", M, by, { size: 9, font: helv, color: INK });
  }

  const bottomLine = [company.name_en, company.phone].filter(isFilled).join("   •   ");
  if (bottomLine) {
    drawText(page, bottomLine, PAGE_W / 2, PAGE_H - 26, { size: 7, font: helv, color: GRAY, align: "center" });
  }

  return await pdf.save();
}

Deno.serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const base44 = createClientFromRequest(req);

    let body;
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers }); }

    const { acknowledgement_id, logo_base64, signature_base64, stamp_base64 } = body || {};
    if (!acknowledgement_id) return new Response(JSON.stringify({ error: "acknowledgement_id is required" }), { status: 400, headers });

    // Load record
    let record;
    try {
      const results = await base44.entities.Acknowledgement.filter({ id: acknowledgement_id });
      record = Array.isArray(results) ? results[0] : results;
    } catch {
      const all = await base44.entities.Acknowledgement.list();
      record = (all || []).find(r => r.id === acknowledgement_id);
    }
    if (!record) return new Response(JSON.stringify({ error: `Acknowledgement ${acknowledgement_id} not found` }), { status: 404, headers });

    const bytes = await buildPdf({
      record,
      company: COMPANY,
      logoB64: logo_base64,
      signatureB64: signature_base64,
      stampB64: stamp_base64,
    });

    if (!bytes || bytes.length === 0) {
      return new Response(JSON.stringify({ error: "PDF generation produced empty output" }), { status: 500, headers });
    }

    const pdf_base64 = encodeBase64(bytes);
    const safeBase = `${record.ack_number ?? acknowledgement_id} - ${record.client_name ?? "Client"}`
      .replace(/[\/\\:*?"<>|\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
    const filename = `${safeBase}.pdf`;

    // Update record status to issued
    try {
      await base44.entities.Acknowledgement.update(acknowledgement_id, { status: "issued" });
    } catch {}

    return new Response(JSON.stringify({ pdf_base64, drive_url: null, filename, note: "PDF generated successfully" }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error: " + (e?.message ?? String(e)) }), { status: 500, headers });
  }
});