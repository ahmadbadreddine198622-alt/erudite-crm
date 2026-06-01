import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function EruditeButton({ children, variant = 'primary', icon: Icon, onClick, className, disabled }) {
  const variants = {
    primary: {
      bg: 'bg-gradient-to-r from-amber-500 to-amber-600',
      text: 'text-[#0F1419]',
      border: 'border-amber-500/50',
      hover: 'hover:from-amber-400 hover:to-amber-500 hover:shadow-lg hover:shadow-amber-500/25'
    },
    secondary: {
      bg: 'bg-white/5',
      text: 'text-white/90',
      border: 'border-white/15',
      hover: 'hover:bg-white/10 hover:border-white/25'
    },
    ghost: {
      bg: 'bg-transparent',
      text: 'text-white/60',
      border: 'border-transparent',
      hover: 'hover:bg-white/5 hover:text-white/80'
    }
  };

  const style = variants[variant] || variants.primary;

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative px-5 py-2.5 rounded-xl text-sm font-medium tracking-wide',
        'transition-all duration-300',
        'backdrop-blur-sm',
        style.bg,
        style.text,
        style.border,
        style.hover,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </Button>
  );
}