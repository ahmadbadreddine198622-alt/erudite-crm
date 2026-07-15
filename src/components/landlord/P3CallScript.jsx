import React, { useState } from 'react';

/* ── PENINSULA 3 — PER-LANDLORD CALL SCRIPT ─────────────────────────────────────
   Renders the personalized evaluation + professional call script built by
   buildP3CallScript() on LandlordDetailPage. Every landlord's script is different:
   composed from THEIR name, unit number, floor/stack, their unit type's own deed
   benchmarks (types never mixed) and the live portal ask layer.
   Pure presentation — no data fetching, renders nothing without a script. */

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

const scriptToText = (script) => {
  const parts = [`${script.header}`, ''];
  (script.sections || []).forEach((s) => {
    parts.push(`■ ${s.title}`);
    (s.lines || []).forEach((l) => parts.push(l));
    parts.push('');
  });
  return parts.join('\n').trim();
};

export default function P3CallScript({ script }) {
  const [copied, setCopied] = useState('');
  const [open, setOpen] = useState(true);
  if (!script) return null;

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard unavailable — ignore */ }
  };

  return (
    <div style={css('margin-top:16px; border-radius:15px; border:1px solid rgba(212,175,55,0.28); background:linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02)); padding:16px 17px;')}>
      {/* header */}
      <div style={css('display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;')}>
        <div style={css('display:flex; align-items:center; gap:8px; min-width:0;')}>
          <span style={css('font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#e8cf7a;')}>Landlord Script</span>
          {script.chip && (
            <span style={css('display:inline-flex; align-items:center; padding:3px 9px; border-radius:99px; font-size:10.5px; font-weight:700; background:rgba(212,175,55,0.13); border:1px solid rgba(212,175,55,0.35); color:#e8cf7a;')}>{script.chip}</span>
          )}
        </div>
        <div style={css('display:flex; align-items:center; gap:6px; flex:none;')}>
          <button
            onClick={() => copy('all', scriptToText(script))}
            style={css('font-size:10.5px; font-weight:700; padding:4px 10px; border-radius:8px; cursor:pointer; border:1px solid rgba(212,175,55,0.4); background:rgba(212,175,55,0.1); color:#e8cf7a;')}
          >{copied === 'all' ? 'Copied ✓' : 'Copy script'}</button>
          <button
            onClick={() => setOpen(!open)}
            style={css('font-size:10.5px; font-weight:700; padding:4px 8px; border-radius:8px; cursor:pointer; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6);')}
          >{open ? '−' : '+'}</button>
        </div>
      </div>
      {script.meta && (
        <div style={css('font-size:11px; color:rgba(255,255,255,0.45); margin-bottom:11px; line-height:1.45;')}>{script.meta}</div>
      )}

      {open && (
        <React.Fragment>
          {/* unit evaluation strip */}
          {Array.isArray(script.evalStrip) && script.evalStrip.length > 0 && (
            <div style={css('display:grid; grid-template-columns:repeat(auto-fit, minmax(118px, 1fr)); gap:6px; margin-bottom:12px;')}>
              {script.evalStrip.map((row, i) => (
                <div key={i} style={css('padding:8px 10px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); min-width:0;')}>
                  <div style={css('font-size:9.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.38); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{row.k}</div>
                  <div style={css('font-size:12.5px; font-weight:700; color:rgba(255,255,255,0.9); margin-top:2px; line-height:1.3;')}>{row.v}</div>
                  {row.sub && <div style={css('font-size:10px; color:rgba(255,255,255,0.42); margin-top:1px;')}>{row.sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* script sections */}
          <div style={css('display:flex; flex-direction:column; gap:8px;')}>
            {(script.sections || []).map((s, i) => (
              <div key={i} style={css('padding:10px 12px; border-radius:11px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);')}>
                <div style={css('display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;')}>
                  <span style={css(`font-size:10px; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:${s.accent || '#e8cf7a'};`)}>{s.title}</span>
                  <button
                    onClick={() => copy(`s${i}`, (s.lines || []).join('\n'))}
                    style={css('font-size:9.5px; font-weight:700; padding:2px 8px; border-radius:7px; cursor:pointer; border:1px solid rgba(255,255,255,0.12); background:transparent; color:rgba(255,255,255,0.45);')}
                  >{copied === `s${i}` ? '✓' : 'copy'}</button>
                </div>
                {(s.lines || []).map((line, j) => (
                  <p key={j} style={css('margin:0 0 6px; font-size:12.5px; line-height:1.62; color:rgba(255,255,255,0.82);')}>{line}</p>
                ))}
              </div>
            ))}
          </div>

          {script.footer && (
            <div style={css('margin-top:10px; font-size:10.5px; line-height:1.5; color:rgba(255,255,255,0.4);')}>{script.footer}</div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
