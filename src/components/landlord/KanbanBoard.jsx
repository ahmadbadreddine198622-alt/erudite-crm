import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import LandlordCard from './LandlordCard';
import { PHASES } from '@/lib/landlordStageGuide';

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
  onDragActiveChange,
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
    onDragActiveChange?.(false);
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
      collisionDetection={closestCorners}
      onDragStart={(e) => { setActiveId(e.active.id); onDragActiveChange?.(true); }}
      onDragCancel={() => { setActiveId(null); onDragActiveChange?.(false); }}
      onDragEnd={handleDragEnd}
      autoScroll={{ threshold: { x: 0.15, y: 0.2 } }}
    >
      <div className="flex flex-row items-start gap-5 pb-4" style={{ minWidth: 'max-content' }}>
        {PHASES.map((phase) => {
          // Only render stages that exist in this board's `stages` list, preserving order.
          const phaseStages = phase.stages.filter((s) => stages.includes(s));
          if (phaseStages.length === 0) return null;
          const phaseCount = phaseStages.reduce((n, s) => n + (stageGroups[s]?.length || 0), 0);
          return (
            <div key={phase.key} className="flex flex-col gap-2 shrink-0">
              {/* Phase band — colored strip spanning this phase's columns */}
              <div
                className="rounded-xl px-3 py-2 flex items-center gap-2.5"
                style={{
                  background: `linear-gradient(90deg, ${phase.color}26, ${phase.color}0d)`,
                  border: `1px solid ${phase.color}55`,
                  borderLeft: `3px solid ${phase.color}`,
                }}
              >
                <span className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: phase.color, fontFamily: 'var(--font-display)' }}>
                  {phase.name}
                </span>
                <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {phase.purpose}
                </span>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${phase.color}22`, color: phase.color }}>
                  {phaseCount}
                </span>
              </div>

              {/* This phase's stage columns */}
              <div className="flex flex-row items-start gap-4">
                {phaseStages.map((stage) => (
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
                    onStageChange={onStageChange}
                  />
                ))}
              </div>
            </div>
          );
        })}
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