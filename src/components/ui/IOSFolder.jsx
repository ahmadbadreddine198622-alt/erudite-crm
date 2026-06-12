import React, { useState } from 'react';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';

export default function IOSFolder({ folderName, apps, badgeCount, tiltX, tiltY, index, navigate }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAppClick = (app, e) => {
    e.stopPropagation();
    if (navigate && app.path) {
      navigate(app.path);
    } else if (app.href) {
      window.open(app.href, '_blank');
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Folder Icon */}
      <div
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center gap-1.5 cursor-pointer select-none"
      >
        {/* Folder Container */}
        <div
          className="relative w-16 h-16 rounded-xl p-1.5 grid grid-cols-3 gap-0.5"
          style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {apps.slice(0, 9).map((app, i) => (
            <div
              key={i}
              className="rounded-sm overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${app.gradient[0]}, ${app.gradient[1] || app.gradient[0]})` }}
            />
          ))}
          
          {/* Badge */}
          {badgeCount > 0 && (
            <div
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-lg"
              style={{ background: '#FF3B30' }}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </div>
          )}
        </div>
        
        {/* Label */}
        <span className="text-[11px] text-center leading-tight max-w-[64px] font-medium text-white/75">
          {folderName}
        </span>
      </div>

      {/* Folder Popup */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* Folder Content */}
          <div
            className="relative w-full max-w-sm rounded-3xl p-6"
            style={{
              background: 'rgba(42,42,42,0.85)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Folder Header */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-semibold text-white">{folderName}</h3>
              <p className="text-[10px] text-white/50 mt-0.5">{apps.length} apps</p>
            </div>

            {/* App Grid */}
            <div className="grid grid-cols-4 gap-4">
              {apps.map((app, i) => {
                const Icon = app.icon;
                return (
                  <div
                    key={i}
                    onClick={(e) => handleAppClick(app, e)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer"
                  >
                    <ExtremeLiquidIcon
                      icon={Icon}
                      gradient={app.gradient}
                      glowColor={app.glowColor}
                      tiltX={tiltX}
                      tiltY={tiltY}
                      index={i}
                      size={52}
                    />
                    <span className="text-[10px] text-center text-white/75 max-w-[56px] leading-tight">
                      {app.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Page Dots */}
            <div className="flex justify-center gap-1.5 mt-6">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              {apps.length > 16 && <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}