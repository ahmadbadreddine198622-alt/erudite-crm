// Private Bank × Light — shared design tokens for the Landlord Pipeline chrome.
// Presentation only. Mirrors the tokens used on the restyled Kanban cards.
export const PB = {
  BASE: '#0B1020',
  CARD: '#0E1428',
  WELL: '#111A33',
  GOLD: '#C6A15B',
  CLARET: '#B4463F',
  CLARET_TEXT: '#C86F66',
  HAIR: 'rgba(255,255,255,0.07)',
  HAIR2: 'rgba(255,255,255,0.10)',
  SLATE: '#A7B0C4',
  NAME: '#E9EDF6',
  CHAMPAGNE: 'linear-gradient(115deg,#D9B36C,#C6A15B 55%,#A88443)',
};

// Champagne gradient ink (background-clip:text). Apply to the style of a <span>.
export const champagneInk = {
  backgroundImage: PB.CHAMPAGNE,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  fontVariantNumeric: 'tabular-nums',
};