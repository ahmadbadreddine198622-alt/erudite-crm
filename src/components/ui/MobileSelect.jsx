import React, { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

/**
 * MobileSelect — iOS-style Action Sheet for mobile screens.
 * On desktop/tablet, renders as a regular Select trigger.
 * On mobile (< 768px), opens a bottom sheet drawer with options.
 */
export default function MobileSelect({ value, onValueChange, options, placeholder, label }) {
  const [open, setOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleSelect = useCallback((optionValue) => {
    onValueChange(optionValue);
    setOpen(false);
  }, [onValueChange]);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  if (!isMobile) {
    // Render as simple button trigger for desktop (actual Select handled by parent)
    return (
      <Button
        variant="outline"
        className="w-full justify-between h-9"
        onClick={() => setOpen(true)}
      >
        <span className="text-sm">{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 opacity-50" />
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-9"
        >
          <span className="text-sm">{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[70vh]">
        <SheetHeader>
          <SheetTitle className="text-left">{label || placeholder}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                value === option.value
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'hover:bg-accent/5'
              }`}
              style={{
                background: value === option.value ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: value === option.value ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.9)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}