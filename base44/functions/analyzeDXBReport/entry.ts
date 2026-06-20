import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * analyzeDXBReport — extract a DXB Interact PDF into MarketTransactions, compute
 * market stats on the MarketReport, and fan out AI valuations to matching
 * LandlordProperty records.
 *
 * Input: { market_report_id }
 * Secret: ANTHROPIC_API_KEY. Model: claude-opus-4-8 (PDF document input).
 * Idempotent: deletes this report's existing MarketTransactions before re-extracting.
 *
 * Key correctness fixes (from real PDF analysis):
 *   1. Column-order validation: price_aed / area_sqft must ≈ price_per_sqft (±5%).
 *      Rows that fail are skipped and logged.
 *   2. Outlier filtering: rows whose price_per_sqft < 60% of the report median are
 *      flagged is_outlier=true and excluded from valuations (fractional/partial transfers).
 *   3. Valuation weighting: ready comps preferred for ready subject; offplan weighted down.
 *   4. Project name normalization: "Peninsula Two" / "Peninsula 2" / "PENINSULA2" etc.
 *      all match the same canonical form.
 */

const MODEL = 'claude-opus-4-8';
const DEFAULT_EVENT_DATE = '2026-02-28';
// Outlier threshold: price_per_sqft below this fraction of the report median is a garbage row
const OUTLIER_THRESHOLD = 0.60;
// Column cross-check: price/sqft derived from price÷area must be within this fraction of stated pps
const PPS_TOLERANCE = 0.05;

// ── Utilities ────────────────────────────────────────────────────────────────

function median(nums) {
  const a = nums.filter((n) => typeof n === 'number' && !isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function round(n) { return n == null ? null : Math.round(n); }
function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}
function toDate(s) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }

function abToBase64(ab) {
  const bytes = new Uint8Array(ab);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Normalize project name: strip spaces/punctuation, lower-case, replace word-form numbers
function normalizeProjectName(raw) {
  const s = String(raw || '').toLowerCase().trim();
  // Replace common word-form ordinals and numbers
  const wordNums = { 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
                     'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10' };
  let out = s;
  for (const [word, digit] of Object.entries(wordNums)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }
  // Strip punctuation/spaces for comparison
  return out.replace(/[\s\-_,\.]+/g, '');
}

const BED_ENUM = ['studio', '1br', '2br', '3br', '4plus'];
function normalizeBedrooms(raw) {
  const s = String(raw ?? '').toLowerCase().trim();
  if (BED_ENUM.includes(s)) return s;
  if (/studio/.test(s)) return 'studio';
  // "1 bed", "1br", "1 bedroom"
  if (/^1\s*(bed|br)/.test(s) || s === '1') return '1br';
  if (/^2\s*(bed|br)/.test(s) || s === '2') return '2br';
  if (/^3\s*(bed|br)/.test(s) || s === '3') return '3br';
  const n = parseInt(s, 10);
  if (!isNaN(n)) {
    if (n <= 0) return 'studio';
    if (n === 1) return '1br'; if (n === 2) return '2br'; if (n === 3) return '3br'; return '4plus';
  }
  return null;
}
function propertyBedType(prop) {
  if (String(prop?.property_type || '').toLowerCase() === 'studio') return 'studio';
  const n = num(prop?.bedrooms);
  if (n == null) return null;
  if (n <= 0) return 'studio'; if (n === 1) return '1br'; if (n === 2) return '2br'; if (n === 3) return '3br'; return '4plus';
}
function normalizeSaleStatus(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (/off.?plan|primary|offplan/.test(s)) return 'offplan';
  if (/ready|secondary|resale|completed/.test(s)) return 'ready';
  return null;
}

function weightedMedian(items) {
  const expanded = [];
  for (const it of items) {
    if (it.value == null) continue;
    const w = Math.max(1, Math.round(it.weight || 1));
    for (let i = 0; i < w; i++) expanded.push(it.value);
  }
  return median(expanded);
}

async function deleteExistingTransactions(svc, reportId) {
  try {
    const existing = await svc.entities.MarketTransaction.filter({ market_report_id: reportId }, '-created_date', 5000);
    for (const t of existing || []) {
      try { await svc.entities.MarketTransaction.delete(t.id); } catch (_) {}
    }
    return (existing || []).length;
  } catch (_) { return 0; }
}

// ── Claude extraction ────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are extracting transaction rows from a DXB Interact (Dubai Land Department) "Sales Performance Summary" PDF for a single building/project.

CRITICAL COLUMN ORDER for the transaction table rows:
  Location | Status (Ready/Offplan) | Apartment No. XXX | Price (capital_gain%) | price_per_sqft | area_sqft | bedroom_type | Date | Sold by

Example row: "808 / Ready / Apt No. 808 / 1,075,000 (+44%) / 2,535 / 424 / Studio / Jun 2026 / ..."
Maps to: unit_number="808", sale_status="ready", price_aed=1075000, price_per_sqft=2535, area_sqft=424, bedrooms="studio", transaction_date="2026-06-01"

DO NOT SWAP price_per_sqft and area_sqft. The MIDDLE number (~2,000-4,000 range) is price/sqft; the NEXT number (~200-2000 range) is area in sqft.

Return ONLY a strict JSON array — no prose, no markdown, no code fences. Each element:
{
  "unit_number": string,
  "transaction_date": "YYYY-MM-DD",
  "price_aed": number,
  "area_sqft": number,
  "price_per_sqft": number,
  "bedrooms": "studio" | "1br" | "2br" | "3br" | "4plus",
  "sale_status": "offplan" | "ready"
}

Rules:
- Extract EVERY transaction row. Do not summarize or sample.
- IGNORE header KPI summary tiles (totals, averages, counts) at the top of page 1.
- IGNORE capital gain %, appreciation %, sold by / agent / broker columns — do not put them in the output.
- bedrooms: "Studio"→"studio"; "1 Bed"/"1 BR"→"1br"; "2 Beds"/"2 BR"→"2br"; "3 Beds"→"3br"; 4+→"4plus".
- sale_status: off-plan/primary→"offplan"; ready/secondary/resale→"ready".
- transaction_date: ISO YYYY-MM-DD. If only month+year given, use the 1st of that month.
- All monetary/area values are plain numbers (strip currency symbols, commas, parentheses).
- If a row is unreadable or missing both price and area, skip it.
Output: a single JSON array (possibly empty).`;

async function callClaude(apiKey, base64Pdf) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    }),
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const text = (data?.content || []).map((b) => b?.text || '').join('').trim();
  return { text, stop_reason: data?.stop_reason };
}

function parseRows(text) {
  let t = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let parsed;
  try { parsed = JSON.parse(t); } catch (_) {
    const s = t.indexOf('['); const e = t.lastIndexOf(']');
    if (s >= 0 && e > s) { try { parsed = JSON.parse(t.slice(s, e + 1)); } catch (_) { parsed = null; } }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.transactions)) return parsed.transactions;
  return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const reportId = body.market_report_id;
  if (!reportId) return Response.json({ error: 'market_report_id is required' }, { status: 400 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let report = null;
  try {
    const reportRows = await svc.entities.MarketReport.filter({}, '-created_date', 500);
    report = (reportRows || []).find((r) => r.id === reportId) || null;
  } catch (_) {}
  if (!report) return Response.json({ error: 'MarketReport not found', reportId }, { status: 404 });
  if (!report.report_file_url) return Response.json({ error: 'report has no report_file_url' }, { status: 422 });

  const projectName = report.project_name || '';
  const normProject = normalizeProjectName(projectName);
  const eventDate = toDate(report.market_event_date || DEFAULT_EVENT_DATE) || toDate(DEFAULT_EVENT_DATE);
  const cutoff90 = new Date(eventDate.getTime() - 90 * 86400000);

  try {
    await svc.entities.MarketReport.update(reportId, { status: 'extracting' });
    await deleteExistingTransactions(svc, reportId);

    // Fetch & encode PDF
    const pdfResp = await fetch(report.report_file_url);
    if (!pdfResp.ok) throw new Error(`PDF fetch ${pdfResp.status} from report_file_url`);
    const ab = await pdfResp.arrayBuffer();
    if (ab.byteLength > 31 * 1024 * 1024) throw new Error(`PDF too large (${Math.round(ab.byteLength / 1048576)}MB > 31MB limit)`);
    const base64Pdf = abToBase64(ab);

    // Extract rows via Claude
    const { text, stop_reason } = await callClaude(apiKey, base64Pdf);
    const rows = parseRows(text);
    if (!rows) throw new Error('Model did not return a JSON array. First 300 chars: ' + text.slice(0, 300));
    const truncated = stop_reason === 'max_tokens';

    // ── Phase 1: validate + create transactions ───────────────────────────────
    const txs = [];
    let skippedValidation = 0;
    const skippedLog = [];

    for (const r of rows) {
      const price_aed = num(r.price_aed);
      const area_sqft = num(r.area_sqft);
      let pps = num(r.price_per_sqft);

      // Derive pps if missing
      if (pps == null && price_aed != null && area_sqft && area_sqft > 0) {
        pps = price_aed / area_sqft;
      }

      // Skip if both price and area are missing
      if (price_aed == null && area_sqft == null) continue;

      // COLUMN-ORDER CROSS-CHECK: price/sqft computed from price÷area must match stated pps (±5%)
      if (price_aed != null && area_sqft != null && area_sqft > 0 && pps != null) {
        const derived = price_aed / area_sqft;
        const diff = Math.abs(derived - pps) / pps;
        if (diff > PPS_TOLERANCE) {
          skippedValidation++;
          skippedLog.push(`unit=${r.unit_number} price=${price_aed} area=${area_sqft} stated_pps=${pps} derived_pps=${Math.round(derived)} diff=${(diff*100).toFixed(1)}%`);
          console.warn(`[analyzeDXBReport] SKIP column-mismatch unit=${r.unit_number}: stated_pps=${pps}, derived=${Math.round(derived)}, diff=${(diff*100).toFixed(1)}%`);
          continue;
        }
      }

      const tdate = toDate(r.transaction_date);
      const rec = {
        market_report_id: reportId,
        project_name: projectName,
        unit_number: r.unit_number != null ? String(r.unit_number) : '',
        transaction_date: tdate ? tdate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        price_aed: price_aed ?? 0,
        area_sqft: area_sqft ?? null,
        price_per_sqft: pps != null ? Math.round(pps) : null,
        bedrooms: normalizeBedrooms(r.bedrooms),
        sale_status: normalizeSaleStatus(r.sale_status),
        is_post_event: tdate ? (tdate.getTime() >= eventDate.getTime()) : false,
        is_outlier: false, // will be set in phase 1b
      };
      txs.push({ ...rec, _date: tdate, _id: null });
    }

    // ── Phase 1b: Outlier filtering ───────────────────────────────────────────
    // Compute a first-pass median from all valid pps values
    const allPpsRaw = txs.map((t) => t.price_per_sqft).filter((v) => v != null);
    const firstPassMedianPsf = median(allPpsRaw);
    const outlierCutoff = firstPassMedianPsf ? firstPassMedianPsf * OUTLIER_THRESHOLD : null;
    let outliersMarked = 0;

    if (outlierCutoff) {
      for (const t of txs) {
        if (t.price_per_sqft != null && t.price_per_sqft < outlierCutoff) {
          t.is_outlier = true;
          outliersMarked++;
          console.warn(`[analyzeDXBReport] OUTLIER unit=${t.unit_number} pps=${t.price_per_sqft} < cutoff=${Math.round(outlierCutoff)} (${OUTLIER_THRESHOLD*100}% of median ${Math.round(firstPassMedianPsf)})`);
        }
      }
    }

    // Write all rows (including outliers, flagged is_outlier=true)
    const written = [];
    for (const t of txs) {
      const { _date, _id, ...rec } = t;
      try {
        const created = await svc.entities.MarketTransaction.create(rec);
        written.push({ ...t, _id: created?.id });
      } catch (e) {
        console.error(`[analyzeDXBReport] create tx failed unit=${t.unit_number}:`, e?.message);
      }
    }

    // ── Compute stats (clean rows only — no outliers) ─────────────────────────
    const clean = written.filter((t) => !t.is_outlier);
    const allPps = clean.map((t) => t.price_per_sqft).filter((v) => v != null);
    const allPrice = clean.map((t) => t.price_aed).filter((v) => v != null);
    const preTx = clean.filter((t) => !t.is_post_event);
    const postTx = clean.filter((t) => t.is_post_event);
    const medOverallPrice = median(allPrice);
    const medOverallPsf = median(allPps);
    const medPrePsf = median(preTx.map((t) => t.price_per_sqft).filter((v) => v != null));
    const medPostPsf = median(postTx.map((t) => t.price_per_sqft).filter((v) => v != null));

    const perBed = {};
    for (const b of BED_ENUM) {
      const g = clean.filter((t) => t.bedrooms === b);
      if (!g.length) continue;
      perBed[b] = {
        pre: median(g.filter((t) => !t.is_post_event).map((t) => t.price_per_sqft).filter((v) => v != null)),
        post: median(g.filter((t) => t.is_post_event).map((t) => t.price_per_sqft).filter((v) => v != null)),
        n: g.length, nPost: g.filter((t) => t.is_post_event).length,
      };
    }

    const shiftPct = (medPrePsf && medPostPsf) ? ((medPostPsf / medPrePsf - 1) * 100) : null;
    const summaryLines = [];
    summaryLines.push(`${clean.length} clean transactions extracted for ${projectName} (${outliersMarked} outliers excluded, ${skippedValidation} column-mismatch rows skipped).`);
    if (medOverallPsf) summaryLines.push(`Building median: ${round(medOverallPsf)} AED/sqft, ${round(medOverallPrice) ? 'AED ' + (round(medOverallPrice) / 1e6).toFixed(2) + 'M median price.' : ''}`);
    if (shiftPct != null) {
      summaryLines.push(`Price/sqft ${shiftPct >= 0 ? 'rose' : 'fell'} ${Math.abs(shiftPct).toFixed(1)}% post-event (pre ${round(medPrePsf)} → post ${round(medPostPsf)} AED/sqft).`);
    }
    if (postTx.length < 5) summaryLines.push(`CAVEAT: only ${postTx.length} post-event transactions — post-event figures are low-confidence.`);
    const perBedTxt = Object.entries(perBed)
      .map(([b, v]) => `${b}: pre ${v.pre != null ? round(v.pre) : 'n/a'} / post ${v.post != null ? round(v.post) : 'n/a'} AED/sqft (n=${v.n})`)
      .join('; ');
    if (perBedTxt) summaryLines.push(`By bedroom — ${perBedTxt}.`);
    if (truncated) summaryLines.push('WARNING: extraction may be incomplete (model hit max tokens).');
    if (skippedLog.length) summaryLines.push(`Column-mismatch rows skipped: ${skippedLog.slice(0, 3).join(' | ')}${skippedLog.length > 3 ? ` … and ${skippedLog.length - 3} more` : ''}.`);

    await svc.entities.MarketReport.update(reportId, {
      transactions_count: clean.length,
      median_price_aed: round(medOverallPrice),
      median_price_sqft: round(medOverallPsf),
      median_price_sqft_pre_event: round(medPrePsf),
      median_price_sqft_post_event: round(medPostPsf),
      analysis_summary: summaryLines.join(' '),
      status: 'analyzed',
    });

    // ── Phase 2: Valuation fan-out ────────────────────────────────────────────
    // Weight function: recency + post-event bonus
    const weightOf = (t) => {
      let w = 1;
      if (t.is_post_event) w += 3;
      else if (t._date && t._date.getTime() >= cutoff90.getTime()) w += 1;
      return w;
    };

    // Weight function including ready/offplan match
    const compWeight = (t, subjectStatus) => {
      let w = weightOf(t);
      // Prefer same status (ready→ready or offplan→offplan), penalise cross-type
      if (subjectStatus && t.sale_status) {
        if (t.sale_status === subjectStatus) w += 2;
        else w = Math.max(1, w - 1); // downweight mismatched type
      }
      return w;
    };

    let valued = 0;
    if (normProject && clean.length) {
      const landlords = (await svc.entities.Landlord.list('-created_date', 5000)) || [];
      const matchingLandlords = landlords.filter((l) =>
        normalizeProjectName(l.project_name) === normProject
      );

      for (const landlord of matchingLandlords) {
        const lps = (await svc.entities.LandlordProperty.filter({ landlord_id: landlord.id })) || [];
        for (const lp of lps) {
          let prop = null;
          if (lp.property_id) {
            const pr = await svc.entities.Property.filter({ id: lp.property_id });
            prop = pr?.[0] || null;
          }
          if (!prop) continue;

          const bedType = propertyBedType(prop);
          if (!bedType) continue;
          const area = num(prop.area_sqft);

          // Determine subject status (ready = not off_plan; off_plan = offplan)
          const subjectStatus = lp.is_off_plan ? 'offplan' : 'ready';

          // Comps: same bedroom type, not outlier
          const bedComps = clean.filter((t) => t.bedrooms === bedType && t.price_per_sqft != null);
          if (!bedComps.length) continue;

          // Narrow by area ±15% if area is known
          let matched = area
            ? bedComps.filter((t) => t.area_sqft && t.area_sqft >= area * 0.85 && t.area_sqft <= area * 1.15)
            : bedComps;
          if (!matched.length) matched = bedComps; // fall back to all bed comps

          const nComps = matched.length;
          const confidence = nComps >= 8 ? 'high' : nComps >= 3 ? 'medium' : 'low';

          const psf = weightedMedian(matched.map((t) => ({
            value: t.price_per_sqft,
            weight: compWeight(t, subjectStatus),
          })));

          if (psf == null) continue;

          const estPsf = round(psf);
          const estValue = area ? Math.round(psf * area) : null;
          const dateRange = matched.length
            ? (() => {
                const dates = matched.map((t) => t.transaction_date).sort();
                return dates[0] + ' to ' + dates[dates.length - 1];
              })()
            : 'n/a';
          const areaRange = matched.filter((t) => t.area_sqft).length
            ? `${Math.round(Math.min(...matched.filter((t) => t.area_sqft).map((t) => t.area_sqft)))}–${Math.round(Math.max(...matched.filter((t) => t.area_sqft).map((t) => t.area_sqft)))} sqft`
            : 'n/a';
          const readyCount = matched.filter((t) => t.sale_status === 'ready').length;
          const offplanCount = matched.filter((t) => t.sale_status === 'offplan').length;
          const basis = `${nComps} ${bedType} comps (${dateRange}), area ${areaRange}, ${readyCount} ready / ${offplanCount} offplan — weighted median ${estPsf} AED/sqft${area ? ` × ${Math.round(area)} sqft = AED ${estValue ? (estValue / 1e6).toFixed(2) + 'M' : 'n/a'}` : ''}. Ready-to-ready preferred; post-event comps weighted 4×.`;

          try {
            await svc.entities.LandlordProperty.update(lp.id, {
              ai_estimated_value_aed: estValue,
              ai_estimated_price_sqft: estPsf,
              ai_valuation_confidence: confidence,
              ai_valuation_basis: basis,
              ai_valuation_updated_at: new Date().toISOString().slice(0, 10),
            });
            valued++;
          } catch (_) {}
        }
      }
    }

    return Response.json({
      ok: true,
      status: 'analyzed',
      report_id: reportId,
      transactions_extracted: written.length,
      outliers_excluded: outliersMarked,
      column_mismatch_skipped: skippedValidation,
      clean_comps: clean.length,
      post_event: postTx.length,
      median_price_sqft: round(medOverallPsf),
      shift_pct: shiftPct != null ? Number(shiftPct.toFixed(1)) : null,
      properties_valued: valued,
      truncated,
    });

  } catch (e) {
    console.error('[analyzeDXBReport] failed:', e?.message, e?.stack);
    try {
      await svc.entities.MarketReport.update(reportId, {
        status: 'failed',
        analysis_summary: `ERROR: ${e?.message}\n\n${e?.stack}`.slice(0, 900),
      });
    } catch (_) {}
    return Response.json({ ok: false, error: e?.message, stack: e?.stack }, { status: 200 });
  }
});