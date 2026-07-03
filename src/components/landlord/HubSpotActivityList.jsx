// HubSpotActivityList — flat, collapsible activity rows (HubSpot CRM style).
// Each row shows icon + title + subtitle (sender) + time + chevron.
// Click the row to expand/collapse the body.
//
// Props:
//   items      (array) — [{ key, icon, iconBg, iconColor, title, subtitle, time, body }]
//   emptyLabel (string) — centered placeholder when no items

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

export default function HubSpotActivityList({ items, emptyLabel = 'No activity yet' }) {
  const [expandedKey, setExpandedKey] = useState(null);

  if (!items || items.length === 0) {
    return (
      <div style={css("display:flex; align-items:center; justify-content:center; flex:1; color:rgba(255,255,255,0.35); font-size:13px; padding:40px 0;")}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={css("display:flex; flex-direction:column; gap:6px;")}>
      {items.map((item) => {
        const isOpen = expandedKey === item.key;
        return (
          <div key={item.key} style={css("border-radius:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); overflow:hidden; transition:border-color 0.12s ease;")}>
            <button
              onClick={() => setExpandedKey(isOpen ? null : item.key)}
              style={css("width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; background:none; border:none; cursor:pointer; text-align:left; font-family:'Inter',sans-serif;")}
            >
              {/* Icon */}
              <span style={{
                flex: 'none',
                width: '30px', height: '30px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px',
                background: item.iconBg || 'rgba(255,255,255,0.08)',
                color: item.iconColor || 'rgba(255,255,255,0.7)',
              }}>
                {item.icon}
              </span>
              {/* Title + subtitle */}
              <span style={css("flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;")}>
                <span style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{item.title}</span>
                {item.subtitle && (
                  <span style={css("font-size:10.5px; color:rgba(255,255,255,0.5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{item.subtitle}</span>
                )}
              </span>
              {/* Time */}
              <span style={css("flex:none; font-size:10px; color:rgba(255,255,255,0.4); white-space:nowrap;")}>{item.time}</span>
              {/* Chevron */}
              <ChevronDown size={14} style={{
                flex: 'none',
                color: 'rgba(255,255,255,0.4)',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }} />
            </button>
            {/* Expanded body */}
            {isOpen && item.body && (
              <div style={css("padding:0 12px 11px 52px; font-size:12px; line-height:1.55; color:rgba(255,255,255,0.72); white-space:pre-wrap;")}>
                {item.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}