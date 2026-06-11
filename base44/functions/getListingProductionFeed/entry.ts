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

      // Documents linked to this LandlordProperty — only those with a real file_url
      const lpDocs = documents
        .filter(d => d.landlord_property_id === lp.id && d.file_url)
        .map(d => ({
          document_type: d.document_type,
          file_url: d.file_url,
          status: d.status,
          notes: d.notes || null,
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

        // Media flags (from LandlordProperty)
        photography_status: lp.photography_status || 'none',
        has_360_tour: lp.has_360_tour ?? false,
        has_drone_footage: lp.has_drone_footage ?? false,
        has_video_walkthrough: lp.has_video_walkthrough ?? false,
        has_floor_plan: lp.has_floor_plan ?? false,

        // Media URLs — only fields that actually exist on LandlordProperty schema
        // NOTE: 360/drone/video have NO URL fields on schema — flags only, no clickable asset possible yet
        floor_plan_url: lp.floor_plan_url || null,
        title_deed_url: lp.title_deed_url || null,
        oqood_url: lp.oqood_url || null,
        ownership_proof_doc_url: lp.ownership_proof_doc_url || null,
        dld_record_url: lp.dld_record_url || null,

        // Listing production stage (default 'received' if missing)
        listing_production_stage: lp.listing_production_stage || 'received',

        // Comments thread
        listing_comments: lp.listing_comments || [],

        // Documents from LandlordDocument entity (only those with real file_url)
        documents: lpDocs,
      };
    });

    return Response.json({ feed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});