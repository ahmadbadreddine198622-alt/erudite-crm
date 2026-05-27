import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Crown, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

/**
 * Coalition Map — visualizes the decision-makers behind a landlord
 * with their influence + sentiment. Highlights who to talk to next.
 */

const SENTIMENT_STYLES = {
  champion:   { color: 'bg-emerald-500', label: 'Champion',    icon: Crown },
  supportive: { color: 'bg-emerald-400', label: 'Supportive',  icon: ShieldCheck },
  neutral:    { color: 'bg-slate-400',   label: 'Neutral',     icon: Shield },
  skeptical:  { color: 'bg-amber-500',   label: 'Skeptical',   icon: ShieldAlert },
  blocker:    { color: 'bg-red-500',     label: 'Blocker',     icon: ShieldAlert }
};

export default function CoalitionMap({ landlord, onAddStakeholder }) {
  const queryClient = useQueryClient();
  const { data: stakeholders = [] } = useQuery({
    queryKey: ['stakeholders', landlord.id],
    queryFn: () => base44.entities.LandlordStakeholder.filter({ landlord_id: landlord.id })
  });

  // Sort by influence priority then decision power
  const sorted = [...stakeholders].sort((a, b) => {
    if (a.influence_priority != null && b.influence_priority != null) {
      return a.influence_priority - b.influence_priority;
    }
    return (b.decision_power || 0) - (a.decision_power || 0);
  });

  const topInfluencer = sorted[0];

  return (
    <Card className="border-2 border-purple-100">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-purple-900">
            <Users className="w-4 h-4" /> Coalition Map
            <Badge className="bg-purple-100 text-purple-900 border-0">{stakeholders.length}</Badge>
          </h3>
          <Button size="sm" variant="ghost" onClick={onAddStakeholder}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>

        {/* Landlord at center */}
        <div className="text-center py-2">
          <div className="inline-block w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white flex items-center justify-center font-bold text-sm">
            {(landlord.full_name_en || landlord.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <p className="text-xs font-medium mt-1">{landlord.full_name_en || landlord.full_name}</p>
          <p className="text-[10px] text-muted-foreground">Primary contact</p>
        </div>

        {stakeholders.length === 0 ? (
          <div className="text-center py-3 text-xs text-muted-foreground">
            <p>No stakeholders mapped yet.</p>
            <p className="mt-1 text-[11px]">
              Aurora auto-detects them from conversations (e.g., "I need to discuss with my wife").
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sorted.map((s, i) => {
              const style = SENTIMENT_STYLES[s.sentiment] || SENTIMENT_STYLES.neutral;
              const Icon = style.icon;
              const isTopInfluencer = s.id === topInfluencer?.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${isTopInfluencer ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className={`w-8 h-8 rounded-full ${style.color} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                    {(s.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      {isTopInfluencer && <Badge className="bg-purple-200 text-purple-900 border-0 text-[9px]">Talk to next</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {s.role?.replace('_', ' ')} · power {s.decision_power || 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Icon className={`w-3.5 h-3.5 text-${style.label.toLowerCase()}-600`} />
                    <span className="text-[10px] font-medium">{style.label}</span>
                  </div>
                </div>
              );
            })}

            {topInfluencer?.claude_strategy && (
              <div className="bg-purple-50 border border-purple-200 rounded p-2.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-purple-700 mb-1">
                  Strategy for {topInfluencer.name}
                </p>
                <p className="text-xs text-purple-900">{topInfluencer.claude_strategy}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
