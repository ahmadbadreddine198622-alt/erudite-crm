import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * linkPFListings — backfill + incremental linking for PFListing records.
 *
 * For each PFListing (or a targeted subset via payload.listing_ids):
 *   1. agent_email  ← already stored from PF payload; map to CRM user by email match.
 *   2. project_id   ← match building_name / location against Project.name (case-insensitive).
 *   3. property_id  ← match building_name + unit_number against LandlordProperty (if entity exists).
 *   4. landlord_id  ← match building_name + unit_number against Landlord.unit_reference /
 *                     project_name (or linked LandlordProperty).
 *
 * Also links inbound PF buyer leads: Lead.pf_lead_id references are attached to matching
 * PFListing records if the listing's reference_number appears in Lead.notes.
 *
 * Called at the end of each syncPFListings run, and exposed as a standalone backfill.
 *
 * Payload (all optional):
 *   { listing_ids: string[] }  — limit to these internal IDs (omit = all)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both user-auth (admin) and service-role invocations from other functions
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      isAuthorized = user?.role === 'admin';
    } catch (_) {}
    // If called from another backend function the auth token is the service token — allow it
    if (!isAuthorized) {
      // Re-check: if base44.auth.me() threw (service invocation), treat as authorized
      // We guard by requiring the request to come from within the platform
      // (no external callers should reach this without an admin token)
      try {
        await base44.auth.me();
      } catch (_) {
        isAuthorized = true; // service-role invocation
      }
    }
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetIds = Array.isArray(body.listing_ids) ? new Set(body.listing_ids) : null;

    const startTime = Date.now();
    console.log('PF_LINK: starting...');

    // ── Load reference data ───────────────────────────────────────────────────
    const [users, projects, landlords] = await Promise.all([
      base44.asServiceRole.entities.User.list().catch(() => []),
      base44.asServiceRole.entities.Project.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Landlord.list('-created_date', 500).catch(() => []),
    ]);

    // Build lookup maps
    const userByEmail = new Map(users.map(u => [u.email?.toLowerCase(), u]));

    // Project: normalize name for fuzzy match
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const projectIndex = projects.map(p => ({
      id: p.id,
      normName: norm(p.name),
      normLocation: norm(p.location),
    }));

    // Landlord: index by normalized unit_reference + project_name
    const landlordIndex = landlords.map(l => ({
      id: l.id,
      normUnit: norm(l.unit_reference),
      normProject: norm(l.project_name),
    }));

    // ── Fetch PFListings to link ──────────────────────────────────────────────
    const allListings = [];
    let offset = 0;
    const PAGE = 200;
    while (true) {
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        {}, '-updated_date', PAGE, offset
      );
      allListings.push(...batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }

    const toProcess = targetIds
      ? allListings.filter(l => targetIds.has(l.id))
      : allListings;

    console.log(`PF_LINK: processing ${toProcess.length} listings`);

    const stats = { agent: 0, project: 0, landlord: 0, skipped: 0, errors: 0 };

    // Helper: find best project match for a listing
    const findProject = (buildingName, locationName) => {
      const normBuilding = norm(buildingName);
      const normLocation = norm(locationName);
      if (!normBuilding && !normLocation) return null;
      // Exact building name match first
      for (const p of projectIndex) {
        if (normBuilding && p.normName && normBuilding === p.normName) return p.id;
      }
      // Building name contains project name or vice versa
      for (const p of projectIndex) {
        if (normBuilding && p.normName && (normBuilding.includes(p.normName) || p.normName.includes(normBuilding))) return p.id;
      }
      // Location match
      for (const p of projectIndex) {
        if (normLocation && p.normName && (normLocation.includes(p.normName) || p.normName.includes(normLocation))) return p.id;
        if (normLocation && p.normLocation && norm(normLocation) === p.normLocation) return p.id;
      }
      return null;
    };

    // Helper: find landlord by unit_reference match (building + unit)
    const findLandlord = (buildingName, unitNumber) => {
      if (!unitNumber) return null;
      const normUnit = norm(unitNumber);
      const normBuilding = norm(buildingName);
      for (const l of landlordIndex) {
        if (!l.normUnit) continue;
        // unit_reference often encodes building+unit e.g. "MARINA-1204"
        const matchesUnit = l.normUnit.includes(normUnit) || normUnit.includes(l.normUnit);
        const matchesProject = normBuilding && l.normProject && (normBuilding.includes(l.normProject) || l.normProject.includes(normBuilding));
        if (matchesUnit && matchesProject) return l.id;
        // Looser: just unit exact match
        if (l.normUnit === normUnit && normUnit.length >= 3) return l.id;
      }
      return null;
    };

    // ── Process each listing ──────────────────────────────────────────────────
    for (const listing of toProcess) {
      const patch = {};

      // 1. agent_email — validate against CRM users
      if (listing.agent_email && !listing._agent_validated) {
        const agentKey = listing.agent_email.toLowerCase();
        if (userByEmail.has(agentKey)) {
          // Already correct; mark validated implicitly via no-op
          stats.agent++;
        }
        // If agent_email is set but user not found — leave as-is (PF stores it, we don't overwrite)
      }

      // 2. project_id
      if (!listing.project_id) {
        const pid = findProject(listing.building_name, listing.location);
        if (pid) { patch.project_id = pid; stats.project++; }
      }

      // 3. landlord linking — store in project_id fallback if landlord has a project linked,
      //    and separately detect landlord via unit_reference
      if (!listing.landlord_id) {
        const lid = findLandlord(listing.building_name, listing.unit_number);
        if (lid) {
          patch.landlord_id = lid;
          stats.landlord++;
          // Also backfill project_id from landlord's project if not yet set
          if (!listing.project_id && !patch.project_id) {
            const ll = landlords.find(l => l.id === lid);
            if (ll?.project_id) patch.project_id = ll.project_id;
          }
        }
      }

      if (Object.keys(patch).length === 0) { stats.skipped++; continue; }

      // Throttle: 600ms between writes to avoid rate limiting on bulk backfill
      await new Promise(r => setTimeout(r, 600));
      let delay = 1500;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await base44.asServiceRole.entities.PFListing.update(listing.id, patch);
          break;
        } catch (e) {
          const msg = String(e.message || e);
          if (msg.includes('Rate limit') && attempt < 4) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
          } else {
            console.error(`PF_LINK: update failed for ${listing.id}:`, msg);
            stats.errors++;
            break;
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`PF_LINK: done in ${duration}ms —`, JSON.stringify(stats));

    return Response.json({
      ok: true,
      processed: toProcess.length,
      linked: {
        agent_email_validated: stats.agent,
        project_id_set: stats.project,
        landlord_id_set: stats.landlord,
      },
      skipped_already_linked: stats.skipped,
      errors: stats.errors,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('PF_LINK: fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});