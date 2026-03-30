import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import PipelineCard from './PipelineCard';
import { cn } from '@/lib/utils';

export default function PipelineColumn({ stage, leads, onLeadClick }) {
  const colorMap = {
    blue: 'bg-blue-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  };

  return (
    <div className="flex flex-col w-[290px] shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 mb-2">
        <span className={cn("w-2 h-2 rounded-full", colorMap[stage.color])} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {stage.label}
        </h3>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted rounded-full w-6 h-6 flex items-center justify-center">
          {leads.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 space-y-2 p-2 rounded-xl min-h-[200px] transition-colors",
              snapshot.isDraggingOver ? "bg-accent/5" : "bg-transparent"
            )}
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <PipelineCard
                      lead={lead}
                      isDragging={snapshot.isDragging}
                      onClick={() => onLeadClick(lead)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}