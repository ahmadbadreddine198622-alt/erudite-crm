import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { prevStage, nextStage, getCaptureStatus, STAGE_GUIDE } from '@/lib/landlordStageGuide';

const GOLD = '#C6A15B';
const NAME = '#E9EDF6';
const HAIR2 = 'rgba(255,255,255,0.12)';

const stageLabel = (s) => STAGE_GUIDE[s]?.title || s?.replace(/_/g, ' ') || s;

// Back/forward stage-move arrows for a landlord card. Reuses the EXACT same handler the
// drag-drop board uses (onStageChange({ id, newStage })) so both paths write identically.
export default function StageArrows({ landlord, onStageChange }) {
  const [warnOpen, setWarnOpen] = useState(false);
  const prev = prevStage(landlord.stage);
  const next = nextStage(landlord.stage);

  // Forward readiness mirrors the card's completeness dot.
  const capture = getCaptureStatus(landlord, landlord.stage);
  const ready = capture.complete;

  const move = (newStage) => {
    if (!newStage) return;
    onStageChange({ id: landlord.id, newStage });
    toast.success(`Moved to ${stageLabel(newStage)}`);
  };

  const handleForward = (e) => {
    e.stopPropagation();
    if (!next) return;
    if (ready) {
      move(next);
    } else {
      setWarnOpen(true);
    }
  };

  const handleBack = (e) => {
    e.stopPropagation();
    move(prev);
  };

  // 20px ghost hairline circles. Ready (forward) gets a subtle gold tint.
  const btnBase = (isReady) => ({
    width: 20, height: 20, borderRadius: 999, display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${isReady ? 'rgba(198,161,91,0.4)' : HAIR2}`,
    transition: 'border-color 150ms ease, color 150ms ease',
    padding: 0,
  });

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {prev && (
          <button
            type="button"
            onClick={handleBack}
            title={`Back to ${stageLabel(prev)}`}
            aria-label={`Back to ${stageLabel(prev)}`}
            style={btnBase(false)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = HAIR2; }}
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(233,237,246,0.6)' }} />
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={handleForward}
            title={ready ? `Advance to ${stageLabel(next)}` : `Not ready — missing: ${capture.missing.join(', ')}`}
            aria-label={`Advance to ${stageLabel(next)}`}
            style={btnBase(ready)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(198,161,91,0.6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = ready ? 'rgba(198,161,91,0.4)' : HAIR2; }}
          >
            <ChevronRight className="w-3 h-3" strokeWidth={1.5} style={{ color: ready ? GOLD : 'rgba(198,161,91,0.5)' }} />
          </button>
        )}
      </div>

      <AlertDialog open={warnOpen} onOpenChange={setWarnOpen}>
        <AlertDialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Not ready to advance</AlertDialogTitle>
            <AlertDialogDescription>
              This landlord isn't ready to advance. Missing: <span className="font-semibold text-foreground">{capture.missing.join(', ')}</span>. Move anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); move(next); }}
              style={{ background: GOLD, color: '#0B1020' }}
            >
              Move anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}