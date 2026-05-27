import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Temporary read-only diagnostic. Returns a snapshot of PFCredential state,
// the total count of property_finder leads, and a 5-row sample. Delete after
// the resumable-sync rollout is verified.

const mask = (s) => s ? String(s).substring(0, 6) + ' (' + String(s).length + ' chars)' : 'EMPTY';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    try { await base44.auth.me(); } catch (_) { /* gate degraded — proceed via service role */ }

    const creds = await base44.asServiceRole.entities.PFCredential.list();
    const pfCredential = (creds || []).map((c) => ({
      id: c.id,
      api_key_masked: mask(c.api_key),
      api_secret_masked: mask(c.api_secret),
      is_connected: c.is_connected || false,
      last_tested_at: c.last_tested_at || null,
      test_message: c.test_message || null,
      sync_last_completed_page: c.sync_last_completed_page ?? null,
      sync_total_pages: c.sync_total_pages ?? null,
      sync_in_progress_since: c.sync_in_progress_since || null,
      sync_last_completed_at: c.sync_last_completed_at || null,
    }));

    let leadCount = 0;
    const pageSize = 500;
    let pageIdx = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Lead.filter(
        { source: 'property_finder' }, '-created_date', pageSize, pageIdx * pageSize
      );
      leadCount += batch.length;
      if (batch.length < pageSize) break;
      pageIdx++;
    }

    const recent = await base44.asServiceRole.entities.Lead.filter(
      { source: 'property_finder' }, '-created_date', 5
    );
    const recentLeadsSample = (recent || []).map((l) => ({
      created_date: l.created_date || null,
      name: l.name || null,
      pf_lead_id: (l.source_metadata && l.source_metadata.pf_lead_id) || null,
      listing_id: (l.source_metadata && l.source_metadata.listing_id) || null,
    }));

    return Response.json({
      timestamp: new Date().toISOString(),
      pfCredential,
      leadCount,
      recentLeadsSample,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
