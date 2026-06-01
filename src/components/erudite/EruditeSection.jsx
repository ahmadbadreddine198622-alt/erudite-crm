import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditeSection({ title, subtitle, children, className, icon: Icon }) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || subtitle) && (
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs font-medium tracking-wide uppercase" style={{ color: 'hsl(38 92% 50% / 0.7)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Icon className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            </div>
          )}
        </div>
      )}
      
      <div className="relative">
        {children}
      </div>
    </section>
  );
}