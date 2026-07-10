// Organization owners — these two emails have unrestricted access to everything
// in the CRM (all permissions, treated as admin regardless of their role field).
export const OWNER_EMAILS = [
  'ahmad.badreddine198622@gmail.com',
  'ahmad@erudite-estate.com',
];

export function isOwner(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}