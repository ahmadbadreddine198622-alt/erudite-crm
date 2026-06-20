import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * dedupePFListings — idempotent deduplication of PFListing records.
 *
 * Groups ALL PFListing records by pf_listing_id. For each group with > 1 record:
 *   1. Selects survivor = record with most recent updated_date (built-in field).
 *   2. Merges non-null linking fields from duplicates onto survivor if survivor's value is null:
 *      agent_email, agent_name, project_id, property_id, landlord_id, landlord_property_id
 *   3. Deletes all non-survivor records (batched, rate-limit-aware).
 *
 * Idempotent: re-running on an already-clean table is a no-op (reports 0 deleted).
 * Always runs in service role to bypass RLS.
 *
 * Returns: unique_before, unique_after, records_before, records_deleted, groups_deduped
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  const t0 = Date.now();
  console.log('PF_DEDUPE: starting...');

  // ── 1. Load ALL records via service role ────────────────────────────────────
  const all = [];
  const PAGE = 500;
  let offset = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.PFListing.filter(
      {}, '-updated_date', PAGE, offset
    );
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  const recordsBefore = all.length;
  console.log(`PF_DEDUPE: loaded ${recordsBefore} records`);

  // ── 2. Group by pf_listing_id ───────────────────────────────────────────────
  const groups = new Map(); // pf_listing_id → Record[]
  const orphans = []; // records with no pf_listing_id (don't touch)
  for (const r of all) {
    if (!r.pf_listing_id) { orphans.push(r.id); continue; }
    if (!groups.has(r.pf_listing_id)) groups.set(r.pf_listing_id, []);
    groups.get(r.pf_listing_id).push(r);
  }

  const uniqueBefore = groups.size;
  console.log(`PF_DEDUPE: ${uniqueBefore} unique pf_listing_ids, ${orphans.length} orphans (no key)`);

  // ── 3. Process each duplicate group ────────────────────────────────────────
  const LINK_FIELDS = ['agent_email', 'agent_name', 'project_id', 'property_id', 'landlord_id', 'landlord_property_id'];
  let groupsDeduped = 0;
  let recordsDeleted = 0;
  let mergePatches = 0;

  for (const [pfId, group] of groups.entries()) {
    if (group.length === 1) continue; // already unique

    // Sort: most recent updated_date first (built-in ISO string — lexicographic sort works)
    group.sort((a, b) => {
      const ta = a.updated_date || a.created_date || '';
      const tb = b.updated_date || b.created_date || '';
      return tb.localeCompare(ta);
    });

    const survivor = group[0];
    const duplicates = group.slice(1);

    // Merge non-null linking fields from duplicates onto survivor
    const patch = {};
    for (const field of LINK_FIELDS) {
      if (!survivor[field]) {
        for (const dup of duplicates) {
          if (dup[field]) { patch[field] = dup[field]; break; }
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      try {
        await base44.asServiceRole.entities.PFListing.update(survivor.id, patch);
        mergePatches++;
        console.log(`PF_DEDUPE: merged fields ${Object.keys(patch).join(',')} onto survivor ${survivor.id} for pf_id=${pfId}`);
      } catch (e) {
        console.error(`PF_DEDUPE: merge failed for ${survivor.id}:`, e.message);
      }
    }

    // Delete all duplicates with exponential backoff on rate limit
    for (const dup of duplicates) {
      let delay = 250;
      let deleted = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await base44.asServiceRole.entities.PFListing.delete(dup.id);
          recordsDeleted++;
          deleted = true;
          break;
        } catch (e) {
          const msg = String(e.message || e);
          if (msg.includes('Rate limit') && attempt < 4) {
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 2, 4000);
          } else {
            console.error(`PF_DEDUPE: delete failed id=${dup.id} pf_id=${pfId}:`, msg);
            break;
          }
        }
      }
      if (deleted) {
        // small pace delay to avoid burst
        await new Promise(r => setTimeout(r, 50));
      }
    }

    groupsDeduped++;
  }

  const uniqueAfter = groups.size; // same — we removed dupes within groups, not groups themselves
  const recordsAfter = recordsBefore - recordsDeleted;
  const duration = Date.now() - t0;

  console.log(`PF_DEDUPE: done in ${duration}ms — records_before=${recordsBefore}, deleted=${recordsDeleted}, records_after=${recordsAfter}, unique_ids_before=${uniqueBefore}, unique_ids_after=${uniqueAfter}, groups_deduped=${groupsDeduped}, merge_patches=${mergePatches}`);

  return Response.json({
    ok: true,
    records_before: recordsBefore,
    records_deleted: recordsDeleted,
    records_after: recordsAfter,
    unique_pf_listing_ids_before: uniqueBefore,
    unique_pf_listing_ids_after: uniqueAfter,
    groups_deduped: groupsDeduped,
    survivors_merge_patched: mergePatches,
    orphans_no_pf_listing_id: orphans.length,
    duration_ms: duration,
  });
});