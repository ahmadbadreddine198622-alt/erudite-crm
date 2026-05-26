import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "viewing_scheduled", label: "Viewing" },
  { key: "offer_made", label: "Offer" },
  { key: "negotiating", label: "Negotiating" },
  { key: "won", label: "Won" },
];

export default function StagePipeline({ currentStage, onStageClick }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="flex items-center gap-0 px-3 py-2 overflow-x-auto border-t">
      {STAGES.map((stage, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={stage.key} className="flex items-center shrink-0">
            <button
              onClick={() => onStageClick?.(stage.key)}
              className={cn(
                "text-[10px] font-medium px-2 py-1 rounded transition-all whitespace-nowrap",
                isCurrent && "bg-green-600 text-white shadow-sm",
                isPast && "text-green-700 hover:bg-green-50",
                !isCurrent && !isPast && "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {stage.label}
            </button>
            {idx < STAGES.length - 1 && (
              <ChevronRight className={cn("w-3 h-3 shrink-0", isPast ? "text-green-400" : "text-muted-foreground/30")} />
            )}
          </div>
        );
      })}
    </div>
  );
}