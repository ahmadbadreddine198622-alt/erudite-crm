import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import LandlordCard from './LandlordCard';

export default function KanbanBoard({
  stages,
  stageLabels,
  stageGroups,
  selectedLandlordId,
  onSelectLandlord,
}) {
  return (
    <div className="flex gap-4 min-w-max h-full pb-4">
      {stages.map((stage) => {
        const landlords = stageGroups[stage] || [];
        const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);

        return (
          <div
            key={stage}
            className="flex-shrink-0 w-80 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border overflow-hidden flex flex-col h-full"
          >
            {/* Column Header */}
            <div className="bg-card border-b border-border p-3 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{stageLabels[stage]}</h3>
                <Badge variant="outline" className="text-xs">
                  {landlords.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                AED {(totalCommission / 1000000).toFixed(1)}M
              </p>
            </div>

            {/* Cards Container - Internal scroll */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {landlords.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-xs text-center p-2">
                  No landlords in this stage
                </div>
              ) : (
                landlords.map((landlord) => (
                  <LandlordCard
                    key={landlord.id}
                    landlord={landlord}
                    isSelected={landlord.id === selectedLandlordId}
                    onClick={() => onSelectLandlord(landlord.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}