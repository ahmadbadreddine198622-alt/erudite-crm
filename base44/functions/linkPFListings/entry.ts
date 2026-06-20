import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * linkPFListings — batch linking of PFListing records to CRM entities.
 *
 * For each PFListing (or a targeted subset via payload.listing_ids):
 *   1. agent_email  — from PFListing.agent_email (already stored from PF payload).
 *                     If agent_email is missing but agent_name is set, match CRM User by name.
 *   2. project_id   — match building_name / location against Project.name + Project.location
 *                     (normalized, case-insensitive). Verifies/repairs existing project_id.
 *   3. property_id  — match building_name + unit_number against Property.building_name + unit_no.
 *   4. landlord_id  — match building_name + unit_number against Landlord.project_name + unit_reference.
 *   5. landlord_property_id — match via LandlordProperty → Property join (building + unit).
 *   6. Lead linkage — for Leads with source=property_finder and pf_lead_id set, match the
 *                     PF listing reference carried in the lead to PFListing.reference_number or
 *                     pf_listing_id, then set Lead.linked_pf_listing_id.
 *
 * All reads/writes via asServiceRole to bypass RLS.
 * Idempotent: already-linked fields are not overwritten.
 * Can be called from syncPFListings or standalone.
 *
 * Payload (optional): { listing_ids: string[] } — limit to specific PFListing record IDs.
 *
 * Returns: per-field linked/unmatched counts.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Accept both admin user calls and service-role invocations from other functions
  let authorized = false;
  try {
    const u = await base44.auth.me();
    if (u?.role === 'admin') authorized = true;
  } catch (_) {
    // service-role invocation from another function — allow
    authorized = true;
  }
  if (!authorized) {
    return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetIds = Array.isArray(body.listing_ids) && body.listing_ids.length > 0
    ? new Set(body.listing_ids) : null;

  const t0 = Date.now();
  console.log('PF_LINK: starting' + (targetIds ? ` (${targetIds.size} targeted)` : ' (all)'));

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const norm = s => (s || '').toLowerCase().replace(/[\s\-_,\.]+/g, '').trim();

  async function loadAll(entity, sortField, pageSize) {
    const rows = [];
    let offset = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities[entity].filter(
        {}, sortField, pageSize, offset
      );
      rows.push(...batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
    return rows;
  }

  async function safeUpdate(entity, id, patch, label) {
    let delay = 250;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await base44.asServiceRole.entities[entity].update(id, patch);
        return true;
      } catch (e) {
        const msg = String(e.message || e);
        if (msg.includes('Rate limit') && attempt < 3) {
          await new Promise(r => setTimeout(r, delay));
          delay = Math.min(delay * 2, 3000);
        } else {
          console.error(`PF_LINK: update failed [${label}] id=${id}:`, msg);
          return false;
        }
      }
    }
    return false;
  }

  // ── Load reference data in parallel ─────────────────────────────────────────
  const [users, projects, properties, landlords, landlordProps, pfLeads] = await Promise.all([
    loadAll('User', 'email', 200),
    loadAll('Project', '-created_date', 500),
    loadAll('Property', '-created_date', 500),
    loadAll('Landlord', '-created_date', 1000),
    loadAll('LandlordProperty', '-created_date', 1000),
    // PF buyer leads: source=property_finder, has pf_lead_id
    base44.asServiceRole.entities.Lead.filter(
      { source: 'property_finder' }, '-created_date', 500, 0
    ).catch(() => []),
  ]);

  // Build indexes
  const userByEmail = new Map(users.map(u => [u.email?.toLowerCase(), u]));
  const userByNormName = new Map(users.map(u => [norm(u.full_name), u]));

  // Project index: normName, normLocation
  const projectIdx = projects.map(p => ({
    id: p.id,
    normName: norm(p.name),
    normLoc: norm(p.location),
  }));

  // Property index: normBuilding + normUnit → id
  const propertyIdx = properties.map(p => ({
    id: p.id,
    normBuilding: norm(p.building_name),
    normUnit: norm(p.unit_no),
  }));

  // Landlord index: normProject + normUnit → id
  const landlordIdx = landlords.map(l => ({
    id: l.id,
    normProject: norm(l.project_name),
    normUnit: norm(l.unit_reference),
  }));

  // LandlordProperty index: property_id → { id (lp.id), landlord_id }
  // We'll join via property_id
  const lpByPropertyId = new Map(landlordProps.map(lp => [lp.property_id, lp]));

  // PF listing index for lead linking: reference_number and pf_listing_id → record id
  // We load PFListings below anyway

  // ── Match helpers ────────────────────────────────────────────────────────────

  function findProject(buildingName, locationName) {
    const nb = norm(buildingName);
    const nl = norm(locationName);
    if (!nb && !nl) return null;
    // Exact match on name
    for (const p of projectIdx) {
      if (nb && p.normName && nb === p.normName) return p.id;
    }
    // Contains match on name (longer contains shorter, min 4 chars)
    for (const p of projectIdx) {
      if (nb && p.normName && p.normName.length >= 4) {
        if (nb.includes(p.normName) || p.normName.includes(nb)) return p.id;
      }
    }
    // Location match
    for (const p of projectIdx) {
      if (nl && p.normName && p.normName.length >= 4) {
        if (nl.includes(p.normName) || p.normName.includes(nl)) return p.id;
      }
      if (nl && p.normLoc && p.normLoc.length >= 4 && nl === p.normLoc) return p.id;
    }
    return null;
  }

  function findProperty(buildingName, unitNumber) {
    const nb = norm(buildingName);
    const nu = norm(unitNumber);
    if (!nb || !nu) return null;
    for (const p of propertyIdx) {
      if (p.normUnit === nu && p.normBuilding && (p.normBuilding === nb || nb.includes(p.normBuilding) || p.normBuilding.includes(nb))) {
        return p.id;
      }
    }
    return null;
  }

  function findLandlord(buildingName, unitNumber) {
    const nb = norm(buildingName);
    const nu = norm(unitNumber);
    if (!nu) return null;
    for (const l of landlordIdx) {
      if (!l.normUnit) continue;
      const unitMatch = l.normUnit === nu || (nu.length >= 2 && (l.normUnit.includes(nu) || nu.includes(l.normUnit)));
      if (!unitMatch) continue;
      if (!l.normProject) return l.id; // unit-only match if no project on landlord
      const projMatch = !nb || nb.includes(l.normProject) || l.normProject.includes(nb);
      if (projMatch) return l.id;
    }
    return null;
  }

  function findLandlordPropertyId(propertyId) {
    if (!propertyId) return null;
    const lp = lpByPropertyId.get(propertyId);
    return lp ? { lpId: lp.id, landlordId: lp.landlord_id } : null;
  }

  function resolveAgentEmail(listing) {
    // If agent_email is already set and matches a CRM user → keep
    if (listing.agent_email) {
      const key = listing.agent_email.toLowerCase();
      if (userByEmail.has(key)) return listing.agent_email;
      // email stored but not a CRM user — still return it (may be external)
      return listing.agent_email;
    }
    // Try to resolve by agent_name
    if (listing.agent_name) {
      const u = userByNormName.get(norm(listing.agent_name));
      if (u) return u.email;
    }
    return null;
  }

  // ── Load PFListings ──────────────────────────────────────────────────────────
  const allListings = await loadAll('PFListing', '-updated_date', 500);
  const toProcess = targetIds
    ? allListings.filter(l => targetIds.has(l.id))
    : allListings;

  // Build lookup by reference_number and pf_listing_id for lead linkage
  const listingByRef = new Map();
  const listingByPfId = new Map();
  for (const l of allListings) {
    if (l.reference_number) listingByRef.set(l.reference_number, l);
    if (l.pf_listing_id) listingByPfId.set(l.pf_listing_id, l);
  }

  console.log(`PF_LINK: processing ${toProcess.length} listings`);

  const stats = {
    agent_email_set: 0,
    project_id_set: 0,
    project_id_repaired: 0,
    property_id_set: 0,
    landlord_id_set: 0,
    landlord_property_id_set: 0,
    already_fully_linked: 0,
    errors: 0,
  };

  for (const listing of toProcess) {
    const patch = {};

    // 1. agent_email
    const resolvedEmail = resolveAgentEmail(listing);
    if (resolvedEmail && resolvedEmail !== listing.agent_email) {
      patch.agent_email = resolvedEmail;
      stats.agent_email_set++;
    } else if (resolvedEmail && !listing.agent_email) {
      patch.agent_email = resolvedEmail;
      stats.agent_email_set++;
    }

    // 2. project_id — verify and repair even if set
    const matchedProjectId = findProject(listing.building_name, listing.location);
    if (matchedProjectId && matchedProjectId !== listing.project_id) {
      if (!listing.project_id) {
        patch.project_id = matchedProjectId;
        stats.project_id_set++;
      } else {
        // repair incorrect link
        patch.project_id = matchedProjectId;
        stats.project_id_repaired++;
      }
    } else if (matchedProjectId && !listing.project_id) {
      patch.project_id = matchedProjectId;
      stats.project_id_set++;
    }

    // 3. property_id
    if (!listing.property_id) {
      const pid = findProperty(listing.building_name, listing.unit_number);
      if (pid) { patch.property_id = pid; stats.property_id_set++; }
    }

    // 4. landlord_id + landlord_property_id
    // Try via LandlordProperty → Property join first (more precise)
    const effectivePropertyId = patch.property_id || listing.property_id;
    if (effectivePropertyId && !listing.landlord_property_id) {
      const lpMatch = findLandlordPropertyId(effectivePropertyId);
      if (lpMatch) {
        patch.landlord_property_id = lpMatch.lpId;
        stats.landlord_property_id_set++;
        if (!listing.landlord_id) {
          patch.landlord_id = lpMatch.landlordId;
          stats.landlord_id_set++;
        }
      }
    }
    // Fallback: direct Landlord match by project_name + unit_reference
    if (!listing.landlord_id && !patch.landlord_id) {
      const lid = findLandlord(listing.building_name, listing.unit_number);
      if (lid) { patch.landlord_id = lid; stats.landlord_id_set++; }
    }

    if (Object.keys(patch).length === 0) {
      stats.already_fully_linked++;
      continue;
    }

    const ok = await safeUpdate('PFListing', listing.id, patch, `pf_id=${listing.pf_listing_id}`);
    if (!ok) stats.errors++;

    // Small pace delay
    await new Promise(r => setTimeout(r, 30));
  }

  // ── 6. Lead linkage: match PF buyer leads to PFListing records ──────────────
  const leadStats = { linked: 0, already_linked: 0, no_match: 0, errors: 0 };
  const pfLeadsToLink = pfLeads.filter(l => l.pf_lead_id && !l.linked_pf_listing_id);

  for (const lead of pfLeadsToLink) {
    // pf_lead_id format: "message_lead_29932721" — the numeric part can match a PF reference
    // Also check source_campaign or notes for a reference_number hint
    // Strategy: extract numeric suffix from pf_lead_id, try matching PFListing.pf_listing_id
    const numericSuffix = (lead.pf_lead_id || '').replace(/[^0-9]/g, '');
    let matchedListing = null;

    if (numericSuffix) {
      matchedListing = listingByPfId.get(numericSuffix)
        || listingByRef.get(numericSuffix)
        || null;
    }

    // Also try source_campaign as reference_number
    if (!matchedListing && lead.source_campaign) {
      matchedListing = listingByRef.get(lead.source_campaign)
        || listingByPfId.get(lead.source_campaign)
        || null;
    }

    if (!matchedListing) { leadStats.no_match++; continue; }

    const ok = await safeUpdate('Lead', lead.id, { linked_pf_listing_id: matchedListing.id }, `pf_lead_id=${lead.pf_lead_id}`);
    if (ok) leadStats.linked++;
    else leadStats.errors++;

    await new Promise(r => setTimeout(r, 30));
  }

  // count already-linked
  leadStats.already_linked = pfLeads.filter(l => l.linked_pf_listing_id).length;

  const duration = Date.now() - t0;
  console.log(`PF_LINK: done in ${duration}ms — listings:`, JSON.stringify(stats), '| leads:', JSON.stringify(leadStats));

  return Response.json({
    ok: true,
    listings_processed: toProcess.length,
    listing_links: {
      agent_email_set: stats.agent_email_set,
      project_id_set: stats.project_id_set,
      project_id_repaired: stats.project_id_repaired,
      property_id_set: stats.property_id_set,
      landlord_id_set: stats.landlord_id_set,
      landlord_property_id_set: stats.landlord_property_id_set,
      already_fully_linked: stats.already_fully_linked,
      errors: stats.errors,
    },
    lead_links: leadStats,
    duration_ms: duration,
  });
});