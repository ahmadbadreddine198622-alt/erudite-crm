import React from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';

const STAGE_LABELS = {
  inquiry: 'Inquiry',
  pre_shoot_check: 'Pre-Shoot',
  shooting: 'Shooting',
  uploaded_3d: '3D Uploaded',
  editing: 'Editing',
  complete: 'Complete',
  handed_to_listing: 'Handed to Listing',
};

export default function PhotographyDashboardWidget({ stageCounts = {}, totalTasks = 0 }) {
  const stages = Object.entries(stageCounts);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Camera className="w-4 h-4 text-accent" />
        Photography Pipeline
      </h3>
      {stages.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No photography tasks</p>
      ) : (
        <div className="space-y-2">
          {stages.map(([stage, count]) => (
            <div
              key={stage}
              className="flex items-center justify-between p-2 rounded-lg border"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: count > 0 ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.2)' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {STAGE_LABELS[stage] || stage}
                </span>
              </div>
              <span className="text-xs font-bold" style={{ color: 'hsl(38 92% 55%)' }}>
                {count}
              </span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total Tasks</span>
              <span className="text-sm font-bold" style={{ color: 'hsl(38 92% 55%)' }}>{totalTasks}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}