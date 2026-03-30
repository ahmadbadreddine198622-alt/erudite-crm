import React from 'react';
import { cn } from '@/lib/utils';

export default function LeadScoreBadge({ score }) {
  const getConfig = (s) => {
    if (s >= 80) return { label: 'Hot', bg: 'bg-red-500/10', text: 'text-red-600', ring: 'ring-red-500/20' };
    if (s >= 60) return { label: 'Warm', bg: 'bg-amber-500/10', text: 'text-amber-600', ring: 'ring-amber-500/20' };
    if (s >= 40) return { label: 'Medium', bg: 'bg-blue-500/10', text: 'text-blue-600', ring: 'ring-blue-500/20' };
    return { label: 'Cold', bg: 'bg-sky-500/10', text: 'text-sky-600', ring: 'ring-sky-500/20' };
  };

  const config = getConfig(score || 0);

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1",
      config.bg, config.text, config.ring
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.text.replace('text-', 'bg-'))} />
      {score || 0} · {config.label}
    </span>
  );
}