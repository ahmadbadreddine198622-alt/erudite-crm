import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import KanbanCardRow from './KanbanCardRow';
import StageGuidePopover from './StageGuidePopover';
import ContactDataMiniPanel from './ContactDataMiniPanel';
import { PHASE_BY_STAGE, VCARD_STAGES } from '@/lib/landlordStageGuide';

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
  onStageChange,
}) {
  const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const itemIds = landlords.map((l) => l.id);
  const phase = PHASE_BY_STAGE[stage];
  const accent = phase?.color || 'hsl(38 92% 50%)';
  const showVCard = VCARD_STAGES.includes(stage);

  return (
    <div
      className="flex-[0_0_auto] w-80 rounded-2xl flex flex-col self-start border border-border bg-card overflow-hidden"
      style={{ borderTop: `2px solid ${accent}` }}
    >
      {/* Column Header — pinned to the top of the column */}
      <div className="p-3 shrink-0 sticky top-0 z-10 bg-secondary border-b-2" style={{ borderBottomColor: `${accent}33` }}>
        <div className="flex items-center justify-between mb-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="font-bold text-sm text-foreground truncate">{label}</h3>
            <StageGuidePopover stage={stage} accent={accent} />
          </div>
          <Badge variant="outline" className="text-xs bg-muted border-border text-foreground shrink-0">
            {landlords.length}
          </Badge>
        </div>
        <p className="text-xs font-bold" style={{ color: accent }}>
          AED {(totalCommission / 1000000).toFixed(1)}M
        </p>
        {showVCard && <ContactDataMiniPanel stage={stage} landlords={landlords} />}
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
              onStageChange={onStageChange}
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