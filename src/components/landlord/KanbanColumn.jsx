import { memo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Users, ChevronDown } from 'lucide-react';
import KanbanCardRow from './KanbanCardRow';
import StageGuidePopover from './StageGuidePopover';
import { PHASE_BY_STAGE } from '@/lib/landlordStageGuide';

// One pipeline column. Memoized so dragging within / over another column doesn't re-render
// columns whose card list is unchanged. The whole column body is a droppable so an EMPTY
// column is still a valid drop target.
//
// Cap + collapse: when `cap` is set, only the top `cap` cards render with a "+X more"
// expander. When `defaultCollapsed` is true, the card body is hidden until the header
// is clicked — used for empty/tiny stages so the board stays focused.
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
  cap,
  defaultCollapsed = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const itemIds = landlords.map((l) => l.id);
  const phase = PHASE_BY_STAGE[stage];
  const accent = phase?.color || 'hsl(38 92% 50%)';

  // Apply cap if set and not expanded
  const visibleLandlords = (cap && !expanded && landlords.length > cap)
    ? landlords.slice(0, cap)
    : landlords;
  const hiddenCount = landlords.length - visibleLandlords.length;


  return (
    <div
      className="flex-[0_0_auto] w-80 rounded-2xl flex flex-col self-start overflow-hidden"
      style={{
        background: 'linear-gradient(180deg,rgba(255,255,255,.032) 0%,rgba(255,255,255,.007) 100%)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: '18px',
        boxShadow: '0 16px 34px -22px rgba(0,0,0,.85)',
        position: 'relative',
        overflow: 'hidden',
      }}
      >
      {/* 2px top accent rail — gold for Win the Mandate, blue for Build the Listing, emerald for Sell the Unit */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none z-0 rounded-t-[18px]"
        style={{
          background: `linear-gradient(90deg,transparent,${accent},transparent)`,
          opacity: 0.72,
        }}
      />

      {/* Column Header — pinned to the top of the column. Click to collapse/expand when defaultCollapsed is available. */}
      <div
        className="p-3 shrink-0 sticky top-0 z-10 cursor-pointer"
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,.06)' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center justify-between mb-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {defaultCollapsed && (
              <ChevronDown className="w-3 h-3 shrink-0 transition-transform duration-200" style={{ color: accent, transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
            )}
            <h3 className="text-sm truncate" style={{ fontFamily: "'Cormorant',serif", fontWeight: 600, color: 'rgb(232,236,246)' }}>{label}</h3>
            <StageGuidePopover stage={stage} accent={accent} />
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-semibold shrink-0"
            style={{ background: accent === '#c9a24b' ? 'rgba(201,162,75,.12)' : accent === '#5a93e0' ? 'rgba(90,147,224,.12)' : 'rgba(63,185,138,.12)', border: `1px solid ${accent}4a`, color: accent }}
          >
            <Users className="w-2.5 h-2.5" />
            {landlords.length}
          </div>
        </div>
        <p className="text-xs font-bold" style={{ color: accent, textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
          AED {(totalCommission / 1000000).toFixed(1)}M
        </p>
      </div>

      {/* Cards Container — droppable, independent vertical scroll. Hidden when collapsed. */}
      {!collapsed && (
        <div
          ref={setNodeRef}
          data-column-scroll="true"
          className={cn(
            'overflow-y-auto overscroll-contain p-2.5 space-y-2 transition-colors max-h-[calc(100vh-220px)] min-h-0',
            isOver ? 'bg-accent/5' : '',
          )}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(201,162,75,.25) transparent',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {visibleLandlords.map((landlord) => (
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

          {/* "+X more" expander when capped */}
          {hiddenCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              className="w-full mt-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: 'rgba(201,162,75,.08)',
                border: '1px solid rgba(201,162,75,.2)',
                color: '#c9a24b',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              +{hiddenCount} more
            </button>
          )}

          {landlords.length === 0 && (
            <div className="flex items-center justify-center h-32 text-xs text-center p-2" style={{ color: '#5f6a85' }}>
              No landlords in this stage
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(KanbanColumn);