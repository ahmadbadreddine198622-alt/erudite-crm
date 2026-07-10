import React from 'react';
import { DollarSign } from 'lucide-react';

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

const fmtAED = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return 'AED ' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
  if (n >= 1_000) return 'AED ' + Math.round(n / 1_000) + 'K';
  return 'AED ' + n;
};

// Commission pipeline summary strip — now lives inside the Pipeline tab.
export default function CommissionPipelineCard({ commissionPct, askingPriceAed, formAContractsCount = 0, onClick }) {
  return (
    <div
      style={css("display:flex; align-items:center; gap:10px; padding:10px 13px; border-radius:11px; background:rgba(62,53,37,0.6); border:1px solid rgba(230,157,67,0.3); cursor:pointer;")}
      onClick={onClick}
    >
      <div style={css("display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:9px; background:rgba(62,53,37,0.8); border:1px solid rgba(230,157,67,0.4);")}>
        <DollarSign className="w-5 h-5" style={css("color:#E69D43;")} />
      </div>
      <div style={css("flex:1; min-width:0;")}>
        <div style={css("font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#888E96;")}>Commission Pipeline</div>
        {commissionPct != null ? (
          <div style={css("font-size:13px; font-weight:700; color:#E69D43; margin-top:2px;")}>
            {commissionPct}% {askingPriceAed ? `· ${fmtAED(askingPriceAed * (commissionPct / 100))}` : ''}
          </div>
        ) : formAContractsCount > 0 ? (
          <div style={css("font-size:13px; font-weight:700; color:#E69D43; margin-top:2px;")}>
            {formAContractsCount} Form A {formAContractsCount === 1 ? 'Contract' : 'Contracts'}
          </div>
        ) : (
          <div style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.4); margin-top:2px;")}>
            No commission yet
          </div>
        )}
      </div>
    </div>
  );
}