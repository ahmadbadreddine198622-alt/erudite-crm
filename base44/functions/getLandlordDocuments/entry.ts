import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DOCUMENT_TYPES = ['passport', 'emirates_id', 'noc', 'noc_landlord', 'form_a'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { landlord_id } = payload;

    if (!landlord_id) {
      return Response.json({ error: 'landlord_id is required' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.LandlordDocument.filter({ landlord_id });

    // Build a map of existing records by document_type
    const byType = {};
    for (const doc of existing) {
      byType[doc.document_type] = doc;
    }

    // Return all four types, filling in placeholders for missing ones
    const documents = DOCUMENT_TYPES.map((type) => {
      if (byType[type]) return byType[type];
      return {
        landlord_id,
        document_type: type,
        status: 'missing',
        file_url: null,
        verified_by_email: null,
        verified_at: null,
        notes: null,
      };
    });

    return Response.json({ documents });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});