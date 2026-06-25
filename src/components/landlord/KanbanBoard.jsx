import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
} from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import LandlordCard from './LandlordCard';

// Single board: one DndContext, each stage column is a droppable, each card sortable.
// Cards carry many buttons, so PointerSensor + TouchSensor both use an 8px activation
// distance — a click on a button doesn't start a drag, and a drag doesn't fire a click.
export default function KanbanBoard({
  stages,
  stageLabels,
  stageGroups,
  selectedLandlordId,
  onSelectLandlord,
  onStageChange,
  selectedIds = new Set(),
  onToggleSelect,
  users = [],
  onSingleAssign,
  photographyTasks = [],
  getPhotoForPhone,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  // Map landlord id -> its current stage, for fast source lookup on drag end.
  const idToStage = useMemo(() => {
    const map = new Map();
    stages.forEach((stage) => {
      (stageGroups[stage] || []).forEach((l) => map.set(l.id, stage));
    });
    return map;
  }, [stages, stageGroups]);

  const activeLandlord = useMemo(() => {
    if (!activeId) return null;
    for (const stage of stages) {
      const found = (stageGroups[stage] || []).find((l) => l.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, stages, stageGroups]);

  // Resolve the destination stage from whatever the card is dropped over —
  // either a column droppable (id === stage) or another card (look up its stage).
  const resolveDestStage = (overId) => {
    if (!overId) return null;
    if (stages.includes(overId)) return overId;
    return idToStage.get(overId) || null;
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const sourceStage = idToStage.get(active.id);
    const destStage = resolveDestStage(over.id);
    if (!destStage || !sourceStage) return;
    if (sourceStage === destStage) return; // within-column reorder — no stage write needed
    onStageChange({ id: active.id, newStage: destStage });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      autoScroll={{ threshold: { x: 0.15, y: 0.2 } }}
    >
      <div className="flex flex-row items-start gap-4 pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            label={stageLabels[stage]}
            landlords={stageGroups[stage] || []}
            selectedLandlordId={selectedLandlordId}
            selectedIds={selectedIds}
            onSelectLandlord={onSelectLandlord}
            onToggleSelect={onToggleSelect}
            users={users}
            onSingleAssign={onSingleAssign}
            photographyTasks={photographyTasks}
            getPhotoForPhone={getPhotoForPhone}
            activeId={activeId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeLandlord ? (
          <div className="w-[300px] scale-[1.03] shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-xl">
            <LandlordCard
              landlord={activeLandlord}
              isDragging
              users={users}
              photographyTasks={photographyTasks}
              getPhotoForPhone={getPhotoForPhone}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}