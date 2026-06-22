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

export default function MandatePanel({ mandate }) {
  if (!mandate) {
    return (
      <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
        <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14l3 3-3 3"/><path d="M15 14l-3 3 3 3"/><path d="M2 12h20"/><path d="M2 12l5-5m0 10l-5-5"/></svg>
          <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Mandate</span>
        </div>
        <p style={css("margin:0; font-size:13px; line-height:1.6; color:rgba(255,255,255,0.5);")}>No mandate yet — upload Form A to get started.</p>
      </div>
    );
  }

  return (
    <React.Fragment>
      {/* Main mandate card */}
      <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
        <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;")}>
          <div style={css("display:flex; align-items:center; gap:8px;")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 60%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14l3 3-3 3"/><path d="M15 14l-3 3 3 3"/><path d="M2 12h20"/><path d="M2 12l5-5m0 10l-5-5"/></svg>
            <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Mandate</span>
          </div>
          <span style={css("display:inline-flex; align-items:center; padding:4px 10px; borderRadius:99px; fontSize:11px; fontWeight:700; background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.32); color:#34d399;")}>{mandate.status}</span>
        </div>

        <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;")}>
          <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Type</div>
            <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{mandate.type}</div>
          </div>
          <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Asking Price</div>
            <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:hsl(38 92% 60%);")}>{mandate.askingPrice}</div>
          </div>
          <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Commission</div>
            <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{mandate.commission}</div>
          </div>
          <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Contract #</div>
            <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{mandate.contractNumber}</div>
          </div>
          <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Start Date</div>
            <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{mandate.startDate}</div>
          </div>
          <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Expiry Date</div>
            <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{mandate.expiryDate}</div>
          </div>
        </div>

        {mandate.pdfUrl && (
          <a href={mandate.pdfUrl} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:7px; padding:8px 12px; border-radius:9px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); color:hsl(38 92% 60%); fontSize:11.5px; fontWeight:600; textDecoration:none;")}>
            <span style={css("font-size:14px;")}>📄</span> View Form A PDF →
          </a>
        )}
      </div>

      {/* Multiple contracts list */}
      {mandate.contracts && mandate.contracts.length > 0 && (
        <div style={css("margin-top:14px;")}>
          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:8px;")}>Additional Contracts</div>
          <div style={css("display:flex; flex-direction:column; gap:7px;")}>
            {mandate.contracts.map((c, i) => (
              <div key={i} style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;")}>
                  <div style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);")}>{c.contractNumber !== '—' ? `Contract ${c.contractNumber}` : c.unit}</div>
                  <span style={css("display:inline-flex; align-items:center; padding:3px 8px; borderRadius:99px; fontSize:10px; fontWeight:700; background:rgba(139,92,246,0.14); border:1px solid rgba(139,92,246,0.32); color:#c4b5fd;")}>{c.type}</span>
                </div>
                <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:8px;")}>
                  <div style={css("font-size:11px; color:rgba(255,255,255,0.5);")}>Unit: <span style={css("color:rgba(255,255,255,0.8);")}>{c.unit}</span></div>
                  <div style={css("font-size:11px; color:rgba(255,255,255,0.5);")}>Asking: <span style={css("color:hsl(38 92% 60%);")}>{c.askingPrice}</span></div>
                  <div style={css("font-size:11px; color:rgba(255,255,255,0.5);")}>Start: <span style={css("color:rgba(255,255,255,0.8);")}>{c.startDate}</span></div>
                  <div style={css("font-size:11px; color:rgba(255,255,255,0.5);")}>Expiry: <span style={css("color:rgba(255,255,255,0.8);")}>{c.expiryDate}</span></div>
                </div>
                {c.pdfUrl && (
                  <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:5px; margin-top:8px; fontSize:10.5px; fontWeight:600; color:hsl(38 92% 60%); textDecoration:none;")}>
                    📄 View PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}