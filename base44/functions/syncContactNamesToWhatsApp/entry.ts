import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Helper: normalize phone to last 9 digits
    // - Strip all non-digits
    // - Strip leading 00
    // - If starts with 0 and is 10 digits (UAE local), prepend 971
    // - Take LAST 9 DIGITS (do NOT strip 971 before taking last 9)
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
      // Small delay between batches to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    const results = {
      totalProcessed: ALL_CONVERSATIONS.length,
      matched: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      samples: [],
    };

    // Step 2 & 3: For each conversation, query Contact by phone filter (server-side, reaches all records)
    // Group conversations by normalized phone to avoid duplicate queries
    const phoneToConversations = new Map();
    for (const conv of ALL_CONVERSATIONS) {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(phone);
      if (!last9) continue;
      
      if (!phoneToConversations.has(last9)) {
        phoneToConversations.set(last9, []);
      }
      phoneToConversations.get(last9).push(conv);
    }

    // Step 4: Process each unique phone
    const BATCH_SIZE = 20;
    const DELAY_BETWEEN_WRITES = 400;
    let processedBatches = 0;

    for (const [last9, conversations] of phoneToConversations.entries()) {
      // Query Contact by phone filter (server-side, reaches all 13k+ records)
      // Try matching on phone field first
      let matchingContact = null;
      
      try {
        // Build a regex pattern that matches any phone containing these last 9 digits
        // This works because server-side filter reaches all records
        const phoneFilter = {
          $or: [
            { phone: { $regex: last9 } },
            { whatsapp: { $regex: last9 } },
          ],
        };
        
        const contacts = await base44.entities.Contact.filter(phoneFilter, undefined, 10);
        if (contacts && contacts.length > 0) {
          // Verify the match by normalizing the contact's phone and checking last 9
          for (const contact of contacts) {
            const contactPhoneLast9 = toLast9Digits(contact.data?.phone || contact.data?.whatsapp);
            if (contactPhoneLast9 === last9) {
              matchingContact = contact;
              break;
            }
          }
        }
      } catch (err) {
        console.log(`Error querying contact for ${last9}: ${err.message}`);
      }

      // Step 5: Update all conversations for this phone
      for (const conv of conversations) {
        const newName = matchingContact?.data?.full_name || null;
        const oldName = conv.wa_saved_name || null;

        if (!newName) {
          results.skipped++;
          continue;
        }

        if (oldName === newName) {
          results.skipped++;
          continue;
        }

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
                phone: conv.wa_phone_e164 || conv.phone_number,
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
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});