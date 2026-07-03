// Connected systems, scorecards, risk signals, AI summary, contact evaluation and market
// intelligence — moved here from the right-panel sidebar so they live inside the Info tab.
import React from 'react';
import Scorecards from '@/components/landlord/Scorecards';
import RiskSignals from '@/components/landlord/RiskSignals';
import ContactEvaluation from '@/components/landlord/ContactEvaluation';

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

export default function LandlordInfoExtras({ connections, showSignals, scorecards, signals, flagChips, buyChips, hasFlags, summaryText, valuation, market, askingPrice, propertyName }) {
  return (
    <React.Fragment>
      {/* connections strip */}
      <div style={css("margin-top:14px; animation: ld-rise 0.46s cubic-bezier(0.22,1,0.36,1) both;")}>
        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:8px;")}>Connected systems</div>
        <div style={css("display:flex; flex-wrap:wrap; gap:8px;")}>
          {connections.map((cn) => (
            <span key={cn.key} style={cn.style}>
              <span style={cn.dotStyle}></span>
              <span style={css("font-size:13px; line-height:1;")}>{cn.icon}</span>
              <span style={css("display:flex; flex-direction:column; line-height:1.2;")}>
                <span style={css("font-size:11.5px; font-weight:600;")}>{cn.label}</span>
                <span style={css("font-size:9.5px; opacity:0.7;")}>{cn.detail}</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {showSignals && <Scorecards scorecards={scorecards} />}
      <RiskSignals signals={signals} flagChips={flagChips} buyChips={buyChips} hasFlags={hasFlags} />

      {/* AI summary */}
      <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); padding:16px 17px;")}>
        <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 50%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
          <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>AI Summary</span>
        </div>
        <p style={css("margin:0; font-size:13.5px; line-height:1.6; color:rgba(255,255,255,0.82);")}>{summaryText}</p>
      </div>

      {/* Contact Evaluation */}
      <ContactEvaluation valuation={valuation} comps={market?.comps} askingPrice={askingPrice} propertyName={propertyName} />

      {/* market intelligence */}
      <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); padding:16px 17px;")}>
        <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;")}>
          <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>Market Intelligence</span>
          <span style={market.trendStyle}>{market.trendLabel}</span>
        </div>
        {market.hasVal && (
          <React.Fragment>
            <div style={css("display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px;")}>
              <div>
                <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>AI estimated value</div>
                <div style={css("display:flex; align-items:baseline; gap:9px; margin-top:4px;")}>
                  <span style={css("font-size:24px; font-weight:800; color:rgba(255,255,255,0.96);")}>{market.estValue}</span>
                  <span style={css("font-size:13px; color:hsl(38 92% 60%); font-weight:600;")}>{market.psf}</span>
                </div>
              </div>
              <span style={market.confStyle}>{market.confLabel}</span>
            </div>
            <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.6); padding:9px 11px; border-radius:9px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); margin-bottom:13px;")}>{market.basis} <span style={css("opacity:0.6;")}>· {market.updatedAt}</span></div>
          </React.Fragment>
        )}
        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:7px;")}>Comparable units · DLD</div>
        <div style={css("display:flex; flex-direction:column; gap:6px;")}>
          {market.comps.map((c, i) => (
            <div key={i} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 11px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);")}>
              <div style={css("min-width:0;")}>
                <div style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);")}>{c.ref}</div>
                <div style={css("font-size:11px; color:rgba(255,255,255,0.45); margin-top:1px;")}>{c.note}</div>
              </div>
              <div style={css("text-align:right; flex:none;")}>
                <div style={css("font-size:13px; font-weight:700; color:rgba(255,255,255,0.9);")}>{c.price}</div>
                <div style={css("font-size:10.5px; color:hsl(38 92% 58%); margin-top:1px;")}>{c.psf}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}