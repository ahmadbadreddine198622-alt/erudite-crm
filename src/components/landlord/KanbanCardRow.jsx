import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LandlordCard from './LandlordCard';

// A single sortable row. The whole row is the drag handle (listeners spread here), but the
// 8px activation distance on the sensors lets buttons inside the card still be clicked.
// Memoized so during a drag only rows whose props actually change re-render.
function KanbanCardRow({
  landlord,
  selectedLandlordId,
  selectedIds,
  onSelectLandlord,
  onToggleSelect,
  users,
  onSingleAssign,
  photographyTasks,
  getPhotoForPhone,
  isActive,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: landlord.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The card lifted into the DragOverlay leaves a dimmed placeholder gap in its slot.
    opacity: isActive ? 0.4 : 1,
  };

  // Only the grip handle drags (listeners passed down to the card's handle), so the card body
  // click reliably navigates and the inline buttons reliably fire — no drag-vs-tap ambiguity.
  return (
    <div ref={setNodeRef} style={style}>
      <LandlordCard
        landlord={landlord}
        isSelected={landlord.id === selectedLandlordId}
        isDragging={false}
        onClick={() => onSelectLandlord(landlord.id)}
        isChecked={selectedIds.has(landlord.id)}
        onToggleCheck={onToggleSelect}
        users={users}
        onSingleAssign={onSingleAssign}
        photographyTasks={photographyTasks}
        getPhotoForPhone={getPhotoForPhone}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export default memo(KanbanCardRow, (prev, next) => (
  prev.landlord === next.landlord &&
  prev.isActive === next.isActive &&
  prev.selectedLandlordId === next.selectedLandlordId &&
  prev.selectedIds === next.selectedIds &&
  prev.users === next.users &&
  prev.photographyTasks === next.photographyTasks &&
  prev.getPhotoForPhone === next.getPhotoForPhone &&
  prev.onSelectLandlord === next.onSelectLandlord &&
  prev.onToggleSelect === next.onToggleSelect &&
  prev.onSingleAssign === next.onSingleAssign
));