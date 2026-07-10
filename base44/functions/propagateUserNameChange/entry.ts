import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// propagateUserNameChange — when a user updates their display name in their
// profile, this propagates the new name to every entity that caches a
// denormalized copy of the agent/author name alongside their email.
//
// The email is the stable key; the name is the volatile display field.
// Called from Profile.jsx after base44.auth.updateMe succeeds when the
// display_name actually changed.

// Entities that cache an agent/author display name with a matching email.
// Each entry: { entity, emailField, nameField }
const NAME_CACHES = [
  { entity: 'Commission',      emailField: 'agent_email',  nameField: 'agent_name'  },
  { entity: 'AgentWorkload',    emailField: 'agent_email',  nameField: 'agent_name'  },
  { entity: 'LandlordNote',     emailField: 'author_email', nameField: 'author_name' },
  { entity: 'ActivityComment',  emailField: 'author_email', nameField: 'author_name' },
  { entity: 'Activity',         emailField: 'agent_email',  nameField: 'agent_name'  },
  { entity: 'AircallCall',      emailField: 'agent_email',  nameField: 'agent_name'  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const newName = (body.new_name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    if (!newName) return Response.json({ error: 'new_name is required' });
    if (!email) return Response.json({ error: 'email is required' });

    // Security: a user may only propagate their own name. Admins may propagate
    // for any user (e.g. when an admin renames someone from the Team page).
    const isAdmin = user.role === 'admin';
    if (!isAdmin && user.email.toLowerCase() !== email) {
      return Response.json({ error: 'You can only update your own name' }, { status: 403 });
    }

    const results = [];
    for (const { entity, emailField, nameField } of NAME_CACHES) {
      try {
        const res = await base44.asServiceRole.entities[entity].updateMany(
          { [emailField]: email },
          { $set: { [nameField]: newName } }
        );
        results.push({ entity, matched: res?.matched_count ?? res?.modified_count ?? 'ok' });
      } catch (err) {
        // Don't abort the whole propagation if one entity fails (e.g. RLS or missing entity)
        results.push({ entity, error: err.message });
      }
    }

    return Response.json({ ok: true, email, new_name: newName, results });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});