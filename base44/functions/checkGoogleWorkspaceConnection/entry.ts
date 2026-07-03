import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// checkGoogleWorkspaceConnection — returns whether the current app user has connected
// their Google account via the "Agent Google Workspace" app-user connector.
// Used by the frontend to decide whether to show the "Connect Google Account" prompt.

const CONNECTOR_ID = '6a479aa48fb6dd5886beb065';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
      if (!accessToken) throw new Error('no_token');

      // Light probe — fetch the Google user profile to confirm the token works and get the email.
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let email = null;
      if (profileRes.ok) {
        const profile = await profileRes.json();
        email = profile.email || null;
      }
      return Response.json({ connected: true, email });
    } catch (_) {
      return Response.json({ connected: false, email: null });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});