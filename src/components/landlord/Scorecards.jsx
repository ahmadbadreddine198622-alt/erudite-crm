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

export default function Scorecards({ scorecards }) {
  if (!scorecards || !scorecards.length) return null;

  return (
    <div style={css("display:grid; grid-template-columns:repeat(4, 1fr); gap:11px; margin-top:14px; animation: ld-rise 0.5s cubic-bezier(0.22,1,0.36,1) both;")}>
      {scorecards.map((sc,i)=>(
        <div key={i} style={css("border-radius:13px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.03); padding:12px 13px;")}>
          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.42);")}>{sc.label}</div>
          <div style={css("display:flex; align-items:baseline; gap:3px; margin-top:5px;")}>
            <span style={{...css("font-size:19px; font-weight:800;"), color:sc.color}}>{sc.value}</span>
            <span style={css("font-size:10px; color:rgba(255,255,255,0.38);")}>{sc.unit}</span>
          </div>
          <div style={css("height:4px; border-radius:99px; background:rgba(255,255,255,0.08); margin-top:7px; overflow:hidden;")}><div style={sc.barStyle}></div></div>
          <div style={css("font-size:10px; color:rgba(255,255,255,0.4); margin-top:6px; line-height:1.4;")}>{sc.why}</div>
        </div>
      ))}
    </div>
  );
}