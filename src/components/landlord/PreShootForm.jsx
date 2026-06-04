import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function PreShootForm({ photographyTask, landlordProperty }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    unit_condition: photographyTask.unit_condition || '',
    furnishing: photographyTask.furnishing || '',
    has_bedsheets: photographyTask.has_bedsheets || false,
    has_pillows: photographyTask.has_pillows || false,
    electricity_on: photographyTask.electricity_on || false,
    water_on: photographyTask.water_on || false,
    staging_needed: photographyTask.staging_needed || '',
    what_to_bring: photographyTask.what_to_bring || '',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.PhotographyTask.update(photographyTask.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photography-task'] });
      toast.success('Pre-shoot checklist saved');
    },
    onError: (e) => toast.error('Failed to save: ' + e.message),
  });

  const handleToggle = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="mt-3 p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          Pre-Shoot Checklist
          {photographyTask.task_stage === 'pre_shoot_check' && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-amber-500/30 text-amber-400 bg-amber-500/10">
              In Progress
            </Badge>
          )}
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="h-7 text-xs gap-1.5"
        >
          {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Save
        </Button>
      </div>

      <div className="space-y-3">
        {/* Unit Condition */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-1.5 block">Unit Condition</label>
          <select
            value={formData.unit_condition}
            onChange={(e) => setFormData(prev => ({ ...prev, unit_condition: e.target.value }))}
            className="w-full px-2 py-1.5 text-xs rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          >
            <option value="">Select condition</option>
            <option value="finished">Finished</option>
            <option value="unfinished">Unfinished</option>
            <option value="clean">Clean</option>
            <option value="needs_cleaning">Needs Cleaning</option>
          </select>
        </div>

        {/* Furnishing */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-1.5 block">Furnishing</label>
          <select
            value={formData.furnishing}
            onChange={(e) => setFormData(prev => ({ ...prev, furnishing: e.target.value }))}
            className="w-full px-2 py-1.5 text-xs rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          >
            <option value="">Select furnishing</option>
            <option value="furnished">Furnished</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        {/* Amenities Checkboxes */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={formData.has_bedsheets}
              onChange={() => handleToggle('has_bedsheets')}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 text-accent focus:ring-accent/50"
            />
            <span className="text-muted-foreground">Has Bedsheets</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={formData.has_pillows}
              onChange={() => handleToggle('has_pillows')}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 text-accent focus:ring-accent/50"
            />
            <span className="text-muted-foreground">Has Pillows</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={formData.electricity_on}
              onChange={() => handleToggle('electricity_on')}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 text-accent focus:ring-accent/50"
            />
            <span className="text-muted-foreground">Electricity On</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={formData.water_on}
              onChange={() => handleToggle('water_on')}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 text-accent focus:ring-accent/50"
            />
            <span className="text-muted-foreground">Water On</span>
          </label>
        </div>

        {/* Staging Notes */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-1.5 block">Staging Requirements</label>
          <textarea
            value={formData.staging_needed}
            onChange={(e) => setFormData(prev => ({ ...prev, staging_needed: e.target.value }))}
            placeholder="What staging is needed before the shoot?"
            rows={2}
            className="w-full px-2 py-1.5 text-xs rounded-md resize-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
        </div>

        {/* What to Bring */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-1.5 block">What Photographer Should Bring</label>
          <textarea
            value={formData.what_to_bring}
            onChange={(e) => setFormData(prev => ({ ...prev, what_to_bring: e.target.value }))}
            placeholder="Equipment, props, or anything else needed"
            rows={2}
            className="w-full px-2 py-1.5 text-xs rounded-md resize-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
        </div>
      </div>
    </div>
  );
}