/**
 * buildMandateDossierPDF.js — THE MANDATE DOSSIER LAYOUT ENGINE.
 *
 * Renders the owner-facing "why list with Erudite" proposal PDF from the output of the
 * forgeMandateDossier backend function: { narrative, data_snapshot, writer, owner_name,
 * version, language }.
 *
 * Doctrine:
 *  - Every NUMBER printed here comes from data_snapshot (computed server-side from live
 *    records). The AI narrative is prose only. This file is the last line of the
 *    fabrication firewall — it never invents or recomputes market figures.
 *  - Brand identity (navy/gold, logo, signature, stamp, TRN, company block) comes from
 *    the shared pdfBrand module so this document matches every other Erudite PDF.
 *  - Full Cyrillic support via Noto Sans (public/fonts) — jsPDF's built-in Helvetica
 *    cannot render Russian, so the Noto faces are embedded in every dossier for
 *    identical typography across EN and RU.
 *
 * Usage:
 *   const doc = await buildMandateDossierPDF(forgeResult);
 *   doc.save(dossierFileName(forgeResult));
 */

import jsPDF from 'jspdf';
import {
  BRAND,
  fmtDate,
  loadImage,
  placeLogo,
  applyEruditeBranding,
  sanitizeFileSegment,
} from '@/lib/pdfBrand';

// ── Layout constants (A4 portrait, mm) ────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;                 // outer margin
const CW = PAGE_W - M * 2;    // content width
const BOTTOM = 272;           // content floor before footer

const fmt0 = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(Math.round(num));
};

const BEDS_LABEL = { studio: 'Studio', '1br': '1BR', '2br': '2BR', '3br': '3BR', '4plus': '4+' };

// ── Localized chrome (headings, labels — narrative prose comes from the forge) ──
const T = {
  en: {
    subtitle: 'A private listing proposal for your property',
    preparedFor: 'PREPARED EXCLUSIVELY FOR',
    preparedBy: 'Prepared by',
    confidential: 'PRIVATE & CONFIDENTIAL',
    letter: 'A Personal Word',
    property: 'Your Property Today',
    valuation: 'AI-ASSISTED VALUATION',
    valuationSub: 'estimated market value',
    perSqft: 'AED / sqft',
    confidence: { high: 'High confidence', medium: 'Medium confidence', low: 'Indicative' },
    valuationPending: 'A formal written valuation is prepared within 48 hours of engagement.',
    valuationDisclaimer: 'Indicative estimate derived from Dubai Land Department transaction data; not a formal RERA valuation.',
    market: 'Market Intelligence',
    mTx: 'Recorded transactions',
    mMedian: 'Median sale price (AED)',
    mMedianSqft: 'Median AED / sqft',
    compsTitle: 'Recorded transactions in the building',
    th: { date: 'Date', beds: 'Layout', sqft: 'Size (sqft)', price: 'Price (AED)', psf: 'AED/sqft' },
    source: (d) => `Source: Dubai Land Department transaction data (DXB Interact)${d ? `, report dated ${fmtDate(d)}` : ''}.`,
    pricing: 'Pricing Strategy',
    scPremium: 'PREMIUM',
    scMarket: 'MARKET',
    scFast: 'VELOCITY',
    anchorNote: { ai_valuation: 'Scenarios anchored on the AI-assisted valuation above.', asking_price: "Scenarios anchored on the owner's stated asking price." },
    why: 'The Erudite Advantage',
    process: 'The Process — Step by Step',
    exclusive: 'The Case for Exclusivity',
    next: 'Your Next Step',
    forCompany: 'For ERUDITE PROPERTY REAL ESTATE',
    page: 'Page',
    unitFacts: { project: 'PROJECT', unit: 'UNIT', layout: 'LAYOUT', size: 'SIZE', tenancy: 'TENANCY', location: 'LOCATION' },
    tenancy: {
      vacant: 'Vacant', tenanted_ejari_valid: 'Tenanted (Ejari valid)', tenanted_ejari_expiring: 'Tenanted (Ejari expiring)',
      tenanted_eviction_notice_served: 'Tenanted (notice served)', owner_occupied: 'Owner-occupied',
    },
  },
  ru: {
    subtitle: 'Персональное предложение для собственника',
    preparedFor: 'ПОДГОТОВЛЕНО ЭКСКЛЮЗИВНО ДЛЯ',
    preparedBy: 'Подготовил',
    confidential: 'КОНФИДЕНЦИАЛЬНО',
    letter: 'Личное обращение',
    property: 'Ваша недвижимость сегодня',
    valuation: 'ОЦЕНКА СТОИМОСТИ (AI)',
    valuationSub: 'оценочная рыночная стоимость',
    perSqft: 'AED / кв. фут',
    confidence: { high: 'Высокая точность', medium: 'Средняя точность', low: 'Ориентировочно' },
    valuationPending: 'Официальная письменная оценка готовится в течение 48 часов после начала сотрудничества.',
    valuationDisclaimer: 'Ориентировочная оценка на основе данных о сделках Земельного департамента Дубая (DLD); не является официальной оценкой RERA.',
    market: 'Аналитика рынка',
    mTx: 'Зарегистрированных сделок',
    mMedian: 'Медианная цена (AED)',
    mMedianSqft: 'Медиана AED / кв. фут',
    compsTitle: 'Зарегистрированные сделки в здании',
    th: { date: 'Дата', beds: 'Планировка', sqft: 'Площадь (кв.фт)', price: 'Цена (AED)', psf: 'AED/кв.фт' },
    source: (d) => `Источник: данные о сделках Земельного департамента Дубая (DXB Interact)${d ? `, отчёт от ${fmtDate(d)}` : ''}.`,
    pricing: 'Ценовая стратегия',
    scPremium: 'ПРЕМИУМ',
    scMarket: 'РЫНОК',
    scFast: 'СКОРОСТЬ',
    anchorNote: { ai_valuation: 'Сценарии рассчитаны от AI-оценки выше.', asking_price: 'Сценарии рассчитаны от заявленной собственником цены.' },
    why: 'Преимущество Erudite',
    process: 'Процесс — шаг за шагом',
    exclusive: 'Аргументы за эксклюзив',
    next: 'Ваш следующий шаг',
    forCompany: 'От имени ERUDITE PROPERTY REAL ESTATE',
    page: 'Стр.',
    unitFacts: { project: 'ПРОЕКТ', unit: 'ЮНИТ', layout: 'ПЛАНИРОВКА', size: 'ПЛОЩАДЬ', tenancy: 'СТАТУС АРЕНДЫ', location: 'РАСПОЛОЖЕНИЕ' },
    tenancy: {
      vacant: 'Свободна', tenanted_ejari_valid: 'Сдана (Ejari действует)', tenanted_ejari_expiring: 'Сдана (Ejari истекает)',
      tenanted_eviction_notice_served: 'Сдана (уведомление вручено)', owner_occupied: 'Проживает собственник',
    },
  },
};

// ── Noto Sans registration (Cyrillic-capable; embedded in every dossier) ──────
let _fontCache = null;
async function loadFontBase64(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Font fetch failed: ${path}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
async function ensureNotoFonts(doc) {
  if (!_fontCache) {
    _fontCache = Promise.all([
      loadFontBase64('/fonts/NotoSans-Regular.ttf'),
      loadFontBase64('/fonts/NotoSans-Bold.ttf'),
    ]).catch((e) => { _fontCache = null; throw e; }); // never cache a transient failure
  }
  const [reg, bold] = await _fontCache;
  doc.addFileToVFS('NotoSans-Regular.ttf', reg);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', bold);
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
}

// ── Main builder ──────────────────────────────────────────────────────────────
export async function buildMandateDossierPDF(forge) {
  const narrative = forge?.narrative || {};
  const snap = forge?.data_snapshot || {};
  const lang = forge?.language === 'ru' ? 'ru' : 'en';
  const t = T[lang];
  const writer = forge?.writer || {};
  const ownerName = forge?.owner_name || '';
  const unit = snap.unit || {};

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await ensureNotoFonts(doc);
  const setF = (style = 'normal', size = 10, color = BRAND.text) => {
    doc.setFont('NotoSans', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  let y = 0;

  // Per-page chrome for content pages (cover has its own design)
  const pageHeader = () => {
    setF('bold', 7.5, BRAND.muted);
    doc.text(`ERUDITE REAL ESTATE — MANDATE DOSSIER · ${t.confidential}`, M, 12, { charSpace: 0.4 });
    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(0.5);
    doc.line(M, 15.5, M + 26, 15.5);
    y = 25;
  };
  const newPage = () => { doc.addPage(); pageHeader(); };
  const ensure = (need) => { if (y + need > BOTTOM) newPage(); };

  // Section header: gold tick + navy title
  const H = (title) => {
    ensure(16);
    doc.setFillColor(...BRAND.gold);
    doc.rect(M, y - 4.2, 2.2, 5.6, 'F');
    setF('bold', 13.5, BRAND.navy);
    doc.text(title, M + 5.5, y);
    y += 9;
  };

  // Wrapped paragraph
  const para = (text, { size = 10.5, lh = 5.1, color = BRAND.text, style = 'normal', width = CW, x = M } = {}) => {
    const str = String(text || '').trim();
    if (!str) return;
    setF(style, size, color);
    const lines = doc.splitTextToSize(str, width);
    for (const line of lines) {
      ensure(lh + 2);
      doc.text(line, x, y);
      y += lh;
    }
  };

  // ══ PAGE 1 — COVER ════════════════════════════════════════════════════════
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, PAGE_W, 112, 'F');
  doc.setFillColor(...BRAND.gold);
  doc.rect(0, 112, PAGE_W, 1.6, 'F');

  setF('bold', 8.5, [255, 255, 255]);
  doc.text('ERUDITE REAL ESTATE · DUBAI', M, 26, { charSpace: 1.2 });
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.9);
  doc.line(M, 32, M + 30, 32);

  setF('bold', 30, [255, 255, 255]);
  doc.text('MANDATE', M, 56);
  doc.text('DOSSIER', M, 69);
  setF('normal', 11, BRAND.gold);
  doc.text(t.subtitle, M, 80);
  const tagline = String(narrative.cover_tagline || '').trim();
  if (tagline) {
    setF('normal', 9.5, [225, 228, 236]);
    const tl = doc.splitTextToSize(tagline, CW);
    doc.text(tl, M, 92);
  }

  // Owner block on white
  setF('bold', 8.5, BRAND.muted);
  doc.text(t.preparedFor, M, 132, { charSpace: 1 });
  setF('bold', 21, BRAND.navy);
  doc.text(doc.splitTextToSize(ownerName || '—', CW), M, 142);
  const unitBits = [unit.project_name, unit.unit_reference ? `Unit ${unit.unit_reference}` : null, unit.unit_layout].filter(Boolean).join('  ·  ');
  setF('normal', 11.5, BRAND.text);
  if (unitBits) doc.text(doc.splitTextToSize(unitBits, CW), M, 152);
  setF('normal', 9.5, BRAND.muted);
  if (unit.location) doc.text(String(unit.location), M, 159);

  doc.setDrawColor(...BRAND.hairline);
  doc.setLineWidth(0.3);
  doc.line(M, 168, PAGE_W - M, 168);

  setF('normal', 9, BRAND.muted);
  doc.text(`${t.preparedBy}:`, M, 176);
  setF('bold', 10.5, BRAND.navy);
  doc.text(`${writer.name || ''}`, M, 182);
  setF('normal', 9, BRAND.muted);
  doc.text(`${writer.position || ''}`, M, 187.5);
  doc.text(fmtDate(forge?.forged_at || new Date().toISOString()), PAGE_W - M, 176, { align: 'right' });

  await placeLogo(doc, { x: PAGE_W / 2 - 26, y: 232, maxW: 52, maxH: 24 });
  setF('normal', 7.2, BRAND.muted);
  doc.text(doc.splitTextToSize(BRAND.tagline, 150), PAGE_W / 2, 264, { align: 'center' });

  // ══ PAGE 2 — PERSONAL LETTER ═══════════════════════════════════════════════
  newPage();
  H(t.letter);
  para(narrative.opening_letter, { size: 11, lh: 5.6 });
  y += 4;
  setF('normal', 9.5, BRAND.muted);
  ensure(10);
  doc.text(`— ${writer.name || ''}, ${writer.position || ''}`, M, y);
  y += 10;

  // ══ YOUR PROPERTY TODAY ════════════════════════════════════════════════════
  ensure(70);
  H(t.property);
  const facts = [
    [t.unitFacts.project, unit.project_name],
    [t.unitFacts.unit, unit.unit_reference],
    [t.unitFacts.layout, unit.unit_layout],
    [t.unitFacts.size, unit.size_sqft ? `${fmt0(unit.size_sqft)} sqft` : null],
    [t.unitFacts.tenancy, unit.tenancy_status ? (t.tenancy[unit.tenancy_status] || unit.tenancy_status) : null],
    [t.unitFacts.location, unit.location],
  ].filter((f) => f[1]);
  const colW = CW / 2;
  let fi = 0;
  const factRowH = 12.5;
  const factsTop = y;
  for (const [label, value] of facts) {
    const col = fi % 2;
    const row = Math.floor(fi / 2);
    const fx = M + col * colW;
    const fy = factsTop + row * factRowH;
    setF('bold', 7.2, BRAND.muted);
    doc.text(String(label), fx, fy, { charSpace: 0.6 });
    setF('bold', 10.5, BRAND.navy);
    doc.text(doc.splitTextToSize(String(value), colW - 8)[0] || '', fx, fy + 5);
    fi++;
  }
  y = factsTop + Math.ceil(facts.length / 2) * factRowH + 3;
  para(narrative.property_position, {});
  y += 3;

  // Valuation panel
  const val = snap.valuation;
  if (val && val.value_aed) {
    ensure(46);
    const panelTop = y;
    doc.setFillColor(...BRAND.light);
    doc.roundedRect(M, panelTop, CW, 38, 2, 2, 'F');
    doc.setFillColor(...BRAND.gold);
    doc.rect(M, panelTop, 2.2, 38, 'F');
    setF('bold', 8, BRAND.gold);
    doc.text(t.valuation, M + 8, panelTop + 8, { charSpace: 1 });
    setF('bold', 21, BRAND.navy);
    doc.text(`AED ${fmt0(val.value_aed)}`, M + 8, panelTop + 18.5);
    setF('normal', 8.5, BRAND.muted);
    const subBits = [
      val.price_sqft ? `${fmt0(val.price_sqft)} ${t.perSqft}` : null,
      val.confidence ? (t.confidence[val.confidence] || val.confidence) : null,
      val.updated_at ? fmtDate(val.updated_at) : null,
    ].filter(Boolean).join('   ·   ');
    doc.text(`${t.valuationSub}   ·   ${subBits}`, M + 8, panelTop + 24.5);
    if (val.basis) {
      setF('normal', 7.8, BRAND.muted);
      const basisLines = doc.splitTextToSize(String(val.basis), CW - 16).slice(0, 2);
      doc.text(basisLines, M + 8, panelTop + 30);
    }
    y = panelTop + 42;
    setF('normal', 7.2, BRAND.muted);
    ensure(6);
    doc.text(doc.splitTextToSize(t.valuationDisclaimer, CW), M, y);
    y += 8;
  } else {
    setF('normal', 9.5, BRAND.navy);
    ensure(8);
    doc.text(doc.splitTextToSize(t.valuationPending, CW), M, y);
    y += 10;
  }

  // ══ MARKET INTELLIGENCE ═══════════════════════════════════════════════════
  const mkt = snap.market;
  const comps = Array.isArray(snap.comps) ? snap.comps : [];
  if (mkt || comps.length || narrative.market_read) {
    ensure(60);
    H(t.market);
    para(narrative.market_read, {});
    y += 3;

    if (mkt) {
      const cards = [
        [t.mTx, mkt.transactions_count != null ? fmt0(mkt.transactions_count) : null],
        [t.mMedian, mkt.median_price_aed ? fmt0(mkt.median_price_aed) : null],
        [t.mMedianSqft, mkt.median_price_sqft ? fmt0(mkt.median_price_sqft) : null],
      ].filter((c) => c[1]);
      if (cards.length) {
        ensure(26);
        const cw = (CW - (cards.length - 1) * 4) / cards.length;
        cards.forEach(([label, valTxt], i) => {
          const cx = M + i * (cw + 4);
          doc.setFillColor(...BRAND.light);
          doc.roundedRect(cx, y, cw, 20, 2, 2, 'F');
          setF('bold', 15, BRAND.navy);
          doc.text(String(valTxt), cx + cw / 2, y + 9.5, { align: 'center' });
          setF('bold', 6.8, BRAND.muted);
          doc.text(doc.splitTextToSize(String(label), cw - 6), cx + cw / 2, y + 15, { align: 'center' });
        });
        y += 26;
      }
    }

    if (comps.length) {
      ensure(20);
      setF('bold', 9.5, BRAND.navy);
      doc.text(t.compsTitle, M, y);
      y += 5;
      const cols = [
        { key: 'date', label: t.th.date, w: 30, align: 'left', fmt: (v) => fmtDate(v) },
        { key: 'beds', label: t.th.beds, w: 30, align: 'left', fmt: (v) => BEDS_LABEL[v] || v || '—' },
        { key: 'sqft', label: t.th.sqft, w: 34, align: 'right', fmt: (v) => (v ? fmt0(v) : '—') },
        { key: 'price_aed', label: t.th.price, w: 48, align: 'right', fmt: (v) => (v ? fmt0(v) : '—') },
        { key: 'price_sqft', label: t.th.psf, w: 36, align: 'right', fmt: (v) => (v ? fmt0(v) : '—') },
      ];
      const rowH = 7;
      const drawHead = () => {
        doc.setFillColor(...BRAND.navy);
        doc.rect(M, y, CW, rowH, 'F');
        setF('bold', 8, [255, 255, 255]);
        let cx = M;
        for (const c of cols) {
          doc.text(c.label, c.align === 'right' ? cx + c.w - 3 : cx + 3, y + 4.8, { align: c.align });
          cx += c.w;
        }
        y += rowH;
      };
      drawHead();
      comps.forEach((row, i) => {
        if (y + rowH > BOTTOM) { newPage(); drawHead(); }
        if (i % 2 === 0) {
          doc.setFillColor(...BRAND.light);
          doc.rect(M, y, CW, rowH, 'F');
        }
        setF('normal', 8.3, BRAND.text);
        let cx = M;
        for (const c of cols) {
          doc.text(String(c.fmt(row[c.key])), c.align === 'right' ? cx + c.w - 3 : cx + 3, y + 4.8, { align: c.align });
          cx += c.w;
        }
        y += rowH;
      });
      y += 4;
      setF('normal', 7.2, BRAND.muted);
      ensure(6);
      doc.text(doc.splitTextToSize(t.source(mkt?.report_date), CW), M, y);
      y += 9;
    }
  }

  // ══ PRICING STRATEGY ═══════════════════════════════════════════════════════
  const pr = snap.pricing;
  if (pr || narrative.pricing_narrative) {
    ensure(66);
    H(t.pricing);
    para(narrative.pricing_narrative, {});
    y += 4;
    if (pr) {
      ensure(46);
      const boxes = [
        { label: t.scPremium, value: pr.premium_aed, desc: narrative.scenario_premium, hero: false },
        { label: t.scMarket, value: pr.market_aed, desc: narrative.scenario_market, hero: true },
        { label: t.scFast, value: pr.fast_aed, desc: narrative.scenario_fast, hero: false },
      ];
      const bw = (CW - 8) / 3;
      const bh = 40;
      boxes.forEach((b, i) => {
        const bx = M + i * (bw + 4);
        if (b.hero) {
          doc.setFillColor(...BRAND.navy);
          doc.roundedRect(bx, y, bw, bh, 2, 2, 'F');
          doc.setDrawColor(...BRAND.gold);
          doc.setLineWidth(0.7);
          doc.roundedRect(bx, y, bw, bh, 2, 2, 'S');
        } else {
          doc.setFillColor(...BRAND.light);
          doc.roundedRect(bx, y, bw, bh, 2, 2, 'F');
        }
        setF('bold', 7.5, b.hero ? BRAND.gold : BRAND.muted);
        doc.text(b.label, bx + bw / 2, y + 7, { align: 'center', charSpace: 1 });
        setF('bold', 13.5, b.hero ? [255, 255, 255] : BRAND.navy);
        doc.text(`AED ${fmt0(b.value)}`, bx + bw / 2, y + 15.5, { align: 'center' });
        setF('normal', 7.4, b.hero ? [215, 220, 230] : BRAND.muted);
        const dl = doc.splitTextToSize(String(b.desc || ''), bw - 8).slice(0, 4);
        doc.text(dl, bx + bw / 2, y + 21.5, { align: 'center' });
      });
      y += bh + 5;
      setF('normal', 7.2, BRAND.muted);
      ensure(6);
      doc.text(t.anchorNote[pr.anchor_source] || '', M, y);
      y += 9;
    }
  }

  // ══ THE ERUDITE ADVANTAGE ═══════════════════════════════════════════════════
  const why = Array.isArray(narrative.why_erudite) ? narrative.why_erudite : [];
  if (why.length) {
    ensure(40);
    H(t.why);
    for (const block of why) {
      ensure(16);
      doc.setFillColor(...BRAND.gold);
      doc.rect(M, y - 3, 2.6, 2.6, 'F');
      setF('bold', 10.5, BRAND.navy);
      doc.text(String(block.title || ''), M + 6, y);
      y += 5;
      para(block.body, { size: 9.3, lh: 4.6, x: M + 6, width: CW - 6, color: BRAND.text });
      y += 3.5;
    }
    y += 2;
  }

  // ══ THE PROCESS ══════════════════════════════════════════════════════════════
  const steps = Array.isArray(narrative.process_steps) ? narrative.process_steps : [];
  if (steps.length) {
    ensure(40);
    H(t.process);
    steps.forEach((s, i) => {
      ensure(18);
      doc.setFillColor(...BRAND.gold);
      doc.circle(M + 4, y - 1, 4, 'F');
      setF('bold', 9.5, BRAND.navy);
      doc.text(String(i + 1), M + 4, y + 0.6, { align: 'center' });
      doc.text(String(s.title || ''), M + 12, y);
      if (s.timeframe) {
        setF('bold', 8, BRAND.gold);
        doc.text(String(s.timeframe), PAGE_W - M, y, { align: 'right' });
      }
      y += 5;
      para(s.body, { size: 9.3, lh: 4.6, x: M + 12, width: CW - 12 });
      y += 3.5;
    });
    y += 2;
  }

  // ══ EXCLUSIVITY + CLOSE ══════════════════════════════════════════════════════
  if (narrative.exclusive_case) {
    ensure(40);
    H(t.exclusive);
    para(narrative.exclusive_case, {});
    y += 4;
  }

  ensure(84);
  H(t.next);
  para(narrative.closing_line, { size: 11, lh: 5.6, color: BRAND.navy, style: 'bold' });
  y += 4;

  // Contact card
  ensure(30);
  const ccTop = y;
  doc.setFillColor(...BRAND.light);
  doc.roundedRect(M, ccTop, CW, 24, 2, 2, 'F');
  setF('bold', 11, BRAND.navy);
  doc.text(String(writer.name || ''), M + 7, ccTop + 8.5);
  setF('normal', 8.5, BRAND.muted);
  doc.text(String(writer.position || ''), M + 7, ccTop + 14);
  setF('normal', 8.5, BRAND.navy);
  doc.text(`${BRAND.phone}   ·   ${BRAND.email}   ·   ${BRAND.website}`, M + 7, ccTop + 19.5);
  y = ccTop + 30;

  // Signature + stamp
  ensure(40);
  setF('normal', 8, BRAND.muted);
  doc.text(t.forCompany, M, y);
  await applyEruditeBranding(doc, { x: M, y: y + 3 });
  y += 34;

  // ══ FOOTERS ══════════════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BRAND.hairline);
    doc.setLineWidth(0.3);
    doc.line(M, 282, PAGE_W - M, 282);
    setF('normal', 6.8, BRAND.muted);
    doc.text(`${BRAND.fullName} · ${BRAND.address} · TRN ${BRAND.vatRegNo}`, M, 287);
    doc.text(`${T[lang].page} ${p} / ${pageCount}`, PAGE_W - M, 287, { align: 'right' });
  }

  return doc;
}

export function dossierFileName(forge) {
  const snap = forge?.data_snapshot || {};
  const bits = [
    'Mandate_Dossier',
    sanitizeFileSegment(forge?.owner_name),
    sanitizeFileSegment(snap?.unit?.unit_reference || ''),
    `v${forge?.version || 1}`,
    (forge?.language || 'en').toUpperCase(),
  ].filter(Boolean);
  return `${bits.join('_')}.pdf`;
}
