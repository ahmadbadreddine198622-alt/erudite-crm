import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Icon className="w-10 h-10" style={{ color: 'hsl(38 92% 50%)' }} />
      </div>
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
        {title}
      </h3>
      <p className="text-sm mb-4 max-w-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'hsl(38 92% 50%)',
            color: 'hsl(222 47% 11%)',
            boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}