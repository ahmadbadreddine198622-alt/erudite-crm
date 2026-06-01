import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditePage({ children, className, title, subtitle, actions }) {
  return (
    <div
      className={cn(
        'min-h-screen relative overflow-hidden',
        'bg-[radial-gradient(ellipse_at_30%_10%,rgba(20,30,60,0.55)_0%,rgba(8,11,18,0.92)_45%,rgba(6,8,14,0.98)_100%)]',
        className
      )}
    >
      {/* Subtle ambient glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Content container */}
      <div className="relative z-10 p-6 md:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        {(title || subtitle || actions) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
              {title && (
                <h1 className="text-3xl md:text-4xl font-light tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm font-medium tracking-wide" style={{ color: 'hsl(38 92% 50% / 0.75)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        )}
        
        {/* Page content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}