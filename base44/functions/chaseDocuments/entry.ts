import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Auto-Document Chase. Runs hourly (or on demand).
 *
 * For each landlord with pending documents:
 *   - Picks the longest-pending document
 *   - Escalates politeness level based on reminder_count (gentle → firm → manager)
 *   - Generates an AI message in the landlord's language with specific upload link
 *   - Sends via WhatsApp
 *   - Updates reminder_count + last_reminder_at
 *   - At 4+ reminders, stops auto-chase and flags needs_human_review = true
 *
 * Body: { landlord_id } (specific landlord) OR {} (all eligible landlords)
 */

const DOC_LABELS_EN: Record<string, string> = {
  title_deed: 'Title Deed',
  emirates_id_front: 'Emirates ID (front side)',
  emirates_id_back: 'Emirates ID (back side)',
  passport: 'Passport copy',
  visa_page: 'UAE visa page',
  power_of_attorney: 'Power of Attorney',
  trade_license: 'Trade License (for companies)',
  developer_noc: 'Developer NOC (No Objection Certificate)',
  service_charge_clearance: 'Service charge clearance letter',
  ejari_certificate: 'Ejari registration',
  mortgage_clearance: 'Mortgage clearance letter from bank',
  trakheesi_permit: 'Trakheesi advertising permit',
  form_a: 'Signed Form A (listing agreement)',
  form_f_mou: 'Signed Form F (MOU)',
  manager_cheque: 'Manager Cheque (10% deposit)',
  spouse_consent: 'Spouse consent letter',
  company_board_resolution: 'Company board resolution'
};

const DOC_LABELS_AR: Record<string, string> = {
  title_deed: 'سند الملكية',
  emirates_id_front: 'الهوية الإماراتية (الوجه الأمامي)',
  emirates_id_back: 'الهوية الإماراتية (الوجه الخلفي)',
  passport: 'نسخة جواز السفر',
  developer_noc: 'شهادة عدم ممانعة من المطور',
  service_charge_clearance: 'إفادة سداد رسوم الخدمات',
  form_a: 'النموذج أ موقّع'
};

function tonePrefix(level: string, lang: string): string {
  if (lang === 'ar') {
    return { gentle: 'تذكير لطيف:', firm: 'تذكير مهم:', manager_escalation: '⚠ إشعار من الإدارة:' }[level] || '';
  }
  return ({
    gentle: 'Friendly reminder:',
    firm: 'Important reminder:',
    manager_escalation: '⚠ Manager escalation:'
  } as any)[level] || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id } = body;

    // Pull eligible documents
    const docs = await base44.asServiceRole.entities.DocumentChecklistItem.filter({
      ...(landlord_id ? { landlord_id } : {}),
      status: 'requested'
    });

    const now = Date.now();
    let chasedCount = 0;
    let skippedCount = 0;
    const results: any[] = [];

    for (const doc of docs) {
      // Skip if recently reminded (24h cooldown between reminders)
      if (doc.last_reminder_at) {
        const hoursSince = (now - new Date(doc.last_reminder_at).getTime()) / 3.6e6;
        if (hoursSince < 24) { skippedCount++; continue; }
      }

      // Escalate based on reminder count
      let newLevel = doc.escalation_level || 'gentle';
      if (doc.reminder_count >= 1 && doc.reminder_count < 3) newLevel = 'firm';
      else if (doc.reminder_count >= 3) newLevel = 'manager_escalation';

      // Stop auto-chase at 4 reminders — flag for human
      if (doc.reminder_count >= 4) {
        const landlord = await base44.asServiceRole.entities.Landlord.get(doc.landlord_id);
        await base44.asServiceRole.entities.Landlord.update(doc.landlord_id, {
          needs_human_review: true,
          review_reason: `Document "${doc.document_type}" not received after 4 reminders to ${landlord?.full_name_en}`
        });
        skippedCount++;
        continue;
      }

      const landlord = await base44.asServiceRole.entities.Landlord.get(doc.landlord_id);
      if (!landlord || landlord.do_not_contact) { skippedCount++; continue; }

      const lang = landlord.preferred_language || 'en';
      const docLabel = (lang === 'ar' ? DOC_LABELS_AR[doc.document_type] : null) || DOC_LABELS_EN[doc.document_type] || doc.document_type;
      const firstName = landlord.first_name || (landlord.full_name_en || landlord.full_name || '').split(' ')[0];

      // Build message
      let message = '';
      if (lang === 'ar') {
        const prefix = tonePrefix(newLevel, lang);
        message = `${prefix} مرحباً ${firstName}،\n\nنحن بحاجة إلى مستند: ${docLabel}\n\nيرجى إرسالها لي عبر هذه المحادثة في أقرب وقت ممكن.\n\nشكراً.`;
      } else {
        const prefix = tonePrefix(newLevel, lang);
        message = `${prefix} Hi ${firstName},\n\nWe need the following document to move forward: ${docLabel}\n\nPlease share it with me on this chat at your earliest convenience.\n\nThanks!`;
        if (newLevel === 'manager_escalation') {
          message += `\n\n(This is the 3rd request. Without this document we cannot proceed with the listing.)`;
        }
      }

      // Send via API channel (automated reminder — never mixes into personal chat thread)
      try {
        await base44.asServiceRole.functions.invoke('sendApiWhatsApp', {
          phone_e164: landlord.whatsapp || landlord.phone,
          message,
        });
        chasedCount++;

        await base44.asServiceRole.entities.DocumentChecklistItem.update(doc.id, {
          reminder_count: (doc.reminder_count || 0) + 1,
          last_reminder_at: new Date().toISOString(),
          escalation_level: newLevel
        });

        // Activity log
        try {
          await base44.asServiceRole.entities.Activity.create({
            lead_id: doc.landlord_id,
            type: 'whatsapp',
            direction: 'outbound',
            channel: 'whatsapp',
            title: `Auto-chase: ${docLabel} (${newLevel})`,
            description: message,
            source: 'automation'
          });
        } catch {}

        results.push({ doc_id: doc.id, landlord: landlord.full_name_en, doc: docLabel, level: newLevel });
      } catch (err: any) {
        console.error('chase send failed:', err);
        results.push({ doc_id: doc.id, error: err.message });
      }
    }

    return Response.json({
      ok: true,
      chased: chasedCount,
      skipped: skippedCount,
      results
    });
  } catch (error: any) {
    console.error('chaseDocuments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});