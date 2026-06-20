import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * dedupePFListings — idempotent deduplication of PFListing records.
 *
 * Groups by pf_listing_id, keeps the most-recently-updated survivor per group,
 * merges non-null linking fields (agent_email, project_id, property_id) onto the
 * survivor, then deletes the rest. Safe to re-run — already-clean tables are
 * reported with 0 removed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const startTime = Date.now();
    console.log('PF_DEDUPE: starting...');

    // ── 1. Fetch every PFListing record ──────────────────────────────────────
    const allListings = [];
    let offset = 0;
    const PAGE = 500;
    while (true) {
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        {}, '-updated_date', PAGE, offset
      );
      allListings.push(...batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }
    const beforeCount = allListings.length;
    console.log(`PF_DEDUPE: fetched ${beforeCount} records`);

    // ── 2. Group by pf_listing_id ─────────────────────────────────────────────
    const groups = new Map();
    const noKey = [];
    for (const listing of allListings) {
      const key = listing.pf_listing_id;
      if (!key) { noKey.push(listing.id); continue; }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(listing);
    }

    let duplicatesRemoved = 0;
    let mergePatched = 0;

    // ── 3. Process duplicates ─────────────────────────────────────────────────
    for (const [key, group] of groups.entries()) {
      if (group.length === 1) continue; // already clean

      // Sort: most recent updated_date wins (fallback: last_synced_at, then created_date)
      group.sort((a, b) => {
        const ta = new Date(a.updated_date || a.last_synced_at || a.created_date || 0).getTime();
        const tb = new Date(b.updated_date || b.last_synced_at || b.created_date || 0).getTime();
        if (tb !== ta) return tb - ta;
        // Tiebreak: prefer record with pf_url populated
        return (b.pf_url ? 1 : 0) - (a.pf_url ? 1 : 0);
      });

      const survivor = group[0];

      // Merge linking fields from all duplicates onto the survivor (if survivor is missing them)
      const merged = {};
      for (const dup of group.slice(1)) {
        if (!survivor.agent_email && dup.agent_email) merged.agent_email = dup.agent_email;
        if (!survivor.project_id  && dup.project_id)  merged.project_id  = dup.project_id;
        if (!survivor.property_id && dup.property_id) merged.property_id = dup.property_id;
      }
      if (Object.keys(merged).length > 0) {
        await new Promise(r => setTimeout(r, 600));
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await base44.asServiceRole.entities.PFListing.update(survivor.id, merged);
            mergePatched++;
            break;
          } catch (e) {
            if (String(e.message || e).includes('Rate limit') && attempt < 4) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            } else {
              console.error(`PF_DEDUPE: merge patch failed for survivor ${survivor.id}:`, e.message);
              break;
            }
          }
        }
      }

      // Delete the duplicates — throttled: one delete per 700ms minimum
      for (const dup of group.slice(1)) {
        await new Promise(r => setTimeout(r, 700));
        let delay = 1500;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await base44.asServiceRole.entities.PFListing.delete(dup.id);
            duplicatesRemoved++;
            break;
          } catch (e) {
            const msg = String(e.message || e);
            if (msg.includes('Rate limit') && attempt < 4) {
              await new Promise(r => setTimeout(r, delay));
              delay *= 2;
            } else {
              console.error(`PF_DEDUPE: delete failed for ${dup.id} (key=${key}):`, msg);
              break;
            }
          }
        }
      }
    }

    const afterCount = beforeCount - duplicatesRemoved;
    const duration = Date.now() - startTime;
    console.log(`PF_DEDUPE: done in ${duration}ms — before=${beforeCount}, removed=${duplicatesRemoved}, after=${afterCount}, merged=${mergePatched}, no_key=${noKey.length}`);

    return Response.json({
      ok: true,
      before_count: beforeCount,
      duplicates_removed: duplicatesRemoved,
      after_count: afterCount,
      survivors_merge_patched: mergePatched,
      records_with_no_pf_listing_id: noKey.length,
      unique_groups: groups.size,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('PF_DEDUPE: fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});