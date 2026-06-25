import { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import KanbanCardRow from './KanbanCardRow';

// One pipeline column. Memoized so dragging within / over another column doesn't re-render
// columns whose card list is unchanged.
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
}) {
  const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);

  return (
    <div
      className="flex-shrink-0 w-[320px] rounded-2xl flex flex-col h-full"
      style={{
        scrollSnapAlign: 'start',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderTopColor: 'rgba(255,255,255,0.15)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Column Header */}
      <div className="p-3 shrink-0" style={{ borderBottom: '2px solid rgba(245,159,10,0.2)', background: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{label}</h3>
          <Badge variant="outline" className="text-xs" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
            {landlords.length}
          </Badge>
        </div>
        <p className="text-xs font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
          AED {(totalCommission / 1000000).toFixed(1)}M
        </p>
      </div>

      {/* Cards Container - droppable, internal scroll */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 overflow-y-auto p-2.5 space-y-2 transition-colors',
              snapshot.isDraggingOver ? 'bg-white/5' : '',
            )}
          >
            {landlords.map((landlord, index) => (
              <KanbanCardRow
                key={landlord.id}
                landlord={landlord}
                index={index}
                selectedLandlordId={selectedLandlordId}
                selectedIds={selectedIds}
                onSelectLandlord={onSelectLandlord}
                onToggleSelect={onToggleSelect}
                users={users}
                onSingleAssign={onSingleAssign}
                photographyTasks={photographyTasks}
                getPhotoForPhone={getPhotoForPhone}
              />
            ))}
            {provided.placeholder}

            {landlords.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-xs text-center p-2">
                No landlords in this stage
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default memo(KanbanColumn);