import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PhoneCall } from 'lucide-react';

// ── Color helpers ─────────────────────────────────────────────────────────────

function rapportStyle(r) {
  const m = {
    cold: { bg: 'rgba(148,163,184,0.12)', color: 'rgba(148,163,184,0.8)', border: 'rgba(148,163,184,0.25)' },
    warming: { bg: 'rgba(245,158,11,0.12)', color: 'hsl(38 92% 60%)', border: 'rgba(245,158,11,0.3)' },
    rapport_built: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
    trust_established: { bg: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: 'rgba(16,185,129,0.4)' },
    champion: { bg: 'rgba(250,204,21,0.15)', color: '#facc15', border: 'rgba(250,204,21,0.35)' },
  };
  return m[r] || m.cold;
}

function priceVsValStyle(v) {
  const m = {
    realistic: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
    slightly_high: { bg: 'rgba(245,158,11,0.12)', color: 'hsl(38 92% 60%)', border: 'rgba(245,158,11,0.3)' },
    significantly_overpriced: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
    below_market: { bg: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
    not_discussed: { bg: 'rgba(148,163,184,0.08)', color: 'rgba(148,163,184,0.6)', border: 'rgba(148,163,184,0.2)' },
  };
  return m[v] || m.not_discussed;
}

function mandateColor(m) {
  if (m === 'open_to_exclusive') return '#34d399';
  if (m === 'already_with_other_brokers') return '#f87171';
  return 'rgba(255,255,255,0.6)';
}

function outcomeStyle(o) {
  if (o === 'interested_proceeding') return { color: '#34d399' };
  if (['dead_lead', 'not_interested', 'wrong_number'].includes(o)) return { color: '#f87171' };
  if (o === 'no_answer') return { color: 'rgba(148,163,184,0.7)' };
  return { color: 'hsl(38 92% 60%)' };
}

function Chip({ label, bg, color, border }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: bg, color, border: `1px solid ${border}` }}>
      {label}
    </span>
  );
}

function Cell({ label, children }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'rgba(59,130,246,0.5)', letterSpacing: '0.08em' }}>{label}</p>
      <div className="flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  );
}

function fmt(s) {
  if (!s) return null;
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CallQualificationSummaryPanel({ landlordId }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['call-qualifications', landlordId],
    queryFn: () => base44.entities.CallQualification.filter({ landlord_id: landlordId }, '-call_date', 1),
    enabled: !!landlordId,
    staleTime: 60_000,
  });

  const q = records[0] || null;

  // Empty state
  if (!isLoading && !q) {
    return (
      <div className="px-6 py-3 flex items-center gap-2" style={{
        background: 'rgba(59,130,246,0.03)',
        borderBottom: '1px solid rgba(59,130,246,0.12)',
        borderTop: '1px solid rgba(59,130,246,0.08)',
      }}>
        <PhoneCall className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(59,130,246,0.4)' }} />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          No call logged yet — use the <span style={{ color: 'rgba(59,130,246,0.7)' }}>Qualify</span> tab to add one.
        </p>
      </div>
    );
  }

  if (!q) return null;

  const callDate = q.call_date
    ? new Date(q.call_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const rapport = rapportStyle(q.rapport_after_call);
  const pvv = priceVsValStyle(q.price_vs_valuation);

  return (
    <div className="px-6 py-4" style={{
      background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.05) 100%)',
      borderBottom: '2px solid rgba(59,130,246,0.3)',
      borderTop: '1px solid rgba(59,130,246,0.12)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#60a5fa', letterSpacing: '0.1em' }}>
            Call Qualification
          </span>
          {callDate && (
            <span className="text-[10px]" style={{ color: 'rgba(96,165,250,0.45)' }}>· {callDate}</span>
          )}
        </div>
        {q.rapport_after_call && (
          <Chip label={fmt(q.rapport_after_call)} {...rapport} />
        )}
      </div>

      {/* Grid of cells */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">

        {/* Motivation */}
        {q.motivation && (
          <Cell label="Motivation">
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{fmt(q.motivation)}</span>
          </Cell>
        )}

        {/* Timeline */}
        {q.timeline_urgency && (
          <Cell label="Timeline">
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{fmt(q.timeline_urgency)}</span>
          </Cell>
        )}

        {/* Price expectation + price vs val chip */}
        {(q.price_expectation_aed || q.price_vs_valuation) && (
          <Cell label="Price Expectation">
            {q.price_expectation_aed && (
              <span className="text-xs font-bold tabular-nums" style={{ color: '#60a5fa' }}>
                AED {Number(q.price_expectation_aed).toLocaleString()}
              </span>
            )}
            {q.price_vs_valuation && (
              <Chip label={fmt(q.price_vs_valuation)} {...pvv} />
            )}
          </Cell>
        )}

        {/* Mandate openness */}
        {q.mandate_openness && (
          <Cell label="Mandate">
            <span className="text-xs font-semibold" style={{ color: mandateColor(q.mandate_openness) }}>
              {fmt(q.mandate_openness)}
            </span>
          </Cell>
        )}

        {/* Call outcome */}
        {q.call_outcome && (
          <Cell label="Last Outcome">
            <span className="text-xs font-semibold" style={outcomeStyle(q.call_outcome)}>
              {fmt(q.call_outcome)}
            </span>
          </Cell>
        )}

        {/* Next step / follow-up */}
        {(q.next_step || q.followup_date) && (
          <Cell label="Next Step">
            {q.next_step && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{q.next_step}</span>
            )}
            {q.followup_date && (
              <span className="text-[10px] ml-1" style={{ color: 'rgba(96,165,250,0.6)' }}>
                · {new Date(q.followup_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </Cell>
        )}
      </div>

      {/* Motivation notes if present */}
      {q.motivation_notes && (
        <div className="mt-2.5 rounded-lg px-2.5 py-2" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-[11px] italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            "{q.motivation_notes}"
          </p>
        </div>
      )}
    </div>
  );
}