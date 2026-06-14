import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const COLORS = [
  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'bg-red-500/10 text-red-600 border-red-500/20',
  'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'bg-rose-500/10 text-rose-600 border-rose-500/20',
  'bg-pink-500/10 text-pink-600 border-pink-500/20',
  'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
];

const LetterAvatar = ({ name, size = 8, className }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColor = (name) => {
    if (!name) return COLORS[0];
    const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[charCodeSum % COLORS.length];
  };

  const sizeClasses = `h-${size} w-${size}`;
  const textSizeClass = size > 8 ? 'text-base' : 'text-xs';

  return (
    <Avatar className={cn(sizeClasses, className)}>
      <AvatarFallback className={cn('font-semibold border', getColor(name), textSizeClass)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
};

export default LetterAvatar;