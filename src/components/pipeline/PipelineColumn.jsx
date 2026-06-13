import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import PipelineLeadCard from './PipelineLeadCard';
import { cn } from '@/lib/utils';

export default function PipelineColumn({ stage, leads, getListing, onLeadClick, users, onAssign, onDelete }) {
  return (
    <div
      className="flex flex-col w-[300px] shrink-0 h-full min-h-0 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderTopColor: 'rgba(255,255,255,0.16)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
      }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-4 py-3"
        style={{
          background: 'rgba(8,11,18,0.7)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(245,159,10,0.2)',
        }}
      >
        <div className="flex items-center gap-2">
          <h3
            className="text-[10px] font-bold uppercase truncate"
            style={{ fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.12em' }}
          >
            {stage.label}
          </h3>
          <span
            className="ml-auto text-[11px] font-bold rounded-full min-w-[26px] h-[26px] px-2 flex items-center justify-center"
            style={{ background: 'rgba(245,159,10,0.15)', color: 'hsl(38 92% 50%)', border: '1px solid rgba(245,159,10,0.3)' }}
          >
            {leads.length}
          </span>
        </div>
        {(() => {
          const total = leads.reduce((s, l) => s + (l.deal_value_aed || 0), 0);
          if (!total) return null;
          const fmt = total >= 1_000_000
            ? `AED ${(total / 1_000_000).toFixed(1)}M`
            : total >= 1_000
            ? `AED ${Math.round(total / 1_000)}K`
            : `AED ${total}`;
          return <p className="text-[10px] font-bold mt-0.5" style={{ color: 'hsl(38 92% 50%)' }}>{fmt}</p>;
        })()}
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto space-y-2 p-2 transition-all duration-200"
            style={{
              outline: snapshot.isDraggingOver ? '2px solid rgba(245,159,10,0.4)' : '2px solid transparent',
              outlineOffset: '-4px',
              borderRadius: '0 0 16px 16px',
              background: snapshot.isDraggingOver ? 'rgba(245,159,10,0.06)' : 'transparent',
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
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {/* Empty state */}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div
                className="rounded-xl p-6 flex items-center justify-center"
                style={{ border: '1px dashed rgba(255,255,255,0.12)' }}
              >
                <p className="text-[11px] italic" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  No leads in this stage
                </p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}