import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import LandlordCard from './LandlordCard';

// A single draggable row, memoized so that during a drag only the rows whose props actually
// change re-render. @hello-pangea/dnd re-renders the board on every pointer move; without this
// boundary, all ~600 cards reconcile each frame and the drag hangs.
function KanbanCardRow({
  landlord,
  index,
  selectedLandlordId,
  selectedIds,
  onSelectLandlord,
  onToggleSelect,
  users,
  onSingleAssign,
  photographyTasks,
  getPhotoForPhone,
}) {
  return (
    <Draggable draggableId={landlord.id} index={index}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
          style={dragProvided.draggableProps.style}
        >
          <LandlordCard
            landlord={landlord}
            isSelected={landlord.id === selectedLandlordId}
            isDragging={dragSnapshot.isDragging}
            onClick={() => onSelectLandlord(landlord.id)}
            isChecked={selectedIds.has(landlord.id)}
            onToggleCheck={onToggleSelect}
            users={users}
            onSingleAssign={onSingleAssign}
            photographyTasks={photographyTasks}
            getPhotoForPhone={getPhotoForPhone}
          />
        </div>
      )}
    </Draggable>
  );
}

export default memo(KanbanCardRow, (prev, next) => (
  prev.landlord === next.landlord &&
  prev.index === next.index &&
  prev.selectedLandlordId === next.selectedLandlordId &&
  prev.selectedIds === next.selectedIds &&
  prev.users === next.users &&
  prev.photographyTasks === next.photographyTasks &&
  prev.getPhotoForPhone === next.getPhotoForPhone &&
  prev.onSelectLandlord === next.onSelectLandlord &&
  prev.onToggleSelect === next.onToggleSelect &&
  prev.onSingleAssign === next.onSingleAssign
));