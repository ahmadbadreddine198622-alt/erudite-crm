import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * ONE-TIME DEDUPLICATION FUNCTION FOR PFListing
 * 
 * This function removes duplicate PFListing records, keeping only the most
 * recently synced / most complete row for each pf_listing_id.
 * 
 * GUARD: This is a ONE-TIME cleanup. DO NOT RE-RUN after initial deduplication.
 * 
 * Logic:
 * 1. Group all PFListing records by pf_listing_id (fallback: reference_number)
 * 2. For each group with duplicates, KEEP the row with:
 *    - Most recent last_synced_at
 *    - Prefer one with pf_url populated
 *    - Prefer one with description populated
 * 3. DELETE all other duplicates
 * 
 * Reports: before_count, duplicates_removed, after_count
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin-only check
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('PF_DEDUPE: Starting one-time deduplication...');
    const startTime = Date.now();

    // Fetch ALL PFListing records
    const allListings = [];
    let page = 0;
    const PAGE_SIZE = 500;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        {}, '-created_date', PAGE_SIZE, page * PAGE_SIZE
      );
      allListings.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    const beforeCount = allListings.length;
    console.log(`PF_DEDUPE: Fetched ${beforeCount} total records`);

    // Group by pf_listing_id (primary) or reference_number (fallback)
    const groups = new Map();
    
    for (const listing of allListings) {
      const key = listing.pf_listing_id || listing.reference_number;
      if (!key) {
        console.warn(`PF_DEDUPE: Skipping record ${listing.id} with no pf_listing_id or reference_number`);
        continue;
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(listing);
    }

    let duplicatesRemoved = 0;
    const deletedIds = [];
    const keptIds = [];

    // Process each group
    for (const [key, group] of groups.entries()) {
      if (group.length === 1) {
        keptIds.push(group[0].id);
        continue;
      }

      // Sort by priority: most recent last_synced_at, then has pf_url, then has description
      const sorted = group.sort((a, b) => {
        // Priority 1: Most recent last_synced_at
        const dateA = new Date(a.last_synced_at || a.created_date || 0).getTime();
        const dateB = new Date(b.last_synced_at || b.created_date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;

        // Priority 2: Has pf_url
        const aHasUrl = !!a.pf_url;
        const bHasUrl = !!b.pf_url;
        if (aHasUrl !== bHasUrl) return (bHasUrl ? 1 : 0) - (aHasUrl ? 1 : 0);

        // Priority 3: Has description
        const aHasDesc = !!a.description;
        const bHasDesc = !!b.description;
        if (aHasDesc !== bHasDesc) return (bHasDesc ? 1 : 0) - (aHasDesc ? 1 : 0);

        return 0;
      });

      // Keep the first (best) record
      const keeper = sorted[0];
      keptIds.push(keeper.id);
      console.log(`PF_DEDUPE: Keeping ${keeper.id} for ${key} (synced: ${keeper.last_synced_at}, has_url: ${!!keeper.pf_url})`);

      // Delete the rest with rate limiting
      for (let i = 1; i < sorted.length; i++) {
        const dupe = sorted[i];
        let retryCount = 0;
        while (retryCount < 5) {
          try {
            await base44.asServiceRole.entities.PFListing.delete(dupe.id);
            deletedIds.push(dupe.id);
            duplicatesRemoved++;
            console.log(`PF_DEDUPE: Deleted duplicate ${dupe.id} for ${key}`);
            break;
          } catch (err) {
            const errMsg = String(err.message || err);
            if (errMsg.includes('Rate limit') && retryCount < 4) {
              retryCount++;
              const delay = 500 * retryCount;
              console.log(`PF_DEDUPE: Rate limited, retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              console.error(`PF_DEDUPE: Failed to delete ${dupe.id}:`, err.message);
              break;
            }
          }
        }
      }
    }

    const afterCount = keptIds.length;
    const duration = Date.now() - startTime;

    console.log(`PF_DEDUPE: Complete in ${duration}ms`);
    console.log(`PF_DEDUPE: Before=${beforeCount}, Removed=${duplicatesRemoved}, After=${afterCount}`);

    return Response.json({
      success: true,
      before_count: beforeCount,
      duplicates_removed: duplicatesRemoved,
      after_count: afterCount,
      deleted_ids: deletedIds,
      kept_ids: keptIds,
      duration_ms: duration,
      warning: 'DO NOT RE-RUN - This is a one-time deduplication',
    });
  } catch (error) {
    console.error('PF_DEDUPE: Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});