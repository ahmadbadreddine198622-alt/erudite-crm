import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

/**
 * Reusable slide-up glass bottom sheet for the mobile dock launchers.
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - title: string
 *  - sections: [{ header?: string, rows: [{ label, icon, path }] }]
 */
export default function NavLauncherSheet({ open, onClose, title, sections = [] }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true">
      {/* Dimmed / blurred backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(4, 8, 18, 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'nav-sheet-fade 0.2s ease both',
        }}
      />

      {/* Sheet */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          background: 'rgba(12, 18, 35, 0.94)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          border: '1px solid rgba(255,255,255,0.15)',
          borderBottom: 'none',
          borderTopColor: 'rgba(255,255,255,0.28)',
          boxShadow: '0 -16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          animation: 'nav-sheet-up 0.32s cubic-bezier(0.22,1,0.36,1) both',
          maxHeight: '78vh',
          overflowY: 'auto',
        }}
      >
        <style>{`
          @keyframes nav-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes nav-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        {/* Grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.22)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="active:scale-90 transition-transform"
            style={{
              width: 32, height: 32, borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.7)' }} />
          </button>
        </div>

        {/* Sections */}
        <div className="px-3 pb-4">
          {sections.map((section, si) => (
            <div key={si} className={si > 0 ? 'mt-4' : ''}>
              {section.header && (
                <div
                  className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'hsl(38 92% 55%)' }}
                >
                  {section.header}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {section.rows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.path}
                      onClick={() => go(row.path)}
                      className="flex items-center gap-3 px-3 py-3 rounded-2xl active:scale-[0.98] transition-transform"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        style={{
                          width: 38, height: 38, borderRadius: 12,
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.14)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.88)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {row.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}