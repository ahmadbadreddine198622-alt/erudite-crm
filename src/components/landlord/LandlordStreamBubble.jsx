// LandlordStreamBubble — renders a single message bubble in the unified chat
// thread (WhatsApp / iMessage / Telegram / SMS tabs in LandlordDetailPage).
// Extracted so the bubble + a gold read-aloud button live in their own file.
import React from 'react';
import LandlordStreamKaraokeBubble from '@/components/landlord/LandlordStreamKaraokeBubble';

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

export default function LandlordStreamBubble({ s }) {
  return (
    <div key={s.key} style={s.rowStyle}>
      <div style={s.bubbleStyle}>
        <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:5px;")}>
          <span style={s.senderStyle}>{s.sender}</span>
          <span style={s.channelStyle}>{s.channel}</span>
          {s.showInstanceLabel && s.imessageInstance && (
            <span title={`iMessage line · ${s.imessageInstance === 'bb2' ? 'Operations Line (bb2)' : 'Erudite Main (bb1)'}`} style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '4px', color: s.imessageInstance === 'bb2' ? '#c4b5fd' : 'rgba(96,165,250,0.7)', background: s.imessageInstance === 'bb2' ? 'rgba(139,92,246,0.14)' : 'rgba(10,132,255,0.1)', border: '1px solid ' + (s.imessageInstance === 'bb2' ? 'rgba(139,92,246,0.3)' : 'rgba(10,132,255,0.2)') }}>
              {s.imessageInstance}
            </span>
          )}
        </div>

        {s.isText && (
          <LandlordStreamKaraokeBubble s={s} />
        )}

        {s.isVoice && (
          <React.Fragment>
            <div style={css("display:flex; align-items:center; gap:9px; margin-bottom:8px;")}>
              <span style={css("flex:none; width:28px; height:28px; border-radius:50%; background:hsl(38 92% 50% / 0.2); display:flex; align-items:center; justify-content:center; color:hsl(38 92% 60%);")}>▶</span>
              <span style={css("display:flex; align-items:center; gap:2px; height:20px;")}>{s.waveform}</span>
              <span style={css("font-size:10.5px; color:rgba(255,255,255,0.45);")}>{s.duration}</span>
            </div>
            <div style={css("display:inline-block; font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Transcript · {s.transcriptLang}</div>
            <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{s.transcript}</div>
            <div style={css("margin-top:7px; padding-top:7px; border-top:1px dashed rgba(255,255,255,0.14);")}>
              <span style={css("display:inline-block; font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:hsl(38 92% 58%); margin-bottom:3px;")}>EN translation · Whisper</span>
              <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.7); font-style:italic;")}>{s.translation}</div>
            </div>
          </React.Fragment>
        )}

        {s.isMedia && (
          <React.Fragment>
            {s.mediaUrl ? (
              <a href={s.mediaUrl} target="_blank" rel="noopener noreferrer" style={css("display:block; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.12); margin-bottom:6px;")}>
                <img src={s.mediaUrl} alt={s.mediaLabel||'media'} loading="lazy" style={css("display:block; max-width:100%; max-height:240px; object-fit:cover;")} />
              </a>
            ) : null}
            {s.text ? <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{s.text}</div> : null}
          </React.Fragment>
        )}

        <div style={s.timeStyle}>{s.time}</div>
      </div>
    </div>
  );
}