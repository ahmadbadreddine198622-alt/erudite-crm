// Sample data for the Buyer vCard page — exactly the spec copy. Self-contained so
// the page renders fully on first load with no empty states.
export const buyer = {
  initials: 'DV',
  name: 'Dmitry Volkov',
  nameRu: 'Дмитрий Волков',
  flag: '🇷🇺',
  ru: true,
  lastActivity: 'Last Activity: 14 Jul 2026, 18:42',
  requirements: ['2–3 Bed', 'Apartment', 'Business Bay', 'Peninsula / Jumeirah Living', 'Sea View'],
  budget: 'AED 2.8M – 3.5M',
  preApproved: 'AED 3.2M',
  timeline: '0–3 months',
  phones: [
    { num: '+971 55 234 8891', label: 'Primary' },
    { num: '+7 916 445 2210', label: 'Secondary' },
  ],
  email: 'd.volkov@gmail.com',
  stagePill: '◷ Unit Matching',
  rapport: 'Warming',
  momentum: '⚡ Accelerating',
  facts: {
    win: '64%',
    source: 'Property Finder',
    stage: '12d in stage',
    residency: 'Resident',
    financing: 'Cash · Pre-approved',
  },
  dossier: {
    financing: 'Cash + Mortgage',
    pof: 'Verified · ENBD 12 Jul',
    preApproval: 'AED 3.2M · valid 60d',
    passport: 'On file ✓',
  },
  agent: { initials: 'GS', name: 'Gleb Sokolov' },
};

export const auroraProposal = {
  title: 'Send Peninsula 4 shortlist — 3 units, budget fit 92%',
};

export const aiIntel = {
  trust: 72,
  urgency: 55,
  win: '64%',
  rationale:
    'Replied within the hour twice and volunteered the bank letter unprompted — trust is real. The decision-maker on the view is Elena; win the Thursday viewing and the offer window opens same-day.',
  needsInput:
    'Is the mortgage pre-approval joint with Elena? It changes DLD registration and the offer signature flow.',
};

export const callScript =
  'Dmitry, Gleb here — two Peninsula units under 3.4M match your brief, and one has the full sea view Elena asked about. Ninety seconds of numbers before Thursday?';

export const leftMedia = [
  { label: 'Peninsula 4 · 2BR', hue: 'linear-gradient(135deg,#1a2a4a,#2a3f6a)' },
  { label: 'Jumeirah Living · 3BR', hue: 'linear-gradient(135deg,#2a1a3a,#3a2f5a)' },
];

export const pinnedNotes = [
  { text: 'Wants to close before the September school year — Elena decides on the view.', author: 'Gleb', time: '14 Jul, 18:42' },
  { text: 'Proof of funds verified — ENBD letter on file. OK to book viewings.', author: 'Gleb', time: '12 Jul, 10:15' },
];

// Right panel
export const aiTasks = [
  { title: 'Send Peninsula 4 matches — budget fit 92%', reason: 'Buyer replied within the hour twice; strike while the thread is hot.' },
  { title: 'Confirm Thursday 17:00 viewing — Peninsula lobby', reason: 'Elena joins — the view decides. Lock the slot before another agent takes it.' },
  { title: 'Prepare offer template at AED 3.25M anchor', reason: 'Pre-approval is AED 3.2M; anchor just under ask to leave room to meet.' },
];

export const channelTabs = ['Activity', 'Notes', 'Follow Up', 'Emails', 'iMessage', 'WhatsApp', 'Telegram', 'Calls', 'SMS', 'Appointments', 'Documents'];

export const pinnedStrip = { text: 'Wants sea view · Elena decides', count: 2 };

export const whatsappThread = [
  { dir: 'in', time: '17:58', text: 'We saw the Peninsula listing on Property Finder. Is the 2BR on a high floor still available?' },
  { dir: 'out', time: '18:03', text: 'Yes — the 2BR on 27 with the full sea view, AED 3.30M. I can also show a 3BR at Jumeirah Living at 3.45M for contrast. Thursday or Friday?' },
  { dir: 'in', time: '18:26', text: 'Thursday after 4pm works. My wife will join — the view matters to her.' },
  { dir: 'out', time: '18:42', text: 'Booked — Thursday 17:00, Peninsula lobby. Sending both brochures now.' },
];

export const composerDraft =
  'Dmitry — brochures attached. One thing before Thursday: the 27th-floor unit had a second viewing request today. If the view checks out for Elena, we should be ready to move same-day.';