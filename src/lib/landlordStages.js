// Landlord pipeline stages — labels and their machine keys, kept in sync order.
// Extracted from LandlordDetailPage so the file stays under the line limit.

export const LANDLORD_STAGE_LABELS = [
  'Initial Contact', 'Attempted to Contact', 'Price Discovery', 'Listing Commitment',
  'Form A Initiation', 'Form A Signing', 'Owner Documents', 'Photos & Videos',
  'Photographer Scheduling', 'Listing Creation', 'Internal Verification',
  'Listing Publication', 'Final Confirmation', 'Marketing — Agents',
  'Marketing — Network', 'Open House', 'Client Blast', 'Deal Closed',
];

export const LANDLORD_STAGE_KEYS = [
  'initial_contact', 'attempted_to_contact', 'price_discovery', 'listing_commitment',
  'form_a_initiation', 'form_a_signing', 'owner_documents', 'photos_videos',
  'photographer_scheduling', 'listing_creation', 'internal_verification',
  'listing_publication', 'final_confirmation', 'marketing_agents',
  'marketing_network', 'open_house', 'client_blast', 'deal_closed',
];