import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, Building2, User, ChevronDown, ChevronUp, Loader2, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * PropertyLeadMatcher
 *
 * mode="property" → given a property, find matching leads
 * mode="lead"     → given a lead, find matching properties
 */
export default function PropertyLeadMatcher({ mode = 'lead', entityId, entityData }) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch the "other side" data for context
  const { data: leads = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 300),
    enabled: mode === 'property' && open,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
    enabled: mode === 'lead' && open,
  });

  const runMatch = async () => {
    setLoading(true);
    setMatches(null);
    try {
      const pool = mode === 'lead' ? properties : leads;

      if (pool.length === 0) {
        toast.error(mode === 'lead' ? 'No properties in the database yet.' : 'No leads in the database yet.');
        setLoading(false);
        return;
      }

      const prompt = mode === 'lead'
        ? buildLeadPrompt(entityData, pool)
        : buildPropertyPrompt(entityData, pool);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id:            { type: 'string' },
                  score:         { type: 'number' },
                  reason:        { type: 'string' },
                  highlight:     { type: 'string' },
                },
              },
            },
          },
        },
      });

      // Enrich matches with full object from pool
      const enriched = (result.matches || [])
        .map(m => ({
          ...m,
          item: pool.find(p => p.id === m.id),
        }))
        .filter(m => m.item)
        .slice(0, 5);

      setMatches(enriched);
    } catch (e) {
      toast.error('Matching failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = (lead, property) => {
    const phone = lead.phone || lead.phones?.[0]?.number;
    if (!phone) { toast.error('No phone number for this lead'); return; }
    const msg = encodeURIComponent(
      `Hi ${lead.name}, I have a great property for you!\n\n🏠 ${property.title}\n📍 ${property.location || ''}\n💰 AED ${property.price_aed?.toLocaleString()}\n\nWould you like to schedule a viewing?`
    );
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="border-b border-[#F3F4F6] last:border-0">
      <button
        onClick={() => { setOpen(v => !v); if (!open && !matches) runMatch(); }}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#374151] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          {mode === 'lead' ? 'Matched Properties' : 'Matched Leads'}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 py-4 justify-center text-xs text-[#9CA3AF]">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              Analysing {mode === 'lead' ? 'properties' : 'leads'} with AI…
            </div>
          )}

          {!loading && matches && matches.length === 0 && (
            <p className="text-xs text-[#9CA3AF] italic py-2">No strong matches found yet. Add more {mode === 'lead' ? 'properties' : 'leads'} to improve results.</p>
          )}

          {!loading && matches && matches.map((m, i) => (
            <MatchCard
              key={m.id}
              rank={i + 1}
              match={m}
              mode={mode}
              entityData={entityData}
              onWhatsApp={sendWhatsApp}
            />
          ))}

          {!loading && matches && (
            <button
              onClick={runMatch}
              className="text-[10px] text-indigo-400 hover:text-indigo-600 font-medium transition-colors"
            >
              ↻ Re-run matching
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({ rank, match, mode, entityData, onWhatsApp }) {
  const { item, score, reason, highlight } = match;
  const isProperty = mode === 'lead';

  const scoreColor = score >= 80 ? 'bg-emerald-100 text-emerald-600' :
                     score >= 60 ? 'bg-amber-100 text-amber-600' :
                                   'bg-slate-100 text-slate-500';

  return (
    <div className="p-3 rounded-xl border border-[#E5E7EB] bg-white space-y-2 hover:border-indigo-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold text-[#9CA3AF]">#{rank}</span>
            {isProperty
              ? <Building2 className="w-3 h-3 text-indigo-400" />
              : <User className="w-3 h-3 text-indigo-400" />
            }
            <p className="text-xs font-bold text-[#111827] truncate">
              {isProperty ? item.title : item.name}
            </p>
          </div>
          {isProperty && (
            <p className="text-[10px] text-[#6B7280]">
              {item.location} · {item.bedrooms}BR · AED {item.price_aed?.toLocaleString()}
            </p>
          )}
          {!isProperty && (
            <p className="text-[10px] text-[#6B7280]">
              {item.relationship_type} · Budget AED {item.budget_aed?.toLocaleString() || item.property_preferences?.max_budget?.toLocaleString() || '—'}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreColor}`}>
          {score}%
        </span>
      </div>

      {highlight && (
        <p className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
          ✨ {highlight}
        </p>
      )}

      <p className="text-[10px] text-[#6B7280] leading-relaxed">{reason}</p>

      <div className="flex gap-2 pt-1">
        {isProperty ? (
          <button
            onClick={() => onWhatsApp(entityData, item)}
            className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Send className="w-2.5 h-2.5" /> WhatsApp this property
          </button>
        ) : (
          <button
            onClick={() => onWhatsApp(item, entityData)}
            className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Send className="w-2.5 h-2.5" /> WhatsApp lead
          </button>
        )}
      </div>
    </div>
  );
}

// ── Prompt builders ────────────────────────────────────────────────────────────

function buildLeadPrompt(lead, properties) {
  const leadInfo = JSON.stringify({
    name: lead.name,
    relationship_type: lead.relationship_type,
    budget_aed: lead.budget_aed,
    property_preferences: lead.property_preferences,
    stage: lead.stage,
    notes: lead.notes,
  });

  const propList = properties.slice(0, 80).map(p => ({
    id: p.id,
    title: p.title,
    type: p.property_type,
    listing_type: p.listing_type,
    price_aed: p.price_aed,
    bedrooms: p.bedrooms,
    location: p.location,
    status: p.status,
  }));

  return `You are a Dubai real estate CRM assistant. Your job is to match leads to properties.

LEAD:
${leadInfo}

AVAILABLE PROPERTIES (${propList.length} total):
${JSON.stringify(propList)}

Score each property 0-100 based on how well it fits the lead's budget, preferences, type, location, and stage.
Return the TOP 5 best matches sorted by score descending.
For each match provide:
- id: the property ID
- score: 0-100 match score
- reason: 1-2 sentence explanation why this is a good match
- highlight: a single short selling point (e.g. "Under budget by AED 200K" or "Exact bedroom count")

Only include properties with score >= 40. If fewer than 5 qualify, return only those.`;
}

function buildPropertyPrompt(property, leads) {
  const propInfo = JSON.stringify({
    title: property.title,
    type: property.property_type,
    listing_type: property.listing_type,
    price_aed: property.price_aed,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    location: property.location,
    area_sqft: property.area_sqft,
    status: property.status,
  });

  const leadList = leads.slice(0, 100).map(l => ({
    id: l.id,
    name: l.name,
    relationship_type: l.relationship_type,
    budget_aed: l.budget_aed,
    preferences: l.property_preferences,
    stage: l.stage,
  }));

  return `You are a Dubai real estate CRM assistant. Your job is to match properties to leads.

PROPERTY:
${propInfo}

LEADS (${leadList.length} total):
${JSON.stringify(leadList)}

Score each lead 0-100 based on how likely they are to be interested in this property (budget fit, type preference, bedrooms, location, stage readiness).
Return the TOP 5 best lead matches sorted by score descending.
For each match provide:
- id: the lead ID
- score: 0-100 match score
- reason: 1-2 sentence explanation
- highlight: a single short reason this lead is a strong candidate (e.g. "Budget aligns perfectly" or "Actively searching in this area")

Only include leads with score >= 40.`;
}