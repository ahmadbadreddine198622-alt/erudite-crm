// Catalog of all merge-field variables available across the CRM.
// Used by the TemplateField autocomplete (type `{{` to insert) and resolved at
// send/load time by replaceTemplateVars (src/lib/templateVars.js).
//
// `key` is the exact token inserted as {{key}}; `label` is what the user sees.

export const TEMPLATE_VARIABLES = [
  // Owner / landlord
  { key: 'owner_first_name', label: 'Owner first name', group: 'Owner' },
  { key: 'owner_last_name', label: 'Owner last name', group: 'Owner' },
  { key: 'owner_name', label: 'Owner full name', group: 'Owner' },
  { key: 'landlord_name', label: 'Landlord full name', group: 'Owner' },
  { key: 'landlord_first_name', label: 'Landlord first name', group: 'Owner' },
  { key: 'landlord_last_name', label: 'Landlord last name', group: 'Owner' },
  { key: 'contact_name', label: 'Contact name', group: 'Owner' },
  { key: 'first_name', label: 'First name', group: 'Owner' },
  { key: 'last_name', label: 'Last name', group: 'Owner' },
  { key: 'full_name', label: 'Full name', group: 'Owner' },
  // Property / unit / project
  { key: 'property_name', label: 'Property name', group: 'Property' },
  { key: 'unit_reference', label: 'Unit reference', group: 'Property' },
  { key: 'unit_no', label: 'Unit number', group: 'Property' },
  { key: 'project_name', label: 'Project name', group: 'Property' },
  { key: 'building_name', label: 'Building name', group: 'Property' },
  // Pricing
  { key: 'asking_price', label: 'Asking price (AED)', group: 'Pricing' },
  { key: 'asking_price_aed', label: 'Asking price AED', group: 'Pricing' },
  // Agent
  { key: 'agent_name', label: 'Agent full name', group: 'Agent' },
  { key: 'agent_first_name', label: 'Agent first name', group: 'Agent' },
  { key: 'agent_email', label: 'Agent email', group: 'Agent' },
  { key: 'agent_title', label: 'Agent title', group: 'Agent' },
  { key: 'specialization', label: 'Agent specialization', group: 'Agent' },
  // Company
  { key: 'company_name', label: 'Company name', group: 'Company' },
  // Contact info
  { key: 'phone', label: 'Owner phone', group: 'Contact' },
  { key: 'email', label: 'Owner email', group: 'Contact' },
  // Appointment
  { key: 'title', label: 'Appointment title', group: 'Appointment' },
];