import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Per-track stage migration map (old runtime/schema stage values → new track-specific stages).
// 'unknown' intent always collapses to intake_clarify (handled inline in computeNewStage).
const STAGE_MIGRATION_MAP: Record<string, Record<string, string>> = {
  buyer: {
    new: 'new_buyer_lead',
    new_lead: 'new_buyer_lead',
    contacted: 'new_buyer_lead',
    qualified: 'qualified_buyer',
    nurturing: 'new_buyer_lead',
    viewing_scheduled: 'viewing_engagement',
    viewing_done: 'viewing_engagement',
    negotiation: 'offer_negotiation',
    negotiating: 'offer_negotiation',
    offer_made: 'offer_negotiation',
    contract_sent: 'mou_dld_processing',
    won: 'transfer_closure',
    closed_won: 'transfer_closure',
    lost: 'new_buyer_lead',
    closed_lost: 'new_buyer_lead',
    on_hold: 'new_buyer_lead',
  },
  tenant: {
    new: 'new_tenant_lead',
    new_lead: 'new_tenant_lead',
    contacted: 'new_tenant_lead',
    qualified: 'qualified_tenant',
    nurturing: 'new_tenant_lead',
    viewing_scheduled: 'viewing_decision',
    viewing_done: 'viewing_decision',
    negotiation: 'contract_cheques',
    negotiating: 'contract_cheques',
    offer_made: 'contract_cheques',
    contract_sent: 'contract_cheques',
    won: 'ejari_movein',
    closed_won: 'ejari_movein',
    lost: 'new_tenant_lead',
    closed_lost: 'new_tenant_lead',
    on_hold: 'new_tenant_lead',
  },
};

// Old stages that imply a lifecycle status change in the new model.
const STAGE_STATUS_OVERRIDE: Record<string, string> = {
  lost: 'lost',
  closed_lost: 'lost',
  on_hold: 'on_hold',
};

function computeNewStage(intent: string, oldStage: string): string {
  if (intent === 'unknown') return 'intake_clarify';
  const map = STAGE_MIGRATION_MAP[intent] || {};
  return map[oldStage] || (intent === 'buyer' ? 'new_buyer_lead' : 'new_tenant_lead');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const force = !!(body && body.force === true);

    const syncStart = Date.now();
    const SOFT_TIMEOUT_MS = 22000;
    const deadlineMs = syncStart + SOFT_TIMEOUT_MS;
    const CHUNK_SIZE = 100;

    const diagnostics: any = {
      leads_processed_this_run: 0,
      leads_migrated_this_run: 0,
      leads_skipped_already_done: 0,
      leads_skipped_no_listing_match: 0,
      matched_to_listing: 0,
      routed_buyer: 0,
      routed_tenant: 0,
      routed_unknown: 0,
      error_count: 0,
      time_ms_listing_load: 0,
      time_ms_lead_processing: 0,
      time_ms_total: 0,
      first_error_message: null,
      terminated_reason: 'unknown',
      resume_from_offset: 0,
      sweep_complete: false,
      force_mode: force,
      next_action_for_ahmad: '',
    };

    try { await base44.auth.me(); } catch (_) { /* gate degraded — proceed via service role */ }

    // Read resume state from PFCredential (non-fatal if absent)
    let credRow: any = null;
    try {
      const creds = await base44.asServiceRole.entities.PFCredential.list();
      credRow = (creds && creds.length > 0) ? creds[0] : null;
    } catch (err) {
      console.error('BACKFILL_RESUME: failed to read PFCredential:', String((err && err.message) || err));
    }
    const resumeOffset = Number((credRow && credRow.backfill_last_completed_offset) || 0);
    diagnostics.resume_from_offset = resumeOffset;
    console.log('BACKFILL_RESUME: resume_from_offset=' + resumeOffset + ', force=' + force + ', has_cred_row=' + !!credRow);

    if (credRow && !credRow.backfill_in_progress_since) {
      try {
        await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
          backfill_in_progress_since: new Date().toISOString(),
        });
      } catch (err) {
        console.error('BACKFILL_PROGRESS: failed to set backfill_in_progress_since:', String((err && err.message) || err));
      }
    }

    // ─── Phase 1: load PFListing lookup tables ───────────────────────
    const listingLoadStart = Date.now();
    const pfListingsById: Record<string, any> = {};
    const pfListingsByRef: Record<string, any> = {};
    let lpage = 0;
    const lpageSize = 500;
    let listingLoadTimedOut = false;
    while (true) {
      if (Date.now() > deadlineMs) {
        diagnostics.terminated_reason = 'soft_timeout';
        listingLoadTimedOut = true;
        break;
      }
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        {}, '-updated_date', lpageSize, lpage * lpageSize
      );
      for (const L of batch) {
        if (L.pf_listing_id) pfListingsById[L.pf_listing_id] = L;
        if (L.reference_number) pfListingsByRef[L.reference_number] = L;
      }
      if (batch.length < lpageSize) break;
      lpage++;
    }
    diagnostics.time_ms_listing_load = Date.now() - listingLoadStart;
    console.log('BACKFILL_LISTINGS: loaded ' + Object.keys(pfListingsById).length + ' listings in ' + diagnostics.time_ms_listing_load + 'ms');

    // ─── Phase 2: migrate leads in offset-based chunks ───────────────
    let offset = resumeOffset;
    let sweepComplete = false;
    const processingStart = Date.now();

    if (!listingLoadTimedOut) {
      while (true) {
        if (Date.now() > deadlineMs) {
          if (
            diagnostics.terminated_reason === 'unknown' ||
            diagnostics.terminated_reason === 'completed_all' ||
            diagnostics.terminated_reason === 'empty_batch'
          ) {
            diagnostics.terminated_reason = 'soft_timeout';
          }
          break;
        }

        // Fetch next chunk of leads (ALL sources — per Ahmad's instruction)
        const batch = await base44.asServiceRole.entities.Lead.filter(
          {}, '-created_date', CHUNK_SIZE, offset
        );

        if (batch.length === 0) {
          if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
            diagnostics.terminated_reason = 'completed_all';
          }
          sweepComplete = true;
          break;
        }

        let midChunkTimeout = false;
        for (const lead of batch) {
          if (Date.now() > deadlineMs) {
            if (
              diagnostics.terminated_reason === 'unknown' ||
              diagnostics.terminated_reason === 'completed_all' ||
              diagnostics.terminated_reason === 'empty_batch'
            ) {
              diagnostics.terminated_reason = 'soft_timeout';
            }
            midChunkTimeout = true;
            break;
          }

          diagnostics.leads_processed_this_run += 1;

          // Idempotency check (skipped if force=true)
          if (!force && lead.stage_entered_at) {
            diagnostics.leads_skipped_already_done += 1;
            continue;
          }

          // Determine intent via PFListing lookup, then fall back to relationship_type
          const meta = lead.source_metadata || {};
          const listingId = meta.listing_id;
          const listingRef = meta.listing_reference;
          let match: any = null;
          if (listingId && pfListingsById[listingId]) match = pfListingsById[listingId];
          else if (listingRef && pfListingsByRef[listingRef]) match = pfListingsByRef[listingRef];

          let intent = 'unknown';
          if (match) {
            diagnostics.matched_to_listing += 1;
            if (match.listing_type === 'sale') intent = 'buyer';
            else if (match.listing_type === 'rent') intent = 'tenant';
          } else {
            // Fall back: use existing relationship_type or intent field on the lead
            const rt = (lead.relationship_type || lead.intent || '').toLowerCase();
            if (rt === 'buyer' || rt === 'buy' || rt === 'sale' || rt === 'purchase') intent = 'buyer';
            else if (rt === 'tenant' || rt === 'rent' || rt === 'rental') intent = 'tenant';
            if (intent === 'unknown') diagnostics.leads_skipped_no_listing_match += 1;
            else diagnostics.matched_to_listing += 1;
          }

          const oldStage = lead.stage || 'new_lead';
          const newStage = computeNewStage(intent, oldStage);
          const newStatus = STAGE_STATUS_OVERRIDE[oldStage] || 'active';

          // Resolve full_name — legacy leads store name in 'name' field
          const fullName = lead.full_name || lead.name || '';

          const update: any = {
            full_name: fullName || 'Unknown',
            intent,
            stage: newStage,
            status: newStatus,
            stage_entered_at: lead.created_date || new Date().toISOString(),
          };
          if (newStatus === 'lost' && !lead.lost_reason) {
            update.lost_reason = 'other';
          }

          try {
            await new Promise(r => setTimeout(r, 400)); // avoid 429 rate limit
            await base44.asServiceRole.entities.Lead.update(lead.id, update);
            diagnostics.leads_migrated_this_run += 1;
            if (intent === 'buyer') diagnostics.routed_buyer += 1;
            else if (intent === 'tenant') diagnostics.routed_tenant += 1;
            else diagnostics.routed_unknown += 1;
          } catch (err) {
            diagnostics.error_count += 1;
            const msg = String((err && err.message) || err);
            if (!diagnostics.first_error_message) {
              diagnostics.first_error_message = 'lead_id=' + lead.id + ': ' + msg;
            }
            console.error('Backfill update error for', lead.id, msg);
          }

          const totalTouched = diagnostics.leads_migrated_this_run + diagnostics.leads_skipped_already_done;
          if (totalTouched > 0 && totalTouched % 100 === 0) {
            console.log('BACKFILL_PROGRESS: touched=' + totalTouched + ', migrated=' + diagnostics.leads_migrated_this_run + ', errors=' + diagnostics.error_count + ', elapsed_ms=' + (Date.now() - processingStart));
          }
        }

        if (midChunkTimeout) break;

        // Chunk fully processed — advance offset & persist
        offset += batch.length;
        if (credRow) {
          try {
            await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
              backfill_last_completed_offset: offset,
            });
          } catch (err) {
            console.error('BACKFILL_PROGRESS: failed to update backfill_last_completed_offset:', String((err && err.message) || err));
          }
        }

        if (batch.length < CHUNK_SIZE) {
          if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
            diagnostics.terminated_reason = 'completed_all';
          }
          sweepComplete = true;
          break;
        }
      }
    }
    diagnostics.time_ms_lead_processing = Date.now() - processingStart;

    // On sweep complete: reset offset, record completion
    if (sweepComplete && credRow) {
      try {
        await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
          backfill_last_completed_offset: 0,
          backfill_in_progress_since: null,
          backfill_last_completed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('BACKFILL_PROGRESS: failed to record sweep completion:', String((err && err.message) || err));
      }
    }

    diagnostics.sweep_complete = sweepComplete;
    diagnostics.time_ms_total = Date.now() - syncStart;
    if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
      diagnostics.terminated_reason = 'completed_all';
    }

    // Compose next_action_for_ahmad
    if (sweepComplete) {
      diagnostics.next_action_for_ahmad =
        'Backfill complete: ' + diagnostics.leads_migrated_this_run + ' leads migrated this run' +
        ' (' + diagnostics.routed_buyer + ' buyers, ' + diagnostics.routed_tenant + ' tenants, ' + diagnostics.routed_unknown + ' unknown).' +
        ' Skipped ' + diagnostics.leads_skipped_already_done + ' already-done.' +
        (diagnostics.routed_unknown > 0 ? ' Tip: re-run with {"force":true} after syncPFListings catches up to upgrade unknowns to buyer/tenant.' : '');
    } else if (diagnostics.terminated_reason === 'soft_timeout') {
      diagnostics.next_action_for_ahmad =
        'Run migrated ' + diagnostics.leads_migrated_this_run + ' leads, skipped ' + diagnostics.leads_skipped_already_done +
        '. Hit soft timeout at offset ' + offset + ' — invoke backfillLeadIntent again to continue.';
    } else {
      diagnostics.next_action_for_ahmad =
        'Run finished with reason "' + diagnostics.terminated_reason + '" at offset ' + offset + '.';
    }

    console.log('BACKFILL_DONE: ' + JSON.stringify(diagnostics));

    return Response.json({
      ok: true,
      total: diagnostics.leads_processed_this_run,
      migrated: diagnostics.leads_migrated_this_run,
      errors: diagnostics.error_count,
      ...diagnostics,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});