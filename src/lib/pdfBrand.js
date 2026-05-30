/**
 * pdfBrand.js — Erudite Property Real Estate
 *
 * Single source of truth for all PDF branding across the CRM.
 * Import this into any PDF-generating component so every document
 * automatically carries the company identity, TRN, bank details,
 * signature, and stamp without per-document configuration.
 *
 * Usage:
 *   import { BRAND, BANK, COMPANY, loadImage, fmtAED, fmtDate, getAssets } from '@/lib/pdfBrand';
 */

// ─── Colour palette ────────────────────────────────────────────────────────────
export const BRAND = {
  name:        'ERUDITE REAL ESTATE',
  fullName:    'ERUDITE PROPERTY REAL ESTATE',
  address:     'Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, United Arab Emirates',
  phone:       '+971 58 180 6000',
  email:       'info@erudite-estate.com',
  website:     'www.eruditeproperty.com',
  tagline:     'A Premier Real Estate Advisory Firm Specializing in Luxury Residential, Commercial, Investment, and Off-Plan Properties Across Dubai.',
  vatRegNo:    '104029757200003',
  // RGB tuples for jsPDF
  navy:        [26, 39, 68],
  gold:        [201, 168, 74],
  light:       [248, 250, 252],
  text:        [30, 41, 59],
  muted:       [110, 120, 140],
  hairline:    [220, 225, 235],
};

// ─── Bank / payment details ────────────────────────────────────────────────────
export const BANK = {
  name:    'ADCB',
  account: '12366874920001',
  iban:    'AE780030012366874920001',
  swift:   'ADCBAEAAXXX',
  branch:  '261 / Khaled Bin Waleed St',
};

// ─── Asset URLs (signature + stamp) ───────────────────────────────────────────
// Eagerly resolved at module load so any PDF component can use them.
const _ASSETS = import.meta.glob('/src/assets/*.png', {
  eager:  true,
  query:  '?url',
  import: 'default',
});

export const SIGNATURE_URL = _ASSETS['/src/assets/signature.png'] || null;
export const STAMP_URL     = _ASSETS['/src/assets/stamp.png']     || null;
export const LOGO_URL      = _ASSETS['/src/assets/logo.png']      || null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a number as AED with 2 decimal places. */
export function fmtAED(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

/** Format a date string as DD MMM YYYY. */
export function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(s);
  }
}

/**
 * Load an image URL and return { dataUrl, width, height } via canvas,
 * or null if unavailable (so PDFs never crash on missing assets).
 */
export function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width  = img.naturalWidth  || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Sanitise a string for use as a filename segment. */
export function sanitizeFileSegment(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'document';
}

/**
 * Place the Erudite logo on a jsPDF page (mm units), aspect-fitted into a
 * box, anchored top-left. Wraps load + scale + addImage with try/catch so a
 * missing/bad asset never crashes PDF generation. Each generator passes its
 * own layout because the header bands differ per template.
 *
 * @param {jsPDF} doc
 * @param {{x:number,y:number,maxW:number,maxH:number}} layout - mm units
 * @param {string} [url=LOGO_URL] - override (e.g. localStorage data URI)
 */
export async function placeLogo(doc, layout = { x: 14, y: 8, maxW: 32, maxH: 16 }, url = LOGO_URL) {
  const logo = await loadImage(url);
  if (!logo) return;
  const aspect = logo.width / logo.height;
  let w = layout.maxW;
  let h = w / aspect;
  if (h > layout.maxH) { h = layout.maxH; w = h * aspect; }
  try { doc.addImage(logo.dataUrl, 'PNG', layout.x, layout.y, w, h); } catch { /* ignore bad image */ }
}

/**
 * Place the Erudite signature + stamp on a jsPDF page (mm units). Signature
 * is anchored top-left of the layout box; the round stamp overlaps slightly
 * to the right, mimicking a real wet seal beside the signature.
 *
 * Sources default to pdfBrand's SIGNATURE_URL / STAMP_URL (repo assets)
 * but can be overridden via opts (e.g. KeyHandover's localStorage data URIs).
 * Missing/bad assets are silently skipped — generation never crashes.
 *
 * @param {jsPDF} doc
 * @param {{x:number, y:number, sigMaxW?:number, sigMaxH?:number, stampMax?:number}} layout
 * @param {{signatureUrl?:string, stampUrl?:string}} [opts]
 */
export async function applyEruditeBranding(doc, layout, opts = {}) {
  const sigMaxW  = layout.sigMaxW  ?? 48;
  const sigMaxH  = layout.sigMaxH  ?? 18;
  const stampMax = layout.stampMax ?? 26;
  const signatureUrl = opts.signatureUrl ?? SIGNATURE_URL;
  const stampUrl     = opts.stampUrl     ?? STAMP_URL;

  const [signature, stamp] = await Promise.all([
    loadImage(signatureUrl),
    loadImage(stampUrl),
  ]);

  if (signature) {
    const aspect = signature.width / signature.height;
    let sw = sigMaxW;
    let sh = sw / aspect;
    if (sh > sigMaxH) { sh = sigMaxH; sw = sh * aspect; }
    try { doc.addImage(signature.dataUrl, 'PNG', layout.x, layout.y, sw, sh); } catch { /* ignore */ }
  }
  if (stamp) {
    const aspect = stamp.width / stamp.height;
    let stW = stampMax;
    let stH = stW / aspect;
    // Stamp just past the signature with a 2mm overlap — real wet-seal look.
    const stX = layout.x + sigMaxW - 2;
    const stY = layout.y - 2;
    try { doc.addImage(stamp.dataUrl, 'PNG', stX, stY, stW, stH); } catch { /* ignore */ }
  }
}

/**
 * Draw the standard Erudite company footer band onto a jsPDF document.
 *
 * @param {jsPDF} doc
 * @param {number} footerTop  - Y position where the footer starts (mm from top)
 * @param {number} pageWidth  - Page width in mm (default A4 = 210)
 * @param {number} pad        - Left/right padding in mm (default 14)
 */
export function drawCompanyFooter(doc, footerTop, pageWidth = 210, pad = 14) {
  const W = pageWidth;

  // Navy band
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, footerTop, W, 44, 'F');

  // Gold top rule
  doc.setFillColor(...BRAND.gold);
  doc.rect(0, footerTop, W, 1.4, 'F');

  // Company name — prominent
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(BRAND.fullName, W / 2, footerTop + 9, { align: 'center' });

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(210, 215, 225);
  doc.text(BRAND.address, W / 2, footerTop + 15, { align: 'center' });

  // Contact line — gold
  doc.setTextColor(...BRAND.gold);
  doc.setFontSize(7);
  doc.text(
    `T: ${BRAND.phone}  |  E: ${BRAND.email}  |  W: ${BRAND.website}`,
    W / 2, footerTop + 21, { align: 'center' }
  );

  // Tagline — small italic
  doc.setTextColor(180, 190, 205);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text(BRAND.tagline, W / 2, footerTop + 28, { align: 'center' });

  // Thin rule
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.2);
  doc.line(pad, footerTop + 32, W - pad, footerTop + 32);

  // Generated date | Thank you
  doc.setTextColor(160, 170, 185);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, pad, footerTop + 37);
  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Thank you for your business', W - pad, footerTop + 37, { align: 'right' });
}