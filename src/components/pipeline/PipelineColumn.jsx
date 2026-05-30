import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import PipelineLeadCard from './PipelineLeadCard';
import { cn } from '@/lib/utils';

export default function PipelineColumn({ stage, leads, getListing, onLeadClick }) {
  return (
    <div
      className="flex flex-col w-[280px] shrink-0 h-full min-h-0 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTopColor: 'rgba(255,255,255,0.14)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3"
        style={{
          background: 'rgba(8,11,18,0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px 16px 0 0',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <h3
          className="text-[11px] font-semibold uppercase truncate"
          style={{ fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em' }}
        >
          {stage.label}
        </h3>
        <span
          className="ml-auto text-[10px] font-semibold rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center"
          style={{ background: 'rgba(245,159,10,0.12)', color: 'hsl(38 92% 50%)', border: '1px solid rgba(245,159,10,0.22)' }}
        >
          {leads.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto space-y-2 p-2 transition-all duration-200"
            style={{
              outline: snapshot.isDraggingOver ? '1px solid rgba(245,159,10,0.35)' : '1px solid transparent',
              outlineOffset: '-4px',
              borderRadius: '0 0 16px 16px',
              background: snapshot.isDraggingOver ? 'rgba(245,159,10,0.04)' : 'transparent',
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
                style={{ border: '1px dashed rgba(255,255,255,0.10)' }}
              >
                <p className="text-[11px] italic" style={{ color: 'rgba(255,255,255,0.25)' }}>
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