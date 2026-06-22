import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Home, Key, AlertCircle, CheckCircle2, Film, Disc, FileText, Loader2, Zap, Droplet, Package, ArrowRight, Send } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import PhotographerVCard from "@/components/photography/PhotographerVCard";

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
                    <PhotographerVCard key={item.task_id} item={item} refetch={refetch} />
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