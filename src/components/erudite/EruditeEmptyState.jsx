import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditeEmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8',
        'rounded-2xl border border-dashed',
        'bg-white/[0.02] border-white/10',
        className
      )}
    >
      {Icon && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 mb-4">
          <Icon className="w-8 h-8" style={{ color: 'hsl(38 92% 50% / 0.6)' }} />
        </div>
      )}
      
      {title && (
        <h3 className="text-lg font-medium mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {title}
        </h3>
      )}
      
      {description && (
        <p className="text-sm text-center max-w-md mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {description}
        </p>
      )}
      
      {action && action}
    </div>
  );
}