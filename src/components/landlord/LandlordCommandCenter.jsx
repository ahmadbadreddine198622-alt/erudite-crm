import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Phone, Mail, Flame, Snowflake, ChevronDown, Info, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ARCHETYPE_COLORS, ARCHETYPE_LABELS } from './LandlordCard';
import { deriveScoreTrend } from './landlordAiFields';
import IMessageBadge from './IMessageBadge';

const STAGE_LABELS = {
  initial_contact: 'Initial contact',
  price_discovery: 'Price discovery',
  listing_commitment: 'Listing commitment',
  form_a_initiation: 'Form A initiation',
  form_a_signing: 'Form A signing',
  owner_documents: 'Owner documents',
  photos_videos: 'Photos / videos',
  photographer_scheduling: 'Photographer scheduling',
  listing_creation: 'Listing creation',
  internal_verification: 'Internal verification',
  listing_publication: 'Listing publication',
  final_confirmation: 'Final confirmation',
};

const STAGE_OPTIONS = [
  'initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation',
  'form_a_signing', 'owner_documents', 'photos_videos', 'photographer_scheduling',
  'listing_creation', 'internal_verification', 'listing_publication', 'final_confirmation',
];

const GOLD = 'hsl(38 92% 55%)';
const GREEN = '#34d399';
const AMBER = 'hsl(38 92% 60%)';
const RED = '#f87171';
const MUTED = 'rgba(255,255,255,0.4)';

function relativeTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Health color: good/watch/risk by value. `invert` for attention metrics (urgency).
function healthColor(value, { good, watch, invert } = {}) {
  if (value == null) return MUTED;
  if (invert) {
    if (value >= good) return RED;     // urgency: ≥80 risk
    if (value >= watch) return AMBER;  // 60–79 watch
    return GREEN;                       // <60 calm
  }
  if (value >= good) return GREEN;
  if (value >= watch) return AMBER;
  return RED;
}

function StatTile({ label, value, suffix, color, pct, delta, rationale }) {
  const isNull = value == null;
  return (
    <div className="rounded-xl p-2.5 relative" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tabular-nums leading-none" style={{ color: isNull ? MUTED : color }}>
          {isNull ? '—' : value}{!isNull && suffix ? suffix : ''}
        </span>
        {delta != null && delta !== 0 && (
          <span className="text-[10px] font-bold" style={{ color: delta > 0 ? GREEN : RED }}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(delta))}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full" style={{ width: isNull ? '0%' : `${Math.max(2, Math.min(100, pct))}%`, background: isNull ? 'transparent' : color, transition: 'width 0.3s ease' }} />
      </div>
      {rationale && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-white/10 transition-colors">
              <Info className="w-2.5 h-2.5" style={{ color: MUTED }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 text-xs" style={{ background: 'hsl(222 47% 13%)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
            <p className="text-[9px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: GOLD }}>{label} rationale</p>
            {rationale}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

const RAPPORT_META = {
  cold: { label: 'Cold', icon: Snowflake, color: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  warming: { label: 'Warming', icon: null, color: AMBER, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  rapport_built: { label: 'Rapport built', icon: null, color: AMBER, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  trust_established: { label: 'Trust established', icon: Flame, color: RED, bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  champion: { label: 'Champion', icon: Flame, color: RED, bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
};

export default function LandlordCommandCenter({ landlord, photoUrl, onUpdate, onAct, actions }) {
  const queryClient = useQueryClient();
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  const stageMutation = useMutation({
    mutationFn: (newStage) => base44.entities.Landlord.update(landlord.id, { stage: newStage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      onUpdate?.();
      toast.success('Stage updated');
    },
    onError: (e) => toast.error('Failed to update stage: ' + e.message),
  });

  // Score snapshots for run-over-run deltas (read-only; same source as the AI card).
  const { data: scoreSnapshots = [] } = useQuery({
    queryKey: ['landlord-score-snapshots', landlord.id],
    queryFn: () => base44.entities.LandlordScoreSnapshot.filter({ landlord_id: landlord.id }, '-captured_at', 14),
    enabled: !!landlord.id,
    staleTime: 60_000,
  });
  const trend = deriveScoreTrend(scoreSnapshots) || {};

  const handleResolveIMessage = async () => {
    setResolving(true);
    try {
      await base44.functions.invoke('resolveLandlordIMessage', { landlord_id: landlord.id });
      await queryClient.invalidateQueries({ queryKey: ['landlords'] });
      onUpdate?.();
      toast.success('iMessage handles resolved');
    } catch (e) {
      toast.error('Resolve failed: ' + (e?.message || 'unknown'));
    } finally {
      setResolving(false);
    }
  };

  const name = landlord.full_name_en || landlord.full_name || 'Unknown';
  const archetypeColor = ARCHETYPE_COLORS[landlord.landlord_archetype];
  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype];

  const winPct = landlord.mandate_win_probability != null ? Math.round(landlord.mandate_win_probability * 100) : null;
  const trust = landlord.trust_score ?? null;
  const response = landlord.responsiveness_score ?? null;
  const urgency = landlord.urgency_score ?? null;

  const stageIndex = STAGE_OPTIONS.indexOf(landlord.stage);
  const stepNum = stageIndex >= 0 ? stageIndex + 1 : 1;

  const rapport = RAPPORT_META[landlord.rapport_level] || RAPPORT_META.cold;
  const RapportIcon = rapport.icon;

  const askingPrice = landlord.asking_price_history?.[0]?.price;
  const beds = landlord.bedrooms ?? landlord.beds;
  const lba = landlord.lease_agreement_status;
  const LBA_STYLE = {
    drafted: { color: 'rgba(255,255,255,0.6)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
    sent_for_signature: { color: AMBER, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    signed: { color: GREEN, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    cancelled: { color: RED, bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  };
  const lbaStyle = LBA_STYLE[lba] || LBA_STYLE.drafted;

  const assetParts = [];
  if (landlord.unit_reference) assetParts.push(`Unit ${landlord.unit_reference}`);
  if (landlord.project_name) assetParts.push(landlord.project_name);
  if (beds != null) assetParts.push(`${beds} BR`);
  if (landlord.area_sqft != null) assetParts.push(`${Math.round(landlord.area_sqft).toLocaleString()} sqft`);

  return (
    <div className="sticky top-0 z-10 px-6 py-4 space-y-3" style={{ background: 'hsl(222 47% 9%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

      {/* ── Zone 1 — Identity bar ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {photoUrl ? (
            <>
              <button onClick={() => setPhotoLightboxOpen(true)} className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-white/20 hover:border-accent/60 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer" title="View full-size photo">
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              </button>
              <Dialog open={photoLightboxOpen} onOpenChange={setPhotoLightboxOpen}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                  <div className="relative w-full h-[85vh] flex items-center justify-center bg-black/95 rounded-lg">
                    <img src={photoUrl} alt="" className="max-h-full max-w-full object-contain" />
                    <button onClick={() => setPhotoLightboxOpen(false)} className="absolute top-3 right-3 p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="w-11 h-11 rounded-full bg-accent/20 flex items-center justify-center text-base font-bold text-accent shrink-0 border border-accent/30">
              {name[0]?.toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-semibold text-lg truncate" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>{name}</h2>
              {archetypeLabel && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${archetypeColor}`}>{archetypeLabel}</span>
              )}
            </div>

            {/* Contact line */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" style={{ color: MUTED }} />
                {landlord.phone || 'No phone'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" style={{ color: MUTED }} />
                {landlord.email || <span style={{ color: MUTED }}>No email on file</span>}
              </span>
            </div>

            <div className="mt-2">
              <IMessageBadge
                status={landlord.imessage_status}
                checkedAt={landlord.imessage_resolved_at || landlord.imessage_checked_at}
                checking={resolving}
                onCheck={handleResolveIMessage}
                handle={landlord.imessage_handle}
                handles={landlord.imessage_handles}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">{actions}</div>
          {(landlord.last_orchestrator_run_at || landlord.ai_processed_at) && (
            <span className="text-[10px]" style={{ color: MUTED }}>
              Aurora synced {relativeTime(landlord.last_orchestrator_run_at || landlord.ai_processed_at)}
            </span>
          )}
        </div>
      </div>

      {/* ── Zone 2 — Strike-now band ──────────────────────────── */}
      {landlord.ai_strike_now && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)' }}>
          <Flame className="w-4 h-4 shrink-0" style={{ color: RED }} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: RED, letterSpacing: '0.1em' }}>Strike now</p>
            <p className="text-xs font-semibold leading-snug mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {landlord.ai_next_best_action?.action || 'Reach out immediately'}
            </p>
          </div>
          {onAct && (
            <button onClick={onAct} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-transform hover:scale-105" style={{ background: RED, color: '#1a0808' }}>
              Act
            </button>
          )}
        </div>
      )}

      {/* ── Zone 3 — Deal vitals ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Deal vitals</p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ color: rapport.color, background: rapport.bg, borderColor: rapport.border }}>
            {RapportIcon && <RapportIcon className="w-2.5 h-2.5" />}
            {rapport.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <StatTile
            label="Win prob"
            value={winPct} suffix="%"
            color={healthColor(winPct, { good: 60, watch: 40 })}
            pct={winPct ?? 0}
            delta={trend.win?.delta}
            rationale={landlord.mandate_win_rationale}
          />
          <StatTile
            label="Trust"
            value={trust}
            color={healthColor(trust, { good: 70, watch: 50 })}
            pct={trust ?? 0}
            delta={trend.trust?.delta}
            rationale={landlord.trust_score_rationale}
          />
          <StatTile
            label="Response"
            value={response}
            color={healthColor(response, { good: 70, watch: 50 })}
            pct={response ?? 0}
            delta={null}
            rationale={landlord.responsiveness_score_rationale || (response != null ? 'Computed from average reply time & reply rate in the message thread.' : null)}
          />
          <StatTile
            label="Urgency"
            value={urgency}
            color={healthColor(urgency, { good: 80, watch: 60, invert: true })}
            pct={urgency ?? 0}
            delta={trend.urgency?.delta}
            rationale={landlord.urgency_score_rationale}
          />
        </div>
      </div>

      {/* ── Zone 4 — Pipeline tracker ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Pipeline</p>
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{STAGE_LABELS[landlord.stage] || landlord.stage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: MUTED }}>step {stepNum} of 12</span>
            <Select value={landlord.stage} onValueChange={(v) => stageMutation.mutate(v)} disabled={stageMutation.isPending}>
              <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent [&>svg]:hidden flex items-center justify-center hover:bg-white/10 rounded">
                <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((stage) => (
                  <SelectItem key={stage} value={stage} className="text-xs">{STAGE_LABELS[stage] || stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-1">
          {STAGE_OPTIONS.map((stage, i) => (
            <div key={stage} className="flex-1 h-1.5 rounded-full" style={{ background: i <= stageIndex ? GOLD : 'rgba(255,255,255,0.08)', transition: 'background 0.2s ease' }} title={STAGE_LABELS[stage]} />
          ))}
        </div>
      </div>

      {/* ── Zone 5 — Asset capsule ────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {assetParts.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md font-semibold" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: GOLD }}>
            {assetParts.join(' · ')}
          </span>
        )}
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ color: MUTED }}>Asking</span>{' '}
          {askingPrice ? `AED ${askingPrice.toLocaleString()}` : <span style={{ color: MUTED }}>— not set</span>}
        </span>
        <span style={{ color: MUTED }}>·</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ color: MUTED }}>Commission</span>{' '}
          {landlord.commission_pct_negotiated != null ? `${landlord.commission_pct_negotiated}%` : <span style={{ color: MUTED }}>—</span>}
        </span>
        {lba && (
          <>
            <span style={{ color: MUTED }}>·</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ color: lbaStyle.color, background: lbaStyle.bg, borderColor: lbaStyle.border }}>
              LBA {lba.replace(/_/g, ' ')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}