import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin user
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { emails } = await req.json();

    if (!Array.isArray(emails) || emails.length === 0) {
      return Response.json({ error: 'No emails provided' }, { status: 400 });
    }

    const results = [];

    for (const email of emails) {
      try {
        // Invite user as regular user (custom "agent" role is managed in dashboard)
        await base44.users.inviteUser(email, 'user');
        
        results.push({ email, status: 'invited', message: 'Invitation sent' });
      } catch (error) {
        results.push({ email, status: 'error', message: error.message });
      }
    }

    const successful = results.filter(r => r.status === 'invited').length;
    const failed = results.filter(r => r.status === 'error').length;

    return Response.json({
      success: failed === 0,
      summary: `${successful} invited successfully, ${failed} failed`,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});