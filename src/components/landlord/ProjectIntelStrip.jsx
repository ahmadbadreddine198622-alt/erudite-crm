import React, { useMemo } from 'react';
import { Layers, Home, Camera, FileText, Globe, Bed } from 'lucide-react';

/**
 * ProjectIntelStrip
 * Shown at the top of the Landlords page when a project filter is active.
 * Computes real-time stats from the current filtered landlord list
 * cross-referenced with landlordPropertyMap (floor+layout) and properties.
 */
export default function ProjectIntelStrip({ landlords, landlordPropertyMap, properties, landlordProperties }) {
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

    return { total, linked, unlinked, floorBuckets, layoutCounts, topLang, topNat, photoReady, hasMedia, vacant, mortgaged, titleVerified, avgSqft };
  }, [landlords, landlordPropertyMap, properties, landlordProperties]);

  if (landlords.length === 0) return null;

  const LANG_LABELS = { en: '🇬🇧 EN', ar: '🇦🇪 AR', ru: '🇷🇺 RU', zh: '🇨🇳 ZH', hi: '🇮🇳 HI', fr: '🇫🇷 FR' };

  return (
    <div
      className="rounded-xl p-3 mb-3"
      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Layers className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Project Intelligence</span>
        <span className="text-[10px] text-white/30 ml-1">{stats.total} owners · {stats.linked} linked units · {stats.unlinked} unlinked</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Floor distribution */}
        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5">Floor Split</p>
          {Object.entries(stats.floorBuckets).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-white/50">{k}</span>
              <div className="flex items-center gap-1">
                <div className="h-1.5 rounded-full bg-amber-500/30" style={{ width: Math.max(4, (v / Math.max(stats.linked, 1)) * 48) }} />
                <span className="text-white/70 font-semibold tabular-nums w-4 text-right">{v}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Layout distribution */}
        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5 flex items-center gap-1"><Bed className="w-2.5 h-2.5" /> Layout Mix</p>
          {Object.entries(stats.layoutCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-white/50">{k}</span>
              <span className="text-white/70 font-semibold tabular-nums">{v}</span>
            </div>
          ))}
          {stats.avgSqft && (
            <p className="text-[9px] text-white/30 mt-1">Avg {stats.avgSqft} sqft</p>
          )}
        </div>

        {/* Languages & Nationalities */}
        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5 flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> Language / Origin</p>
          {stats.topLang.map(([lang, count]) => (
            <div key={lang} className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-white/50">{LANG_LABELS[lang] || lang.toUpperCase()}</span>
              <span className="text-white/70 font-semibold tabular-nums">{count}</span>
            </div>
          ))}
          {stats.topNat.length > 0 && (
            <p className="text-[9px] text-white/30 mt-1">{stats.topNat.map(([n]) => n).join(', ')}</p>
          )}
        </div>

        {/* Unit readiness */}
        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5 flex items-center gap-1"><Camera className="w-2.5 h-2.5" /> Unit Readiness</p>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-white/50">Photos done</span>
            <span className="text-emerald-400 font-semibold tabular-nums">{stats.photoReady}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-white/50">Media (360/video)</span>
            <span className="text-blue-400 font-semibold tabular-nums">{stats.hasMedia}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-white/50">Title verified</span>
            <span className="text-emerald-400 font-semibold tabular-nums">{stats.titleVerified}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-white/50">Vacant</span>
            <span className="text-amber-400 font-semibold tabular-nums">{stats.vacant}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/50">Mortgaged</span>
            <span className="text-orange-400 font-semibold tabular-nums">{stats.mortgaged}</span>
          </div>
        </div>
      </div>
    </div>
  );
}