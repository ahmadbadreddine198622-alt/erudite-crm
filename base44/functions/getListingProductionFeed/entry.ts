// getListingProductionFeed — Returns all Landlords assigned to a listing manager,
// joined with their LandlordProperty. Full data access (listing manager sees all fields).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // All landlords that have a listing_manager_email set
    const [landlords, properties, documents] = await Promise.all([
      base44.asServiceRole.entities.Landlord.list('-updated_date', 500),
      base44.asServiceRole.entities.LandlordProperty.list('-updated_date', 500),
      base44.asServiceRole.entities.LandlordDocument.list('-updated_date', 500),
    ]);

    const assigned = landlords.filter(l => l.listing_manager_email && l.listing_manager_email.trim() !== '');

    // Check for archive mode (returns completed units only)
    const url = new URL(req.url);
    const archiveMode = url.searchParams.get('archive') === '1';

    const feed = assigned
      .filter((ll) => {
        const lp = properties.find((p) => p.landlord_id === ll.id) || {};
        const stage = lp.listing_production_stage || 'received';
        return archiveMode ? stage === 'complete' : stage !== 'complete';
      })
      .map((ll) => {
      const lp = properties.find((p) => p.landlord_id === ll.id) || {};

      // Documents linked by landlord_id (landlord_property_id is null on all real records)
      // Only include records with a real file_url
      const landlordDocs = documents
        .filter(d => d.landlord_id === ll.id && d.file_url)
        .map(d => ({
          document_type: d.document_type,
          file_url: d.file_url,
          status: d.status,
        }));

      // Form A contract details — pull from most recent entry in form_a_contracts[] if present,
      // falling back to root-level fields. Exact field names from Landlord schema:
      //   form_a_contract_number, form_a_pdf_url, mandate_expires_at, commission_pct_negotiated,
      //   form_a_contracts[].contract_number, .pdf_url, .mandate_expires_at, .asking_price_aed, .mandate_type
      const latestFormA = Array.isArray(ll.form_a_contracts) && ll.form_a_contracts.length > 0
        ? ll.form_a_contracts[ll.form_a_contracts.length - 1]
        : null;

      return {
        landlord_id: ll.id,
        landlord_property_id: lp.id || null,

        // Identity
        owner_name: ll.full_name_en || ll.full_name || null,
        project: ll.project_name || null,
        unit_reference: ll.unit_reference || null,

        // Agent / Manager
        assigned_agent_email: ll.assigned_agent_email || null,
        listing_manager_email: ll.listing_manager_email || null,

        // Financials
        asking_price_aed: ll.asking_price_aed || null,

        // Contact (full access)
        phone: ll.phone || null,
        whatsapp: ll.whatsapp || null,
        email: ll.email || null,

        // Permit number — check both entities
        permit_number: lp.permit_number || ll.permit_number || null,

        // Form A contract block (real data confirmed)
        form_a_pdf_url: latestFormA?.pdf_url || ll.form_a_pdf_url || null,
        form_a_contract_number: latestFormA?.contract_number || ll.form_a_contract_number || null,
        form_a_expires_at: latestFormA?.mandate_expires_at || ll.mandate_expires_at || null,
        form_a_price_aed: latestFormA?.asking_price_aed || ll.asking_price_aed || null,
        form_a_mandate_type: latestFormA?.mandate_type || ll.mandate_type || null,
        form_a_commission_pct: ll.commission_pct_negotiated || null,

        // Media flags + URLs (from LandlordProperty)
        photography_status: lp.photography_status || 'none',
        has_360_tour: lp.has_360_tour ?? false,
        tour_360_url: lp.tour_360_url || null,
        has_drone_footage: lp.has_drone_footage ?? false,
        drone_footage_url: lp.drone_footage_url || null,
        has_video_walkthrough: lp.has_video_walkthrough ?? false,
        video_walkthrough_url: lp.video_walkthrough_url || null,
        has_floor_plan: lp.has_floor_plan ?? false,
        floor_plan_url: lp.floor_plan_url || null,

        // Listing production stage (default 'received' if missing)
        listing_production_stage: lp.listing_production_stage || 'received',

        // Comments thread
        listing_comments: lp.listing_comments || [],

        // Real documents from LandlordDocument entity (joined by landlord_id, file_url confirmed real)
        documents: landlordDocs,
      };
    });

    return Response.json({ feed, archive_mode: archiveMode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});