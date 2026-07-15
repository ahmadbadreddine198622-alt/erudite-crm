// LandlordStreamKaraokeBubble — renders the message body of a stream bubble
// with an inline read-aloud (speaker) control. Delegates the body to
// InlineKaraokeBody so word-by-word karaoke follows the audio prominently
// while this bubble's track is active in the global voice engine.
import React, { useMemo } from 'react';
import ReadAloudButton from '@/components/shared/ReadAloudButton';
import InlineKaraokeBody from '@/components/shared/InlineKaraokeBody';

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

export default function LandlordStreamKaraokeBubble({ s }) {
  const speakerTitle = `${s.channel || 'Message'} · ${s.sender || ''}${s.time ? ' · ' + s.time : ''}`;
  const bodyStyle = css('flex:1; font-size:14px; line-height:1.5; color:rgba(255,255,255,0.9);');

  return (
    <div style={css('display:flex; align-items:flex-start; gap:6px;')}>
      <InlineKaraokeBody text={s.text} title={speakerTitle} style={bodyStyle} />
      <ReadAloudButton text={s.text} title={speakerTitle} size={20} style={{ flex: 'none', marginTop: -2 }} />
    </div>
  );
}