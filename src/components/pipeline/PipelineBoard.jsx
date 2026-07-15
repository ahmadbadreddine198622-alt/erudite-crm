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

  // Board total value — same formula PipelineSummaryCard uses (Σ deal_value_aed).
  const boardTotalValue = useMemo(
    () => leads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0),
    [leads],
  );

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId) return;
    onStageChange({ id: draggableId, newStage: destination.droppableId });
  };

  return (
    <div
      className="overflow-x-auto overflow-y-hidden pb-3 pipeline-scroll"
      style={{
        height: '100%',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(198,161,91,0.4) transparent',
        overscrollBehavior: 'contain',
      }}
    >
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '12px', width: 'max-content', height: '100%', paddingRight: '16px' }}>
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
              trackStages={stages}
              boardTotalValue={boardTotalValue}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}