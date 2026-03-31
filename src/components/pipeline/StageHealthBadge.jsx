import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function StageHealthBadge({ lead }) {
  if (!lead.stage_order && lead.created_date) {
    const daysInStage = Math.floor((Date.now() - new Date(lead.created_date)) / 86400000);
    
    if (daysInStage > 14) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[10px]">
          <AlertTriangle className="w-3 h-3 text-red-600" />
          <span className="text-red-700 font-medium">{daysInStage}d stuck</span>
        </div>
      );
    }
    
    if (daysInStage > 7) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px]">
          <Clock className="w-3 h-3 text-amber-600" />
          <span className="text-amber-700 font-medium">{daysInStage}d in stage</span>
        </div>
      );
    }
  }
  
  return null;
}