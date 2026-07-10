// EmailList — collapsible email cards for the Emails tab on the landlord detail page.
// Collapsed: subject (bold) + "by {sender}" + date/time + chevron.
// Expanded: full email body (plain text, pre-wrap).

import React, { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';

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

export default function EmailList({ items, emptyLabel = 'No emails yet' }) {
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
        const border = isOpen ? 'hsl(38 92% 50% / 0.5)' : 'rgba(255,255,255,0.08)';
        return (
          <div key={item.key} style={css("border-radius:10px; border:1px solid " + border + "; background:rgba(255,255,255,0.03); overflow:hidden; transition:border-color 0.12s ease;")}>
            <button
              onClick={() => setExpandedKey(isOpen ? null : item.key)}
              style={css("width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; background:none; border:none; cursor:pointer; text-align:left; font-family:'Inter',sans-serif;")}
            >
              <span style={{ flex: 'none', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(38 92% 50% / 0.15)' }}>
                <Mail size={15} style={{ color: 'hsl(38 92% 62%)' }} />
              </span>
              <span style={css("flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;")}>
                <span style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{item.subject || '(no subject)'}</span>
                {item.sender && (
                  <span style={css("font-size:10.5px; color:rgba(255,255,255,0.5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>by {item.sender}</span>
                )}
              </span>
              <span style={css("flex:none; font-size:10px; color:rgba(255,255,255,0.4); white-space:nowrap;")}>{item.time}</span>
              <ChevronDown size={14} style={{ flex: 'none', color: 'rgba(255,255,255,0.4)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>
            {isOpen && (
              <div style={css("padding:2px 12px 12px 52px; font-size:12px; line-height:1.55; color:rgba(255,255,255,0.78); white-space:pre-wrap;")}>
                {item.body || '(empty body)'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}