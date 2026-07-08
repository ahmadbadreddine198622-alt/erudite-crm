// LandlordNavArrows — prev/next landlord navigation arrows for the page header.
// Fetches all landlord IDs ordered by updated_date descending, finds the
// current landlord's position, and offers arrow-key + click navigation.
// Keeps the current tab/composer type when navigating.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function LandlordNavArrows({ currentId }) {
  const navigate = useNavigate();
  const [ids, setIds] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await base44.entities.Landlord.filter({}, '-updated_date', 500);
        if (mounted) setIds((list || []).map(l => l.id));
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  const idx = ids.indexOf(currentId);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < ids.length - 1;
  const loading = !ids.length;

  const go = useCallback((dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ids.length) return;
    navigate(`/landlord/${ids[newIdx]}`);
  }, [idx, ids, navigate]);

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

  const btnStyle = (enabled) => ({
    flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7, cursor: enabled ? 'pointer' : 'not-allowed',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
    color: enabled ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', transition: 'all 0.12s',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => go(-1)} disabled={!hasPrev} title="Previous landlord (←)" style={btnStyle(hasPrev)}>
        <ChevronLeft size={15} />
      </button>
      <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.35)', minWidth: 28, textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
        {loading ? '…' : (idx >= 0 ? (idx + 1) + '/' + ids.length : '—')}
      </span>
      <button onClick={() => go(1)} disabled={!hasNext} title="Next landlord (→)" style={btnStyle(hasNext)}>
        <ChevronRight size={15} />
      </button>
    </div>
  );
}