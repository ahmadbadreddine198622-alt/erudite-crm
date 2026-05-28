import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Maps old Landlord stage keys to the new 12-stage pipeline
const STAGE_MAP = {
  sourced: 'initial_contact',
  first_contact: 'initial_contact',
  property_discovery: 'price_discovery',
  pricing_alignment: 'price_discovery',
  mandate_negotiation: 'listing_commitment',
  form_a_drafting: 'form_a_initiation',
  form_a_signature: 'form_a_signing',
  documents_collection: 'owner_documents',
  marketing_live: 'listing_publication',
  viewings_flow: 'listing_publication',
  offer_negotiation: 'listing_publication',
  form_f_and_deposit: 'final_confirmation',
  closing: 'final_confirmation',
  post_completion: 'final_confirmation',
};

const NEW_STAGES = new Set([
  'initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation',
  'form_a_signing', 'owner_documents', 'photos_videos', 'photographer_scheduling',
  'listing_creation', 'internal_verification', 'listing_publication', 'final_confirmation',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const landlords = await base44.asServiceRole.entities.Landlord.list('-created_date', 500);

    const toMigrate = landlords.filter(l => !NEW_STAGES.has(l.stage));
    const results = [];

    for (const landlord of toMigrate) {
      const newStage = STAGE_MAP[landlord.stage] || 'initial_contact';
      await base44.asServiceRole.entities.Landlord.update(landlord.id, {
        stage: newStage,
        stage_entered_at: landlord.stage_entered_at || new Date().toISOString(),
      });
      results.push({ id: landlord.id, name: landlord.full_name_en, old: landlord.stage, new: newStage });
    }

    return Response.json({
      success: true,
      total: landlords.length,
      migrated: results.length,
      already_on_new_stages: landlords.length - results.length,
      changes: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});