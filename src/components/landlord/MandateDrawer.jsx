import React from 'react';
import { FileText, ArrowLeftRight } from 'lucide-react';

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

export default function MandateDrawer({ mandate }) {
  if (!mandate) {
    return (
      <div style={css("margin-top:12px; border-radius:11px; border:1px solid rgba(255,255,255,0.08); background:#16181d; padding:16px 18px;")}>
        <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:12px;")}>
          <div style={css("display:flex; alignItems:center; gap:6px;")}>
            <ArrowLeftRight className="w-4 h-4" style={css("color:hsl(38 92% 60%);")} />
          </div>
          <span style={css("font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>Mandate</span>
        </div>
        <p style={css("margin:0; font-size:13px; line-height:1.6; color:rgba(255,255,255,0.45);")}>No mandate yet — upload Form A to get started.</p>
      </div>
    );
  }

  return (
    <React.Fragment>
      {/* Main mandate drawer */}
      <div style={css("margin-top:12px; border-radius:11px; border:1px solid rgba(255,255,255,0.08); background:#16181d; padding:16px 18px;")}>
        {/* Header */}
        <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;")}>
          <div style={css("display:flex; align-items:center; gap:8px;")}>
            <ArrowLeftRight className="w-4 h-4" style={css("color:hsl(38 92% 60%);")} />
            <span style={css("font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>Mandate</span>
          </div>
          <span style={css("display:inline-flex; align-items:center; padding:4px 10px; borderRadius:99px; fontSize:10px; fontWeight:700; background:#1b3127; border:1px solid rgba(85,217,147,0.3); color:#55d992;")}>
            {mandate.status}
          </span>
        </div>

        {/* Data Grid */}
        <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;")}>
          <div style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#6b7280;")}>Type</div>
            <div style={css("font-size:13px; font-weight:600; margin-top:4px; color:#ffffff;")}>{mandate.type}</div>
          </div>
          <div style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#6b7280;")}>Asking Price</div>
            <div style={css("font-size:13px; font-weight:600; margin-top:4px; color:hsl(38 92% 60%);")}>{mandate.askingPrice}</div>
          </div>
          <div style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#6b7280;")}>Commission</div>
            <div style={css("font-size:13px; font-weight:600; margin-top:4px; color:#ffffff;")}>{mandate.commission}</div>
          </div>
          <div style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#6b7280;")}>Contract #</div>
            <div style={css("font-size:13px; font-weight:600; margin-top:4px; color:#ffffff;")}>{mandate.contractNumber}</div>
          </div>
          <div style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#6b7280;")}>Start Date</div>
            <div style={css("font-size:13px; font-weight:600; margin-top:4px; color:#ffffff;")}>{mandate.startDate}</div>
          </div>
          <div style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#6b7280;")}>Expiry Date</div>
            <div style={css("font-size:13px; font-weight:600; margin-top:4px; color:#ffffff;")}>{mandate.expiryDate}</div>
          </div>
        </div>

        {/* View PDF Button */}
        {mandate.pdfUrl && (
          <a href={mandate.pdfUrl} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:8px; background:rgba(245,166,35,0.08); border:1px solid hsl(38 92% 60% / 0.4); color:hsl(38 92% 60%); fontSize:11px; fontWeight:600; textDecoration:none;")}>
            <FileText className="w-3.5 h-3.5" />
            View Form A PDF →
          </a>
        )}
      </div>

      {/* Additional contracts */}
      {mandate.contracts && mandate.contracts.length > 0 && (
        <div style={css("margin-top:12px;")}>
          <div style={css("font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:8px;")}>Additional Contracts</div>
          <div style={css("display:flex; flex-direction:column; gap:6px;")}>
            {mandate.contracts.map((c, i) => (
              <div key={i} style={css("border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:10px 12px;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;")}>
                  <div style={css("font-size:12px; font-weight:600; color:rgba(255,255,255,0.85);")}>{c.contractNumber !== '—' ? `Contract ${c.contractNumber}` : c.unit}</div>
                  <span style={css("display:inline-flex; align-items:center; padding:3px 8px; borderRadius:99px; fontSize:9px; fontWeight:700; background:rgba(139,92,246,0.14); border:1px solid rgba(139,92,246,0.32); color:#c4b5fd;")}>{c.type}</span>
                </div>
                <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:6px;")}>
                  <div style={css("font-size:10.5px; color:rgba(255,255,255,0.5);")}>Unit: <span style={css("color:rgba(255,255,255,0.8);")}>{c.unit}</span></div>
                  <div style={css("font-size:10.5px; color:rgba(255,255,255,0.5);")}>Asking: <span style={css("color:hsl(38 92% 60%);")}>{c.askingPrice}</span></div>
                  <div style={css("font-size:10.5px; color:rgba(255,255,255,0.5);")}>Start: <span style={css("color:rgba(255,255,255,0.8);")}>{c.startDate}</span></div>
                  <div style={css("font-size:10.5px; color:rgba(255,255,255,0.5);")}>Expiry: <span style={css("color:rgba(255,255,255,0.8);")}>{c.expiryDate}</span></div>
                </div>
                {c.pdfUrl && (
                  <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:4px; margin-top:8px; fontSize:10px; fontWeight:600; color:hsl(38 92% 60%); textDecoration:none;")}>
                    <FileText className="w-3 h-3" /> View PDF
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