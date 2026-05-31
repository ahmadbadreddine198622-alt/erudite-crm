/**
 * LeadAISummary — AI-generated snapshot of a lead's status, intent, and interactions.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function LeadAISummary({ lead }) {
  const [expanded, setExpanded] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: activities = [] } = useQuery({
    queryKey: ['activities-summary', lead.id],
    queryFn: () => base44.entities.Activity.filter({ lead_id: lead.id }, '-created_date', 20),
    enabled: !!lead.id,
  });

  const { data: summary, isLoading, isFetching } = useQuery({
    queryKey: ['ai-lead-summary', lead.id, refreshKey],
    queryFn: async () => {
      const recentActivities = activities
        .slice(0, 10)
        .map(a => `[${a.activity_type || a.type || 'activity'}] ${a.title}${a.body || a.description ? ': ' + (a.body || a.description) : ''}`)
        .join('\n');

      const prompt = `You are a CRM AI assistant. Analyze this real estate lead and produce a concise 3-part summary (max 4 sentences total):

LEAD DATA:
- Name: ${lead.full_name || lead.name || 'Unknown'}
- Stage: ${lead.stage || 'N/A'}
- Status: ${lead.status || 'active'}
- Intent: ${lead.intent || 'unknown'} (${lead.transaction_type || ''})
- Budget: ${lead.budget_min || lead.budget_max ? `AED ${(lead.budget_min || 0).toLocaleString()} – ${(lead.budget_max || 0).toLocaleString()}` : 'Not specified'}
- Locations: ${(lead.preferred_locations || []).join(', ') || 'Not specified'}
- Bedrooms: ${lead.bedrooms_min != null ? `${lead.bedrooms_min}${lead.bedrooms_max ? '–' + lead.bedrooms_max : '+'}` : 'Not specified'}
- Financing: ${lead.financing_method || 'unknown'}
- Lead Score: ${lead.ai_lead_score ?? lead.lead_score ?? 'N/A'}/100
- Days since last contact: ${lead.days_since_last_contact ?? 'N/A'}
- Source: ${lead.source || 'unknown'}
- Nationality: ${lead.nationality || 'unknown'}
- Notes: ${lead.notes || 'None'}

RECENT ACTIVITY (latest 10):
${recentActivities || 'No recent activity recorded.'}

Provide a 3-sentence summary covering:
1. Where they are in the buying/renting journey and their key intent
2. Their engagement level and any concerns or objections detected
3. The single most important next action the agent should take

Be direct, specific, and actionable. No bullet points, just 3 flowing sentences.`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      return result;
    },
    enabled: !!lead.id && activities !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  const loading = isLoading || isFetching;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(139,92,246,0.05) 100%)',
        border: '1px solid rgba(245,158,11,0.20)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.5), rgba(139,92,246,0.4))' }}>
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'hsl(38 92% 60%)' }}>AI Lead Summary</span>
          {loading && (
            <span className="text-[10px] text-white/40 animate-pulse">Generating…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setRefreshKey(k => k + 1); }}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            title="Regenerate summary"
          >
            <RefreshCw className={`w-3 h-3 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" style={{ width: `${90 - i * 10}%` }} />
              ))}
            </div>
          ) : summary ? (
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
              {summary}
            </p>
          ) : (
            <p className="text-xs text-white/30 italic">No summary available — try refreshing.</p>
          )}
        </div>
      )}
    </div>
  );
}