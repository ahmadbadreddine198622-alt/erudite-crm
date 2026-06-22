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

const fmtStamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function MediaPanel({ media }) {
  if (!media) return null;

  const renderClickableMedia = (icon, label, hasMedia, url, type = 'link') => {
    const isClickable = hasMedia && url;
    return (
      <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 11px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);")}>
        <div style={css("display:flex; align-items:center; gap:8px;")}>
          <span style={css("font-size:14px;")}>{icon}</span>
          <span style={css("font-size:12px; color:rgba(255,255,255,0.75);")}>{label}</span>
        </div>
        {isClickable ? (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={css("font-size:11px; font-weight:600; color:hsl(38 92% 60%); text-decoration:none; display:inline-flex; align-items:center; gap:4px;")}
          >
            {type === 'video' ? '▶ Watch' : type === '360' ? '🔄 View 360°' : '📄 View'} →
          </a>
        ) : (
          <span style={css("font-size:11px; font-weight:600; color: "+(hasMedia ? '#34d399' : 'rgba(255,255,255,0.35)'))}>
            {hasMedia ? '✓ Available (no link)' : '✗ Not captured'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.49s cubic-bezier(0.22,1,0.36,1) both;")}>
      <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:10px;")}>Property Media</div>
      <div style={css("display:flex; flex-direction:column; gap:8px;")}>
        {/* Video walkthrough */}
        {renderClickableMedia('🎬', 'Video walkthrough', media?.hasVideo, media?.videoWalkthroughUrl, 'video')}
        {/* 360 tour */}
        {renderClickableMedia('🔄', '360° tour', media?.has360, media?.tour360Url, '360')}
        {/* Drone footage */}
        {renderClickableMedia('🚁', 'Drone footage', media?.hasDrone, media?.droneFootageUrl, 'video')}
        {/* Floor plan */}
        {renderClickableMedia('📐', 'Floor plan', media?.hasFloorPlan, media?.floorPlanUrl, 'document')}
        {/* Photography status */}
        <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 11px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);")}>
          <div style={css("display:flex; align-items:center; gap:8px;")}>
            <span style={css("font-size:14px;")}>📸</span>
            <span style={css("font-size:12px; color:rgba(255,255,255,0.75);")}>Photography</span>
          </div>
          <span style={css("font-size:11px; font-weight:600; color:hsl(38 92% 60%);")}>{
            media?.photographyStatus === 'none' ? 'Not started' :
            media?.photographyStatus === 'phone_quality' ? 'Phone quality' :
            media?.photographyStatus === 'professional_done' ? 'Professional done' :
            media?.photographyStatus === 'scheduled' ? 'Scheduled' : '—'
          }</span>
        </div>
        {/* Photoshoot scheduled */}
        {media?.photoshootScheduledAt && (
          <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 11px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);")}>
            <div style={css("display:flex; align-items:center; gap:8px;")}>
              <span style={css("font-size:14px;")}>📅</span>
              <span style={css("font-size:12px; color:rgba(255,255,255,0.75);")}>Photoshoot date</span>
            </div>
            <span style={css("font-size:11px; font-weight:600; color:hsl(38 92% 60%);")}>{fmtStamp(media.photoshootScheduledAt)}</span>
          </div>
        )}
        {/* Keys location */}
        {media?.keysLocation && (
          <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 11px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);")}>
            <div style={css("display:flex; align-items:center; gap:8px;")}>
              <span style={css("font-size:14px;")}>🔑</span>
              <span style={css("font-size:12px; color:rgba(255,255,255,0.75);")}>Keys location</span>
            </div>
            <span style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.85);")}>{
              media?.keysLocation === 'with_landlord' ? 'With landlord' :
              media?.keysLocation === 'with_us' ? 'With us' :
              media?.keysLocation === 'lockbox' ? 'Lockbox' :
              media?.keysLocation === 'tenant' ? 'With tenant' :
              (media?.keysLocation || '').replace(/_/g, ' ')
            }</span>
          </div>
        )}
        {/* Key access instructions */}
        {media?.keyAccessInstructions && (
          <div style={css("padding:8px 11px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);")}>
            <div style={css("font-size:10px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:4px;")}>Access instructions</div>
            <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.8);")}>{media.keyAccessInstructions}</div>
          </div>
        )}
      </div>
    </div>
  );
}