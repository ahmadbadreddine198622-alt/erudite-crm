/**
 * AppPickerSheet — Reusable bottom-sheet modal for picking apps to add.
 */

import React from 'react';
import { X } from 'lucide-react';
import { ALL_APPS } from '@/lib/navApps';

export default function AppPickerSheet({ currentItems, onAdd, onClose, title = 'Add to Dashboard' }) {
  const available = ALL_APPS.filter(a => !currentItems.find(c => c.path === a.path));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{
          background: 'rgba(12,16,28,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderTopColor: 'rgba(255,255,255,0.20)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
          maxHeight: '72dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <p className="text-sm font-semibold text-white/80">{title}</p>
          <button onPointerDown={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="overflow-y-auto pb-8 px-4" style={{ maxHeight: '56dvh' }}>
          <div className="grid grid-cols-4 gap-x-3 gap-y-5">
            {available.map(app => {
              const Icon = app.icon;
              return (
                <button
                  key={app.path}
                  onPointerDown={() => onAdd(app)}
                  className="flex flex-col items-center gap-1.5 select-none"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div style={{
                    width: 52, height: 52,
                    borderRadius: `${Math.round(52 * 0.245)}px`,
                    position: 'relative',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.50)',
                  }}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${app.gradient}`}
                      style={{ borderRadius: `${Math.round(52 * 0.245)}px` }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: `${Math.round(52 * 0.245)}px`,
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderTopColor: 'rgba(255,255,255,0.30)',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: `${Math.round(52 * 0.245)}px`,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0) 55%)',
                      pointerEvents: 'none',
                    }} />
                    <Icon style={{
                      position: 'absolute', width: Math.round(52 * 0.55), height: Math.round(52 * 0.55),
                      top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      color: 'rgba(255,255,255,0.95)', strokeWidth: 2.2, zIndex: 2,
                      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.65))',
                    }} />
                  </div>
                  <span className="text-[9px] text-white/60 text-center leading-tight max-w-[56px]">{app.label}</span>
                </button>
              );
            })}
          </div>
          {available.length === 0 && (
            <p className="text-white/40 text-sm text-center py-8">All apps are already added</p>
          )}
        </div>
      </div>
    </div>
  );
}