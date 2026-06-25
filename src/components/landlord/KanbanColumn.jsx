import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import KanbanCardRow from './KanbanCardRow';

// One pipeline column. Memoized so dragging within / over another column doesn't re-render
// columns whose card list is unchanged. The whole column body is a droppable so an EMPTY
// column is still a valid drop target.
function KanbanColumn({
  stage,
  label,
  landlords,
  selectedLandlordId,
  selectedIds,
  onSelectLandlord,
  onToggleSelect,
  users,
  onSingleAssign,
  photographyTasks,
  getPhotoForPhone,
  activeId,
}) {
  const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const itemIds = landlords.map((l) => l.id);

  return (
    <div
      className="flex-[0_0_auto] w-80 rounded-2xl flex flex-col self-start border border-border bg-card"
    >
      {/* Column Header — pinned to the top of the column */}
      <div className="p-3 shrink-0 sticky top-0 z-10 rounded-t-2xl bg-secondary border-b-2" style={{ borderBottomColor: 'hsl(38 92% 50% / 0.2)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-bold text-sm text-foreground">{label}</h3>
          <Badge variant="outline" className="text-xs bg-muted border-border text-foreground">
            {landlords.length}
          </Badge>
        </div>
        <p className="text-xs font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
          AED {(totalCommission / 1000000).toFixed(1)}M
        </p>
      </div>

      {/* Cards Container — droppable, independent vertical scroll */}
      <div
        ref={setNodeRef}
        data-column-scroll="true"
        className={cn(
          'overflow-y-auto p-2.5 space-y-2 transition-colors max-h-[calc(100vh-220px)] rounded-b-2xl',
          isOver ? 'bg-accent/5' : '',
        )}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {landlords.map((landlord) => (
            <KanbanCardRow
              key={landlord.id}
              landlord={landlord}
              selectedLandlordId={selectedLandlordId}
              selectedIds={selectedIds}
              onSelectLandlord={onSelectLandlord}
              onToggleSelect={onToggleSelect}
              users={users}
              onSingleAssign={onSingleAssign}
              photographyTasks={photographyTasks}
              getPhotoForPhone={getPhotoForPhone}
              isActive={activeId === landlord.id}
            />
          ))}
        </SortableContext>

        {landlords.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-xs text-center p-2">
            No landlords in this stage
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(KanbanColumn);