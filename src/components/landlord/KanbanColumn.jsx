import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
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
      className="flex-[0_0_auto] w-80 rounded-2xl flex flex-col self-start overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, rgba(201,162,75,0.06), rgba(255,255,255,0.02))',
        border: '1px solid rgba(201,162,75,0.2)',
        borderTop: `3px solid ${accent}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}
    >
      {/* Column Header — pinned to the top of the column */}
      <div className="p-3 shrink-0 sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(201,162,75,0.15)' }}>
        <div className="flex items-center justify-between mb-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="font-bold text-sm truncate" style={{ color: 'rgba(255,255,255,0.95)', fontFamily: "'Playfair Display',serif" }}>{label}</h3>
            <StageGuidePopover stage={stage} accent={accent} />
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-semibold shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'hsl(38 92% 50%)' }}
          >
            <Users className="w-2.5 h-2.5" />
            {landlords.length}
          </div>
        </div>
        <p className="text-xs font-bold" style={{ color: accent, textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
          AED {(totalCommission / 1000000).toFixed(1)}M
        </p>
        {showVCard && <ContactDataMiniPanel stage={stage} landlords={landlords} />}
      </div>

      {/* Cards Container — droppable, independent vertical scroll */}
      <div
        ref={setNodeRef}
        data-column-scroll="true"
        className={cn(
          'overflow-y-auto overscroll-contain p-2.5 space-y-2 transition-colors max-h-[calc(100vh-220px)] min-h-0',
          isOver ? 'bg-accent/5' : '',
        )}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(38 92% 50% / 0.5) transparent',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
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