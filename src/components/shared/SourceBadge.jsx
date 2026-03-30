import React from 'react';
import { SOURCE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const sourceColors = {
  property_finder: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
  bayut: 'bg-blue-500/10 text-blue-600 ring-blue-500/20',
  whatsapp: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
  referral: 'bg-purple-500/10 text-purple-600 ring-purple-500/20',
  website: 'bg-sky-500/10 text-sky-600 ring-sky-500/20',
  walk_in: 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
  social_media: 'bg-pink-500/10 text-pink-600 ring-pink-500/20',
  other: 'bg-muted text-muted-foreground ring-border',
};

export default function SourceBadge({ source }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1",
      sourceColors[source] || sourceColors.other
    )}>
      {SOURCE_LABELS[source] || source}
    </span>
  );
}