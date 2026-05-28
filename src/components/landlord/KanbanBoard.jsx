import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import LandlordCard from './LandlordCard';

export default function KanbanBoard({
  stages,
  stageLabels,
  stageGroups,
  selectedLandlordId,
  onSelectLandlord,
  onStageChange,
}) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId) return;
    onStageChange({ id: draggableId, newStage: destination.droppableId });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 min-w-max h-full pb-4">
        {stages.map((stage) => {
          const landlords = stageGroups[stage] || [];
          const totalCommission = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);

          return (
            <div
              key={stage}
              className="flex-shrink-0 w-80 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border overflow-hidden flex flex-col h-full"
            >
              {/* Column Header */}
              <div className="bg-card border-b border-border p-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{stageLabels[stage]}</h3>
                  <Badge variant="outline" className="text-xs">
                    {landlords.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  AED {(totalCommission / 1000000).toFixed(1)}M
                </p>
              </div>

              {/* Cards Container - droppable, internal scroll */}
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 overflow-y-auto p-3 space-y-2 transition-colors',
                      snapshot.isDraggingOver ? 'bg-accent/5' : '',
                    )}
                  >
                    {landlords.map((landlord, index) => (
                      <Draggable key={landlord.id} draggableId={landlord.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                          >
                            <LandlordCard
                              landlord={landlord}
                              isSelected={landlord.id === selectedLandlordId}
                              isDragging={dragSnapshot.isDragging}
                              onClick={() => onSelectLandlord(landlord.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {landlords.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-32 text-muted-foreground text-xs text-center p-2">
                        No landlords in this stage
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
