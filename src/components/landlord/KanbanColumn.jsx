import { memo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Users, Maximize2 } from 'lucide-react';
import KanbanCardRow from './KanbanCardRow';
import StageGuidePopover from './StageGuidePopover';
import { PHASE_BY_STAGE } from '@/lib/landlordStageGuide';

const GOLD = '#D8B26A';
const NAME = '#E9EDF6';
const SLATE = '#A7B0C4';
const HAIR = 'rgba(255,255,255,0.07)';
const HAIR2 = 'rgba(255,255,255,0.10)';
const CLARET = '#B4463F';
const CLARET_TEXT = '#C86F66';
const CLARET_BG = 'rgba(180,70,63,0.08)';
const CLARET_BORDER = 'rgba(180,70,63,0.35)';

// Card-level urgency — mirrors LandlordCard so the column can rank its urgent cards.
const isUrgent = (l) => {
  if ((l.urgency_score || 0) >= 60) return true;
  if (l.mandate_expires_at) {
    const d = Math.ceil((new Date(l.mandate_expires_at).getTime() - Date.now()) / 86400000);
    if (d >= 0 && d <= 14) return true;
  }
  return false;
};

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
  boardTotalCommission = 0,
  collapsed = false,
  onExpand,
}) {
  const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const sharePct = boardTotalCommission > 0 ? Math.min((totalCommission / boardTotalCommission) * 100, 100) : 0;
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const itemIds = landlords.map((l) => l.id);
  const phase = PHASE_BY_STAGE[stage];

  // ONE SIREN PER COLUMN — among urgent cards, the single most-overdue one (max days in
  // stage, tie → max urgency score) carries the full claret alert; the rest downgrade.
  let sirenId = null;
  let bestScore = -1;
  for (const l of landlords) {
    if (!isUrgent(l)) continue;
    const score = (l.days_in_stage || 0) * 1000 + (l.urgency_score || 0);
    if (score > bestScore) { bestScore = score; sirenId = l.id; }
  }
  const urgentCount = landlords.reduce((n, l) => n + (isUrgent(l) ? 1 : 0), 0);

  // Render cap — with 9,000+ landlords the board would mount 9,000 card nodes and
  // freeze the tab. Only the first RENDER_CAP cards render by default; the header
  // still shows the TRUE total (landlords.length) and a "show more" row expands the
  // rest. Counts, commission totals, search and filters all use the full list.
  const RENDER_CAP = 75;
  const [showAll, setShowAll] = useState(false);
  const visibleLandlords = landlords.length > RENDER_CAP && !showAll ? landlords.slice(0, RENDER_CAP) : landlords;

  // ── Slim rail — an empty stage collapsed to 46px. Still a FULL droppable target.
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={() => onExpand?.(stage)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand?.(stage); } }}
        title={`${label} — empty. Click to expand · drop a card here to move it to this stage`}
        className="flex-[0_0_auto] flex flex-col items-center cursor-pointer select-none"
        style={{
          width: 46,
          height: '100%',
          minHeight: 300,
          background: isOver ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: isOver ? `1px dashed ${GOLD}` : `1px solid ${HAIR}`,
          borderRadius: 14,
          boxShadow: isOver ? '0 0 0 1px rgba(216,178,106,0.25)' : 'none',
          position: 'relative',
          overflow: 'hidden',
          transition: 'background 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        <span
          className="mt-2.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
          style={{ color: SLATE, background: 'transparent', border: `1px solid ${HAIR2}`, fontVariantNumeric: 'tabular-nums' }}
        >
          0
        </span>
        <span
          className="flex-1 mt-2 mb-1 text-[10px] font-medium whitespace-nowrap overflow-hidden"
          style={{
            writingMode: 'vertical-rl',
            fontFamily: "'Montserrat',sans-serif",
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: isOver ? GOLD : SLATE,
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        <Maximize2 className="w-3 h-3 mb-2.5 shrink-0" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.35)' }} />
      </div>
    );
  }

  return (
    <div
      className="flex-[0_0_auto] w-80 flex flex-col overflow-hidden"
      style={{
        height: '100%',
        background: '#0B1020',
        border: `1px solid ${HAIR}`,
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Column Header — "AED X.XM · STAGE NAME" + gold underline + value-share bar + count/urgent chips */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 sticky top-0 z-10" style={{ background: '#0B1020', borderBottom: `1px solid ${HAIR}` }}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[14px] font-semibold" style={{ color: NAME, fontVariantNumeric: 'tabular-nums' }}>
              AED {(totalCommission / 1000000).toFixed(1)}M
            </span>
            <span className="text-[10.5px] truncate" style={{ color: SLATE, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
              · {label}
            </span>
            <StageGuidePopover stage={stage} accent={GOLD} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {urgentCount > 0 && (
              <span
                className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ color: CLARET_TEXT, background: CLARET_BG, border: `1px solid ${CLARET_BORDER}`, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}
                title={`${urgentCount} urgent card${urgentCount === 1 ? '' : 's'} in this stage — the most overdue carries the full alert`}
              >
                {urgentCount} NEED ACTION
              </span>
            )}
            <div
              className="flex items-center gap-1 px-1.5 h-5 rounded-full text-[9px] font-semibold"
              style={{ background: 'transparent', border: `1px solid ${HAIR2}`, color: SLATE, fontVariantNumeric: 'tabular-nums' }}
            >
              <Users className="w-2.5 h-2.5" strokeWidth={1.5} />
              {landlords.length}
            </div>
          </div>
        </div>
        {/* 24px × 2px gold underline accent */}
        <div style={{ width: 24, height: 2, background: GOLD, marginTop: 6, borderRadius: 1 }} />
        {/* Value-share bar — this column's pipeline value ÷ board total. */}
        <div className="flex items-center gap-2 mt-2">
          <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${sharePct}%`, background: 'linear-gradient(90deg,#AA8140,#F0D89E)', borderRadius: 1, transition: 'width 200ms ease-out' }} />
          </div>
          <span style={{ fontSize: 10, color: SLATE, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
            {sharePct.toFixed(sharePct < 10 ? 1 : 0)}%
          </span>
        </div>
      </div>

      {/* Cards Container — droppable, independent vertical scroll */}
      <div
        ref={setNodeRef}
        data-column-scroll="true"
        className="overflow-y-auto overscroll-contain p-2 space-y-2 transition-colors flex-1 min-h-0"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(216,178,106,0.3) transparent',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          background: isOver ? 'rgba(216,178,106,0.04)' : 'transparent',
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
              isColumnSiren={landlord.id === sirenId}
            />
          ))}
        </SortableContext>

        {!showAll && landlords.length > RENDER_CAP && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-center text-[10px] font-medium py-2 rounded-lg transition-colors"
            style={{ color: SLATE, background: 'transparent', border: `1px solid ${HAIR2}` }}
          >
            Show {landlords.length - RENDER_CAP} more…
          </button>
        )}

        {landlords.length === 0 && (
          <div
            className="flex items-center justify-center text-center p-2 mx-1 my-3 rounded-lg"
            style={{ color: SLATE, fontSize: 11, border: '1px dashed rgba(255,255,255,0.10)', minHeight: 80 }}
          >
            No landlords in this stage
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(KanbanColumn);