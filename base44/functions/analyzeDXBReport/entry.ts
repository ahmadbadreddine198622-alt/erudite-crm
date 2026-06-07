import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * analyzeDXBReport — extract a DXB Interact PDF into MarketTransactions, compute
 * pre/post-event market stats on the MarketReport, and fan out AI valuations to
 * matching LandlordProperty records.  Input: { market_report_id }
 * Secret: ANTHROPIC_API_KEY.  Model: claude-opus-4-8 (PDF document input).
 * Idempotent: deletes this report's existing MarketTransactions before re-extracting.
 */

const MODEL = 'claude-opus-4-8';
const DEFAULT_EVENT_DATE = '2026-02-28';

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

const BED_ENUM = ['studio', '1br', '2br', '3br', '4plus'];
function normalizeBedrooms(raw) {
  const s = String(raw ?? '').toLowerCase().trim();
  if (BED_ENUM.includes(s)) return s;
  if (/studio/.test(s)) return 'studio';
  const n = parseInt(s, 10);
  if (!isNaN(n)) { if (n <= 0) return 'studio'; if (n === 1) return '1br'; if (n === 2) return '2br'; if (n === 3) return '3br'; return '4plus'; }
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
  if (/off.?plan/.test(s)) return 'offplan';
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
      try { await svc.entities.MarketTransaction.delete(t.id); } catch (_) { /* continue */ }
    }
    return (existing || []).length;
  } catch (_) { return 0; }
}

const EXTRACTION_PROMPT = `You are extracting transaction rows from a DXB Interact (Dubai Land Department) PDF market report for a single building/project.

Return ONLY a strict JSON array — no prose, no markdown, no code fences. Each element is one transaction row:
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
- Extract EVERY transaction row in the table(s). Do not summarize or sample.
- IGNORE the header KPI cards / summary tiles at the top (totals, averages, counts).
- IGNORE any "capital gain %", "appreciation %", and "sold by" / agent / broker columns.
- bedrooms: map any bedroom count to the enum. "0" or "studio" -> "studio"; 4 or more -> "4plus".
- sale_status: off-plan/primary -> "offplan"; ready/secondary/resale -> "ready".
- transaction_date: ISO YYYY-MM-DD.
- All monetary/area values are plain numbers (strip currency symbols and thousands separators).
- If a row is unreadable or missing price and area, skip it.
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
  try { parsed = JSON.parse(t); }
  catch (_) {
    const s = t.indexOf('['); const e = t.lastIndexOf(']');
    if (s >= 0 && e > s) { try { parsed = JSON.parse(t.slice(s, e + 1)); } catch (_) { parsed = null; } }
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.transactions)) return parsed.transactions;
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) { /* none */ }
  const reportId = body.market_report_id;
  if (!reportId) return Response.json({ error: 'market_report_id is required' }, { status: 400 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const reportRows = await svc.entities.MarketReport.filter({ id: reportId });
  const report = reportRows?.[0];
  if (!report) return Response.json({ error: 'MarketReport not found', reportId }, { status: 404 });
  if (!report.report_file_url) return Response.json({ error: 'report has no report_file_url' }, { status: 422 });

  const projectName = report.project_name || '';
  const eventDate = toDate(report.market_event_date || DEFAULT_EVENT_DATE) || toDate(DEFAULT_EVENT_DATE);
  const cutoff90 = new Date(eventDate.getTime() - 90 * 86400000);

  try {
    await svc.entities.MarketReport.update(reportId, { status: 'extracting' });
    await deleteExistingTransactions(svc, reportId);

    const pdfResp = await fetch(report.report_file_url);
    if (!pdfResp.ok) throw new Error(`PDF fetch ${pdfResp.status} from report_file_url`);
    const ab = await pdfResp.arrayBuffer();
    if (ab.byteLength > 31 * 1024 * 1024) throw new Error(`PDF too large (${Math.round(ab.byteLength / 1048576)}MB > 31MB Claude limit)`);
    const base64Pdf = abToBase64(ab);

    const { text, stop_reason } = await callClaude(apiKey, base64Pdf);
    const rows = parseRows(text);
    if (!rows) throw new Error('Model did not return a JSON array. First 300 chars: ' + text.slice(0, 300));
    const truncated = stop_reason === 'max_tokens';

    const txs = [];
    for (const r of rows) {
      const price_aed = num(r.price_aed);
      const area_sqft = num(r.area_sqft);
      let pps = num(r.price_per_sqft);
      if (pps == null && price_aed != null && area_sqft) pps = price_aed / area_sqft;
      if (price_aed == null && area_sqft == null) continue;
      const tdate = toDate(r.transaction_date);
      const rec = {
        market_report_id: reportId,
        project_name: projectName,
        unit_number: r.unit_number != null ? String(r.unit_number) : '',
        transaction_date: tdate ? tdate.toISOString() : new Date().toISOString(),
        price_aed: price_aed ?? 0,
        area_sqft: area_sqft ?? null,
        price_per_sqft: pps != null ? Math.round(pps) : null,
        bedrooms: normalizeBedrooms(r.bedrooms),
        sale_status: normalizeSaleStatus(r.sale_status),
        is_post_event: tdate ? (tdate.getTime() >= eventDate.getTime()) : false,
      };
      try {
        await svc.entities.MarketTransaction.create(rec);
        txs.push({ ...rec, _date: tdate });
      } catch (_) { /* skip a single bad row */ }
    }

    const allPps = txs.map((t) => t.price_per_sqft).filter((v) => v != null);
    const allPrice = txs.map((t) => t.price_aed).filter((v) => v != null);
    const preTx = txs.filter((t) => !t.is_post_event);
    const postTx = txs.filter((t) => t.is_post_event);
    const medOverallPrice = median(allPrice);
    const medOverallPsf = median(allPps);
    const medPrePsf = median(preTx.map((t) => t.price_per_sqft).filter((v) => v != null));
    const medPostPsf = median(postTx.map((t) => t.price_per_sqft).filter((v) => v != null));

    const perBed = {};
    for (const b of BED_ENUM) {
      const g = txs.filter((t) => t.bedrooms === b);
      if (!g.length) continue;
      perBed[b] = {
        pre: median(g.filter((t) => !t.is_post_event).map((t) => t.price_per_sqft).filter((v) => v != null)),
        post: median(g.filter((t) => t.is_post_event).map((t) => t.price_per_sqft).filter((v) => v != null)),
        n: g.length, nPost: g.filter((t) => t.is_post_event).length,
      };
    }

    const shiftPct = (medPrePsf && medPostPsf) ? ((medPostPsf / medPrePsf - 1) * 100) : null;
    const summaryLines = [];
    summaryLines.push(`${txs.length} transactions extracted for ${projectName || 'this project'} (event date ${eventDate.toISOString().slice(0, 10)}).`);
    if (shiftPct != null) {
      summaryLines.push(`Building-wide price/sqft ${shiftPct >= 0 ? 'rose' : 'fell'} ${Math.abs(shiftPct).toFixed(1)}% post-event (pre ${round(medPrePsf)} → post ${round(medPostPsf)} AED/sqft).`);
    } else {
      summaryLines.push(`Insufficient data to compute a pre/post price-per-sqft shift.`);
    }
    summaryLines.push(`Post-event sample size: ${postTx.length}.` + (postTx.length < 5 ? ' CAVEAT: fewer than 5 post-event transactions — treat post-event medians and valuations as low-confidence.' : ''));
    const perBedTxt = Object.entries(perBed)
      .map(([b, v]) => `${b}: pre ${v.pre != null ? round(v.pre) : 'n/a'} / post ${v.post != null ? round(v.post) : 'n/a'} AED/sqft (n=${v.n}, post=${v.nPost})`)
      .join('; ');
    if (perBedTxt) summaryLines.push(`Per-bedroom medians — ${perBedTxt}.`);
    if (truncated) summaryLines.push('WARNING: extraction may be incomplete (model hit max output length); some rows may be missing.');

    await svc.entities.MarketReport.update(reportId, {
      transactions_count: txs.length,
      median_price_aed: round(medOverallPrice),
      median_price_sqft: round(medOverallPsf),
      median_price_sqft_pre_event: round(medPrePsf),
      median_price_sqft_post_event: round(medPostPsf),
      analysis_summary: summaryLines.join(' '),
      status: 'analyzed',
    });

    const wantProject = projectName.trim().toLowerCase();
    let valued = 0;
    if (wantProject && txs.length) {
      const landlords = (await svc.entities.Landlord.list('-created_date', 5000)) || [];
      const matchLandlordIds = landlords
        .filter((l) => String(l.project_name || '').trim().toLowerCase() === wantProject)
        .map((l) => l.id);

      const weightOf = (t) => (t.is_post_event ? 3 : (t._date && t._date.getTime() >= cutoff90.getTime() ? 2 : 1));

      for (const landlordId of matchLandlordIds) {
        const lps = (await svc.entities.LandlordProperty.filter({ landlord_id: landlordId })) || [];
        for (const lp of lps) {
          let prop = null;
          if (lp.property_id) { const pr = await svc.entities.Property.filter({ id: lp.property_id }); prop = pr?.[0] || null; }
          if (!prop) continue;
          const bedType = propertyBedType(prop);
          if (!bedType) continue;
          const area = num(prop.area_sqft);

          const bedComps = txs.filter((t) => t.bedrooms === bedType && t.price_per_sqft != null);
          if (!bedComps.length) continue;
          let matched = area ? bedComps.filter((t) => t.area_sqft && t.area_sqft >= area * 0.85 && t.area_sqft <= area * 1.15) : bedComps;
          if (!matched.length) matched = bedComps;
          const postSameBed = matched.filter((t) => t.is_post_event);

          let psf = null, confidence = 'low', basis = '';
          if (postSameBed.length >= 1) {
            psf = weightedMedian(matched.map((t) => ({ value: t.price_per_sqft, weight: weightOf(t) })));
            confidence = postSameBed.length >= 3 ? 'high' : 'medium';
            basis = `${matched.length} comps (${postSameBed.length} post-event), weighted median ${round(psf)} AED/sqft` + (area ? ` × ${Math.round(area)} sqft` : '');
          } else {
            const bedPre = median(bedComps.filter((t) => !t.is_post_event).map((t) => t.price_per_sqft));
            if (bedPre && medPrePsf && medPostPsf) {
              const shift = medPostPsf / medPrePsf;
              psf = bedPre * shift;
              basis = `no post-event ${bedType} comps; applied building ${((shift - 1) * 100).toFixed(1)}% post/pre shift to ${bedType} pre median ${round(bedPre)} → ${round(psf)} AED/sqft` + (area ? ` × ${Math.round(area)} sqft` : '');
            } else {
              psf = median(bedComps.map((t) => t.price_per_sqft));
              basis = `no post-event data; used ${bedType} median ${round(psf)} AED/sqft` + (area ? ` × ${Math.round(area)} sqft` : '');
            }
            confidence = 'low';
          }
          if (psf == null) continue;

          let estValue = null, estPsf = round(psf);
          if (area) estValue = Math.round(psf * area);
          else {
            const wp = weightedMedian(matched.map((t) => ({ value: t.price_aed, weight: weightOf(t) })));
            estValue = wp != null ? Math.round(wp) : null;
            basis += '; no area on Property — value from comp price median';
          }

          try {
            await svc.entities.LandlordProperty.update(lp.id, {
              ai_estimated_value_aed: estValue,
              ai_estimated_price_sqft: estPsf,
              ai_valuation_confidence: confidence,
              ai_valuation_basis: basis,
              ai_valuation_updated_at: new Date().toISOString(),
            });
            valued++;
          } catch (_) { /* keep going */ }
        }
      }
    }

    return Response.json({
      status: 'analyzed',
      report_id: reportId,
      transactions: txs.length,
      post_event: postTx.length,
      median_price_sqft: round(medOverallPsf),
      shift_pct: shiftPct != null ? Number(shiftPct.toFixed(1)) : null,
      properties_valued: valued,
      truncated,
    });
  } catch (e) {
    const msg = e?.stack || e?.message || String(e);
    try { await svc.entities.MarketReport.update(reportId, { status: 'failed', analysis_summary: ('Analysis failed: ' + (e?.message || String(e))).slice(0, 900) }); } catch (_) {}
    console.error('[analyzeDXBReport] error:', msg);
    return Response.json({ status: 'failed', error: e?.message || String(e) }, { status: 500 });
  }
});