import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * valuationSweep — daily daemon that keeps AI valuations complete for every
 * landlord, forever. Supersedes the valuation fan-out that died mid-run inside
 * analyzeDXBReport on 20 June (this function does NOT modify analyzeDXBReport).
 *
 * Runs daily at 05:45 UTC via the platform scheduler. Supports manual invocation
 * with { dry_run: true, project?: string }.
 *
 * All DB ops via service role. NO silent error swallowing — every error surfaces
 * in the response errors[] array or as a 500.
 *
 * Cap: 200 units valued per run. Cursor/batch pattern so a single invocation
 * never exceeds the platform timeout.
 *
 * Returns: { projects_processed, landlords_scanned, units_valued,
 *   skipped_already_valued, skipped_no_unit_reference, skipped_unknown_stack,
 *   skipped_inconsistent_link, has_more, errors }
 */

const TERMINAL_STAGES = ['deal_closed'];
const STALE_DAYS = 60;
const MAX_UNITS_PER_RUN = 200;
const AREA_TOLERANCE = 0.15; // ±15%

// ── Utilities ────────────────────────────────────────────────────────────────

function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function median(arr) {
  const a = arr.filter((n) => typeof n === 'number' && !isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mode(arr) {
  const filtered = arr.filter((v) => v != null && v !== '');
  if (!filtered.length) return null;
  const counts = {};
  for (const v of filtered) {
    const key = String(v);
    counts[key] = (counts[key] || 0) + 1;
  }
  let maxCount = 0;
  let maxVal = null;
  for (const v of filtered) {
    const key = String(v);
    if (counts[key] > maxCount) {
      maxCount = counts[key];
      maxVal = v;
    }
  }
  return maxVal;
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

// Normalize project name: lowercase, strip spaces/dashes/punctuation,
// convert word-numbers to digits (e.g. "Peninsula Two" → "peninsula2").
function normalizeProjectName(raw) {
  const s = String(raw || '').toLowerCase().trim();
  const wordNums = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  };
  let out = s;
  for (const [word, digit] of Object.entries(wordNums)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }
  return out.replace(/[\s\-_,\.]+/g, '');
}

// Normalize a unit reference to a digits-only canonical form for matching.
// "19-01" → "1901", "Unit 808" → "808", "A-1901" → "1901".
function normalizeUnit(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

// ── Valuation computation (exact formula from analyzeDXBReport) ──────────────

function computeValuation({ comps, subjectBedrooms, subjectArea, subjectStatus, areaSource }) {
  if (!subjectBedrooms) return null;

  // Comps of same bedrooms, with a valid price_per_sqft
  const bedComps = comps.filter(
    (t) => t.bedrooms === subjectBedrooms && t.price_per_sqft != null && t.price_per_sqft > 0
  );
  if (!bedComps.length) return null;

  // Narrow to area ±15% when subject area is known (fallback: all bed comps)
  let matched = subjectArea
    ? bedComps.filter(
        (t) => t.area_sqft && num(t.area_sqft) >= subjectArea * (1 - AREA_TOLERANCE) && num(t.area_sqft) <= subjectArea * (1 + AREA_TOLERANCE)
      )
    : bedComps;
  if (!matched.length) matched = bedComps;

  const nComps = matched.length;
  let confidence = nComps >= 8 ? 'high' : nComps >= 3 ? 'medium' : 'low';

  // Downgrade high → medium when area came from the stack map (less precise)
  if (confidence === 'high' && areaSource === 'floor-stack profile') {
    confidence = 'medium';
  }

  // Weight: 1 base, +3 if is_post_event, +1 if within 90 days (non-post),
  // +2 if sale_status matches subject, else max(1, w−1)
  const cutoff90 = Date.now() - 90 * 86400000;
  const compWeight = (t) => {
    let w = 1;
    if (t.is_post_event === true) w += 3;
    else if (t.transaction_date && new Date(t.transaction_date).getTime() >= cutoff90) w += 1;
    if (subjectStatus && t.sale_status) {
      if (t.sale_status === subjectStatus) w += 2;
      else w = Math.max(1, w - 1);
    }
    return w;
  };

  const psf = weightedMedian(
    matched.map((t) => ({ value: t.price_per_sqft, weight: compWeight(t) }))
  );
  if (psf == null) return null;

  const estPsf = Math.round(psf);
  const estValue = subjectArea ? Math.round(psf * subjectArea) : null;

  // Basis string — established format + area source note
  const dates = matched.map((t) => t.transaction_date).filter(Boolean).sort();
  const dateRange = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'n/a';
  const areas = matched.map((t) => num(t.area_sqft)).filter((a) => a != null && a > 0);
  const areaRange = areas.length
    ? `${Math.round(Math.min(...areas))}–${Math.round(Math.max(...areas))} sqft`
    : 'n/a';
  const readyCount = matched.filter((t) => t.sale_status === 'ready').length;
  const offplanCount = matched.filter((t) => t.sale_status === 'offplan').length;

  const basis =
    `${nComps} ${subjectBedrooms} comps (${dateRange}), area ${areaRange}, ` +
    `${readyCount} ready / ${offplanCount} offplan — weighted median ${estPsf} AED/sqft` +
    (subjectArea
      ? ` × ${Math.round(subjectArea)} sqft = AED ${estValue ? (estValue / 1e6).toFixed(2) + 'M' : 'n/a'}`
      : '') +
    `. Subject area from ${areaSource}.`;

  return { estValue, estPsf, confidence, basis, subjectBedrooms, subjectArea };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const errors = [];
  let projectsProcessed = 0;
  let landlordsScanned = 0;
  let unitsValued = 0;
  let skippedAlreadyValued = 0;
  let skippedNoUnitReference = 0;
  let skippedUnknownStack = 0;
  let skippedInconsistentLink = 0;
  let hasMore = false;

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Auth check: manual invocation requires admin. Scheduled (no token) proceeds.
    try {
      const caller = await base44.auth.me();
      if (caller && caller.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }
    } catch (_authErr) {
      // No user token — scheduled invocation, proceed with service role.
    }

    // Parse body (dry_run + optional project filter). Scheduled invocations
    // may have an empty body — that's valid, not an error.
    const text = await req.text();
    const body = text.trim() ? JSON.parse(text) : {};
    const dryRun = body.dry_run === true;
    const filterProject = body.project || null;
    const filterNorm = filterProject ? normalizeProjectName(filterProject) : null;

    const today = new Date().toISOString().slice(0, 10);

    // ── Load all data upfront (single round-trip per entity) ──
    const [allTx, allLandlords, allLPs, allProperties] = await Promise.all([
      svc.entities.MarketTransaction.list('-transaction_date', 5000),
      svc.entities.Landlord.list('-created_date', 5000),
      svc.entities.LandlordProperty.list('-created_date', 5000),
      svc.entities.Property.list('-created_date', 5000),
    ]);

    // Build Property lookup by id
    const propById = {};
    for (const p of allProperties) {
      if (p.id) propById[p.id] = p;
    }

    // Group LandlordProperty by landlord_id
    const lpsByLandlord = {};
    for (const lp of allLPs) {
      if (!lp.landlord_id) continue;
      if (!lpsByLandlord[lp.landlord_id]) lpsByLandlord[lp.landlord_id] = [];
      lpsByLandlord[lp.landlord_id].push(lp);
    }

    // ── Group MarketTransactions by normalized project name ──
    const projectGroups = {};
    for (const t of allTx) {
      if (t.is_outlier === true) continue;
      const norm = normalizeProjectName(t.project_name);
      if (!norm) continue;
      if (!projectGroups[norm]) {
        projectGroups[norm] = { originalName: t.project_name, txs: [] };
      }
      projectGroups[norm].txs.push(t);
    }

    // ── Process each project ──
    for (const [normProject, group] of Object.entries(projectGroups)) {
      if (filterNorm && filterNorm !== normProject) continue;
      if (unitsValued >= MAX_UNITS_PER_RUN) {
        hasMore = true;
        break;
      }

      projectsProcessed++;

      // 1. DEDUPLICATE comps on (unit_number, transaction_date, price_per_sqft, area_sqft)
      const seen = new Set();
      const dedupedComps = [];
      for (const t of group.txs) {
        const key = `${normalizeUnit(t.unit_number)}|${t.transaction_date || ''}|${t.price_per_sqft || ''}|${t.area_sqft || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedupedComps.push(t);
      }

      if (!dedupedComps.length) continue;

      // 2. Build exact unit map + floor-stack map
      const exactMap = {};        // normalized unit_number → { bedrooms, area }
      const stackRaw = {};          // last-2-digits → [{ bedrooms, area }, ...]

      for (const t of dedupedComps) {
        const unitDigits = normalizeUnit(t.unit_number);
        if (!unitDigits) continue;

        // Exact map (first comp wins for a given unit)
        if (!exactMap[unitDigits]) {
          exactMap[unitDigits] = { bedrooms: t.bedrooms, area: num(t.area_sqft) };
        }

        // Stack map: keyed on last 2 digits of the unit number
        const stackKey = unitDigits.slice(-2);
        if (!stackRaw[stackKey]) stackRaw[stackKey] = [];
        stackRaw[stackKey].push({ bedrooms: t.bedrooms, area: num(t.area_sqft) });
      }

      // Resolve modal bedrooms + modal area for each stack
      const stackResolved = {};
      for (const [key, items] of Object.entries(stackRaw)) {
        const bedrooms = mode(items.map((i) => i.bedrooms));
        const areas = items.map((i) => i.area).filter((a) => a != null && a > 0);
        const area = areas.length ? median(areas) : null;
        stackResolved[key] = { bedrooms, area };
      }

      // Max transaction date for this project (refresh check)
      const maxTxTs = dedupedComps
        .map((t) => (t.transaction_date ? new Date(t.transaction_date).getTime() : 0))
        .filter((ts) => !isNaN(ts))
        .reduce((mx, ts) => Math.max(mx, ts), 0);

      // 3. Find matching landlords for this project (non-terminal stages)
      const projectLandlords = allLandlords.filter(
        (l) =>
          normalizeProjectName(l.project_name) === normProject &&
          !TERMINAL_STAGES.includes(l.stage)
      );

      for (const landlord of projectLandlords) {
        landlordsScanned++;
        if (unitsValued >= MAX_UNITS_PER_RUN) {
          hasMore = true;
          break;
        }

        try {
          const lps = lpsByLandlord[landlord.id] || [];

          // Check if landlord has any valued LP
          const valuedLPs = lps.filter((lp) => lp.ai_estimated_value_aed != null);

          if (valuedLPs.length > 0) {
            // 7. Idempotency: skip unless stale (>60d) AND newer MarketTransactions exist
            const needsRefresh = valuedLPs.some((lp) => {
              const valDate = lp.ai_valuation_updated_at;
              if (!valDate) return false;
              const d = new Date(valDate);
              if (isNaN(d)) return false;
              const isStale = Date.now() - d.getTime() > STALE_DAYS * 86400000;
              if (!isStale) return false;
              // Newer MarketTransactions exist?
              return maxTxTs > 0 && maxTxTs > d.getTime();
            });

            if (!needsRefresh) {
              skippedAlreadyValued++;
              continue;
            }
            // Refresh: fall through and re-process all units
          }

          // Parse unit_reference: comma-separated, trimmed, deduped, normalized
          const unitRefs = [
            ...new Set(
              String(landlord.unit_reference || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map(normalizeUnit)
                .filter(Boolean)
            ),
          ];

          if (unitRefs.length === 0) {
            skippedNoUnitReference++;
            continue;
          }

          // Build LP → unit_no map (from linked Properties)
          const lpUnitMap = {};        // normalized unit_no → LP
          const unvaluedLPs = [];

          for (const lp of lps) {
            if (lp.ai_estimated_value_aed == null) unvaluedLPs.push(lp);

            if (lp.property_id) {
              const prop = propById[lp.property_id];
              if (prop && prop.unit_no) {
                const normUnitNo = normalizeUnit(prop.unit_no);
                if (normUnitNo) {
                  // Check for inconsistent link: unit_no NOT in landlord's unit_reference
                  if (!unitRefs.includes(normUnitNo)) {
                    skippedInconsistentLink++;
                  } else {
                    lpUnitMap[normUnitNo] = lp;
                  }
                }
              }
            }
          }

          // 4-6. Process each unit
          for (const unitRef of unitRefs) {
            if (unitsValued >= MAX_UNITS_PER_RUN) {
              hasMore = true;
              break;
            }

            // Resolve subject bedrooms + area
            let subjectBedrooms = null;
            let subjectArea = null;
            let areaSource = 'unknown';

            const exact = exactMap[unitRef];
            if (exact) {
              subjectBedrooms = exact.bedrooms;
              subjectArea = exact.area;
              areaSource = 'exact DLD unit match';
            } else {
              const stackKey = unitRef.slice(-2);
              const stack = stackResolved[stackKey];
              if (stack && (stack.bedrooms || stack.area)) {
                subjectBedrooms = stack.bedrooms;
                subjectArea = stack.area;
                areaSource = 'floor-stack profile';
              } else {
                skippedUnknownStack++;
                continue;
              }
            }

            // Subject status: 'ready' unless matching LP has is_off_plan=true
            let subjectStatus = 'ready';
            const matchingLP = lpUnitMap[unitRef];
            if (matchingLP && matchingLP.is_off_plan === true) {
              subjectStatus = 'offplan';
            }

            // 5. Compute valuation
            const valuation = computeValuation({
              comps: dedupedComps,
              subjectBedrooms,
              subjectArea,
              subjectStatus,
              areaSource,
            });

            if (!valuation) {
              skippedUnknownStack++;
              continue;
            }

            // 6. Write
            if (!dryRun) {
              const updateFields = {
                ai_estimated_value_aed: valuation.estValue,
                ai_estimated_price_sqft: valuation.estPsf,
                ai_valuation_confidence: valuation.confidence,
                ai_valuation_basis: valuation.basis,
                ai_valuation_updated_at: today,
              };

              // (a) Existing LP with matching Property.unit_no → update
              if (matchingLP) {
                await svc.entities.LandlordProperty.update(matchingLP.id, updateFields);
              } else if (unvaluedLPs.length === 1 && unitRefs.length === 1) {
                // (b) No matching LP, exactly one unvalued LP, landlord has one unit → update
                await svc.entities.LandlordProperty.update(unvaluedLPs[0].id, updateFields);
              } else {
                // (c) No suitable row → create new LP
                await svc.entities.LandlordProperty.create({
                  landlord_id: landlord.id,
                  ...updateFields,
                });
              }
            }

            unitsValued++;
          }
        } catch (landlordErr) {
          errors.push(
            `Landlord ${landlord.id} (${landlord.full_name_en || landlord.full_name || '?'}): ${landlordErr.message}`
          );
        }
      }

      if (unitsValued >= MAX_UNITS_PER_RUN) break;
    }

    return Response.json({
      projects_processed: projectsProcessed,
      landlords_scanned: landlordsScanned,
      units_valued: unitsValued,
      skipped_already_valued: skippedAlreadyValued,
      skipped_no_unit_reference: skippedNoUnitReference,
      skipped_unknown_stack: skippedUnknownStack,
      skipped_inconsistent_link: skippedInconsistentLink,
      has_more: hasMore,
      errors,
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        projects_processed: projectsProcessed,
        landlords_scanned: landlordsScanned,
        units_valued: unitsValued,
        skipped_already_valued: skippedAlreadyValued,
        skipped_no_unit_reference: skippedNoUnitReference,
        skipped_unknown_stack: skippedUnknownStack,
        skipped_inconsistent_link: skippedInconsistentLink,
        has_more: hasMore,
        errors,
      },
      { status: 500 }
    );
  }
});