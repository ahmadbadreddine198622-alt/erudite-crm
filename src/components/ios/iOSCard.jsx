import React from 'react';
import { cn } from '@/lib/utils';

export default function iOSCard({ children, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl shadow-sm border border-gray-100',
        'transition-all duration-200',
        onClick && 'active:scale-[0.98] cursor-pointer hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}