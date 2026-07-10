import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CallBrainPanel from './CallBrainPanel';
import { Brain, Sparkles } from 'lucide-react';

// BrainAISheet — floating brain button that opens the AI call coach as a
// side sheet. Keeps the form clean while keeping the coach one tap away.
export default function BrainAISheet({ landlord, form }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button — bottom-right, clears mobile dock */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 hover:scale-105"
        style={{
          bottom: '5rem',
          right: '1rem',
          background: 'linear-gradient(135deg, rgba(96,165,250,0.95), rgba(59,130,246,0.9))',
          border: '1px solid rgba(96,165,250,0.4)',
          boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
        }}
        title="Brain AI — What to ask on this call"
      >
        <Brain className="w-5 h-5 text-white" />
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(38 92% 50%)' }}
        >
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </span>
      </button>

      {/* Side sheet with the full Brain AI panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[90vw] sm:max-w-[420px] overflow-y-auto"
          style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(96,165,250,0.2)' }}
        >
          <SheetHeader className="mb-2">
            <SheetTitle className="flex items-center gap-2" style={{ color: 'rgba(96,165,250,0.95)' }}>
              <Brain className="w-4 h-4" /> Brain AI — Call Coach
            </SheetTitle>
          </SheetHeader>
          <CallBrainPanel landlord={landlord} form={form} defaultOpen={true} />
        </SheetContent>
      </Sheet>
    </>
  );
}