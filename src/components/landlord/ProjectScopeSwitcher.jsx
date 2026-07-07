// ProjectScopeSwitcher — pill-based project scope selector at the very top of the
// Landlord section. "All" + dynamic project pills sorted by landlord count.
// Controls the same filterProject state used by the rest of the page.

import React from 'react';
import { Building2 } from 'lucide-react';

const LDC = {
  gold: '#c9a24b', glite: '#e3c06a', ink: '#e8ecf6', slate: '#8b96b0', dim: '#5f6a85',
};

export default function ProjectScopeSwitcher({ options, value, onChange }) {
  // options: [{ id: '', label: 'All', count: N }, { id: 'proj-id', label: 'Peninsula 2', count: 367 }, ...]
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      <style>{`
        .pss-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: LDC.dim }} />
      {options.map((opt) => {
        const active = (value || '') === opt.id;
        return (
          <button
            key={opt.id || 'all'}
            onClick={() => onChange(opt.id)}
            className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200"
            style={{
              fontFamily: "'Inter',sans-serif",
              background: active
                ? 'linear-gradient(135deg, rgba(201,162,75,.22), rgba(201,162,75,.08))'
                : 'rgba(255,255,255,.035)',
              border: active
                ? '1px solid rgba(201,162,75,.55)'
                : '1px solid rgba(255,255,255,.08)',
              color: active ? LDC.glite : 'rgba(255,255,255,.6)',
              boxShadow: active ? '0 0 14px rgba(201,162,75,.18)' : 'none',
            }}
          >
            {opt.label}
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: active ? 'rgba(201,162,75,.2)' : 'rgba(255,255,255,.06)',
                color: active ? LDC.gold : LDC.dim,
              }}
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}