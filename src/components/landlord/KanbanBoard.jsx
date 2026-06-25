import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';

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

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId) return;
    onStageChange({ id: draggableId, newStage: destination.droppableId });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full pb-4" style={{ scrollSnapType: 'x proximity' }}>
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
          />
        ))}
      </div>
    </DragDropContext>
  );
}