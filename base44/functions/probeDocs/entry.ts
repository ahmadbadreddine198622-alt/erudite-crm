// probeDocs — THROWAWAY probe. Inlines doc logic to work without a real user session.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DOCUMENT_TYPES = ['passport', 'emirates_id', 'noc', 'form_a'];
const ALLOWED_TYPES = ['passport', 'emirates_id', 'noc', 'form_a'];
const ALLOWED_STATUSES = ['missing', 'received', 'verified'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find a landlord in photographer_scheduling stage
    const landlords = await base44.asServiceRole.entities.Landlord.filter({ stage: 'photographer_scheduling' });
    if (!landlords.length) return Response.json({ error: 'no landlords in photographer_scheduling stage' });
    const ll = landlords[0];

    // --- inline updateLandlordDocument ---
    const document_type = 'passport';
    const status = 'received';
    const notes = 'probe test';
    const landlord_id = ll.id;

    const existing = await base44.asServiceRole.entities.LandlordDocument.filter({ landlord_id, document_type });

    const updateData = { landlord_id, document_type, status, notes, landlord_property_id: '' };

    let updatedDoc;
    if (existing.length > 0) {
      updatedDoc = await base44.asServiceRole.entities.LandlordDocument.update(existing[0].id, updateData);
    } else {
      updatedDoc = await base44.asServiceRole.entities.LandlordDocument.create(updateData);
    }

    // --- inline getLandlordDocuments ---
    const allExisting = await base44.asServiceRole.entities.LandlordDocument.filter({ landlord_id });
    const byType = {};
    for (const doc of allExisting) byType[doc.document_type] = doc;

    const documents = DOCUMENT_TYPES.map((type) =>
      byType[type] || { landlord_id, document_type: type, status: 'missing', file_url: null, verified_by_email: null, verified_at: null, notes: null }
    );

    return Response.json({ landlord: ll.full_name_en, updated: updatedDoc, docs: { documents } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});