export const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'blue' },
  { id: 'contacted', label: 'Contacted', color: 'sky' },
  { id: 'viewing_scheduled', label: 'Viewing Scheduled', color: 'amber' },
  { id: 'viewing_done', label: 'Viewing Done', color: 'orange' },
  { id: 'negotiation', label: 'Negotiation', color: 'purple' },
  { id: 'offer_made', label: 'Offer Made', color: 'cyan' },
  { id: 'closed_won', label: 'Closed Won', color: 'emerald' },
  { id: 'closed_lost', label: 'Closed Lost', color: 'red' },
];

export const SOURCE_LABELS = {
  property_finder: 'Property Finder',
  bayut: 'Bayut',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  website: 'Website',
  walk_in: 'Walk-in',
  social_media: 'Social Media',
  other: 'Other',
};

export const LEAD_TYPE_LABELS = {
  buyer: 'Buyer',
  seller: 'Seller',
  investor: 'Investor',
  tenant: 'Tenant',
  landlord: 'Landlord',
};

export const TAG_COLORS = {
  hot_lead: 'red',
  warm_lead: 'orange',
  cold_lead: 'blue',
  vip: 'amber',
  investor: 'purple',
  first_time_buyer: 'emerald',
  cash_buyer: 'emerald',
  mortgage: 'sky',
  off_plan: 'cyan',
  ready: 'emerald',
};

export const getStageColor = (stageId) => {
  const stage = PIPELINE_STAGES.find(s => s.id === stageId);
  return stage?.color || 'blue';
};

export const formatAED = (amount) => {
  if (!amount) return 'AED 0';
  return `AED ${new Intl.NumberFormat('en-AE').format(amount)}`;
};

export const getLeadScoreColor = (score) => {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'amber';
  if (score >= 40) return 'orange';
  return 'red';
};