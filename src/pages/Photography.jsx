import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Home, Key, AlertCircle, CheckCircle2, Film, Disc, FileText, Loader2, Zap, Droplet, Package, ArrowRight, Send } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

const STAGE_COLUMNS = ['inquiry', 'pre_shoot_check', 'shooting', 'uploaded_3d', 'editing', 'complete'];

const STAGE_LABELS = {
  inquiry: 'Inquiry',
  pre_shoot_check: 'Pre-Shoot Check',
  shooting: 'Shooting',
  uploaded_3d: '3D Uploaded',
  editing: 'Editing',
  complete: 'Complete',
};

const NEXT_STAGE = {
  inquiry: 'pre_shoot_check',
  pre_shoot_check: 'shooting',
  shooting: 'uploaded_3d',
  uploaded_3d: 'editing',
  editing: 'complete',
  complete: 'handed_to_listing',
};

const BUTTON_LABELS = {
  inquiry: 'Start',
  pre_shoot_check: 'Ready to shoot',
  shooting: 'Shot done',
  uploaded_3d: '3D uploaded',
  editing: 'Editing done',
  complete: 'Send to listing',
};

const MEDIA_CONFIG = [
  { label: '360° Tour', key: 'has_360_tour', icon: Disc },
  { label: 'Drone Footage', key: 'has_drone_footage', icon: Film },
  { label: 'Video Walkthrough', key: 'has_video_walkthrough', icon: Camera },
  { label: 'Floor Plan', key: 'has_floor_plan', icon: FileText },
];

function PhotographyCard({ item, refetch }) {
  const [editingSubstatus, setEditingSubstatus] = useState(item.editing_substatus || '');
  const [completionNotes, setCompletionNotes] = useState(item.completion_notes || '');
  const [videoLink, setVideoLink] = useState(item.video_link || '');
  const [photosLink, setPhotosLink] = useState(item.photos_link || '');
  const [tour3dLink, setTour3dLink] = useState(item.tour_3d_link || '');

  const handleSaveLinks = () => {
    const updates = {};
    if (tour3dLink) updates.tour_3d_link = tour3dLink;
    if (videoLink) updates.video_link = videoLink;
    if (photosLink) updates.photos_link = photosLink;
    
    if (Object.keys(updates).length === 0) {
      toast.error('Please enter at least one link');
      return;
    }
    
    updateFieldsMutation.mutate({ task_id: item.task_id, updates });
  };

  const advanceMutation = useMutation({
    mutationFn: ({ task_id, new_stage }) => 
      base44.functions.invoke('advancePhotographyTask', { task_id, new_stage }),
    onSuccess: () => {
      refetch();
      toast.success('Task advanced');
    },
    onError: (err) => toast.error('Failed: ' + err.message),
  });

  const updateFieldsMutation = useMutation({
    mutationFn: ({ task_id, updates }) => 
      base44.functions.invoke('updatePhotographyTaskFields', { task_id, updates }),
    onSuccess: () => {
      refetch();
      toast.success('Saved');
    },
    onError: (err) => toast.error('Failed: ' + err.message),
  });

  const handleAdvance = () => {
    const next = NEXT_STAGE[item.task_stage];
    if (!next) return;
    advanceMutation.mutate({ task_id: item.task_id, new_stage: next });
  };

  const handleSaveFields = () => {
    const updates = {};
    if (item.task_stage === 'editing') updates.editing_substatus = editingSubstatus;
    if (item.task_stage === 'complete') {
      updates.completion_notes = completionNotes;
    }
    if (Object.keys(updates).length === 0) return;
    updateFieldsMutation.mutate({ task_id: item.task_id, updates });
  };

  const isSaving = advanceMutation.isPending || updateFieldsMutation.isPending;

  return (
    <Card className="glass-card mb-3 last:mb-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-accent truncate text-sm" style={{ color: 'hsl(38 92% 55%)' }}>
              {item.project || 'Unknown Project'}
            </h3>
            {item.unit_reference && (
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <Home className="w-2.5 h-2.5" />
                Unit {item.unit_reference}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Owner */}
        {item.owner_name && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px] shrink-0">
              {item.owner_name[0]?.toUpperCase()}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{item.owner_name}</p>
          </div>
        )}

        {/* Media flags */}
        <div className="pt-1 border-t border-white/10">
          <p className="text-[9px] text-muted-foreground mb-1">Media</p>
          <div className="flex flex-wrap gap-1">
            {MEDIA_CONFIG.map((config) => {
              const Icon = config.icon;
              const isDone = item[config.key] === true;
              return (
                <span
                  key={config.key}
                  className={
                    isDone
                      ? 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                      : 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400'
                  }
                >
                  {isDone ? <CheckCircle2 className="w-2 h-2" /> : <Icon className="w-2 h-2" />}
                  {config.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Pre-shoot details - only show if populated */}
        <div className="pt-1 border-t border-white/10 space-y-1.5">
          {/* Access */}
          {(item.keys_location || item.key_access_instructions) && (
            <div>
              <div className="flex items-center gap-1 text-[9px] mb-0.5">
                <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="font-medium text-[9px]">Access</span>
              </div>
              {item.keys_location && (
                <p className="text-[8px] text-muted-foreground pl-4">
                  Keys: <span className="text-foreground">{item.keys_location.replace(/_/g, ' ')}</span>
                </p>
              )}
              {item.key_access_instructions && (
                <p className="text-[8px] text-muted-foreground pl-4 italic">
                  {item.key_access_instructions}
                </p>
              )}
            </div>
          )}

          {/* Condition */}
          {(item.unit_condition || item.furnishing) && (
            <div>
              <div className="flex items-center gap-1 text-[9px] mb-0.5">
                <Home className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span className="font-medium text-[9px]">Condition</span>
              </div>
              {item.unit_condition && (
                <p className="text-[8px] text-muted-foreground pl-4">
                  Unit: <span className="text-foreground">{item.unit_condition.replace(/_/g, ' ')}</span>
                </p>
              )}
              {item.furnishing && (
                <p className="text-[8px] text-muted-foreground pl-4">
                  Furnishing: <span className="text-foreground">{item.furnishing.replace(/_/g, ' ')}</span>
                </p>
              )}
            </div>
          )}

          {/* Readiness - highlight missing utilities */}
          {(item.has_bedsheets !== undefined || item.has_pillows !== undefined || item.electricity_on !== undefined || item.water_on !== undefined) && (
            <div>
              <div className="flex items-center gap-1 text-[9px] mb-0.5">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <span className="font-medium text-[9px]">Readiness</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-4">
                {item.has_bedsheets !== undefined && (
                  <span className={item.has_bedsheets ? 'text-[8px] text-emerald-400' : 'text-[8px] text-red-400 font-semibold'}>
                    {item.has_bedsheets ? '✓ Bedsheets' : '⚠ Bedsheets'}
                  </span>
                )}
                {item.has_pillows !== undefined && (
                  <span className={item.has_pillows ? 'text-[8px] text-emerald-400' : 'text-[8px] text-red-400 font-semibold'}>
                    {item.has_pillows ? '✓ Pillows' : '⚠ Pillows'}
                  </span>
                )}
                {item.electricity_on !== undefined && (
                  <span className={item.electricity_on ? 'text-[8px] text-emerald-400' : 'text-[8px] text-red-400 font-semibold flex items-center gap-0.5'}>
                    {item.electricity_on ? <Zap className="w-2 h-2" /> : <Zap className="w-2 h-2 fill-red-400" />}
                    Electricity
                  </span>
                )}
                {item.water_on !== undefined && (
                  <span className={item.water_on ? 'text-[8px] text-emerald-400' : 'text-[8px] text-red-400 font-semibold flex items-center gap-0.5'}>
                    {item.water_on ? <Droplet className="w-2 h-2" /> : <Droplet className="w-2 h-2 fill-red-400" />}
                    Water
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Staging */}
          {(item.staging_needed || item.what_to_bring) && (
            <div>
              <div className="flex items-center gap-1 text-[9px] mb-0.5">
                <Package className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                <span className="font-medium text-[9px]">Staging</span>
              </div>
              {item.staging_needed && (
                <p className="text-[8px] text-muted-foreground pl-4">
                  {item.staging_needed}
                </p>
              )}
              {item.what_to_bring && (
                <p className="text-[8px] text-muted-foreground pl-4">
                  Bring: {item.what_to_bring}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stage-specific editable fields */}
        {item.task_stage === 'editing' && (
          <div className="pt-1.5 border-t border-white/10">
            <Input
              placeholder="Editing substatus (e.g., video finalizing)"
              value={editingSubstatus}
              onChange={(e) => setEditingSubstatus(e.target.value)}
              className="h-7 text-[10px]"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        )}

        {item.task_stage === 'complete' && (
          <div className="pt-1.5 border-t border-white/10">
            <Input
              placeholder="Completion notes"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="h-7 text-[10px]"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        )}

        {/* Links section - visible in ALL stages */}
        <div className="pt-1.5 border-t border-white/10 space-y-1.5">
          <p className="text-[9px] text-muted-foreground font-medium">Links</p>
          <Input
            placeholder="3D tour link"
            value={tour3dLink}
            onChange={(e) => setTour3dLink(e.target.value)}
            className="h-7 text-[10px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Input
            placeholder="Video link"
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            className="h-7 text-[10px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Input
            placeholder="Photos link"
            value={photosLink}
            onChange={(e) => setPhotosLink(e.target.value)}
            className="h-7 text-[10px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* Advance button */}
        <div className="pt-2 border-t border-white/10 space-y-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdvance}
            disabled={isSaving}
            className="w-full h-7 text-[10px] gap-1"
            style={{ background: 'hsl(38 92% 50% / 0.15)', border: '1px solid hsl(38 92% 50% / 0.3)', color: 'hsl(38 92% 55%)' }}
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                {BUTTON_LABELS[item.task_stage]}
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSaveLinks}
            disabled={isSaving}
            className="w-full h-7 text-[10px]"
          >
            {updateFieldsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save links'}
          </Button>
          {(item.task_stage === 'editing' || item.task_stage === 'complete') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSaveFields}
              disabled={isSaving}
              className="w-full h-7 text-[10px]"
            >
              {updateFieldsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save fields'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Photography() {
  const queryClient = useQueryClient();

  const { data: feed = [], isLoading, refetch } = useQuery({
    queryKey: ['photography-feed'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPhotographyFeed', {});
      return res.data?.feed || [];
    },
  });

  if (isLoading) {
    return (
      <div className="page-root flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading photography worklist...</p>
        </div>
      </div>
    );
  }

  // Group by stage
  const byStage = {};
  STAGE_COLUMNS.forEach(stage => { byStage[stage] = []; });
  feed.forEach(item => {
    if (item.task_stage && byStage[item.task_stage]) {
      byStage[item.task_stage].push(item);
    }
  });

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title text-2xl font-semibold mb-1">Photography Worklist</h1>
        <p className="page-subtitle">Tap to advance tasks through the workflow</p>
      </div>

      {/* Kanban Board - horizontal scroll on mobile */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {STAGE_COLUMNS.map(stage => (
            <div key={stage} className="w-80 shrink-0">
              {/* Column header */}
              <div className="mb-3 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm" style={{ color: 'hsl(38 92% 55%)' }}>
                    {STAGE_LABELS[stage]}
                  </h2>
                  <Badge variant="outline" className="text-[10px]" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
                    {byStage[stage].length}
                  </Badge>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-0">
                {byStage[stage].length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-muted-foreground" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                    No tasks
                  </div>
                ) : (
                  byStage[stage].map(item => (
                    <PhotographyCard key={item.task_id} item={item} refetch={refetch} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}