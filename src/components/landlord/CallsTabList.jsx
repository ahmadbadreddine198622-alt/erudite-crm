import React, { useRef, useState } from 'react';

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

const PROV_META = {
  aircall: ['Aircall', '📞', '#93c5fd', 'rgba(59,130,246,0.16)'],
  twilio: ['Twilio', '☎', '#34d399', 'rgba(16,185,129,0.16)'],
  vapi: ['VAPI AI', '🎙', '#c4b5fd', 'rgba(139,92,246,0.16)'],
  whatsapp: ['WhatsApp', '📲', '#4ade80', 'rgba(37,211,102,0.16)'],
};
const STATUS_META = {
  done: ['rgba(16,185,129,0.16)', '#34d399', 'Completed'],
  missed: ['rgba(239,68,68,0.16)', '#f87171', 'Missed'],
  voicemail: ['rgba(245,158,11,0.16)', 'hsl(38 92% 62%)', 'Voicemail'],
};

function InlinePlayer({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else a.play().then(() => setPlaying(true)).catch(() => { setFailed(true); });
  };
  if (failed) {
    return (
      <div style={css('display:flex; align-items:center; gap:8px; margin-top:8px; padding:7px 9px; border-radius:9px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.22);')}>
        <span style={css('font-size:11px; color:hsl(38 92% 62%);')}>⚠ Recording can't play inline</span>
        <a href={url} target="_blank" rel="noopener noreferrer" style={css('flex:none; font-size:10px; padding:4px 9px; border-radius:6px; color:#34d399; text-decoration:none; border:1px solid rgba(16,185,129,0.3);')}>Open ↗</a>
      </div>
    );
  }
  return (
    <div style={css('display:flex; align-items:center; gap:8px; margin-top:8px; padding:7px 9px; border-radius:9px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.22);')}>
      <button onClick={toggle} style={css('flex:none; width:30px; height:30px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; background:rgba(16,185,129,0.25); color:#34d399; font-size:13px;')}>
        {playing ? '❚❚' : '▶'}
      </button>
      <audio ref={audioRef} src={url} onError={() => setFailed(true)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} controls style={{ flex: 1, height: 30, accentColor: '#34d399' }} />
      <a href={url} target="_blank" rel="noopener noreferrer" style={css('flex:none; font-size:10px; padding:4px 7px; border-radius:6px; color:#34d399; text-decoration:none; border:1px solid rgba(16,185,129,0.3);')}>Open ↗</a>
    </div>
  );
}

export default function CallsTabList({ calls = [] }) {
  return (
    <div style={css('display:flex; flex-direction:column; gap:8px;')}>
      {calls.map((c, i) => {
        const pm = PROV_META[c.provider] || PROV_META.aircall;
        const sm = STATUS_META[c.status] || ['rgba(148,163,184,0.16)', 'rgba(255,255,255,0.6)', c.status];
        return (
          <div key={i} style={css('padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);')}>
            <div style={css('display:flex; align-items:center; gap:12px;')}>
              <span style={{ ...css('flex:none; width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:15px;'), background: c.dir === 'out' ? 'rgba(16,185,129,0.16)' : 'rgba(59,130,246,0.16)', color: c.dir === 'out' ? '#34d399' : '#93c5fd' }}>
                {c.dir === 'out' ? '↗' : '↙'}
              </span>
              <div style={css('flex:1; min-width:0;')}>
                <div style={css('font-size:13px; font-weight:600; color:rgba(255,255,255,0.88);')}>{(c.dir === 'out' ? 'Outbound · ' : 'Inbound · ') + c.title}</div>
                <div style={css('display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px;')}>
                  <span style={{ ...css('display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700;'), color: pm[2], background: pm[3] }}>{pm[1]} {pm[0]}</span>
                  <span style={{ ...css('padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700;'), color: sm[1], background: sm[0] }}>{sm[2]}</span>
                  {c.recording && <span style={css('padding:2px 8px; border-radius:99px; font-size:10px; font-weight:600; color:#34d399; background:rgba(16,185,129,0.12);')}>📼 Recording</span>}
                  {!c.recording && <span style={css('padding:2px 8px; border-radius:99px; font-size:10px; font-weight:600; color:rgba(255,255,255,0.35); background:rgba(255,255,255,0.04);')}>No recording</span>}
                  <span style={css('font-size:11px; color:rgba(255,255,255,0.42);')}>{c.who}</span>
                </div>
              </div>
              <span style={css('flex:none; font-size:12px; font-weight:600; color:rgba(255,255,255,0.6);')}>{c.dur}</span>
            </div>
            {c.recording && c.recordingUrl && <InlinePlayer url={c.recordingUrl} />}
          </div>
        );
      })}
    </div>
  );
}