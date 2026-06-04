import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic function to test email delivery via Core.SendEmail
 * Returns the raw response from the email integration
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const emailResponse = await base44.integrations.Core.SendEmail({
      to: "ahmad@erudite-estate.com",
      subject: "PropCRM test email — please confirm receipt",
      body: "<p>This is a test from PropCRM to confirm email delivery works. If you received this, Core.SendEmail is working.</p>",
      from_name: "Erudite CRM",
    });

    return Response.json({
      success: true,
      email_response: emailResponse,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      full_error: error,
    }, { status: 500 });
  }
});