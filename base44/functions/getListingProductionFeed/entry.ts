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

    const feed = assigned.map((ll) => {
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

        // Form A PDF — real data confirmed on Landlord entity
        form_a_pdf_url: ll.form_a_pdf_url || null,

        // Media flags (from LandlordProperty)
        photography_status: lp.photography_status || 'none',
        has_360_tour: lp.has_360_tour ?? false,
        has_drone_footage: lp.has_drone_footage ?? false,
        has_video_walkthrough: lp.has_video_walkthrough ?? false,
        has_floor_plan: lp.has_floor_plan ?? false,
        // NOTE: floor_plan_url, title_deed_url, oqood_url, dld_record_url — all null in real data, not returned

        // Listing production stage (default 'received' if missing)
        listing_production_stage: lp.listing_production_stage || 'received',

        // Comments thread
        listing_comments: lp.listing_comments || [],

        // Real documents from LandlordDocument entity (joined by landlord_id, file_url confirmed real)
        documents: landlordDocs,
      };
    });

    return Response.json({ feed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});