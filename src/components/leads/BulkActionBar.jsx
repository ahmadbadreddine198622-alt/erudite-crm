import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, UserCheck, Tag, ArrowRight, Trash2, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { PIPELINE_STAGES } from '@/lib/constants';

export default function BulkActionBar({ selectedIds, onClear }) {
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState(null);
  const [agentEmail, setAgentEmail] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [stageValue, setStageValue] = useState('');
  const [projectId, setProjectId] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });

  const invalidate = () => {
    queryClient.invalidateQueries(['leads']);
    onClear();
    setActiveAction(null);
  };

  const bulkUpdate = useMutation({
    mutationFn: async (updateData) => {
      await Promise.all([...selectedIds].map(id => base44.entities.Lead.update(id, updateData)));
    },
    onSuccess: () => {
      toast.success(`Updated ${selectedIds.size} leads`);
      invalidate();
    },
    onError: () => toast.error('Bulk update failed'),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      await Promise.all([...selectedIds].map(id => base44.entities.Lead.delete(id)));
    },
    onSuccess: () => {
      toast.success(`Deleted ${selectedIds.size} leads`);
      invalidate();
    },
    onError: () => toast.error('Bulk delete failed'),
  });

  const handleAssign = () => {
    if (!agentEmail.trim()) return;
    bulkUpdate.mutate({ assigned_agent: agentEmail.trim() });
  };

  const handleTag = () => {
    if (!tagInput.trim()) return;
    const tag = tagInput.trim().toLowerCase();
    Promise.all([...selectedIds].map(async (id) => {
      const lead = await base44.entities.Lead.get(id);
      const tags = [...new Set([...(lead.tags || []), tag])];
      return base44.entities.Lead.update(id, { tags });
    })).then(() => {
      toast.success(`Tagged ${selectedIds.size} leads with "${tag}"`);
      invalidate();
    });
  };

  const handleStageChange = () => {
    if (!stageValue) return;
    bulkUpdate.mutate({ stage: stageValue });
  };

  const handleProjectTag = () => {
    if (!projectId) return;
    bulkUpdate.mutate({ project_id: projectId });
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap max-w-[90vw]"
      style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderTopColor: 'rgba(255,255,255,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <CheckSquare className="w-4 h-4 text-accent" />
        <span className="font-semibold text-sm">{selectedIds.size} selected</span>
      </div>
      <div className="w-px h-5 bg-white/20" />

      {activeAction === 'assign' ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Agent email..."
            value={agentEmail}
            onChange={e => setAgentEmail(e.target.value)}
            className="h-7 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/50 w-48"
            onKeyDown={e => e.key === 'Enter' && handleAssign()}
          />
          <Button size="sm" className="h-7 bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={handleAssign}>
            Assign
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/60" onClick={() => setActiveAction(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : activeAction === 'tag' ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Tag name..."
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            className="h-7 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/50 w-36"
            onKeyDown={e => e.key === 'Enter' && handleTag()}
          />
          <Button size="sm" className="h-7 bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={handleTag}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/60" onClick={() => setActiveAction(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : activeAction === 'stage' ? (
        <div className="flex items-center gap-2">
          <Select value={stageValue} onValueChange={setStageValue}>
            <SelectTrigger className="h-7 text-xs bg-white/10 border-white/20 text-white w-44">
              <SelectValue placeholder="Select stage..." />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={handleStageChange}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/60" onClick={() => setActiveAction(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : activeAction === 'project' ? (
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-7 text-xs bg-white/10 border-white/20 text-white w-48">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={handleProjectTag}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-white/60" onClick={() => setActiveAction(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-white/10 text-white" onClick={() => setActiveAction('assign')}>
            <UserCheck className="w-3 h-3" /> Assign Agent
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-white/10 text-white" onClick={() => setActiveAction('tag')}>
            <Tag className="w-3 h-3" /> Add Tag
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-white/10 text-white" onClick={() => setActiveAction('stage')}>
            <ArrowRight className="w-3 h-3" /> Change Stage
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-white/10 text-white" onClick={() => setActiveAction('project')}>
            <Tag className="w-3 h-3" /> Set Project
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 hover:bg-white/10 text-red-300 hover:text-red-200"
            onClick={() => {
              if (confirm(`Delete ${selectedIds.size} leads? This cannot be undone.`)) bulkDelete.mutate();
            }}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        </>
      )}

      <div className="w-px h-5 bg-white/20" />
      <Button size="sm" variant="ghost" className="h-7 text-white/60 hover:text-white hover:bg-white/10 p-1" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}