import React from 'react';

/* Convert a CSS declaration string into a React style object (preserves the design 1:1). */
function css(str) {
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
}

export default function DocumentsTab({ docs }) {
  if (!docs || !docs.length) {
    return (
      <div style={css("display:flex; flex-direction:column; gap:7px;")}>
        <div style={css("font-size:12.5px; color:rgba(255,255,255,0.5); padding:20px; text-align:center;")}>No documents yet</div>
      </div>
    );
  }

  return (
    <div style={css("display:flex; flex-direction:column; gap:7px;")}>
      {docs.map((dc)=>(
        <div key={dc.key || dc.label} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
          <div style={css("display:flex; align-items:center; gap:11px; min-width:0;")}>
            <span style={css("font-size:15px;")}>{dc.icon}</span>
            <div style={css("min-width:0;")}>
              <div style={css("font-size:13px; color:rgba(255,255,255,0.85);")}>{dc.label}</div>
              <div style={css("font-size:10.5px; color:rgba(255,255,255,0.42); margin-top:1px;")}>{dc.provider}</div>
            </div>
          </div>
          <span style={dc.statusStyle}>{dc.status}</span>
        </div>
      ))}
    </div>
  );
}