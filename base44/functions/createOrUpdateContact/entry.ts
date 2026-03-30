import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Normalize phone number to standard format
function normalizePhone(phone) {
  if (!phone) return null;
  
  // Strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length < 7) return null;
  
  // Handle 00 prefix (international format) → convert to +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }
  
  // Ensure international format for UAE numbers
  if (cleaned.startsWith('05') && cleaned.length === 10) return '+971' + cleaned.slice(1);
  if (cleaned.startsWith('5') && cleaned.length === 9) return '+971' + cleaned;
  if (!cleaned.startsWith('+') && cleaned.length >= 10) return '+' + cleaned;
  return cleaned;
}

// Check for duplicate by phone or email
async function checkForDuplicate(base44, phone, email) {
  const normalized = normalizePhone(phone);
  
  const byPhone = normalized 
    ? await base44.asServiceRole.entities.Lead.filter({ phone: normalized })
    : [];
  
  const byEmail = email 
    ? await base44.asServiceRole.entities.Lead.filter({ email: email.toLowerCase() })
    : [];

  return byPhone.length > 0 ? byPhone[0] : (byEmail.length > 0 ? byEmail[0] : null);
}

// Get or create folder by source
async function getOrCreateFolder(base44, source) {
  const folders = await base44.asServiceRole.entities.ContactFolder.filter({
    folder_type: 'source_based',
    source: source
  });

  if (folders.length > 0) {
    return folders[0].id;
  }

  const sourceNames = {
    whatsapp: 'WhatsApp Contacts',
    website: 'Website Leads',
    email: 'Email Inbox',
    import: 'Imported Contacts',
    manual: 'Manual Entry',
    social_media: 'Social Media',
    referral: 'Referrals'
  };

  const folder = await base44.asServiceRole.entities.ContactFolder.create({
    folder_name: sourceNames[source] || source,
    folder_type: 'source_based',
    source: source,
    is_auto_populated: true,
    contact_count: 0
  });

  return folder.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, phone, email, source = 'manual', source_metadata = {}, tags = [], auto_tags = [] } = await req.json();

    if (!name || !phone) {
      return Response.json({ error: 'Name and phone required' }, { status: 400 });
    }

    // Check for duplicate
    const duplicate = await checkForDuplicate(base44, phone, email);

    if (duplicate) {
      // Update existing contact
      const updatedLead = await base44.asServiceRole.entities.Lead.update(duplicate.id, {
        last_contact_date: new Date().toISOString(),
        tags: [...new Set([...(duplicate.tags || []), ...tags])],
      });

      // Log history
      await base44.asServiceRole.entities.ContactHistory.create({
        lead_id: duplicate.id,
        change_type: 'updated',
        old_value: duplicate,
        new_value: updatedLead,
        changed_by: user.email
      });

      return Response.json({
        success: true,
        action: 'updated',
        lead_id: duplicate.id,
        is_duplicate: true
      });
    }

    // Create new contact
    const folderId = await getOrCreateFolder(base44, source);

    const newLead = await base44.asServiceRole.entities.Lead.create({
      name,
      phone: normalizePhone(phone),
      email: email ? email.toLowerCase() : null,
      source,
      source_metadata,
      tags,
      auto_tags,
      folder_id: folderId,
      stage: 'new_lead',
      created_at: new Date().toISOString()
    });

    // Log history
    await base44.asServiceRole.entities.ContactHistory.create({
      lead_id: newLead.id,
      change_type: 'created',
      new_value: newLead,
      changed_by: user.email
    });

    // Increment folder contact count
    const folder = await base44.asServiceRole.entities.ContactFolder.read(folderId);
    await base44.asServiceRole.entities.ContactFolder.update(folderId, {
      contact_count: (folder.contact_count || 0) + 1
    });

    return Response.json({
      success: true,
      action: 'created',
      lead_id: newLead.id,
      is_duplicate: false
    });

  } catch (error) {
    console.error('Contact creation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});