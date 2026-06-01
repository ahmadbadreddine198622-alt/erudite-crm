import React from 'react';
import { cn } from '@/lib/utils';

export default function iOSButton({ 
  children, 
  variant = 'primary', 
  className, 
  icon: Icon,
  ...props 
}) {
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
    ghost: 'bg-transparent text-blue-500 hover:bg-blue-50 active:bg-blue-100',
    destructive: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'px-4 py-2.5 rounded-xl font-semibold text-sm',
        'transition-all duration-150 active:scale-[0.98]',
        variants[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}