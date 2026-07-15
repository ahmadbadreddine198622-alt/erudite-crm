import React, { useMemo, useState } from 'react';
import { Layers, Home, Camera, Film, BadgeCheck, FileText, Globe, Bed, ChevronDown, ChevronUp } from 'lucide-react';
import WinAutoOutreachButton from '@/components/landlord/WinAutoOutreachButton';
import AuroraPulseChips from '@/components/landlord/AuroraPulseChips';
import { PB } from '@/lib/pbTokens';

/**
 * ProjectIntelStrip
 * Shown at the top of the Landlords page when a project filter is active.
 * Computes real-time stats from the current filtered landlord list
 * cross-referenced with landlordPropertyMap (floor+layout) and properties.
 */
export default function ProjectIntelStrip({ landlords, landlordPropertyMap, properties, landlordProperties, projectId, projectName, isAdmin, activePulse, onPulseFilter }) {
  const stats = useMemo(() => {
    const total = landlords.length;
    const linked = landlords.filter(l => landlordPropertyMap[l.id]).length;
    const unlinked = total - linked;

    // Floor distribution
    const floorBuckets = { '1–10': 0, '11–20': 0, '21+': 0 };
    landlords.forEach(l => {
      const info = landlordPropertyMap[l.id];
      if (!info?.floor) return;
      if (info.floor <= 10) floorBuckets['1–10']++;
      else if (info.floor <= 20) floorBuckets['11–20']++;
      else floorBuckets['21+']++;
    });

    // Layout distribution
    const layoutCounts = {};
    landlords.forEach(l => {
      const info = landlordPropertyMap[l.id];
      if (!info?.layout) return;
      layoutCounts[info.layout] = (layoutCounts[info.layout] || 0) + 1;
    });

    // Language distribution
    const langCounts = {};
    landlords.forEach(l => {
      const lang = l.preferred_language || 'en';
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    });
    const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Nationality
    const natCounts = {};
    landlords.forEach(l => {
      if (!l.nationality) return;
      natCounts[l.nationality] = (natCounts[l.nationality] || 0) + 1;
    });
    const topNat = Object.entries(natCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Photography readiness
    const lpsForLandlords = new Set(landlords.map(l => l.id));
    const relevantLPs = landlordProperties.filter(lp => lpsForLandlords.has(lp.landlord_id));
    const photoReady = relevantLPs.filter(lp => lp.photography_status === 'professional_done').length;
    const hasMedia = relevantLPs.filter(lp => lp.has_360_tour || lp.has_drone_footage || lp.has_video_walkthrough).length;

    // Tenancy & mortgage
    const vacant = relevantLPs.filter(lp => lp.tenancy_status === 'vacant' || lp.currently_occupied === false).length;
    const mortgaged = relevantLPs.filter(lp => lp.mortgage_status && lp.mortgage_status !== 'free_hold_no_mortgage').length;
    const titleVerified = relevantLPs.filter(lp => lp.title_deed_verified).length;

    // Avg sqft
    const propsForProject = properties.filter(p =>
      landlordProperties.some(lp => lp.property_id === p.id && lpsForLandlords.has(lp.landlord_id))
    );
    const avgSqft = propsForProject.length
      ? Math.round(propsForProject.reduce((s, p) => s + (p.area_sqft || 0), 0) / propsForProject.filter(p => p.area_sqft).length)
      : null;

    // Win-branch auto-outreach target set (Initial Contact owners with a phone)
    const initialContact = landlords.filter((l) => l.stage === 'initial_contact' && l.phone);
    const initialContactIds = initialContact.map((l) => l.id);
    return { total, linked, unlinked, floorBuckets, layoutCounts, topLang, topNat, photoReady, hasMedia, vacant, mortgaged, titleVerified, avgSqft, initialContactCount: initialContact.length, initialContactIds };
  }, [landlords, landlordPropertyMap, properties, landlordProperties]);

  if (landlords.length === 0) return null;

  const LANG_LABELS = { en: 'EN', ar: 'AR', ru: 'RU', zh: 'ZH', hi: 'HI', fr: 'FR' };

  return (
    <ProjectIntelStripView
      stats={stats}
      LANG_LABELS={LANG_LABELS}
      projectId={projectId}
      projectName={projectName}
      isAdmin={isAdmin}
      landlords={landlords}
      activePulse={activePulse}
      onPulseFilter={onPulseFilter}
    />
  );
}

// One inline mini-stat: 1.5px lucide icon + tabular count, 35% opacity when zero.
function MiniStat({ icon: Icon, count, title }) {
  const zero = !count;
  return (
    <span className="flex items-center gap-1" style={{ opacity: zero ? 0.35 : 1 }} title={title}>
      <Icon className="w-3 h-3" strokeWidth={1.5} style={{ color: PB.SLATE, flex: 'none' }} />
      <span style={{ color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </span>
  );
}

function ProjectIntelStripView({ stats, LANG_LABELS, projectId, projectName, isAdmin, landlords, activePulse, onPulseFilter }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl px-3 py-2 mb-1"
      style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}
    >
      {/* Header row — always visible, clickable to toggle. AI auto-outreach lives here too. */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <Layers className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} style={{ color: PB.GOLD }} />
          <span className="text-[10px] font-bold uppercase shrink-0" style={{ color: PB.GOLD, letterSpacing: '0.08em' }}>Project Intelligence</span>
          <span className="text-[10px] shrink-0" style={{ color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>
            {stats.total} owners · {stats.linked} linked · {stats.unlinked} unlinked
          </span>
          {/* Inline mini-stats — always visible when collapsed, 1.5px lucide icons */}
          {!expanded && (
            <span className="flex items-center gap-3 ml-1">
              <span className="flex items-center gap-1" style={{ color: PB.SLATE }}>
                <Home className="w-3 h-3" strokeWidth={1.5} style={{ flex: 'none' }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.floorBuckets['1–10']}/{stats.floorBuckets['11–20']}/{stats.floorBuckets['21+']}</span>
              </span>
              <MiniStat icon={Camera} count={stats.photoReady} title="Photos done" />
              <MiniStat icon={Film} count={stats.hasMedia} title="Media (360/video)" />
              <MiniStat icon={BadgeCheck} count={stats.titleVerified} title="Title verified" />
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-3 h-3 ml-auto" strokeWidth={1.5} style={{ color: PB.SLATE }} />
            : <ChevronDown className="w-3 h-3 ml-auto" strokeWidth={1.5} style={{ color: PB.SLATE }} />}
        </button>

        {/* Aurora Pulse — the brain's live heartbeat, client-side from loaded landlords */}
        <AuroraPulseChips landlords={landlords} activePulse={activePulse} onPulseFilter={onPulseFilter} />

        {isAdmin && (
          <WinAutoOutreachButton
            projectId={projectId}
            projectName={projectName}
            initialCount={stats.initialContactCount}
            landlordIds={stats.initialContactIds}
          />
        )}
      </div>

      {/* Expandable detail grid — hairline wells, slate labels, thin gold accent bars */}
      {expanded && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
        {/* Floor distribution */}
        <div className="rounded-lg p-2" style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}>
          <p className="text-[9px] uppercase mb-1.5" style={{ color: PB.SLATE, letterSpacing: '0.06em' }}>Floor Split</p>
          {Object.entries(stats.floorBuckets).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[10px] mb-0.5">
              <span style={{ color: PB.SLATE }}>{k}</span>
              <div className="flex items-center gap-1">
                <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)', width: 44, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, (v / Math.max(stats.linked, 1)) * 100)}%`, background: PB.GOLD, borderRadius: 1, opacity: v ? 1 : 0.35 }} />
                </div>
                <span className="font-semibold w-4 text-right" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Layout distribution */}
        <div className="rounded-lg p-2" style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}>
          <p className="text-[9px] uppercase mb-1.5 flex items-center gap-1" style={{ color: PB.SLATE, letterSpacing: '0.06em' }}><Bed className="w-2.5 h-2.5" strokeWidth={1.5} /> Layout Mix</p>
          {Object.entries(stats.layoutCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[10px] mb-0.5">
              <span style={{ color: PB.SLATE }}>{k}</span>
              <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
          {stats.avgSqft && (
            <p className="text-[9px] mt-1" style={{ color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>Avg {stats.avgSqft.toLocaleString()} sqft</p>
          )}
        </div>

        {/* Languages & Nationalities */}
        <div className="rounded-lg p-2" style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}>
          <p className="text-[9px] uppercase mb-1.5 flex items-center gap-1" style={{ color: PB.SLATE, letterSpacing: '0.06em' }}><Globe className="w-2.5 h-2.5" strokeWidth={1.5} /> Language / Origin</p>
          {stats.topLang.map(([lang, count]) => (
            <div key={lang} className="flex items-center justify-between text-[10px] mb-0.5">
              <span style={{ color: PB.SLATE }}>{LANG_LABELS[lang] || lang.toUpperCase()}</span>
              <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            </div>
          ))}
          {stats.topNat.length > 0 && (
            <p className="text-[9px] mt-1" style={{ color: PB.SLATE }}>{stats.topNat.map(([n]) => n).join(', ')}</p>
          )}
        </div>

        {/* Unit readiness */}
        <div className="rounded-lg p-2" style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}>
          <p className="text-[9px] uppercase mb-1.5 flex items-center gap-1" style={{ color: PB.SLATE, letterSpacing: '0.06em' }}><Camera className="w-2.5 h-2.5" strokeWidth={1.5} /> Unit Readiness</p>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span style={{ color: PB.SLATE }}>Photos done</span>
            <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums', opacity: stats.photoReady ? 1 : 0.35 }}>{stats.photoReady}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span style={{ color: PB.SLATE }}>Media (360/video)</span>
            <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums', opacity: stats.hasMedia ? 1 : 0.35 }}>{stats.hasMedia}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span style={{ color: PB.SLATE }}>Title verified</span>
            <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums', opacity: stats.titleVerified ? 1 : 0.35 }}>{stats.titleVerified}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span style={{ color: PB.SLATE }}>Vacant</span>
            <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums', opacity: stats.vacant ? 1 : 0.35 }}>{stats.vacant}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: PB.SLATE }}>Mortgaged</span>
            <span className="font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums', opacity: stats.mortgaged ? 1 : 0.35 }}>{stats.mortgaged}</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}