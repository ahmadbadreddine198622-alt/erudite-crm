import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Youtube, HardDrive, ExternalLink } from 'lucide-react';
import { GOLD, GOLD_LITE, serif } from '@/lib/academyStyles';
import { parseVideoUrl } from './videoEmbed';

// Full-screen slide-deck player. One video at a time with Next / Previous.
// `videos` is the ordered list; `index` is the starting slide.
export default function VideoSlidePlayer({ videos, index, onIndexChange, onClose }) {
  const current = videos[index];
  const parsed = current ? parseVideoUrl(current.url) : null;

  const go = useCallback((dir) => {
    onIndexChange((i) => {
      const n = i + dir;
      if (n < 0) return videos.length - 1;
      if (n >= videos.length) return 0;
      return n;
    });
  }, [onIndexChange, videos.length]);

  // Keyboard controls — arrows to navigate, Esc to close.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!current) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(5,8,16,0.96)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {parsed?.type === 'youtube' ? <Youtube size={18} style={{ color: GOLD }} /> : parsed?.type === 'drive' ? <HardDrive size={18} style={{ color: GOLD }} /> : null}
          <span style={{ ...serif, fontSize: 18, color: GOLD_LITE }}>{current.title}</span>
          {current.category && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', color: GOLD_LITE }}>
              {current.category}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
            {index + 1} / {videos.length}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex' }} title="Close (Esc)">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 64px', minHeight: 0, position: 'relative' }}>
        {/* Prev */}
        {videos.length > 1 && (
          <button onClick={() => go(-1)} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 48, height: 64, borderRadius: 12, border: '1px solid rgba(212,175,55,0.25)',
            background: 'rgba(212,175,55,0.08)', color: GOLD, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="Previous (←)">
            <ChevronLeft size={26} />
          </button>
        )}

        <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(212,175,55,0.15)', background: '#000', boxShadow: '0 0 60px rgba(212,175,55,0.08)' }}>
            {parsed?.embedUrl ? (
              <iframe
                key={current.id + '-' + index}
                src={parsed.embedUrl}
                title={current.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.5)' }}>
                <p>Could not embed this link.</p>
                <a href={current.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: GOLD_LITE, textDecoration: 'none' }}>
                  Open in new tab <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
          {current.description && (
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: 760 }}>
              {current.description}
            </p>
          )}
        </div>

        {/* Next */}
        {videos.length > 1 && (
          <button onClick={() => go(1)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 48, height: 64, borderRadius: 12, border: '1px solid rgba(212,175,55,0.25)',
            background: 'rgba(212,175,55,0.08)', color: GOLD, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="Next (→)">
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      {/* Thumbnail filmstrip */}
      {videos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 24px 16px', overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {videos.map((v, i) => {
            const p = parseVideoUrl(v.url);
            const active = i === index;
            return (
              <button key={v.id} onClick={() => onIndexChange(i)} style={{
                flex: '0 0 auto', width: 120, borderRadius: 8, overflow: 'hidden',
                border: active ? '2px solid ' + GOLD : '1px solid rgba(255,255,255,0.1)',
                opacity: active ? 1 : 0.55, cursor: 'pointer', background: '#000', position: 'relative',
              }} title={v.title}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                  {p?.thumb ? (
                    <img src={p.thumb} alt={v.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : p?.type === 'drive' ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(90,147,224,0.12)' }}>
                      <HardDrive size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)' }}>
                      <Youtube size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                  )}
                </div>
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 6px', fontSize: 9, color: '#fff', background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {i + 1}. {v.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}