import React from 'react';

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

export default function ContactEvaluation({ valuation, comps }) {
  if (!valuation && (!comps || comps.length === 0)) {
    return (
      <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
        <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
          <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Contact Evaluation</span>
        </div>
        <p style={css("margin:0; font-size:13px; line-height:1.6; color:rgba(255,255,255,0.5);")}>No evaluation data available for Peninsula 2.</p>
      </div>
    );
  }

  return (
    <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
      <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;")}>
        <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Contact Evaluation</span>
        {valuation && valuation.confLabel && (
          <span style={valuation.confStyle}>{valuation.confLabel}</span>
        )}
      </div>
      
      {valuation && (
        <React.Fragment>
          <div style={css("display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px;")}>
            <div>
              <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>AI Estimated Value</div>
              <div style={css("display:flex; align-items:baseline; gap:9px; margin-top:4px;")}>
                <span style={css("font-size:24px; font-weight:800; color:rgba(255,255,255,0.96);")}>{valuation.estValue}</span>
                <span style={css("font-size:13px; color:hsl(38 92% 60%); font-weight:600;")}>{valuation.psf}</span>
              </div>
            </div>
          </div>
          <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.6); padding:9px 11px; border-radius:9px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); margin-bottom:13px;")}>
            {valuation.basis} <span style={css("opacity:0.6;")}>· {valuation.updatedAt}</span>
          </div>
        </React.Fragment>
      )}

      {comps && comps.length > 0 && (
        <React.Fragment>
          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:7px;")}>Comparable Units · DLD</div>
          <div style={css("display:flex; flex-direction:column; gap:6px;")}>
            {comps.map((comp, i) => (
              <div key={i} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 11px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);")}>
                <div style={css("min-width:0;")}>
                  <div style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);")}>{comp.ref}</div>
                  <div style={css("font-size:11px; color:rgba(255,255,255,0.45); margin-top:1px;")}>{comp.note}</div>
                </div>
                <div style={css("text-align:right; flex:none;")}>
                  <div style={css("font-size:13px; font-weight:700; color:rgba(255,255,255,0.9);")}>{comp.price}</div>
                  {comp.psf && (
                    <div style={css("font-size:10.5px; color:hsl(38 92% 58%); margin-top:1px;")}>{comp.psf}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}