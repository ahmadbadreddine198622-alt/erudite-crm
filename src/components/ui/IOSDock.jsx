import React from 'react';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';

export default function IOSDock({ apps, badgeCounts, tiltX, tiltY, navigate }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      {/* Dock Container */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-3xl"
        style={{
          background: 'rgba(42,42,42,0.65)',
          backdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {apps.map((app, i) => {
          const Icon = app.icon;
          const badge = badgeCounts[app.badgeKey || ''] || 0;
          
          return (
            <div
              key={i}
              onClick={() => {
                if (navigate && app.path) {
                  navigate(app.path);
                } else if (app.href) {
                  window.open(app.href, '_blank');
                }
              }}
              className="relative cursor-pointer transition-transform active:scale-95"
            >
              <ExtremeLiquidIcon
                icon={Icon}
                gradient={app.gradient}
                glowColor={app.glowColor}
                tiltX={tiltX}
                tiltY={tiltY}
                index={i}
                size={68}
              />
              
              {/* Badge */}
              {badge > 0 && (
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                  style={{ background: '#FF3B30' }}
                >
                  {badge > 999 ? '999+' : badge}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}