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

export default function Pipeline() {
  const isMobile = useIsMobile();
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [search, setSearch] = useState('');
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
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) || l.email?.toLowerCase().includes(search.toLowerCase())
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