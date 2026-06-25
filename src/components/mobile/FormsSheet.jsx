/**
 * FormsSheet — slide-up bottom sheet listing form types.
 * Matches the dark-glass dock aesthetic + safe-area padding.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FileSignature, FileText, FileBox, X } from 'lucide-react';

const FORM_ITEMS = [
  { label: 'Form A',           sub: 'DLD listing mandate',     icon: FileSignature, path: '/form-a-inbox',     color: 'rgba(245,158,11,0.9)' },
  { label: 'Form I',           sub: 'Property listing form',   icon: FileText,      path: '/form-i-generator', color: 'rgba(99,102,241,0.9)' },
  { label: 'Tenancy Contract', sub: 'Ejari tenancy contract',  icon: FileText,      path: '/tenancy-contracts',color: 'rgba(59,130,246,0.9)' },
  { label: 'Lease Agreement',  sub: 'Brokerage lease',         icon: FileBox,       path: '/lease-agreement',  color: 'rgba(148,163,184,0.9)' },
  { label: 'Offer',            sub: 'Buyer offer',             icon: FileSignature, path: '/offers',           color: 'rgba(6,182,212,0.9)' },
];

export default function FormsSheet({ onClose }) {
  const navigate = useNavigate();

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] md:hidden flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(12,16,32,0.94)',
          backdropFilter: 'blur(60px) saturate(280%)',
          WebkitBackdropFilter: 'blur(60px) saturate(280%)',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          border: '1px solid rgba(255,255,255,0.12)',
          borderBottom: 'none',
          boxShadow: '0 -16px 48px rgba(0,0,0,0.6)',
          padding: '14px 16px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 16px)',
          animation: 'forms-sheet-rise 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <style>{`
          @keyframes forms-sheet-rise {
            from { transform: translateY(100%); opacity: 0.5; }
            to   { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        {/* Grabber */}
        <div style={{ width: 38, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>Forms</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-2">
          {FORM_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item.path)}
                className="active:scale-[0.98] transition-transform"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', textAlign: 'left',
                  padding: '12px 14px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon style={{ width: 19, height: 19, color: item.color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{item.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}