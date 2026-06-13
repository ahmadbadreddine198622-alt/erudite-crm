import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Plus, Search, X, Loader2, Building2, User, Users,
  ArrowRight, Clock, DollarSign, CheckCircle2, Calendar, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import ClosingDealSheet from '@/components/closing/ClosingDealSheet';
import NewClosingDialog from '@/components/closing/NewClosingDialog';

// ── Stage config ─────────────────────────────────────────────────────────────
export const CLOSING_STAGES = [
  { key: 'not_started',   label: 'Not Started',     color: '#94a3b8' },
  { key: 'cheques_ready', label: 'Cheques Ready',   color: '#f59e0b' },
  { key: 'trustee_booked',label: 'Trustee Booked',  color: '#8b5cf6' },
  { key: 'at_trustee',   label: 'At Trustee',       color: '#3b82f6' },
  { key: 'transfer_done',label: 'Transfer Done',     color: '#06b6d4' },
  { key: 'title_issued',  label: 'Title Issued',    color: '#10b981' },
  { key: 'handover',      label: 'Handover',        color: '#84cc16' },
  { key: 'complete',      label: 'Complete',        color: '#22c55e' },
];

const STAGE_MAP = Object.fromEntries(CLOSING_STAGES.map(s => [s.key, s]));

const REPR_STYLE = {
  buyer_side:  { bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd', border: 'rgba(59,130,246,0.3)',  label: 'Buyer Side' },
  seller_side: { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)', label: 'Seller Side' },
  both:        { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80', border: 'rgba(34,197,94,0.3)',  label: 'Both Sides' },
};

const fmtAed = (n) => n ? `AED ${Number(n).toLocaleString('en-AE', { maximumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => { try { return d ? format(new Date(d), 'd MMM yyyy') : '—'; } catch { return '—'; } };
const fmtDateTime = (d) => { try { return d ? format(new Date(d), 'd MMM, HH:mm') : '—'; } catch { return '—'; } };

function StagePill({ stage }) {
  const s = STAGE_MAP[stage];
  if (!s) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: s.color + '22', color: s.color, borderColor: s.color + '55' }}>
      {s.label}
    </span>
  );
}

function ReprPill({ repr }) {
  const s = REPR_STYLE[repr] || REPR_STYLE.buyer_side;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {s.label}
    </span>
  );
}

function StageRail({ current }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {CLOSING_STAGES.map((s, i) => {
        const isCurrent = s.key === current;
        const isPast = CLOSING_STAGES.findIndex(x => x.key === current) > i;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
              style={{
                background: isCurrent ? s.color : isPast ? s.color + '66' : 'rgba(255,255,255,0.12)',
                boxShadow: isCurrent ? `0 0 6px ${s.color}88` : 'none',
              }}
            />
            {i < CLOSING_STAGES.length - 1 && (
              <div className="w-3 h-px flex-shrink-0"
                style={{ background: isPast ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ClosingHub() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [reprFilter, setReprFilter] = useState('all');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['closing_deals'],
    queryFn: () => base44.entities.ClosingDeal.list('-created_date', 500),
  });

  // KPIs
  const kpi = useMemo(() => {
    const active = deals.filter(d => d.stage !== 'complete');
    const complete = deals.filter(d => d.stage === 'complete');
    const totalValue = active.reduce((s, d) => s + (d.deal_value_aed || 0), 0);
    const totalComm = deals.filter(d => d.stage === 'complete').reduce((s, d) =>
      s + (d.commission_amount_aed || 0) + (d.commission_amount_buy_side_aed || 0), 0);
    return { active: active.length, complete: complete.length, totalValue, totalComm };
  }, [deals]);

  const filtered = useMemo(() => {
    let r = deals;
    if (stageFilter !== 'all') r = r.filter(d => d.stage === stageFilter);
    if (reprFilter !== 'all') r = r.filter(d => d.representation === reprFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(d =>
        (d.lead_name || '').toLowerCase().includes(q) ||
        (d.landlord_name || '').toLowerCase().includes(q) ||
        (d.property_ref || '').toLowerCase().includes(q) ||
        (d.closing_reference || '').toLowerCase().includes(q) ||
        (d.trustee_office || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [deals, stageFilter, reprFilter, search]);

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['closing_deals'] });
  };

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title text-2xl font-semibold mb-1">Closing Hub</h1>
          <p className="page-subtitle">{deals.length} deal{deals.length !== 1 ? 's' : ''} in closing pipeline</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
          <Plus className="w-4 h-4" /> New Closing
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Active Closings</p>
          <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{kpi.active}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Completed</p>
          <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{kpi.complete}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pipeline Value</p>
          <p className="text-xl font-bold gold-text truncate">{fmtAed(kpi.totalValue)}</p>
        </div>
        <div className="glass-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Commission Earned</p>
          <p className="text-xl font-bold truncate" style={{ color: '#4ade80' }}>{fmtAed(kpi.totalComm)}</p>
        </div>
      </div>

      {/* Stage pipeline overview */}
      <div className="glass-card p-4 mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stage Distribution</p>
        <div className="flex flex-wrap gap-2">
          {CLOSING_STAGES.map(s => {
            const count = deals.filter(d => d.stage === s.key).length;
            return (
              <button key={s.key}
                onClick={() => setStageFilter(stageFilter === s.key ? 'all' : s.key)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: stageFilter === s.key ? s.color + '22' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${stageFilter === s.key ? s.color + '55' : 'rgba(255,255,255,0.1)'}`,
                  color: stageFilter === s.key ? s.color : 'rgba(255,255,255,0.6)',
                }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.label}
                {count > 0 && <span className="font-bold" style={{ color: s.color }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search buyer, seller, property, ref…"
            className="pl-8 pr-8 py-2 rounded-lg text-xs outline-none w-64"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3 h-3" /></button>}
        </div>
        <select value={reprFilter} onChange={e => setReprFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}>
          <option value="all">All Sides</option>
          <option value="buyer_side">Buyer Side</option>
          <option value="seller_side">Seller Side</option>
          <option value="both">Both Sides</option>
        </select>
      </div>

      {/* Deal cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No closing deals found.</p>
          <button onClick={() => setShowNew(true)} className="mt-4 text-xs underline" style={{ color: 'hsl(38 92% 55%)' }}>
            Create the first one →
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(deal => (
            <button key={deal.id} onClick={() => setSelectedDeal(deal)}
              className="glass-card p-4 text-left hover:border-white/20 transition-all active:scale-[0.99]">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {deal.closing_reference && (
                      <span className="text-[10px] font-mono font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {deal.closing_reference}
                      </span>
                    )}
                    <ReprPill repr={deal.representation || 'buyer_side'} />
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {deal.deal_type === 'rent' ? 'Rent' : 'Sale'}
                    </span>
                  </div>
                  {deal.property_ref && (
                    <p className="text-sm font-semibold text-white/90 truncate">{deal.property_ref}</p>
                  )}
                </div>
                <StagePill stage={deal.stage || 'not_started'} />
              </div>

              {/* Parties */}
              <div className="space-y-1 mb-3">
                {deal.lead_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <User className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <span className="text-white/70 truncate">{deal.lead_name}</span>
                    <span className="text-white/30 text-[10px]">Buyer</span>
                  </div>
                )}
                {deal.landlord_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="text-white/70 truncate">{deal.landlord_name}</span>
                    <span className="text-white/30 text-[10px]">Seller</span>
                  </div>
                )}
              </div>

              {/* Stage rail */}
              <div className="mb-3">
                <StageRail current={deal.stage || 'not_started'} />
              </div>

              {/* Money + trustee */}
              <div className="flex items-center justify-between gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-bold" style={{ color: 'hsl(38 92% 55%)' }}>
                  {fmtAed(deal.deal_value_aed)}
                </div>
                {deal.trustee_appointment_at && (
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <Calendar className="w-3 h-3" />
                    {fmtDateTime(deal.trustee_appointment_at)}
                  </div>
                )}
                {deal.noc_status && deal.noc_status !== 'not_required' && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                    NOC: {deal.noc_status}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail sheet */}
      {selectedDeal && (
        <ClosingDealSheet
          deal={selectedDeal}
          open={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onSaved={() => { handleSaved(); setSelectedDeal(null); }}
        />
      )}

      <NewClosingDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}