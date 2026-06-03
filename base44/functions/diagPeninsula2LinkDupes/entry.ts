import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// READ-ONLY. Determines whether Peninsula 2 has duplicate LandlordProperty
// rows (same landlord_id + property_id) vs whether the earlier 779 total was
// a pagination artifact. Method:
//   1. List ALL LandlordProperty, dedupe by unique record id (collapses any
//      double-returns from offset pagination over a non-unique sort key).
//   2. Restrict to Peninsula 2 links (landlord_id is a project landlord).
//   3. Count distinct (landlord_id|property_id) pairs vs distinct rows.
//      duplicates = rows - distinct pairs.
// Also reports rawReturned vs distinctRows so the pagination over-count (if
// any) is visible directly. No writes.

const PROJECT_ID = '6a1808d8793c2b7606599f55';
const PAGE = 200;

async function listAllRaw(entity: any, filter: any) {
  const out: any[] = [];
  for (let page = 0; ; page++) {
    const batch = await entity.filter(filter, '-created_date', PAGE, page * PAGE);
    out.push(...batch);
    if (!batch || batch.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate below */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const svc = base44.asServiceRole.entities;

  // Peninsula 2 landlord ids
  const landlords = await listAllRaw(svc.Landlord, { project_id: PROJECT_ID });
  const p2LandlordIds = new Set<string>(landlords.map((L: any) => L.id));

  // all links, deduped by unique record id
  const rawLinks = await listAllRaw(svc.LandlordProperty, {});
  const byId = new Map<string, any>();
  for (const X of rawLinks) if (X.id) byId.set(X.id, X);

  // Peninsula 2 links only (deduped rows)
  const p2Rows = [...byId.values()].filter((X: any) => p2LandlordIds.has(X.landlord_id));
  const pairCount = new Map<string, number>();
  for (const X of p2Rows) {
    const sig = `${X.landlord_id}|${X.property_id}`;
    pairCount.set(sig, (pairCount.get(sig) || 0) + 1);
  }
  const distinctPairs = pairCount.size;
  const duplicateRows = p2Rows.length - distinctPairs;
  const dupSamples = [...pairCount.entries()]
    .filter(([, n]) => n > 1)
    .slice(0, 25)
    .map(([sig, n]) => ({ pair: sig, occurrences: n }));

  return Response.json({
    mode: 'readonly_dup_check',
    pagination_visibility: {
      raw_link_rows_returned: rawLinks.length,
      distinct_link_rows_by_id: byId.size,
      pagination_overcount: rawLinks.length - byId.size,
    },
    peninsula2: {
      landlords: landlords.length,
      link_rows_distinct_by_id: p2Rows.length,
      distinct_landlord_property_pairs: distinctPairs,
      duplicate_rows: duplicateRows,
    },
    duplicate_pair_samples: dupSamples,
  });
});
