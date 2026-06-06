import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Brain, Flame, Thermometer, RefreshCw, Phone, Calendar, Eye, MessageSquare,
  CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const TEMP_CONFIG = {
  hot:  { label: 'Hot',  className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  warm: { label: 'Warm', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  cold: { label: 'Cold', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

const TYPE_ICON = {
  followup: <MessageSquare className="w-3.5 h-3.5" />,
  meeting:  <Calendar className="w-3.5 h-3.5" />,
  viewing:  <Eye className="w-3.5 h-3.5" />,
  call:     <Phone className="w-3.5 h-3.5" />,
};

const ENTITY_MAP = {
  followup: 'Followup',
  meeting:  'Meeting',
  viewing:  'Viewing',
  call:     'Call',
};

export default function LandlordIntelligenceTab({ landlord }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(null); // suggestion index being created

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['conversation-insight', landlord?.id],
    queryFn: () => base44.entities.ConversationInsight.filter({ landlord_id: landlord.id }),
    enabled: !!landlord?.id,
  });

  const insight = insights[0] || null;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke('analyzeLandlordConversation', { landlord_id: landlord.id });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error + (d.detail ? ` — ${d.detail}` : ''));
      if (d?.status === 'skipped_recent_analysis') {
        toast.info('Analysis is fresh (< 30s old) — no need to re-run.');
      } else if (d?.status === 'no_messages') {
        toast.warning('No messages found for this landlord.');
      } else {
        toast.success('Conversation analysed');
        qc.invalidateQueries({ queryKey: ['conversation-insight', landlord.id] });
      }
    } catch (e) {
      toast.error(`Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateFromSuggestion = async (suggestion, idx) => {
    setCreating(idx);
    const entityName = ENTITY_MAP[suggestion.type] || 'Followup';
    const payload = { landlord_id: landlord.id, created_from_ai: true };
    if (suggestion.title) payload.title = suggestion.title;
    if (suggestion.suggested_datetime) payload.scheduled_at = suggestion.suggested_datetime;
    if (suggestion.reason) payload.notes = suggestion.reason;
    try {
      await base44.entities[entityName].create(payload);
      toast.success(`${entityName} created`);
    } catch (e) {
      toast.error(`Failed to create ${entityName}: ${e.message}`);
    } finally {
      setCreating(null);
    }
  };

  const fmt = (ts) => {
    try { return ts ? format(new Date(ts), 'd MMM yyyy, HH:mm') : null; } catch { return null; }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading intelligence…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / Analyze button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Conversation Intelligence</span>
          {insight?.temperature && (
            <Badge variant="outline" className={`text-xs border ${TEMP_CONFIG[insight.temperature]?.className}`}>
              <Flame className="w-3 h-3 mr-1" />
              {TEMP_CONFIG[insight.temperature]?.label}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={analyzing} className="gap-1.5 text-xs">
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {analyzing ? 'Analysing…' : 'Analyse Now'}
        </Button>
      </div>

      {!insight ? (
        <div className="rounded-xl p-6 text-center text-sm text-muted-foreground border border-dashed border-white/10">
          No analysis yet — click <strong>Analyse Now</strong> to run AI on the message thread.
        </div>
      ) : (
        <>
          {/* Meta */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {insight.last_analyzed_at && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmt(insight.last_analyzed_at)}</span>
            )}
            {insight.language && (
              <Badge variant="outline" className="text-xs border-white/15 text-white/50">
                {insight.language}
              </Badge>
            )}
            {insight.conversation_stage && (
              <Badge variant="outline" className="text-xs border-white/15 text-white/50">
                {insight.conversation_stage}
              </Badge>
            )}
          </div>

          {/* Summary */}
          {insight.summary && (
            <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'rgb(167,139,250)' }}>Summary</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{insight.summary}</p>
            </div>
          )}

          {/* Key Facts */}
          {insight.key_facts && (
            <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold text-amber-400">Key Facts</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{insight.key_facts}</p>
            </div>
          )}

          {/* Outstanding Items */}
          {insight.outstanding_items && (
            <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold text-red-400">Outstanding Items</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{insight.outstanding_items}</p>
            </div>
          )}

          {/* Suggestions */}
          {Array.isArray(insight.suggestions) && insight.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Suggestions</p>
              {insight.suggestions.map((s, idx) => (
                <div key={idx} className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground">{TYPE_ICON[s.type]}</span>
                      <span className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.title}</span>
                      <Badge variant="outline" className="text-[10px] border-white/15 text-white/50 shrink-0 capitalize">{s.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 px-2"
                        disabled={creating === idx}
                        onClick={(e) => { e.stopPropagation(); handleCreateFromSuggestion(s, idx); }}
                      >
                        {creating === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Create
                      </Button>
                      {expanded === idx ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {expanded === idx && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/06">
                      {s.reason && (
                        <div className="pt-3">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Why</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.reason}</p>
                        </div>
                      )}
                      {s.suggested_message && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Suggested Message</p>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}>{s.suggested_message}</p>
                        </div>
                      )}
                      {s.suggested_datetime && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {fmt(s.suggested_datetime) || s.suggested_datetime}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}