// Shared merge-field replacement for all template-loading paths
// (email, iMessage, WhatsApp, Telegram, SMS, appointment reminders).
// Handles every common variable alias used across templates.
//
// Usage:
//   import { buildTemplateContext, replaceTemplateVars } from '@/lib/templateVars';
//   const ctx = buildTemplateContext(landlord, user);
//   const filled = replaceTemplateVars(templateBody, ctx);

export function buildTemplateContext(landlord, user) {
  const l = landlord || {};
  const u = user || {};
  const fullName = l.full_name_en || l.full_name_ar ||
    [l.first_name, l.last_name].filter(Boolean).join(' ') || '';
  const firstName = l.first_name || (fullName ? fullName.split(' ')[0] : '');
  const lastName = l.last_name || (fullName ? fullName.split(' ').slice(1).join(' ') : '');
  const agentFirst = u.full_name ? u.full_name.split(' ')[0] : '';
  const askingPrice = l.asking_price_aed
    ? Number(l.asking_price_aed).toLocaleString('en-US') + ' AED'
    : '';

  return {
    // Owner / landlord name variants
    owner_first_name: firstName,
    owner_last_name: lastName,
    owner_name: fullName,
    landlord_name: fullName,
    landlord_first_name: firstName,
    landlord_last_name: lastName,
    contact_name: fullName,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    // Property / unit / project
    property_name: l.unit_reference || l.project_name || '',
    unit_reference: l.unit_reference || '',
    unit_no: l.unit_reference || '',
    unit_layout: l.unit_layout || '',
    project_name: l.project_name || '',
    building_name: l.building_name || '',
    // Agent
    agent_name: u.full_name || '',
    agent_first_name: agentFirst,
    agent_email: u.email || '',
    agent_title: u.title || 'Senior Broker',
    specialization: u.specialization || 'Dubai real estate',
    // Company
    company_name: 'Erudite Real Estate',
    // Pricing
    asking_price: askingPrice,
    asking_price_aed: askingPrice,
    // Contact info
    phone: l.phone || '',
    email: l.email || '',
    // Appointment title (filled by bookAppointment for reminders)
    title: '',
  };
}

// Replace every {{var}} in text with the matching context value.
// Unknown / empty vars are left as-is so the agent can spot and fill them manually.
export function replaceTemplateVars(text, ctx) {
  if (!text) return '';
  return String(text).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = ctx ? ctx[key] : undefined;
    return (val !== undefined && val !== null && String(val).trim() !== '')
      ? String(val)
      : match;
  });
}