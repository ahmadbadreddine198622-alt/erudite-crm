import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STAGES } from '@/lib/pipeline';
import { toast } from 'sonner';

// Buyer-track start: first stage defined in lib/pipeline.js SALE track
const BUYER_START = 'contact_identity';
// Tenant-track start: first stage defined in lib/pipeline.js RENT track
const TENANT_START = 'new_tenant_lead';

function isBuyerStage(stageKey) {
  return STAGES[stageKey]?.intent === 'buyer';
}
function isTenantStage(stageKey) {
  return STAGES[stageKey]?.intent === 'tenant';
}

/**
 * IntentToggle — sets intent + stage atomically so the lead re-buckets correctly.
 * size: 'sm' (card) | 'md' (detail sheet)
 */
export default function IntentToggle({ lead, size = 'md' }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.update(lead.id, data),
    onMutate: async (data) => {
      const keys = [['leads'], ['pipeline-leads']];
      await Promise.all(keys.map((k) => queryClient.cancelQueries({ queryKey: k })));
      const snapshots = keys.map((k) => [k, queryClient.getQueryData(k)]);
      for (const [key] of snapshots) {
        queryClient.setQueryData(key, (old) =>
          Array.isArray(old) ? old.map((l) => (l.id === lead.id ? { ...l, ...data } : l)) : old,
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, prev] of context.snapshots) queryClient.setQueryData(key, prev);
      }
      toast.error('Failed to update intent');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    },
  });

  const handleToggle = (newIntent) => {
    if (newIntent === lead.intent) return; // no-op if already set

    let payload = { intent: newIntent, stage_entered_at: new Date().toISOString() };

    if (newIntent === 'buyer') {
      // Only move to start stage if NOT already on a buyer-track stage
      if (!isBuyerStage(lead.stage)) {
        payload.stage = BUYER_START;
      }
    } else if (newIntent === 'tenant') {
      // Only move to start stage if NOT already on a tenant-track stage
      if (!isTenantStage(lead.stage)) {
        payload.stage = TENANT_START;
      }
    }

    mutation.mutate(payload);
    toast.success(newIntent === 'buyer' ? '→ Sale track' : '→ Rent track');
  };

  const current = lead.intent;
  const isPending = mutation.isPending;

  if (size === 'sm') {
    // Compact pill pair for the card
    return (
      <div
        className="flex items-center gap-0.5 rounded-full p-0.5"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          disabled={isPending}
          onClick={() => handleToggle('buyer')}
          className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider transition-all"
          style={
            current === 'buyer'
              ? { background: 'hsl(38 92% 50%)', color: '#1a1a2e' }
              : { color: 'rgba(255,255,255,0.45)' }
          }
        >
          B
        </button>
        <button
          disabled={isPending}
          onClick={() => handleToggle('tenant')}
          className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider transition-all"
          style={
            current === 'tenant'
              ? { background: 'hsl(173 58% 39%)', color: '#fff' }
              : { color: 'rgba(255,255,255,0.45)' }
          }
        >
          T
        </button>
      </div>
    );
  }

  // Full size for detail sheet
  return (
    <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
      <button
        disabled={isPending}
        onClick={() => handleToggle('buyer')}
        className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
        style={
          current === 'buyer'
            ? { background: 'hsl(38 92% 50%)', color: '#1a1a2e' }
            : { color: 'rgba(255,255,255,0.5)' }
        }
      >
        Buyer
      </button>
      <button
        disabled={isPending}
        onClick={() => handleToggle('tenant')}
        className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
        style={
          current === 'tenant'
            ? { background: 'hsl(173 58% 39%)', color: '#fff' }
            : { color: 'rgba(255,255,255,0.5)' }
        }
      >
        Tenant
      </button>
    </div>
  );
}