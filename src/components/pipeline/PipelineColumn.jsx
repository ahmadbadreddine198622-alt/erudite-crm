import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import PipelineLeadCard from './PipelineLeadCard';
import { PB, isAtRisk, sirenScore, formatAEDCompact } from '@/lib/buyerPipelineTokens';
import { Users } from 'lucide-react';

export default function PipelineColumn({ stage, leads, getListing, getPhotoForPhone, onLeadClick, users, onAssign, onDelete, trackStages, boardTotalValue = 0 }) {
  const totalValue = leads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0);
  const sharePct = boardTotalValue > 0 ? Math.min((totalValue / boardTotalValue) * 100, 100) : 0;

  // ONE SIREN PER COLUMN — among at-risk leads, the single most at-risk one (max days × churn)
  // carries the full claret alert; the rest downgrade to a quiet dot.
  let sirenId = null;
  let bestScore = -1;
  for (const l of leads) {
    if (!isAtRisk(l)) continue;
    const sc = sirenScore(l);
    if (sc > bestScore) { bestScore = sc; sirenId = l.id; }
  }
  const atRiskCount = leads.reduce((n, l) => n + (isAtRisk(l) ? 1 : 0), 0);

  return (
    <div
      className="flex flex-col w-[300px] shrink-0 h-full min-h-0 overflow-hidden"
      style={{
        background: PB.BASE,
        border: `1px solid ${PB.HAIR}`,
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)',
        position: 'relative',
      }}
    >
      {/* Column Header — "AED X.XM" white 14px tabular · "· STAGE NAME" 10.5px SLATE · gold underline · count chip · N AT RISK chip */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 sticky top-0 z-10" style={{ background: PB.BASE, borderBottom: `1px solid ${PB.HAIR}` }}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[14px] font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums' }}>
              {totalValue > 0 ? formatAEDCompact(totalValue) : ''}
            </span>
            <span className="text-[10.5px] truncate" style={{ color: PB.SLATE, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
              {totalValue > 0 ? '· ' : ''}{stage.label}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {atRiskCount > 0 && (
              <span
                className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ color: PB.CLARET_TEXT, background: PB.CLARET_BG, border: `1px solid ${PB.CLARET_BORDER}`, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}
                title={`${atRiskCount} at-risk lead${atRiskCount === 1 ? '' : 's'} in this stage — the most at-risk carries the full alert`}
              >
                {atRiskCount} AT RISK
              </span>
            )}
            <div
              className="flex items-center gap-1 px-1.5 h-5 rounded-full text-[9px] font-semibold"
              style={{ background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}
            >
              <Users className="w-2.5 h-2.5" strokeWidth={1.5} />
              {leads.length}
            </div>
          </div>
        </div>
        {/* 24px × 2px gold underline accent */}
        <div style={{ width: 24, height: 2, background: PB.GOLD, marginTop: 6, borderRadius: 1 }} />
        {/* Value-share bar — column value ÷ board total */}
        <div className="flex items-center gap-2 mt-2">
          <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${sharePct}%`, background: 'linear-gradient(90deg,#A88443,#D9B36C)', borderRadius: 1, transition: 'width 200ms ease-out' }} />
          </div>
          <span style={{ fontSize: 10, color: PB.SLATE, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
            {sharePct.toFixed(sharePct < 10 ? 1 : 0)}%
          </span>
        </div>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            data-column-scroll="true"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 p-2"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(198,161,91,0.3) transparent',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              background: snapshot.isDraggingOver ? 'rgba(198,161,91,0.04)' : 'transparent',
              transition: 'background 150ms ease',
            }}
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  >
                    <PipelineLeadCard
                      lead={lead}
                      listing={getListing ? getListing(lead) : null}
                      isDragging={dragSnapshot.isDragging}
                      onClick={() => onLeadClick(lead)}
                      users={users}
                      onAssign={onAssign}
                      onDelete={onDelete}
                      getPhotoForPhone={getPhotoForPhone}
                      isColumnSiren={lead.id === sirenId}
                      trackStages={trackStages}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {/* Empty state */}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div
                className="flex items-center justify-center text-center p-2 mx-1 my-3 rounded-lg"
                style={{ color: PB.SLATE, fontSize: 11, border: `1px dashed ${PB.HAIR2}`, minHeight: 80 }}
              >
                No leads in this stage
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}