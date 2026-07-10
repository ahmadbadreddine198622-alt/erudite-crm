import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { prevStage, nextStage, getCaptureStatus, STAGE_GUIDE, STAGE_ORDER } from '@/lib/landlordStageGuide';

const stageLabel = (s) => STAGE_GUIDE[s]?.title || s?.replace(/_/g, ' ') || s;

// Back/forward stage-move arrows for a landlord card. Reuses the EXACT same handler the
// drag-drop board uses (onStageChange({ id, newStage })) so both paths write identically.
export default function StageArrows({ landlord, onStageChange }) {
  const [warnOpen, setWarnOpen] = useState(false);
  const prev = prevStage(landlord.stage);
  const next = nextStage(landlord.stage);

  // Forward readiness mirrors the card's green/amber completeness dot.
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

  const btnBase = {
    width: 24, height: 24, borderRadius: 999, display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: '#0B1F3A', border: '1px solid rgba(201,162,75,0.35)',
    transition: 'all 0.15s ease', padding: 0,
  };

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {prev && (
          <button
            type="button"
            onClick={handleBack}
            title={`Back to ${stageLabel(prev)}`}
            aria-label={`Back to ${stageLabel(prev)}`}
            style={btnBase}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#C9A24B'; e.currentTarget.style.borderColor = '#C9A24B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0B1F3A'; e.currentTarget.style.borderColor = 'rgba(201,162,75,0.35)'; }}
          >
            <ChevronLeft className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={handleForward}
            title={ready ? `Advance to ${stageLabel(next)}` : `Not ready — missing: ${capture.missing.join(', ')}`}
            aria-label={`Advance to ${stageLabel(next)}`}
            style={{ ...btnBase, borderColor: ready ? 'rgba(201,162,75,0.6)' : 'rgba(201,162,75,0.25)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#C9A24B'; e.currentTarget.style.borderColor = '#C9A24B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0B1F3A'; e.currentTarget.style.borderColor = ready ? 'rgba(201,162,75,0.6)' : 'rgba(201,162,75,0.25)'; }}
          >
            <ChevronRight className="w-3.5 h-3.5" style={{ color: ready ? '#C9A24B' : 'rgba(201,162,75,0.5)' }} />
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
              style={{ background: '#C9A24B', color: '#0B1F3A' }}
            >
              Move anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}