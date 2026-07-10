// jumeirahLivingValuation — a grounded valuation brain scoped to the
// Jumeirah Living tower only.
//
// When a price is handed over or requested for any unit in Jumeirah Living,
// this brain:
//   1. Reads MarketTransaction records for project_name "Jumeirah Living",
//      excluding is_outlier=true (notably the unit 19-01 June 2026 fractional/
//      share transfer, which must NEVER be quoted as a comparable).
//   2. Understands the unit by its floor / line / bedroom, parsed from the
//      unit_reference (or unit_no).
//   3. Values on price-per-sqft, then multiplies by the unit's real built-up
//      area (Property.area_sqft).
//   4. Considers before/after the war event date (2025-06-13): post-war psf
//      holds around 4000-4300 with a modest premium, so post-event comps are
//      the primary anchor.
//   5. Produces a realistic price range, an asking-price verdict, and a
//      strategy. Default strategy for this low-liquidity high-end tower is
//      patience + premium positioning, NOT undercutting.
//   6. Writes estimated value, psf used, comparables leaned on, confidence,
//      and flags back to the LandlordProperty fields:
//      ai_estimated_value_aed, ai_estimated_price_sqft,
//      ai_valuation_confidence, ai_valuation_basis, ai_valuation_updated_at.
//
// Input:
//   landlord_property_id (string, preferred) — the LandlordProperty to value
//   property_id         (string, alt entry)  — resolve via the Property directly
//   landlord_id         (string, alt entry)  — first LandlordProperty for the landlord
//   asking_price_aed    (number, optional)  — the price handed over / requested,
//                                              used for the asking-price verdict
//   dry_run             (bool, optional)    — if true, return the valuation
//                                              without writing it back to the entity
//
// Returns the full valuation object (also written to the entity unless dry_run).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TOWER = 'Jumeirah Living';
const WAR_EVENT_DATE = '2025-06-13';
// Post-war anchor band (psf in AED) — used as a sanity fallback only.
const POST_WAR_PSF_LOW = 4000;
const POST_WAR_PSF_HIGH = 4300;
const POST_WAR_PSF_MID = 4150;

// The explicitly forbidden outlier: unit 19-01, June 2026, a fractional/share transfer.
const OUTLIER_UNIT = '19-01';
const OUTLIER_DATE_PREFIX = '2026-06';

// ── helpers ──
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[idx];
}
function round(n, d = 0) {
  if (n == null || isNaN(n)) return null;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
function fmtAed(n) {
  if (n == null) return 'N/A';
  return Math.round(n).toLocaleString('en-US') + ' AED';
}

// Parse a unit_reference / unit_no into { floor, line, raw }.
// Handles "19-01", "1901", "JL-19-01", "Unit 1901", "19.01", "A-1901".
function parseUnitRef(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return { floor: null, line: null, raw: '' };
  // Pull the trailing digit group(s).
  const m = s.match(/(\d{1,2})\s*[-.\s]?\s*(\d{1,2})\s*$/);
  if (m) {
    return { floor: parseInt(m[1], 10), line: parseInt(m[2], 10), raw: s };
  }
  // Fallback: last 3-4 digits as floor+line.
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 3) {
    const floor = parseInt(digits.slice(0, -2), 10);
    const line = parseInt(digits.slice(-2), 10);
    return { floor: isNaN(floor) ? null : floor, line, raw: s };
  }
  return { floor: null, line: null, raw: s };
}

// Normalize a bedroom count on the Property (number) to the MarketTransaction
// bedrooms enum (studio / 1br / 2br / 3br / 4plus).
function bedToEnum(n) {
  if (n == null) return null;
  if (n === 0) return 'studio';
  if (n === 1) return '1br';
  if (n === 2) return '2br';
  if (n === 3) return '3br';
  if (n >= 4) return '4plus';
  return null;
}

// A unit is the forbidden outlier if it matches unit 19-01 AND transacted in June 2026.
function isForbiddenOutlier(tx, unitRef) {
  const u = parseUnitRef(unitRef || tx?.unit_number);
  const matchesUnit = (u.raw && u.raw.replace(/\s/g, '').includes('1901')) ||
    (u.floor === 19 && u.line === 1);
  const txDate = String(tx?.transaction_date || '').slice(0, 7);
  return !!matchesUnit && txDate === OUTLIER_DATE_PREFIX;
}

// Apply a modest floor premium: higher floors in a high-end tower carry a small
// premium, but it is capped so the valuation stays grounded in the comps.
function floorPremium(floor, compMedianFloor) {
  if (floor == null || compMedianFloor == null) return 0;
  const diff = floor - compMedianFloor;
  if (diff <= 0) return 0;
  // +0.4% per floor above the comp median, capped at +6%.
  return Math.min(0.06, diff * 0.004);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_property_id, property_id, landlord_id, asking_price_aed, dry_run } = body || {};

    // ── 1. Resolve the LandlordProperty + Property ──
    let lp = null;
    if (landlord_property_id) {
      lp = await base44.asServiceRole.entities.LandlordProperty.get(landlord_property_id).catch(() => null);
    }
    if (!lp && landlord_id) {
      const list = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id }, '-created_date', 1).catch(() => []);
      lp = (list && list[0]) || null;
    }
    let property = null;
    const propId = lp?.property_id || property_id;
    if (propId) {
      property = await base44.asServiceRole.entities.Property.get(propId).catch(() => null);
    }
    // Resolve landlord (for project_name / unit_reference cross-check).
    let landlord = null;
    if (lp?.landlord_id || landlord_id) {
      landlord = await base44.asServiceRole.entities.Landlord.get(lp?.landlord_id || landlord_id).catch(() => null);
    }

    if (!lp && !property) {
      return Response.json({ ok: false, error: 'No LandlordProperty or Property found for the given id(s)' }, { status: 404 });
    }

    // ── 2. Verify the unit belongs to Jumeirah Living (scope guard) ──
    const towerCandidates = [
      property?.building_name, property?.location, property?.title,
      landlord?.project_name, landlord?.unit_reference,
    ].filter(Boolean).map((s) => String(s));
    const belongsToTower = towerCandidates.some((s) => s.toLowerCase().includes('jumeirah living'));
    if (!belongsToTower) {
      return Response.json({
        ok: false,
        error: `This valuation brain is scoped to "${TOWER}" only. The supplied unit does not appear to belong to this tower.`,
        tower_candidates: towerCandidates,
      }, { status: 400 });
    }

    // ── 3. Understand the unit ──
    const unitRef = landlord?.unit_reference || property?.unit_no || lp?.title_deed_number || '';
    const parsed = parseUnitRef(unitRef);
    const areaSqft = Number(property?.area_sqft) > 0 ? Number(property.area_sqft) : null;
    const bedEnum = bedToEnum(property?.bedrooms) || null;

    const flags = [];
    if (!areaSqft) flags.push('Missing built-up area (area_sqft) on the Property — cannot compute a grounded value; psf only.');
    if (!bedEnum) flags.push('Could not resolve bedroom count for the unit — valuation falls back to all-bedroom comps.');
    if (parsed.floor == null) flags.push('Could not parse floor/line from the unit reference — no floor premium applied.');

    // ── 4. Read MarketTransaction records for Jumeirah Living, excluding outliers ──
    const allTx = await base44.asServiceRole.entities.MarketTransaction.filter({}, '-transaction_date', 500).catch(() => []);
    const towerTx = (allTx || []).filter((t) => {
      const pn = String(t?.project_name || '').toLowerCase();
      if (!pn.includes('jumeirah living')) return false;
      if (t?.is_outlier === true) return false;
      // Hard exclusion of the known outlier even if the flag was missed.
      if (isForbiddenOutlier(t, unitRef)) return false;
      return true;
    });

    if (!towerTx.length) {
      const fallbackPsf = POST_WAR_PSF_MID;
      const estValue = areaSqft ? round(fallbackPsf * areaSqft) : null;
      const basis = `No usable MarketTransaction comps found for ${TOWER}. Valuation anchored on the stated post-war psf band (${POST_WAR_PSF_LOW}-${POST_WAR_PSF_HIGH} AED/sqft, midpoint ${POST_WAR_PSF_MID}). Low confidence — confirm with fresh DXB Interact data.`;
      const valuation = {
        tower: TOWER,
        unit_reference: unitRef,
        floor: parsed.floor,
        line: parsed.line,
        bedrooms: property?.bedrooms ?? null,
        area_sqft: areaSqft,
        psf_used: fallbackPsf,
        psf_low: POST_WAR_PSF_LOW,
        psf_high: POST_WAR_PSF_HIGH,
        estimated_value_aed: estValue,
        price_range_low_aed: areaSqft ? round(POST_WAR_PSF_LOW * areaSqft) : null,
        price_range_high_aed: areaSqft ? round(POST_WAR_PSF_HIGH * areaSqft) : null,
        confidence: 'low',
        basis,
        strategy: `Patience and premium positioning. ${TOWER} is a low-liquidity high-end tower — hold the ask near the top of the range; do not undercut.`,
        asking_price_verdict: asking_price_aed == null ? 'No asking price supplied.' : verdictFor(asking_price_aed, areaSqft ? round(POST_WAR_PSF_LOW * areaSqft) : null, areaSqft ? round(POST_WAR_PSF_HIGH * areaSqft) : null),
        comparables: [],
        flags: ['No comps available — anchored on the post-war psf band.'].concat(flags),
        war_event_date: WAR_EVENT_DATE,
      };
      if (!dry_run && lp) await writeBack(base44, lp.id, valuation);
      return Response.json({ ok: true, valuation });
    }

    // ── 5. Split pre/post-war and by bedroom ──
    const isPost = (t) => t?.is_post_event === true || (t?.transaction_date && String(t.transaction_date).slice(0, 10) >= WAR_EVENT_DATE);
    const sameBed = (t) => !bedEnum || t?.bedrooms === bedEnum;
    const postSameBed = towerTx.filter((t) => isPost(t) && sameBed(t));
    const postAnyBed = towerTx.filter((t) => isPost(t));
    const preSameBed = towerTx.filter((t) => !isPost(t) && sameBed(t));

    // Choose the comp set: prefer post-war + same bedroom; else post-war all;
    // else pre-war same bedroom (with a confidence penalty).
    let compSet, compLabel, usedFallback = false;
    if (postSameBed.length >= 2) {
      compSet = postSameBed; compLabel = `post-war ${bedEnum || '(all beds)'} comps`;
    } else if (postAnyBed.length >= 2) {
      compSet = postAnyBed; compLabel = `post-war all-bedroom comps (same-bed set too thin)`;
      usedFallback = true;
    } else if (preSameBed.length >= 2) {
      compSet = preSameBed; compLabel = `pre-war ${bedEnum} comps (post-war set too thin — apply post-war premium)`;
      usedFallback = true;
    } else {
      // Not enough structured comps of any kind — anchor on the band.
      compSet = towerTx; compLabel = `all available ${TOWER} comps (thin)`;
      usedFallback = true;
    }

    const psfValues = compSet.map((t) => Number(t.price_per_sqft)).filter((n) => n > 0);
    // If psf missing on a comp but price + area present, derive it.
    for (const t of compSet) {
      if ((!t.price_per_sqft || Number(t.price_per_sqft) <= 0) && t.price_aed > 0 && t.area_sqft > 0) {
        psfValues.push(Number(t.price_aed) / Number(t.area_sqft));
      }
    }

    let psfMedian = median(psfValues) || POST_WAR_PSF_MID;
    let psfLow = percentile(psfValues, 25) || POST_WAR_PSF_LOW;
    let psfHigh = percentile(psfValues, 75) || POST_WAR_PSF_HIGH;

    // If we leaned on pre-war comps, lift toward the post-war band (modest premium).
    if (compSet === preSameBed) {
      psfMedian = psfMedian * 1.03; // modest post-war premium
      psfLow = psfLow * 1.03;
      psfHigh = psfHigh * 1.03;
    }

    // Floor premium (modest, capped) — only when we know the unit's floor and
    // have enough comps to compute a median comp floor.
    const compFloors = compSet.map((t) => parseUnitRef(t?.unit_number).floor).filter((n) => n != null);
    const compMedianFloor = compFloors.length ? median(compFloors) : null;
    const prem = floorPremium(parsed.floor, compMedianFloor);
    if (prem > 0) {
      psfMedian = psfMedian * (1 + prem);
      psfLow = psfLow * (1 + prem);
      psfHigh = psfHigh * (1 + prem);
    }

    psfMedian = round(psfMedian);
    psfLow = round(psfLow);
    psfHigh = round(psfHigh);

    const estimatedValue = areaSqft ? round(psfMedian * areaSqft) : null;
    const rangeLow = areaSqft ? round(psfLow * areaSqft) : null;
    const rangeHigh = areaSqft ? round(psfHigh * areaSqft) : null;

    // ── 6. Confidence ──
    let confidence = 'high';
    if (usedFallback || compSet.length < 5) confidence = 'medium';
    if (compSet.length < 3 || !areaSqft || usedFallback && compSet.length < 2) confidence = 'low';

    // ── 7. Comparables leaned on (for the basis + transparency) ──
    const comparables = compSet
      .slice()
      .sort((a, b) => new Date(b.transaction_date || 0) - new Date(a.transaction_date || 0))
      .slice(0, 6)
      .map((t) => ({
        unit_number: t.unit_number || null,
        transaction_date: t.transaction_date || null,
        price_aed: t.price_aed || null,
        area_sqft: t.area_sqft || null,
        price_per_sqft: t.price_per_sqft || (t.price_aed && t.area_sqft ? round(t.price_aed / t.area_sqft) : null),
        bedrooms: t.bedrooms || null,
        post_war: isPost(t),
      }));

    const askingVerdict = asking_price_aed == null
      ? 'No asking price supplied — valuation is range-only.'
      : verdictFor(Number(asking_price_aed), rangeLow, rangeHigh);

    const basis = [
      `Tower: ${TOWER} (scoped).`,
      `Unit: ${unitRef || '(unknown)'} — floor ${parsed.floor ?? '?'}, line ${parsed.line ?? '?'}, ${property?.bedrooms ?? '?'} bed, ${areaSqft ? areaSqft + ' sqft' : 'area missing'}.`,
      `Comps leaned on: ${compSet.length} ${compLabel}.`,
      `War event date: ${WAR_EVENT_DATE}. Post-war psf band ${POST_WAR_PSF_LOW}-${POST_WAR_PSF_HIGH} AED/sqft used as a sanity anchor.`,
      `Psf used: ${psfMedian} AED/sqft (range ${psfLow}-${psfHigh}).${prem > 0 ? ` Includes +${Math.round(prem * 100)}% floor premium (floor ${parsed.floor} vs comp median ${compMedianFloor ?? '?'}).` : ''}`,
      `Estimated value: ${fmtAed(estimatedValue)} (range ${fmtAed(rangeLow)}-${fmtAed(rangeHigh)}).`,
      `Confidence: ${confidence}.`,
      `Excluded outlier: unit ${OUTLIER_UNIT} (${OUTLIER_DATE_PREFIX}) fractional/share transfer — never quoted as a comparable.`,
      flags.length ? `Flags: ${flags.join('; ')}.` : 'No flags.',
    ].join(' ');

    const strategy = `Patience and premium positioning. ${TOWER} is a low-liquidity high-end tower — hold the ask near the top of the range (${fmtAed(rangeHigh)}); do not undercut. Qualify the buyer's seriousness before entertaining any discount; time on market is expected and acceptable here.`;

    const valuation = {
      tower: TOWER,
      unit_reference: unitRef,
      floor: parsed.floor,
      line: parsed.line,
      bedrooms: property?.bedrooms ?? null,
      area_sqft: areaSqft,
      psf_used: psfMedian,
      psf_low: psfLow,
      psf_high: psfHigh,
      estimated_value_aed: estimatedValue,
      price_range_low_aed: rangeLow,
      price_range_high_aed: rangeHigh,
      confidence,
      basis,
      strategy,
      asking_price_verdict: askingVerdict,
      comparables,
      flags: flags.length ? flags : [],
      war_event_date: WAR_EVENT_DATE,
      excluded_outlier: `unit ${OUTLIER_UNIT} (${OUTLIER_DATE_PREFIX})`,
    };

    // ── 8. Write back to LandlordProperty (unless dry_run) ──
    if (!dry_run && lp) {
      await writeBack(base44, lp.id, valuation);
    }

    return Response.json({ ok: true, valuation });
  } catch (error) {
    console.error('jumeirahLivingValuation error:', error);
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
});

// Asking-price verdict against the computed range.
function verdictFor(asking, rangeLow, rangeHigh) {
  if (asking == null || rangeLow == null || rangeHigh == null) {
    return 'Asking price could not be compared to the range (missing data).';
  }
  const a = Number(asking);
  if (a < rangeLow * 0.97) {
    return `Asking ${fmtAed(a)} is below the estimated range (${fmtAed(rangeLow)}-${fmtAed(rangeHigh)}). Verify the motivation — could be a quick-sale signal or a mispricing; do not anchor the listing to it.`;
  }
  if (a > rangeHigh * 1.05) {
    return `Asking ${fmtAed(a)} is above the estimated range (${fmtAed(rangeLow)}-${fmtAed(rangeHigh)}). Premium positioning is justified for this tower — expect a longer time on market; hold firm and qualify buyers hard.`;
  }
  return `Asking ${fmtAed(a)} is within the estimated market range (${fmtAed(rangeLow)}-${fmtAed(rangeHigh)}). Reasonable, with room to hold near the top.`;
}

// Persist the valuation to the LandlordProperty entity.
async function writeBack(base44, lpId, v) {
  try {
    await base44.asServiceRole.entities.LandlordProperty.update(lpId, {
      ai_estimated_value_aed: v.estimated_value_aed ?? undefined,
      ai_estimated_price_sqft: v.psf_used ?? undefined,
      ai_valuation_confidence: v.confidence,
      ai_valuation_basis: v.basis,
      ai_valuation_updated_at: new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    console.warn('writeBack failed:', e?.message || e);
  }
}