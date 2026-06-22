import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * TEMPORARY DIAGNOSTIC FUNCTION — READ ONLY
 * 
 * Fetches captured label event payloads from WebhookDeadLetter
 * (source: 'evolution_label_diagnostic') for inspection.
 * 
 * Does NOT modify anything. Use this to see the raw Evolution LABELS_ASSOCIATION
 * and LABELS_EDIT payload structure.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins can run diagnostics
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch label diagnostic payloads, newest first
    const deadLetters = await base44.asServiceRole.entities.WebhookDeadLetter.filter(
      { source: 'evolution_label_diagnostic' },
      '-created_date',
      10
    );

    if (!deadLetters || deadLetters.length === 0) {
      return Response.json({
        ok: true,
        message: 'No label event payloads captured yet',
        instructions: [
          '1. Deploy the updated evolutionWebhook.js function',
          '2. Open WhatsApp personal (+971581806000)',
          '3. Add a label to any contact (e.g. "Peninsula 4")',
          '4. Remove and re-add it to capture both add/remove events',
          '5. Run this function again to see the captured payloads',
        ],
      });
    }

    // Format for readability
    const formatted = deadLetters.map((dl, idx) => {
      const eventData = {
        index: idx + 1,
        captured_at: dl.created_date,
        event_type: dl.event,
        instance: dl.instance,
        stage: dl.stage,
        error_note: dl.error,
        // Extract the raw payload — Evolution stores it in raw_payload field
        raw_payload: dl.raw_payload || dl.raw || null,
      };

      // Try to parse if it's a string
      if (typeof eventData.raw_payload === 'string') {
        try {
          eventData.raw_payload = JSON.parse(eventData.raw_payload);
        } catch {}
      }

      return eventData;
    });

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      total_captured: deadLetters.length,
      payloads: formatted,
    });
  } catch (error) {
    console.error('[viewLabelPayloads] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});