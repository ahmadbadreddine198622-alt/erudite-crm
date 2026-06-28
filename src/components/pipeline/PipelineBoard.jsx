import React, { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import PipelineColumn from './PipelineColumn';
import { getStagesForIntent } from '@/lib/pipeline';

export default function PipelineBoard({ track, leads, getListing, getPhotoForPhone, onLeadClick, onStageChange, users, onAssign, onDelete }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
      <div
        className="overflow-x-auto overflow-y-hidden pb-4"
        style={{
          height: '100%',
          minWidth: 0,
          position: 'relative',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(38 92% 50% / 0.45) transparent',
          overscrollBehavior: 'contain',
        }}
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 min-w-max h-full">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage.key}
                stage={stage}
                leads={leadsByStage[stage.key] || []}
                getListing={getListing}
                getPhotoForPhone={getPhotoForPhone}
                onLeadClick={onLeadClick}
                users={users}
                onAssign={onAssign}
                onDelete={onDelete}
              />
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}