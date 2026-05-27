import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import PipelineLeadCard from './PipelineLeadCard';
import { cn } from '@/lib/utils';

export default function PipelineColumn({ stage, leads, getListing, onLeadClick }) {
  return (
    <div className="flex flex-col w-[300px] shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {stage.label}
        </h3>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center">
          {leads.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 space-y-2 p-2 rounded-xl min-h-[200px] transition-colors',
              snapshot.isDraggingOver ? 'bg-accent/5' : 'bg-transparent',
            )}
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
              <div className="border-2 border-dashed border-border/40 rounded-xl p-6 flex items-center justify-center">
                <p className="text-[11px] text-muted-foreground/60 italic">No leads in this stage</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
