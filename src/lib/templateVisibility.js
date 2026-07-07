// Shared client-side visibility filter for MessageTemplate records shown in
// template pickers / selectors.
//
// The MessageTemplate RLS already returns private templates to their creator,
// shared templates to everyone, and specific_agents templates to listed agents.
// This helper enforces the SAME rule on the client so behavior is explicit and
// consistent across every picker (email, iMessage, WhatsApp, Telegram, SMS).
//
// A template is visible to the current user when ANY of these is true:
//   - visibility === 'shared'                      (everyone sees it)
//   - visibility === 'private' AND created_by_email === userEmail
//   - visibility === 'specific_agents' AND userEmail is in shared_with_agents
//   - isAdmin                                       (admins see everything)
//
// Also requires is_active === true (inactive templates stay hidden).

export function filterVisibleTemplates(templates, userEmail, isAdmin = false) {
  if (!Array.isArray(templates)) return [];
  const email = (userEmail || '').toLowerCase();
  return templates.filter((t) => {
    if (t.is_active === false) return false;
    if (isAdmin) return true;
    if (t.visibility === 'shared') return true;
    if (t.visibility === 'private' && (t.created_by_email || '').toLowerCase() === email) return true;
    if (t.visibility === 'specific_agents' && Array.isArray(t.shared_with_agents)) {
      return t.shared_with_agents.some((a) => String(a || '').toLowerCase() === email);
    }
    // Unknown / missing visibility → treat as private (only creator sees it)
    if (!t.visibility && (t.created_by_email || '').toLowerCase() === email) return true;
    return false;
  });
}