// LandlordNavArrows — prev/next landlord navigation for the detail page.
// Loads the FULL landlord ID set (paged via loadAllLandlords) so navigation
// works across every record, not just the last 500. Renders:
//   1. a compact inline cluster in the header, and
//   2. a prominent always-visible floating dock (fixed, bottom-center) so you
//      can jump to the prev/next landlord from anywhere on the page, any time.
// Arrow-key shortcuts work in both.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';

export default function LandlordNavArrows({ currentId }) {
  const navigate = useNavigate();
  const [ids, setIds] = useState([]);

  // Load every landlord ID via the paginated service-role endpoint (same source
  // as the board) so next/prev spans the whole book, not a 500-row window.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = [];
        const limit = 1000;
        const MAX_PAGES = 40;
        const PARALLEL = 5;
        const fetchPage = async (skip) => {
          const res = await base44.functions.invoke('loadAllLandlords', { skip, limit });
          const data = res?.data ?? res;
          return { page: (data?.landlords || []).map((l) => l.id), hasMore: !!data?.hasMore };
        };
        let { page, hasMore } = await fetchPage(0);
        all.push(...page);
        let fetched = 1;
        while (hasMore && fetched < MAX_PAGES) {
          const count = Math.min(PARALLEL, MAX_PAGES - fetched);
          const round = await Promise.all(
            Array.from({ length: count }, (_, i) => fetchPage((fetched + i) * limit)),
          );
          round.forEach((r) => all.push(...r.page));
          hasMore = round[round.length - 1].hasMore;
          fetched += count;
        }
        if (mounted) setIds(all);
      } catch {
        // Fallback to the lightweight 500-row list so the arrows still work.
        try {
          const list = await base44.entities.Landlord.filter({}, '-updated_date', 500);
          if (mounted) setIds((list || []).map((l) => l.id));
        } catch { /* silent */ }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const idx = ids.indexOf(currentId);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < ids.length - 1;
  const loading = !ids.length;

  const go = useCallback((dir) => {
    if (loading) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ids.length) return;
    navigate(`/landlord/${ids[newIdx]}`);
  }, [idx, ids, loading, navigate]);

  // Keyboard shortcuts — skip when typing in inputs/textareas.
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go]);

  const counter = loading ? '' : (idx >= 0 ? `${idx + 1} / ${ids.length}` : '—');

  // ── Compact inline cluster (header) ──
  const inlineBtn = (enabled) => ({
    flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8, cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
    border: enabled ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.08)',
    color: enabled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)', transition: 'all 0.12s',
  });

  const InlineCluster = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => go(-1)} disabled={!hasPrev} title="Previous landlord (←)" style={inlineBtn(hasPrev)}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', minWidth: 44, textAlign: 'center', fontFamily: "'Inter',sans-serif", fontVariantNumeric: 'tabular-nums' }}>
        {counter}
      </span>
      <button onClick={() => go(1)} disabled={!hasNext} title="Next landlord (→)" style={inlineBtn(hasNext)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );

  // ── Always-visible floating dock (fixed, bottom-center) ──
  // Gold elevated buttons — Private Bank × Light: champagne gradient fill, thin
  // near-white rim, soft elevation. Disabled buttons drop to the deeper gold shade.
  const GOLD = '#C6A15B';
  const GOLD_DEEP = '#A07C48';
  const dockBtn = (enabled) => ({
    flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 46, height: 46, borderRadius: 13, cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled
      ? 'linear-gradient(155deg, #D9B36C, #C6A15B 52%, #A88443)'
      : `linear-gradient(155deg, ${GOLD_DEEP}, ${GOLD_DEEP}cc)`,
    border: enabled
      ? '1px solid rgba(240,240,240,0.55)'
      : '1px solid rgba(240,240,240,0.18)',
    color: enabled ? '#111A33' : 'rgba(17,26,51,0.45)',
    boxShadow: enabled
      ? '0 6px 18px rgba(0,0,0,0.5), 0 2px 6px rgba(198,161,91,0.35), inset 0 1px 0 rgba(255,255,255,0.4)'
      : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  });

  const FloatingDock = (
    <div style={{
      position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
      zIndex: 90, display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 9px', borderRadius: 18,
      background: 'rgba(11,16,32,0.88)', backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid rgba(198,161,91,0.22)',
      boxShadow: '0 16px 44px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <button onClick={() => go(-1)} disabled={!hasPrev} title="Previous landlord (←)" style={dockBtn(hasPrev)}>
        <ChevronLeft size={21} strokeWidth={2} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 74, padding: '0 6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: GOLD, textTransform: 'uppercase' }}>
          <Users size={10} strokeWidth={1.5} /> Landlord
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#F0F0F0', fontFamily: "'Inter',sans-serif", fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {counter}
        </span>
      </div>
      <button onClick={() => go(1)} disabled={!hasNext} title="Next landlord (→)" style={dockBtn(hasNext)}>
        <ChevronRight size={21} strokeWidth={2} />
      </button>
    </div>
  );

  return (
    <>
      {InlineCluster}
      {FloatingDock}
    </>
  );
}