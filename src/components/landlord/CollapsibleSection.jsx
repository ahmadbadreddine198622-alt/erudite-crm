import React from 'react';
import { ChevronDown } from 'lucide-react';

const css = (str) => {
  const o = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  });
  return o;
};

export default function CollapsibleSection({ icon: Icon, title, count, children, isOpen, onToggle, defaultOpen = false }) {
  return (
    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); overflow:hidden; margin-top:16px; animation: ld-rise 0.47s cubic-bezier(0.22,1,0.36,1) both;")}>
      <button 
        onClick={onToggle}
        style={css("width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 13px; background:transparent; border:none; cursor:pointer; transition:background 0.15s ease;")}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={css("display:flex; align-items:center; gap:8px;")}>
          {Icon && <Icon className="w-5 h-5" style={css("color:#E69D43;")} />}
          <span style={css("font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#888E96;")}>{title}</span>
        </div>
        <div style={css("display:flex; align-items:center; gap:8px;")}>
          {count > 0 && <span style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.4);")}>{count}</span>}
          <ChevronDown className={"w-4 h-4 transition-transform duration-200 " + (isOpen ? 'rotate-180' : '')} style={css("color:rgba(255,255,255,0.4);")} />
        </div>
      </button>
      {isOpen && (
        <div style={css("padding:0 13px 13px;")}>
          {children}
        </div>
      )}
    </div>
  );
}