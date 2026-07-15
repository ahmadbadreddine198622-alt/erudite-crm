import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// checkGoogleWorkspaceConnection — returns whether the current app user has connected
// their Google account via the "Agent Google Workspace" app-user connector.
// Used by the frontend to decide whether to show the "Connect Google Account" prompt.

const CONNECTOR_ID = '6a4907061925b80b469ca3d5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
      const accessToken = conn?.accessToken;
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
      // Sync gmail_connected / gmail_address onto the User entity (only if changed)
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const ue = users?.[0];
        if (ue && (!ue.gmail_connected || ue.gmail_address !== email)) {
          await base44.asServiceRole.entities.User.update(ue.id, { gmail_connected: true, gmail_address: email || user.email });
        }
      } catch (_) { /* best-effort sync */ }
      return Response.json({ connected: true, email });
    } catch (err) {
      // Capture the real reason so the frontend can surface it — the previous
      // silent swallow made it impossible to diagnose expired/revoked tokens vs
      // popup-blocked consent vs platform errors.
      const reason = String(err?.message || err || 'unknown');
      // Mark as disconnected on the User entity
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const ue = users?.[0];
        if (ue?.gmail_connected) {
          await base44.asServiceRole.entities.User.update(ue.id, { gmail_connected: false, gmail_address: '' });
        }
      } catch (_) { /* best-effort sync */ }
      return Response.json({ connected: false, email: null, error_detail: reason });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});