import React from 'react';
import { FileText, CheckCircle, Clock } from 'lucide-react';

const STATUS_LABELS = {
  received: 'Received',
  requested: 'Requested',
  verified: 'Verified',
  missing: 'Missing',
};

const STATUS_ICONS = {
  received: CheckCircle,
  requested: Clock,
  verified: CheckCircle,
  missing: FileText,
};

const STATUS_COLORS = {
  received: '#34d399',
  requested: 'hsl(38 92% 55%)',
  verified: '#34d399',
  missing: '#f87171',
};

export default function DocumentsDashboardWidget({ statusCounts = {}, typeCounts = {}, totalDocs = 0, completionRate = 0 }) {
  const statuses = Object.entries(statusCounts);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        Document Checklist
      </h3>
      {statuses.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No documents</p>
      ) : (
        <div className="space-y-2">
          {statuses.map(([status, count]) => {
            const Icon = STATUS_ICONS[status] || FileText;
            const color = STATUS_COLORS[status] || 'rgba(255,255,255,0.6)';
            return (
              <div
                key={status}
                className="flex items-center justify-between p-2 rounded-lg border"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {STATUS_LABELS[status] || status}
                  </span>
                </div>
                <span className="text-xs font-bold" style={{ color }}>{count}</span>
              </div>
            );
          })}
          <div className="pt-2 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Total Documents</span>
              <span className="text-sm font-bold" style={{ color: 'hsl(38 92% 55%)' }}>{totalDocs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Completion Rate</span>
              <span className="text-sm font-bold" style={{ color: completionRate > 50 ? '#34d399' : 'hsl(38 92% 55%)' }}>
                {completionRate}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}