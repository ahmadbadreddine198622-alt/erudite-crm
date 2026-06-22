import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Home, Key, CheckCircle2, Film, Disc, FileText, Loader2, Zap, Droplet, Package, ArrowRight, User, Mail, Phone } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

const STAGE_LABELS = {
  inquiry: 'Inquiry',
  pre_shoot_check: 'Pre-Shoot',
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

export default function PhotographerVCard({ item, refetch }) {
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
    
    // Auto-save links before advancing (especially for 'handed_to_listing')
    if (next === 'handed_to_listing') {
      const hasAnyLink = tour3dLink || videoLink || photosLink;
      if (!hasAnyLink) {
        toast.error('Please add at least one media link (3D tour, video, or photos) before sending to listing');
        return;
      }
      // Save links first, then advance
      const updates = {};
      if (tour3dLink) updates.tour_3d_link = tour3dLink;
      if (videoLink) updates.video_link = videoLink;
      if (photosLink) updates.photos_link = photosLink;
      
      updateFieldsMutation.mutate({ task_id: item.task_id, updates }, {
        onSuccess: () => {
          advanceMutation.mutate({ task_id: item.task_id, new_stage: next });
        }
      });
      return;
    }
    
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
    <div className="rounded-2xl border p-4 transition-all hover:border-accent/30" 
      style={{ 
        background: 'rgba(255,255,255,0.04)', 
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)'
      }}>
      {/* Header with owner info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg shrink-0"
          style={{ color: 'hsl(38 92% 55%)', background: 'hsl(38 92% 50% / 0.2)' }}>
          {item.owner_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-accent truncate text-base" style={{ color: 'hsl(38 92% 55%)' }}>
            {item.owner_name || 'Unknown Owner'}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
            {item.project && (
              <span className="flex items-center gap-1">
                <Home className="w-3 h-3" />
                {item.project}
              </span>
            )}
            {item.unit_reference && (
              <span>Unit {item.unit_reference}</span>
            )}
          </div>

        </div>
        <Badge variant="outline" className="text-xs shrink-0" 
          style={{ 
            background: 'hsl(38 92% 50% / 0.15)', 
            border: '1px solid hsl(38 92% 50% / 0.3)', 
            color: 'hsl(38 92% 55%)' 
          }}>
          {STAGE_LABELS[item.task_stage]}
        </Badge>
      </div>

      {/* Media flags */}
      <div className="mb-3 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Media Status</p>
        <div className="flex flex-wrap gap-1.5">
          {MEDIA_CONFIG.map((config) => {
            const Icon = config.icon;
            const isDone = item[config.key] === true;
            return (
              <span
                key={config.key}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                {config.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Assignment section */}
      <div className="mb-3 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Assignment</p>
        {item.assigned_photographer_email ? (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs shrink-0"
              style={{ color: 'hsl(38 92% 55%)', background: 'hsl(38 92% 50% / 0.2)' }}>
              {item.assigned_photographer_email[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-foreground">{item.assigned_photographer_email.split('@')[0]}</p>
              <p className="text-xs text-muted-foreground">Photographer · {item.assigned_photographer_email}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No photographer assigned</p>
        )}
      </div>

      {/* Pre-shoot details */}
      <div className="mb-3 pb-3 border-b space-y-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        {/* Access */}
        {(item.keys_location || item.key_access_instructions) && (
          <div>
            <div className="flex items-center gap-1.5 text-xs mb-1">
              <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium text-xs">Access</span>
            </div>
            {item.keys_location && (
              <p className="text-xs text-muted-foreground pl-5">
                Keys: <span className="text-foreground">{item.keys_location.replace(/_/g, ' ')}</span>
              </p>
            )}
            {item.key_access_instructions && (
              <p className="text-xs text-muted-foreground pl-5 italic">
                {item.key_access_instructions}
              </p>
            )}
          </div>
        )}

        {/* Readiness */}
        {(item.has_bedsheets !== undefined || item.has_pillows !== undefined || item.electricity_on !== undefined || item.water_on !== undefined) && (
          <div>
            <div className="flex items-center gap-1.5 text-xs mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-medium text-xs">Readiness</span>
            </div>
            <div className="flex flex-wrap gap-2 pl-5">
              {item.has_bedsheets !== undefined && (
                <span className={item.has_bedsheets ? 'text-xs text-emerald-400' : 'text-xs text-red-400 font-semibold'}>
                  {item.has_bedsheets ? '✓ Bedsheets' : '⚠ Bedsheets'}
                </span>
              )}
              {item.has_pillows !== undefined && (
                <span className={item.has_pillows ? 'text-xs text-emerald-400' : 'text-xs text-red-400 font-semibold'}>
                  {item.has_pillows ? '✓ Pillows' : '⚠ Pillows'}
                </span>
              )}
              {item.electricity_on !== undefined && (
                <span className={`${item.electricity_on ? 'text-xs text-emerald-400' : 'text-xs text-red-400 font-semibold'} flex items-center gap-1`}>
                  {item.electricity_on ? <Zap className="w-3 h-3" /> : <Zap className="w-3 h-3 fill-red-400" />}
                  Electricity
                </span>
              )}
              {item.water_on !== undefined && (
                <span className={`${item.water_on ? 'text-xs text-emerald-400' : 'text-xs text-red-400 font-semibold'} flex items-center gap-1`}>
                  {item.water_on ? <Droplet className="w-3 h-3" /> : <Droplet className="w-3 h-3 fill-red-400" />}
                  Water
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stage-specific fields */}
      {item.task_stage === 'editing' && (
        <div className="mb-3">
          <Input
            placeholder="Editing substatus (e.g., video finalizing)"
            value={editingSubstatus}
            onChange={(e) => setEditingSubstatus(e.target.value)}
            className="h-9 text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      )}

      {item.task_stage === 'complete' && (
        <div className="mb-3">
          <Input
            placeholder="Completion notes"
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            className="h-9 text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      )}

      {/* Links section */}
      <div className="mb-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Media Links</p>
        <Input
          placeholder="3D tour link"
          value={tour3dLink}
          onChange={(e) => setTour3dLink(e.target.value)}
          className="h-8 text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <Input
          placeholder="Video link"
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          className="h-8 text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <Input
          placeholder="Photos link"
          value={photosLink}
          onChange={(e) => setPhotosLink(e.target.value)}
          className="h-8 text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
      </div>

      {/* Action buttons */}
      <div className="pt-3 border-t space-y-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <Button
          size="sm"
          onClick={handleAdvance}
          disabled={isSaving}
          className="w-full h-9 text-sm gap-1"
          style={{ 
            background: 'hsl(38 92% 50% / 0.15)', 
            border: '1px solid hsl(38 92% 50% / 0.3)', 
            color: 'hsl(38 92% 55%)' 
          }}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {BUTTON_LABELS[item.task_stage]}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSaveLinks}
          disabled={isSaving}
          className="w-full h-9 text-sm"
        >
          {updateFieldsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save links'}
        </Button>
        {(item.task_stage === 'editing' || item.task_stage === 'complete') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSaveFields}
            disabled={isSaving}
            className="w-full h-9 text-sm"
          >
            {updateFieldsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save fields'}
          </Button>
        )}
      </div>
    </div>
  );
}