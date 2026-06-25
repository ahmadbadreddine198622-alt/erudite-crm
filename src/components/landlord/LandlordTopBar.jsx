import React from 'react';

/* Convert a CSS declaration string into a React style object. */
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

/*
 * Top banner bar for the Landlord Intelligence page: Back + Close-all on the left,
 * centered "Landlord Intelligence" pill, and the landlord switcher on the right.
 * On mobile a "Details" toggle is shown to open the right-hand details panel overlay.
 */
export default function LandlordTopBar({ onBack, onCollapseAll, currentId, landlordOptions, onSwitch, isMobile, showDetails, onToggleDetails }) {
  return (
    <div style={css("flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 18px 10px; border-bottom:1px solid rgba(255,255,255,0.08); background:linear-gradient(180deg, rgba(15,18,28,0.95), rgba(10,12,20,0.98)); backdrop-filter:blur(16px);")}>
      <div style={css("display:flex; align-items:center; gap:6px; padding-left:50px;")}>
        <button onClick={onBack} title="Back" style={css("flex:none; display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px; border:1px solid rgba(204,170,102,0.2); background:rgba(38,35,34,0.95); cursor:pointer;")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccaa66" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </button>
        <button onClick={onCollapseAll} title="Close all open panels" style={css("flex:none; display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 12px; border-radius:9px; border:1px solid rgba(96,165,250,0.35); background:rgba(96,165,250,0.1); color:#93c5fd; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
          <span style={css("font-size:13px; line-height:1;")}>⊟</span> Close all
        </button>
      </div>

      {!isMobile && (
        <div style={css("flex:1; display:flex; align-items:center; justify-content:center;")}>
          <div style={css("display:inline-flex; align-items:center; gap:9px; padding:7px 18px; border-radius:99px; background:linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02)); border:1px solid hsl(38 92% 50% / 0.25); box-shadow:0 4px 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.05);")}>
            <div style={css("width:6px; height:6px; border-radius:50%; background:hsl(38 92% 55%); box-shadow:0 0 12px hsl(38 92% 55% / 0.8), 0 0 24px hsl(38 92% 50% / 0.5); animation: ld-pulse 2s ease-in-out infinite;")}></div>
            <span style={css("font-size:11px; font-weight:800; letter-spacing:0.22em; text-transform:uppercase; background:linear-gradient(135deg, hsl(38 92% 62%), hsl(38 92% 50%)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; text-shadow:0 2px 10px rgba(245,158,11,0.3);")}>Landlord Intelligence</span>
          </div>
        </div>
      )}

      <div style={css("display:flex; align-items:center; gap:10px;")}>
        {isMobile && (
          <button onClick={onToggleDetails} style={css("flex:none; height:34px; padding:0 12px; border-radius:9px; border:1px solid hsl(38 92% 50% / 0.4); background:hsl(38 92% 50% / 0.12); color:hsl(38 92% 62%); font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
            {showDetails ? '✕ Close' : 'Details'}
          </button>
        )}
        {!isMobile && <span style={css("font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Viewing</span>}
        <select value={currentId} onChange={onSwitch} style={css("padding:9px 13px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.88); font-size:12.5px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer; min-width:120px;")}>
          {landlordOptions.map(o => (
            <option key={o.id} value={o.id} style={{ background: '#13182a' }}>{o.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}