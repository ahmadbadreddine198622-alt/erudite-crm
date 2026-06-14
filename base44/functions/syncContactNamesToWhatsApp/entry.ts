import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Helper: normalize phone to last 9 digits
    const toLast9Digits = (phone) => {
      if (!phone) return null;
      let digits = String(phone).replace(/\D/g, '');
      
      // Strip leading 00
      while (digits.startsWith('00')) {
        digits = digits.slice(2);
      }
      
      // If starts with 0 and is 10 digits (UAE local format), prepend 971
      if (digits.startsWith('0') && digits.length === 10) {
        digits = '971' + digits.slice(1);
      }
      
      // Take last 9 digits
      if (digits.length < 9) {
        return digits.length > 0 ? digits : null;
      }
      return digits.slice(-9);
    };

    // Step 1: Load ALL WhatsAppConversation records with pagination
    const ALL_CONVERSATIONS = [];
    let skip = 0;
    const LIMIT = 50;
    while (true) {
      const batch = await base44.entities.WhatsAppConversation.list(undefined, LIMIT, skip);
      if (!batch || batch.length === 0) break;
      ALL_CONVERSATIONS.push(...batch);
      skip += LIMIT;
      if (batch.length < LIMIT) break;
      await new Promise(r => setTimeout(r, 200));
    }

    const results = {
      totalProcessed: ALL_CONVERSATIONS.length,
      matched: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      samples: [],
      debugSamples: [],
    };

    const BATCH_SIZE = 20;
    const DELAY_BETWEEN_WRITES = 400;
    let processedBatches = 0;

    // Step 2: Process each conversation individually with server-side Contact filter
    for (let i = 0; i < ALL_CONVERSATIONS.length; i++) {
      const conv = ALL_CONVERSATIONS[i];
      // Access fields directly on conv (not conv.data) for list() results
      const convPhone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(convPhone);
      
      const oldName = conv.wa_saved_name || null;

      // Add debug sample for first 10 conversations
      if (results.debugSamples.length < 10) {
        results.debugSamples.push({
          wa_phone_e164: convPhone,
          normalized_key: last9,
          contact_found: false,
          contact_name: null,
          old_wa_saved_name: oldName,
        });
      }
      
      if (!last9) {
        results.skipped++;
        continue;
      }

      // Query Contact with server-side filter on phone/whatsapp containing last 9 digits
      let matchingContact = null;
      let contactFound = false;
      
      try {
        const phoneFilter = {
          $or: [
            { phone: { $regex: last9 } },
            { whatsapp: { $regex: last9 } },
          ],
        };
        
        const contacts = await base44.entities.Contact.filter(phoneFilter, undefined, 20);
        if (contacts && contacts.length > 0) {
          // Verify match by normalizing contact's phone
          for (const contact of contacts) {
            const contactPhoneLast9 = toLast9Digits(contact.phone);
            const contactWhatsappLast9 = toLast9Digits(contact.whatsapp);
            if (contactPhoneLast9 === last9 || contactWhatsappLast9 === last9) {
              matchingContact = contact;
              contactFound = true;
              break;
            }
          }
        }
      } catch (err) {
        console.log(`Error querying contact for ${last9}: ${err.message}`);
      }

      const newName = matchingContact?.full_name || null;

      // Update debug sample with match info for first 10
      if (results.debugSamples.length < 10) {
        results.debugSamples[results.debugSamples.length - 1].contact_found = contactFound;
        results.debugSamples[results.debugSamples.length - 1].contact_name = newName;
      }

      if (!newName) {
        results.skipped++;
        continue;
      }

      if (oldName === newName) {
        results.skipped++;
        continue;
      }

      results.matched++;

      // Update with retry logic
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        try {
          await base44.entities.WhatsAppConversation.update(conv.id, { wa_saved_name: newName });
          results.updated++;
          success = true;

          if (results.samples.length < 10) {
            results.samples.push({
              phone: convPhone,
              old_name: oldName,
              new_name: newName,
            });
          }
        } catch (err) {
          attempts++;
          if (err.message && err.message.includes('Rate limit')) {
            if (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 2000 * attempts));
            } else {
              results.failed++;
              console.log(`Failed ${conv.id} after ${attempts} attempts: ${err.message}`);
            }
          } else {
            results.failed++;
            console.log(`Failed ${conv.id}: ${err.message}`);
            break;
          }
        }
      }

      // Throttle between writes
      processedBatches++;
      if (processedBatches % BATCH_SIZE === 0) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_WRITES));
      }
    }

    return Response.json({
      summary: {
        totalProcessed: results.totalProcessed,
        matched: results.matched,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed,
      },
      samples: results.samples,
      debugSamples: results.debugSamples,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});