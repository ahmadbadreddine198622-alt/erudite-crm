import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ALLOWED_TYPES = ['passport', 'emirates_id', 'noc', 'noc_landlord', 'form_a'];
const ALLOWED_STATUSES = ['missing', 'received', 'verified'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { landlord_id, landlord_property_id, document_type, status, file_url, notes } = payload;

    if (!landlord_id) {
      return Response.json({ error: 'landlord_id is required' }, { status: 400 });
    }
    if (!document_type || !ALLOWED_TYPES.includes(document_type)) {
      return Response.json({ error: `document_type must be one of: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return Response.json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Find existing record for this landlord + document_type
    const existing = await base44.asServiceRole.entities.LandlordDocument.filter({
      landlord_id,
      document_type,
    });

    const updateData = {
      landlord_id,
      document_type,
      status,
    };

    if (landlord_property_id !== undefined) updateData.landlord_property_id = landlord_property_id;
    if (file_url !== undefined) updateData.file_url = file_url;
    if (notes !== undefined) updateData.notes = notes;

    if (status === 'verified') {
      updateData.verified_by_email = user.email;
      updateData.verified_at = new Date().toISOString();
    }

    let record;
    if (existing.length > 0) {
      record = await base44.asServiceRole.entities.LandlordDocument.update(existing[0].id, updateData);
    } else {
      record = await base44.asServiceRole.entities.LandlordDocument.create(updateData);
    }

    return Response.json({ document: record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});