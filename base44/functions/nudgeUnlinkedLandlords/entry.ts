import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * nudgeUnlinkedLandlords
 * Scheduled daily — finds landlords with an email address but zero linked
 * LandlordProperty records, and sends them a gentle nudge to list with us.
 *
 * Guards:
 * - Only landlords with a valid email address are contacted.
 * - Skips landlords whose ai_rolling_summary contains the nudge-sent marker
 *   so we don't spam them on every run (one nudge per landlord).
 */

const NUDGE_MARKER = '[nudge_sent]';

function buildEmailHtml(landlord) {
  const firstName = landlord.first_name || landlord.full_name_en?.split(' ')[0] || 'there';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Inter',Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111827;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

          <!-- Gold top bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#b45309,#f59e0b,#b45309);height:4px;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;">Erudite Property</p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">
                Your unit is waiting<br/>to be discovered 🏙️
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#94a3b8;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#94a3b8;">
                We have you in our system as one of our valued property owners in Dubai, but we don't yet have your unit listed with us — and the market right now is <strong style="color:#ffffff;">exceptionally active</strong>.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#94a3b8;">
                Listing your property with Erudite means:
              </p>

              <!-- Benefits list -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                ${[
                  ['📸', 'Professional photography &amp; 360° tours at no extra cost'],
                  ['🎯', 'Targeted exposure on Property Finder &amp; Bayut to qualified buyers and tenants'],
                  ['🤖', 'AI-powered lead matching — your unit shown to the right buyers instantly'],
                  ['🔑', 'Dedicated agent support from listing to closing'],
                ].map(([emoji, text]) => `
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">${emoji}</td>
                  <td style="padding:8px 0;font-size:14px;line-height:1.6;color:#cbd5e1;">${text}</td>
                </tr>`).join('')}
              </table>

              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#94a3b8;">
                It takes less than 5 minutes to get started. Simply reply to this email or reach us directly — your assigned agent will take care of everything else.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="mailto:listings@erudite.ae?subject=I%20want%20to%20list%20my%20unit&body=Hi%2C%20I%20received%20your%20email%20and%20I%27d%20like%20to%20list%20my%20property%20with%20you."
                       style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#111827;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">
                      List My Property →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#475569;">Erudite Property · Dubai, UAE</p>
              <p style="margin:0;font-size:11px;color:#334155;">
                You're receiving this because you're registered as a property owner in our network.<br/>
                To unsubscribe, simply reply with "unsubscribe".
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no auth) and manual (admin-authenticated) invocations
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Fetch all landlords (up to 500)
    const allLandlords = await base44.asServiceRole.entities.Landlord.list('-created_date', 500);

    // Fetch all LandlordProperty links
    const allLinks = await base44.asServiceRole.entities.LandlordProperty.list();

    // Build set of landlord IDs that have at least one linked property
    const linkedIds = new Set(allLinks.map(lp => lp.landlord_id).filter(Boolean));

    // Filter: unlinked + has email + not already nudged
    const targets = allLandlords.filter(l => {
      if (!l.email) return false;
      if (linkedIds.has(l.id)) return false;
      // Skip if we already sent them a nudge (marker stored in ai_rolling_summary)
      if (l.ai_rolling_summary?.includes(NUDGE_MARKER)) return false;
      return true;
    });

    if (targets.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No eligible landlords to nudge.' });
    }

    const results = [];

    for (const landlord of targets) {
      if (!dryRun) {
        // Send email
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: landlord.email,
          subject: 'Your Dubai property — ready to list with us? 🏙️',
          html: buildEmailHtml(landlord),
        });

        // Mark as nudged so we don't resend
        const existingSummary = landlord.ai_rolling_summary || '';
        await base44.asServiceRole.entities.Landlord.update(landlord.id, {
          ai_rolling_summary: existingSummary
            ? `${existingSummary}\n\n${NUDGE_MARKER} Listing nudge email sent on ${new Date().toISOString().slice(0, 10)}.`
            : `${NUDGE_MARKER} Listing nudge email sent on ${new Date().toISOString().slice(0, 10)}.`,
        });
      }

      results.push({ id: landlord.id, name: landlord.full_name_en, email: landlord.email });
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      sent: targets.length,
      landlords: results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});