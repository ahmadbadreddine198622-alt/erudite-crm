// Lightweight modal shell for the Command Center action composers.
import React from 'react';
import { X } from 'lucide-react';
import { CARD_BG, GOLD } from './ccPrimitives';

export default function CCModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,9,16,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="cc-root" style={{ width: '100%', maxWidth: 520, background: CARD_BG, border: '1px solid rgba(201,162,75,0.25)', borderRadius: 16, padding: 18, fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span className="cc-title" style={{ fontSize: 19, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{title}</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <X className="w-4 h-4" style={{ color: GOLD }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}