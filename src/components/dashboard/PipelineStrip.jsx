import React from 'react';
import { useNavigate } from 'react-router-dom';

// Phase groupings map each stage enum to a phase
const PHASE_STAGES = {
  New: ['initial_contact', 'price_discovery'],
  Mandate: ['listing_commitment', 'form_a_initiation', 'form_a_signing'],
  'Docs & Media': ['owner_documents', 'photos_videos', 'photographer_scheduling'],
  Listing: ['listing_creation', 'internal_verification', 'listing_publication', 'final_confirmation'],
  Marketing: ['marketing_agents', 'marketing_network', 'open_house', 'client_blast'],
};

const PHASE_LABELS = {
  New: 'New',
  Mandate: 'Mandate',
  'Docs & Media': 'Docs & Media',
  Listing: 'Listing',
  Marketing: 'Marketing',
};

export default function PipelineStrip({ phaseCounts = {} }) {
  const navigate = useNavigate();

  // Use pre-calculated counts from backend
  const counts = {
    New: phaseCounts.New || 0,
    Mandate: phaseCounts.Mandate || 0,
    'Docs & Media': phaseCounts['Docs & Media'] || 0,
    Listing: phaseCounts.Listing || 0,
    Marketing: phaseCounts.Marketing || 0,
  };

  return (
    <div className="w-full max-w-4xl mb-8">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Object.entries(PHASE_LABELS).map(([phaseKey, label]) => {
          const count = counts[phaseKey] || 0;
          const needsAttention = count > 0;
          
          return (
            <button
              key={phaseKey}
              onClick={() => navigate('/landlords')}
              className="flex-shrink-0 flex flex-col items-center justify-center px-5 py-3 rounded-xl transition-all active:scale-[0.98]"
              style={{
                background: needsAttention 
                  ? 'linear-gradient(160deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))' 
                  : 'linear-gradient(160deg, #141b29, #101622)',
                border: needsAttention
                  ? '1px solid rgba(245,158,11,0.3)'
                  : '1px solid rgba(255,255,255,0.06)',
                minWidth: '100px',
              }}
            >
              <p 
                className="text-2xl font-bold tabular-nums"
                style={{ 
                  color: needsAttention ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.6)',
                  fontFamily: "'Playfair Display', serif",
                  lineHeight: 1,
                }}
              >
                {count}
              </p>
              <p 
                className="uppercase font-semibold mt-1 text-[9px] tracking-wider"
                style={{ 
                  color: needsAttention ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.35)',
                }}
              >
                {label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}