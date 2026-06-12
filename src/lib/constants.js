const isFilled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

export const COMPANY = {
  name_en:       "ERUDITE REAL ESTATE",
  name_ar:       "الإرودايت للعقارات",
  establishment: "Erudite Property (Erudite Real Estate)",
  address:       "Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, U.A.E.",
  po_box:        "121828",
  phone:         "+971 58 180 6000",
  email:         "info@erudite-estate.com",
  website:       "www.eruditeproperty.com",
  orn:           "29322",
  brn:           "34625",
  ded:           "1032973",
};

export const COMPANY_BOTTOM_LINE = [
  COMPANY.name_en,
  COMPANY.address,
  COMPANY.phone,
  COMPANY.website,
].filter(isFilled).join("   ·   ");

export const COMPANY_LETTERHEAD = [
  COMPANY.establishment,
  COMPANY.address,
  isFilled(COMPANY.po_box) ? "P.O. Box " + COMPANY.po_box : "",
  COMPANY.phone,
  COMPANY.email,
  COMPANY.website,
  `ORN ${COMPANY.orn}  |  BRN ${COMPANY.brn}  |  DED ${COMPANY.ded}`,
].filter(isFilled);

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