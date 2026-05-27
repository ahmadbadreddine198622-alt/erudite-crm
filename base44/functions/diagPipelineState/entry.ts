import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Read-only diagnostic for the pipeline data state. No writes. Returns a
// snapshot showing PFCredential progress timestamps, PFListing coverage,
// Lead distribution across source/intent/status/stage, per-source backfill
// coverage, and a 10-lead match-attempt diagnostic. Delete after we've
// settled the pipeline-data issues.

const SOFT_TIMEOUT_MS = 20000;
const PAGE_SIZE = 500;

function incr(obj: Record<string, number>, key: string) {
  obj[key] = (obj[key] || 0) + 1;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const start = Date.now();
    const deadline = start + SOFT_TIMEOUT_MS;
    let partialReason: string | null = null;

    try { await base44.auth.me(); } catch (_) { /* gate degraded — proceed via service role */ }

    // ─── PFCredential snapshot ─────────────────────────────────────
    let credRow: any = null;
    try {
      const creds = await base44.asServiceRole.entities.PFCredential.list();
      credRow = (creds && creds.length > 0) ? creds[0] : null;
    } catch (_) { /* non-fatal */ }

    const pfCredential = credRow ? {
      exists: true,
      is_connected: !!credRow.is_connected,
      leads_sync_last_completed_at: credRow.sync_last_completed_at || null,
      leads_sync_last_completed_page: credRow.sync_last_completed_page ?? null,
      listings_sync_last_completed_at: credRow.listings_sync_last_completed_at || null,
      listings_sync_last_completed_page: credRow.listings_sync_last_completed_page ?? null,
      listings_sync_total_pages: credRow.listings_sync_total_pages ?? null,
      backfill_last_completed_at: credRow.backfill_last_completed_at || null,
      backfill_last_completed_offset: credRow.backfill_last_completed_offset ?? null,
      backfill_in_progress_since: credRow.backfill_in_progress_since || null,
    } : { exists: false };

    // ─── PFListing snapshot + lookup maps ──────────────────────────
    const pfListingsById: Record<string, any> = {};
    const pfListingsByRef: Record<string, any> = {};
    let pfListingTotal = 0;
    const offeringBreakdown: Record<string, number> = { sale: 0, rent: 0, unknown: 0, null_or_missing: 0 };
    const sample5: any[] = [];
    let mostRecentRaw: any = null;
    let mostRecentTs: string | null = null;

    let lpage = 0;
    while (true) {
      if (Date.now() > deadline) { partialReason = partialReason || 'soft_timeout_listings'; break; }
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        {}, '-updated_date', PAGE_SIZE, lpage * PAGE_SIZE
      );
      for (const L of batch) {
        pfListingTotal++;
        if (L.listing_id) pfListingsById[L.listing_id] = L;
        if (L.listing_reference) pfListingsByRef[L.listing_reference] = L;
        const ot = L.offering_type;
        if (ot === 'sale') incr(offeringBreakdown, 'sale');
        else if (ot === 'rent') incr(offeringBreakdown, 'rent');
        else if (ot === 'unknown') incr(offeringBreakdown, 'unknown');
        else incr(offeringBreakdown, 'null_or_missing');
        if (sample5.length < 5) {
          sample5.push({
            id: L.id,
            listing_id: L.listing_id || null,
            listing_reference: L.listing_reference || null,
            offering_type: L.offering_type || null,
            title: L.title || null,
            image_url: L.image_url || null,
            price: L.price ?? null,
            price_period: L.price_period || null,
          });
        }
        const ts = L.updated_date || L.created_date;
        if (ts && (!mostRecentTs || ts > mostRecentTs)) {
          mostRecentTs = ts;
          mostRecentRaw = L.raw_data || null;
        }
      }
      if (batch.length < PAGE_SIZE) break;
      lpage++;
    }

    // ─── Lead snapshot (paginate ALL leads) ────────────────────────
    let leadTotal = 0;
    const bySource: Record<string, number> = {
      property_finder: 0, whatsapp: 0, instagram: 0, other: 0, null_or_missing: 0,
    };
    const byIntent: Record<string, number> = {
      buyer: 0, tenant: 0, unknown: 0, null_or_missing: 0,
    };
    const byStatus: Record<string, number> = {};
    const byStageIntakeOnly: Record<string, number> = {};
    let stageEnteredAtSet = 0;
    let stageEnteredAtUnset = 0;
    const backfillCoverageBySource: Record<string, { touched: number; untouched: number }> = {};
    const intakeSampleCandidates: any[] = [];

    let leadPage = 0;
    while (true) {
      if (Date.now() > deadline) { partialReason = partialReason || 'soft_timeout_leads'; break; }
      const batch = await base44.asServiceRole.entities.Lead.filter(
        {}, '-created_date', PAGE_SIZE, leadPage * PAGE_SIZE
      );

      for (const L of batch) {
        leadTotal++;

        const src = L.source;
        const srcKey = (src === 'property_finder' || src === 'whatsapp' || src === 'instagram')
          ? src
          : (src === null || src === undefined ? 'null_or_missing' : 'other');
        incr(bySource, srcKey);

        const intent = L.intent;
        if (intent === 'buyer') incr(byIntent, 'buyer');
        else if (intent === 'tenant') incr(byIntent, 'tenant');
        else if (intent === 'unknown') incr(byIntent, 'unknown');
        else incr(byIntent, 'null_or_missing');

        const statusKey = L.status || '__null_or_missing__';
        incr(byStatus, statusKey);

        if (L.stage_entered_at) stageEnteredAtSet++;
        else stageEnteredAtUnset++;

        if (!backfillCoverageBySource[srcKey]) {
          backfillCoverageBySource[srcKey] = { touched: 0, untouched: 0 };
        }
        if (L.stage_entered_at) backfillCoverageBySource[srcKey].touched++;
        else backfillCoverageBySource[srcKey].untouched++;

        const isIntake = (intent === 'unknown' || intent === null || intent === undefined || L.stage === 'intake_clarify');
        if (isIntake) {
          const stageKey = L.stage || '__null_or_missing__';
          incr(byStageIntakeOnly, stageKey);

          if (intakeSampleCandidates.length < 10) {
            const meta = L.source_metadata || {};
            intakeSampleCandidates.push({
              lead_id: L.id,
              name: L.name || null,
              source: L.source || null,
              listing_id: meta.listing_id || null,
              listing_reference: meta.listing_reference || null,
              current_intent: intent ?? null,
              current_stage: L.stage || null,
              current_status: L.status || null,
            });
          }
        }
      }

      if (batch.length < PAGE_SIZE) break;
      leadPage++;
    }

    // ─── Match diagnostic ──────────────────────────────────────────
    let wouldRouteBuyer = 0;
    let wouldRouteTenant = 0;
    let wouldRouteUnknownNoMatch = 0;
    let wouldRouteUnknownMatchNoOffering = 0;

    const sample10IntakeLeads = intakeSampleCandidates.map((c) => {
      const matchById = c.listing_id ? pfListingsById[c.listing_id] : null;
      const matchByRef = c.listing_reference ? pfListingsByRef[c.listing_reference] : null;
      const match = matchById || matchByRef;
      const ot = match ? match.offering_type : null;
      let routedAs;
      if (ot === 'sale') { routedAs = 'buyer'; wouldRouteBuyer++; }
      else if (ot === 'rent') { routedAs = 'tenant'; wouldRouteTenant++; }
      else if (match) { routedAs = 'unknown_match_no_offering'; wouldRouteUnknownMatchNoOffering++; }
      else { routedAs = 'unknown_no_match'; wouldRouteUnknownNoMatch++; }
      return {
        ...c,
        match_by_id: matchById ? 'FOUND' : 'NOT_FOUND',
        match_by_reference: matchByRef ? 'FOUND' : 'NOT_FOUND',
        matched_offering_type: ot,
        would_route_to: routedAs,
      };
    });

    const matchDiagnostic = {
      sample_10_intake_leads: sample10IntakeLeads,
      summary: {
        sample_size: sample10IntakeLeads.length,
        would_route_buyer: wouldRouteBuyer,
        would_route_tenant: wouldRouteTenant,
        would_route_unknown_no_match: wouldRouteUnknownNoMatch,
        would_route_unknown_match_no_offering: wouldRouteUnknownMatchNoOffering,
      },
    };

    return Response.json({
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
      partial: partialReason !== null,
      partial_reason: partialReason,
      pfCredential,
      pfListings: {
        total_count: pfListingTotal,
        offering_type_breakdown: offeringBreakdown,
        sample_5: sample5,
      },
      most_recent_listing_raw_data: mostRecentRaw,
      leads: {
        total_count: leadTotal,
        by_source: bySource,
        by_intent: byIntent,
        by_status: byStatus,
        by_stage_intake_only: byStageIntakeOnly,
        stage_entered_at_set_count: stageEnteredAtSet,
        stage_entered_at_unset_count: stageEnteredAtUnset,
        backfill_coverage_by_source: backfillCoverageBySource,
      },
      matchDiagnostic,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
