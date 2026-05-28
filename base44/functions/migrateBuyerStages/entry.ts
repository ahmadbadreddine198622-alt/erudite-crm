import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIGRATION_MAP = {
  new_buyer_lead: 'contact_identity',
  qualified_buyer: 'financial_qualification',
  property_matching: 'unit_matching',
  viewing_engagement: 'viewing',
  offer_negotiation: 'objection_offer',
  mou_dld_processing: 'closing_dld',
  transfer_closure: 'closed',
};

const OLD_STAGES = new Set(Object.keys(MIGRATION_MAP));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const params = new URL(req.url).searchParams;
    const dry_run = params.get('dry_run') === 'true';
    const limit_updates = parseInt(params.get('limit') || '200');

    // Step 1: Collect all leads that need migration
    // Fetch all buyer leads page by page
    const toMigrate = [];
    let offset = 0;
    const PAGE = 100;

    while (true) {
      const batch = await base44.asServiceRole.entities.Lead.filter(
        { intent: 'buyer' },
        '-created_date',
        PAGE,
        offset
      );
      for (const lead of batch) {
        if (OLD_STAGES.has(lead.stage)) {
          toMigrate.push({ id: lead.id, old_stage: lead.stage, stage_entered_at: lead.stage_entered_at });
        }
      }
      if (batch.length < PAGE) break;
      offset += PAGE;
      await sleep(300); // rate-limit pause between pages
    }

    // Build summary
    const summary = {};
    for (const item of toMigrate) {
      const label = `${item.old_stage} → ${MIGRATION_MAP[item.old_stage]}`;
      summary[label] = (summary[label] || 0) + 1;
    }

    if (dry_run) {
      return Response.json({ dry_run: true, total: toMigrate.length, summary });
    }

    // Step 2: Apply migrations with rate-limit delays
    const toProcess = toMigrate.slice(0, limit_updates);
    let migrated = 0;
    const errors = [];

    for (const item of toProcess) {
      try {
        await base44.asServiceRole.entities.Lead.update(item.id, {
          stage: MIGRATION_MAP[item.old_stage],
          stage_entered_at: item.stage_entered_at || new Date().toISOString(),
        });
        migrated++;
        await sleep(150); // stay well under rate limit
      } catch (e) {
        errors.push({ id: item.id, old_stage: item.old_stage, error: e.message });
        await sleep(500); // longer pause on error
      }
    }

    return Response.json({
      success: true,
      total_needing_migration: toMigrate.length,
      processed_this_run: toProcess.length,
      migrated,
      remaining: toMigrate.length - toProcess.length,
      errors: errors.length,
      error_details: errors.slice(0, 5),
      summary,
      note: toMigrate.length > limit_updates
        ? `Run again to process remaining ${toMigrate.length - limit_updates} leads`
        : 'All leads processed',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});