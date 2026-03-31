import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext } from '@hello-pangea/dnd';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import PipelineColumn from '@/components/pipeline/PipelineColumn';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { PIPELINE_STAGES } from '@/lib/constants';
import MobilePipeline from '@/components/mobile/MobilePipeline';

const PROJECT_LAYERS = [
  { id: 'peninsula-three', label: 'Peninsula Three', color: 'bg-blue-500' },
  { id: 'jumeirah-living', label: 'Jumeirah Living', color: 'bg-emerald-500' },
  { id: 'six-senses', label: 'Six Senses', color: 'bg-purple-500' },
  { id: 'peninsula-four', label: 'Peninsula Four', color: 'bg-orange-500' },
];

export default function Pipeline() {
  const isMobile = useIsMobile();
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [search, setSearch] = useState('');
  const [activeLayer, setActiveLayer] = useState('peninsula-three');
  const queryClient = useQueryClient();

  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Pipeline" />
        <Button size="sm" onClick={() => setShowAddLead(true)} className="w-full bg-accent">
          <Plus className="w-4 h-4 mr-1" /> Add Lead
        </Button>
        <MobilePipeline />
        <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />
      </div>
    );
  }

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const filteredLeads = leads.filter(l =>
    (!search || l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) || l.email?.toLowerCase().includes(search.toLowerCase())) &&
    (!activeLayer || l.project_layer === activeLayer)
  );

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    const lead = leads.find(l => l.id === draggableId);
    if (lead && lead.stage !== newStage) {
      updateMutation.mutate({ id: draggableId, data: { stage: newStage } });
    }
  };

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="p-4 md:px-8 md:pt-8 md:pb-4">
         <PageHeader title="Pipeline" subtitle="Drag leads between stages">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input
               placeholder="Search leads..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="pl-9 w-52 h-9"
             />
           </div>
           <Button size="sm" onClick={() => setShowAddLead(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
             <Plus className="w-4 h-4 mr-1" /> Add Lead
           </Button>
         </PageHeader>

         {/* Project Layer Tabs */}
         <div className="flex gap-2 mt-4 flex-wrap">
           {PROJECT_LAYERS.map(layer => (
             <button
               key={layer.id}
               onClick={() => setActiveLayer(layer.id)}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                 activeLayer === layer.id
                   ? `${layer.color} text-white shadow-md`
                   : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
               }`}
             >
               {layer.label}
               {filteredLeads.length > 0 && (
                 <span className="ml-2 text-xs opacity-80">
                   ({leads.filter(l => l.project_layer === layer.id).length})
                 </span>
               )}
             </button>
           ))}
         </div>
       </div>

      <div className="flex-1 overflow-x-auto px-4 md:px-8 pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 min-w-max">
            {PIPELINE_STAGES.map(stage => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                leads={filteredLeads.filter(l => l.stage === stage.id)}
                onLeadClick={setSelectedLead}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {selectedLead && (
        <LeadDetailSheet
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}

      <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />
    </div>
  );
}