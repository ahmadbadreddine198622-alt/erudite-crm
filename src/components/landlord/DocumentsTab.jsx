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

const statusStyleMap = {
  received: { padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:'rgba(16,185,129,0.16)', color:'#34d399' },
  pending: { padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:'hsl(38 92% 50% / 0.16)', color:'hsl(38 92% 62%)' },
  missing: { padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:'rgba(239,68,68,0.16)', color:'#f87171' },
};

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
      {docs.map((dc, i)=>{
        const statusKey = dc.status === '✓ Received' ? 'received' : dc.status === '◷ Pending' ? 'pending' : dc.status === '✕ Missing' ? 'missing' : 'pending';
        const sStyle = statusStyleMap[statusKey] || statusStyleMap.pending;
        return (
          <div key={dc.key || dc.label || i} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
            <div style={css("display:flex; align-items:center; gap:11px; min-width:0;")}>
              <span style={css("font-size:15px;")}>{dc.icon}</span>
              <div style={css("min-width:0;")}>
                <div style={css("font-size:13px; color:rgba(255,255,255,0.85);")}>{dc.label}</div>
                <div style={css("font-size:10.5px; color:rgba(255,255,255,0.42); margin-top:1px;")}>{dc.provider}</div>
              </div>
            </div>
            <div style={css("display:flex; align-items:center; gap:8px;")}>
              {dc.url && (
                <a href={dc.url} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:4px; fontSize:10.5px; fontWeight:600; color:hsl(38 92% 60%); textDecoration:none; padding:4px 8px; borderRadius:6px; background:hsl(38 92% 50% / 0.1); border:1px solid hsl(38 92% 50% / 0.3);")}>
                  📄 View
                </a>
              )}
              <span style={sStyle}>{dc.status === 'received' ? '✓ Received' : dc.status === 'pending' ? '◷ Pending' : dc.status === 'missing' ? '✕ Missing' : dc.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}