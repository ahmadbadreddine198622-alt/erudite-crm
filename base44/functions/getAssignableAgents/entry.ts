import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await base44.asServiceRole.entities.User.list();
    // Prefer the profile `display_name` (set by the user in Profile) over the built-in
    // `full_name` so agent names are consistent everywhere in the CRM.
    const agents = users
      .filter(u => u.email)
      .map(u => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name || u.full_name || '',
        full_name: u.display_name || u.full_name || '',
      }));

    return Response.json({ agents });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});