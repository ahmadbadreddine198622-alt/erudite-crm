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

// Battle card + price ladder + offers received. Props: tab ({ battle, ladder, offers }).
export default function NegotiationTab({ tab }) {
  return (
    <React.Fragment>
      <div style={css("border-radius:14px; border:1px solid hsl(38 92% 50% / 0.3); background:linear-gradient(180deg, hsl(38 92% 50% / 0.08), rgba(255,255,255,0.02)); overflow:hidden; margin-bottom:16px;")}>
        <div style={css("display:flex; align-items:center; gap:8px; padding:11px 14px; border-bottom:1px solid hsl(38 92% 50% / 0.16);")}>
          <span style={css("font-size:14px;")}>⚔</span>
          <span style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 60%);")}>Battle Card</span>
          <span style={css("margin-left:auto; font-size:10.5px; color:rgba(255,255,255,0.4);")}>generateBattleCard</span>
        </div>
        <div style={css("padding:13px 14px;")}>
          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#fca5a5; margin-bottom:4px;")}>Pain point</div>
          <div style={css("font-size:13px; line-height:1.5; color:rgba(255,255,255,0.85); margin-bottom:12px;")}>{tab.battle.painPoint}</div>

          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:6px;")}>Top motivators</div>
          <div style={css("display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;")}>
            {tab.battle.motivators.map((mo, i) => (
              <span key={i} style={css("padding:5px 11px; border-radius:99px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); font-size:11.5px; color:rgba(255,255,255,0.8);")}>{mo}</span>
            ))}
          </div>

          <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:11px; margin-bottom:12px;")}>
            <div style={css("border-radius:10px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); padding:10px 12px;")}>
              <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#fca5a5; margin-bottom:4px;")}>Competitor intel</div>
              <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.78);")}>{tab.battle.competitor}</div>
            </div>
            <div style={css("border-radius:10px; background:hsl(38 92% 50% / 0.07); border:1px solid hsl(38 92% 50% / 0.25); padding:10px 12px;")}>
              <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 60%); margin-bottom:4px;")}>Winning pitch</div>
              <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{tab.battle.pitch}</div>
            </div>
          </div>

          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:6px;")}>Closing techniques</div>
          <div style={css("display:flex; flex-direction:column; gap:5px;")}>
            {tab.battle.closes.map((cz, i) => (
              <div key={i} style={css("display:flex; align-items:flex-start; gap:8px; font-size:12px; color:rgba(255,255,255,0.74); line-height:1.45;")}><span style={css("flex:none; color:hsl(38 92% 58%); font-weight:700;")}>→</span>{cz}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={css("display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:15px;")}>
        {tab.ladder.map((l, i) => (
          <div key={i} style={l.cardStyle}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.45);")}>{l.label}</div>
            <div style={{ ...css("font-size:18px; font-weight:800; margin-top:5px;"), color: l.color }}>{l.value}</div>
          </div>
        ))}
      </div>
      <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:7px;")}>Offers received</div>
      <div style={css("display:flex; flex-direction:column; gap:6px;")}>
        {tab.offers.map((of) => (
          <div key={of.key} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
            <div>
              <div style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);")}>{of.who}</div>
              <div style={css("font-size:11px; color:rgba(255,255,255,0.45); margin-top:1px;")}>{of.time}</div>
            </div>
            <div style={css("display:flex; align-items:center; gap:10px;")}>
              <span style={css("font-size:14px; font-weight:700; color:rgba(255,255,255,0.92);")}>{of.amount}</span>
              <span style={of.statusStyle}>{of.status}</span>
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}