import React from 'react';
import { Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChannelSwitcher({ selectedChannel, onChannelChange, disabled = false }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChannelChange('business')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
          selectedChannel === 'business'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Business line (+971582806000)"
      >
        <Building2 className="w-3.5 h-3.5" />
        Business
      </button>
      <button
        onClick={() => onChannelChange('personal')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
          selectedChannel === 'personal'
            ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Personal line (+971581806000)"
      >
        <User className="w-3.5 h-3.5" />
        Personal
      </button>
    </div>
  );
}