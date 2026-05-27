import React, { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import PipelineColumn from './PipelineColumn';
import { getStagesForIntent } from '@/lib/pipeline';

export default function PipelineBoard({ track, leads, getListing, onLeadClick, onStageChange }) {
  const stages = useMemo(() => getStagesForIntent(track), [track]);

  const leadsByStage = useMemo(() => {
    const map = {};
    for (const stage of stages) map[stage.key] = [];
    for (const lead of leads) {
      if (map[lead.stage]) {
        map[lead.stage].push(lead);
      } else {
        // Lead's stage doesn't belong to this track — drop into the first column so it's visible
        map[stages[0].key].push(lead);
      }
    }
    return map;
  }, [stages, leads]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId) return;
    onStageChange({ id: draggableId, newStage: destination.droppableId });
  };

  return (
    <div className="flex-1 overflow-x-auto pb-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 min-w-max">
          {stages.map((stage) => (
            <PipelineColumn
              key={stage.key}
              stage={stage}
              leads={leadsByStage[stage.key] || []}
              getListing={getListing}
              onLeadClick={onLeadClick}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
