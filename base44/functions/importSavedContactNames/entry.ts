import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lookupUrl } = await req.json();
    if (!lookupUrl || typeof lookupUrl !== 'string') {
      return Response.json({ error: 'Missing lookupUrl in payload' }, { status: 400 });
    }

    // Step 1: Fetch the lookup JSON ONCE (no retry loop to avoid GitHub rate limits)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let lookup;
    try {
      const res = await fetch(lookupUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'PropCRM-import/1.0' }
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return Response.json({ 
          error: `Failed to fetch lookup: ${res.status} ${res.statusText}`, 
          details: body.slice(0, 200) 
        }, { status: 500 });
      }
      
      const text = await res.text();
      lookup = JSON.parse(text);
    } catch (err) {
      clearTimeout(timeoutId);
      return Response.json({ error: `Fetch failed: ${err.message}` }, { status: 500 });
    }

    if (typeof lookup !== 'object' || lookup === null || Array.isArray(lookup)) {
      return Response.json({ error: 'Lookup must be a JSON object { "<last9digits>": "<name>" }' }, { status: 400 });
    }

    // Helper: normalize phone to last 9 digits
    const toLast9Digits = (phone) => {
      if (!phone) return null;
      // Strip all non-digits
      let digits = String(phone).replace(/\D/g, '');
      // Strip leading zeros
      digits = digits.replace(/^0+/, '');
      // If starts with 971 (UAE code), strip it to get local number
      if (digits.startsWith('971')) {
        digits = digits.slice(3);
      }
      // If starts with 60 (Malaysia) or other codes, we still want last 9
      // Take last 9 digits
      if (digits.length > 9) {
        digits = digits.slice(-9);
      }
      // If less than 9, pad or return as-is (won't match)
      if (digits.length < 9) {
        return digits.length > 0 ? digits : null;
      }
      return digits;
    };

    // Step 2: Load ALL WhatsAppConversation records with pagination and rate limit handling
    const ALL_CONVERSATIONS = [];
    let skip = 0;
    const LIMIT = 50;
    while (true) {
      try {
        const batch = await base44.entities.WhatsAppConversation.list(undefined, LIMIT, skip);
        if (!batch || batch.length === 0) break;
        ALL_CONVERSATIONS.push(...batch);
        skip += LIMIT;
        if (batch.length < LIMIT) break;
        // Small delay between batches to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        if (err.message && err.message.includes('Rate limit')) {
          // Wait and retry once
          await new Promise(r => setTimeout(r, 3000));
          const batch = await base44.entities.WhatsAppConversation.list(undefined, LIMIT, skip);
          if (!batch || batch.length === 0) break;
          ALL_CONVERSATIONS.push(...batch);
          skip += LIMIT;
          if (batch.length < LIMIT) break;
        } else {
          throw err;
        }
      }
    }

    // Step 3 & 4: Match and update
    const results = {
      totalProcessed: ALL_CONVERSATIONS.length,
      matched: 0,
      noMatch: 0,
      updated: 0,
      samples: [],
    };

    // Track which phones we've already updated to avoid duplicate writes
    const phoneUpdates = new Map(); // last9digits -> saved_name

    // First pass: determine what each phone should have
    for (const conv of ALL_CONVERSATIONS) {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(phone);
      if (!last9) {
        results.noMatch++;
        continue;
      }
      const savedName = lookup[last9] || null;
      phoneUpdates.set(last9, savedName);
    }

    // Second pass: apply updates
    const updates = [];
    for (const conv of ALL_CONVERSATIONS) {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(phone);
      if (!last9) continue;

      const savedName = phoneUpdates.get(last9) || null;
      
      // Only update if we have a name AND it's different from current
      if (savedName && conv.saved_contact_name !== savedName) {
        updates.push({
          id: conv.id,
          phone,
          savedName,
        });
      }

      // Track for report
      if (savedName) {
        results.matched++;
        if (results.samples.length < 10) {
          results.samples.push({ phone, saved_contact_name: savedName });
        }
      } else {
        results.noMatch++;
      }
    }

    // Batch update all conversations with rate limit handling
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      try {
        await base44.entities.WhatsAppConversation.update(update.id, { saved_contact_name: update.savedName });
        results.updated++;
      } catch (err) {
        if (err.message && err.message.includes('Rate limit')) {
          // Wait and retry once
          await new Promise(r => setTimeout(r, 2000));
          try {
            await base44.entities.WhatsAppConversation.update(update.id, { saved_contact_name: update.savedName });
            results.updated++;
          } catch (retryErr) {
            // Skip this one, continue with others
            console.log(`Skipped ${update.id}: ${retryErr.message}`);
          }
        } else {
          console.log(`Skipped ${update.id}: ${err.message}`);
        }
      }
      // Small delay every 10 updates to avoid rate limits
      if ((i + 1) % 10 === 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return Response.json({
      summary: {
        totalProcessed: results.totalProcessed,
        matched: results.matched,
        noMatch: results.noMatch,
        updated: results.updated,
      },
      samples: results.samples,
      lookupSize: Object.keys(lookup).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});