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

    // Step 3 & 4: Match and update with throttling
    const results = {
      totalProcessed: ALL_CONVERSATIONS.length,
      matched: 0,
      noMatch: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      samples: [],
    };

    // First pass: match phones to saved names and determine what needs updating
    const updatesNeeded = [];
    for (const conv of ALL_CONVERSATIONS) {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(phone);
      if (!last9) {
        results.noMatch++;
        continue;
      }
      
      const savedName = lookup[last9] || null;
      
      if (savedName) {
        results.matched++;
        // Only update if saved_contact_name is missing or different
        if (!conv.wa_saved_name || conv.wa_saved_name !== savedName) {
          updatesNeeded.push({
            id: conv.id,
            phone,
            savedName,
          });
        } else {
          results.skipped++; // Already has correct name
        }
        
        if (results.samples.length < 10) {
          results.samples.push({ phone, saved_contact_name: savedName });
        }
      } else {
        results.noMatch++;
      }
    }

    // Step 5: Throttled writes with retry logic
    const BATCH_SIZE = 15;
    const DELAY_BETWEEN_WRITES = 400; // ms
    const DELAY_BETWEEN_BATCHES = 2000; // ms
    
    for (let i = 0; i < updatesNeeded.length; i++) {
      const update = updatesNeeded[i];
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        try {
          await base44.entities.WhatsAppConversation.update(update.id, { saved_contact_name: update.savedName });
          results.updated++;
          success = true;
        } catch (err) {
          attempts++;
          if (err.message && err.message.includes('Rate limit')) {
            if (attempts < maxAttempts) {
              // Exponential backoff: 2s, 4s
              await new Promise(r => setTimeout(r, 2000 * attempts));
            } else {
              results.failed++;
              console.log(`Failed ${update.id} after ${attempts} attempts: ${err.message}`);
            }
          } else {
            results.failed++;
            console.log(`Failed ${update.id}: ${err.message}`);
            break; // Don't retry non-rate-limit errors
          }
        }
      }
      
      // Delay between each write
      if (i < updatesNeeded.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_WRITES));
      }
      
      // Longer delay between batches
      if ((i + 1) % BATCH_SIZE === 0 && i < updatesNeeded.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }

    return Response.json({
      summary: {
        totalProcessed: results.totalProcessed,
        matched: results.matched,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed,
        noMatch: results.noMatch,
      },
      samples: results.samples,
      lookupSize: Object.keys(lookup).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});