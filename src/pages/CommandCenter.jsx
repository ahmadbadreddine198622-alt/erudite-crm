import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { User, Camera, Disc, Film, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const LISTING_STAGE_LABELS = {
  received:         'Received',
  permit_creation:  'Permit Creation',
  listing_drafting: 'Listing Drafting',
  photos_upload:    'Photos Upload',
  publishing:       'Publishing',
  verification:     'Verification',
  live:             'Live',
};

const LISTING_STAGE_COLORS = {
  received:         { text: 'rgba(148,163,184,0.9)',  bg: 'rgba(148,163,184,0.12)',  border: 'rgba(148,163,184,0.25)' },
  permit_creation:  { text: '#fbbf24',                bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.25)' },
  listing_drafting: { text: '#a5b4fc',                bg: 'rgba(99,102,241,0.12)',   border: 'rgba(99,102,241,0.25)' },
  photos_upload:    { text: '#67e8f9',                bg: 'rgba(6,182,212,0.12)',    border: 'rgba(6,182,212,0.25)' },
  publishing:       { text: '#fdba74',                bg: 'rgba(249,115,22,0.12)',   border: 'rgba(249,115,22,0.25)' },
  verification:     { text: '#d8b4fe',                bg: 'rgba(168,85,247,0.12)',   border: 'rgba(168,85,247,0.25)' },
  live:             { text: '#4ade80',                bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.3)' },
};

const PHOTO_STATUS_LABELS = {
  none:              'None',
  phone_quality:     'Phone Quality',
  professional_done: 'Professional Done',
  scheduled:         'Scheduled',
};


const LISTING_STAGES = ['received','permit_creation','listing_drafting','photos_upload','publishing','verification','live'];
const PHOTO_STATUSES = ['none','phone_quality','scheduled','professional_done'];

function SummaryCard({ label, value, sub, color = 'hsl(38 92% 50%)' }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)', letterSpacing: '0.07em' }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function UnitRow({ item, type }) {
  const stagePill = type === 'listing'
    ? (() => {
        const c = LISTING_STAGE_COLORS[item.listing_production_stage] || LISTING_STAGE_COLORS.received;
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
            {LISTING_STAGE_LABELS[item.listing_production_stage] || item.listing_production_stage}
          </span>
        );
      })()
    : (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
          {PHOTO_STATUS_LABELS[item.photography_status] || item.photography_status}
        </span>
      );

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[9px] font-bold shrink-0" style={{ color: 'hsl(38 92% 55%)' }}>
        {(item.owner_name || '?')[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{item.owner_name || '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {[item.project, item.unit_reference].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {type === 'photography' && (
          <div className="flex gap-0.5">
            {[
              { key: 'has_360_tour', icon: Disc },
              { key: 'has_drone_footage', icon: Film },
              { key: 'has_video_walkthrough', icon: Camera },
              { key: 'has_floor_plan', icon: FileText },
            ].map(({ key, icon: Icon }) => (
              <span key={key} title={key.replace('has_', '').replace(/_/g, ' ')}
                className={`w-4 h-4 rounded flex items-center justify-center ${item[key] ? 'text-emerald-400' : 'text-white/15'}`}>
                <Icon className="w-2.5 h-2.5" />
              </span>
            ))}
          </div>
        )}
        {item.assigned_agent_email && (
          <span className="text-[9px] px-1.5 py-0.5 rounded hidden sm:inline"
            style={{ background: 'rgba(245,158,11,0.1)', color: 'hsl(38 92% 60%)' }}>
            <User className="w-2 h-2 inline mr-0.5" />{item.assigned_agent_email.split('@')[0]}
          </span>
        )}
        {type === 'listing' && item.listing_manager_email && (
          <span className="text-[9px] px-1.5 py-0.5 rounded hidden sm:inline"
            style={{ background: 'rgba(167,139,250,0.1)', color: '#c4b5fd' }}>
            {item.listing_manager_email.split('@')[0]}
          </span>
        )}
        {stagePill}
      </div>
    </div>
  );
}

function SectionTable({ title, items, type, color, linkTo, linkLabel }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <h2 className="font-semibold text-sm font-display" style={{ color: 'rgba(255,255,255,0.88)' }}>{title}</h2>
          <Badge variant="outline" className="text-[10px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.12)' }}>
            {items.length}
          </Badge>
        </div>
        <Link to={linkTo} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent transition-colors">
          <ExternalLink className="w-3 h-3" /> {linkLabel}
        </Link>
      </div>
      <div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No units</p>
        ) : (
          items.map(item => <UnitRow key={item.landlord_id} item={item} type={type} />)
        )}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const { data, isLoading } = useQuery({
    queryKey: ['command-center-feed'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCommandCenterFeed', {});
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="page-root flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading Command Center…</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const listingUnits = data?.listing_units || [];
  const photoUnits = data?.photo_units || [];

  // Group listing units by stage
  const byListingStage = {};
  LISTING_STAGES.forEach(s => { byListingStage[s] = []; });
  listingUnits.forEach(u => {
    const s = u.listing_production_stage || 'received';
    if (byListingStage[s]) byListingStage[s].push(u);
  });

  // Group photo units by photography_status
  const byPhotoStatus = {};
  PHOTO_STATUSES.forEach(s => { byPhotoStatus[s] = []; });
  photoUnits.forEach(u => {
    const s = u.photography_status || 'none';
    if (byPhotoStatus[s]) byPhotoStatus[s].push(u);
  });

  // Manager assignment summary text
  const managerCounts = summary.manager_counts || {};
  const managerSummary = Object.entries(managerCounts)
    .map(([email, count]) => `${email.split('@')[0]}: ${count}`)
    .join(' · ') || 'None';

  return (
    <div className="page-root space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title text-2xl font-semibold mb-1">Command Center</h1>
        <p className="page-subtitle">Read-only operations overview — Listing Production &amp; Photography</p>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="In Production" value={summary.total_listing ?? 0} sub={managerSummary} />
        <SummaryCard label="In Photography" value={summary.total_photography ?? 0} color="#f9a8d4" />
        <SummaryCard label="Unassigned" value={summary.total_unassigned ?? 0} color="rgba(148,163,184,0.9)" sub="no listing manager" />
        <SummaryCard label="Live" value={summary.listing_stage_counts?.live ?? 0} color="#4ade80" sub="on portals" />
      </div>

      {/* Listing Production stage breakdown */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>
          Listing Production — by stage
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {LISTING_STAGES.map(s => {
            const c = LISTING_STAGE_COLORS[s];
            const count = summary.listing_stage_counts?.[s] ?? 0;
            return (
              <div key={s} className="rounded-lg p-3 text-center" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <p className="text-lg font-bold tabular-nums" style={{ color: c.text }}>{count}</p>
                <p className="text-[9px] font-medium mt-0.5 leading-tight" style={{ color: c.text, opacity: 0.8 }}>{LISTING_STAGE_LABELS[s]}</p>
              </div>
            );
          })}
        </div>

        {/* Listing units table grouped by stage */}
        <div className="space-y-4">
          {LISTING_STAGES.filter(s => byListingStage[s].length > 0).map(s => (
            <SectionTable
              key={s}
              title={`${LISTING_STAGE_LABELS[s]} (${byListingStage[s].length})`}
              items={byListingStage[s]}
              type="listing"
              color={LISTING_STAGE_COLORS[s].text}
              linkTo="/listing-production"
              linkLabel="Open board →"
            />
          ))}
          {listingUnits.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No units in listing production</p>
          )}
        </div>
      </div>

      {/* Photography */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>
          Photography — by status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {PHOTO_STATUSES.map(s => {
            const count = summary.photo_status_counts?.[s] ?? 0;
            return (
              <div key={s} className="rounded-lg p-3 text-center" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <p className="text-lg font-bold tabular-nums text-rose-400">{count}</p>
                <p className="text-[9px] font-medium mt-0.5 text-rose-400/70 leading-tight">{PHOTO_STATUS_LABELS[s]}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {PHOTO_STATUSES.filter(s => byPhotoStatus[s].length > 0).map(s => (
            <SectionTable
              key={s}
              title={`${PHOTO_STATUS_LABELS[s]} (${byPhotoStatus[s].length})`}
              items={byPhotoStatus[s]}
              type="photography"
              color="#f9a8d4"
              linkTo="/photography"
              linkLabel="Open board →"
            />
          ))}
          {photoUnits.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No units in photography workflow</p>
          )}
        </div>
      </div>
    </div>
  );
}