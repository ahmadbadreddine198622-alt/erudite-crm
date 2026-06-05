// probeDocs — THROWAWAY. Creates/reads a document record for one landlord.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    // Use a known landlord in the admin stage — Tuiara or Viachelav.
    const landlords = await base44.asServiceRole.entities.Landlord.filter({ stage: 'photographer_scheduling' });
    if (!landlords.length) return Response.json({ error: 'no landlords in admin stage' });
    const ll = landlords[0];

    const updated = await base44.functions.invoke('updateLandlordDocument', {
      landlord_id: ll.id,
      landlord_property_id: '',
      document_type: 'passport',
      status: 'received',
      notes: 'probe test',
    });

    const docs = await base44.functions.invoke('getLandlordDocuments', { landlord_id: ll.id });
    return Response.json({ landlord: ll.full_name_en, updated: updated?.data, docs: docs?.data });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});