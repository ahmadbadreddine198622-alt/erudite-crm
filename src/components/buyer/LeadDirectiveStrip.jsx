import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { PB } from '@/lib/buyerPipelineTokens';
import WritingField from '@/components/shared/WritingField';

// LeadDirectiveStrip — FOUNDER'S DIRECTIVE gold strip for the Lead Command Center
// (BUYER BRAIN V1 B4d; lean twin of the landlord FounderDirectiveStrip).
//
// Active directive renders as a gold band with Crown + priority; the assigned agent can
// Acknowledge (with an optional reply); admins can Resolve or issue a new directive.
// Directives are injected into the buyerOrchestrator dossier with top authority and
// surface in the morning digest — this strip is where they live on the card.

const GOLD = PB.GOLD;
const PRIORITY_META = {
  critical: { label: 'CRITICAL', color: PB.CLARET_TEXT, border: PB.CLARET_BORDER },
  high: { label: 'HIGH', color: GOLD, border: 'rgba(198,161,91,0.45)' },
  normal: { label: 'NORMAL', color: PB.SLATE, border: PB.HAIR2 },
};

export default function LeadDirectiveStrip({ leadId, currentUser, isAdmin }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftPriority, setDraftPriority] = useState('high');
  const [replyText, setReplyText] = useState('');

  const { data: directives = [] } = useQuery({
    queryKey: ['lead_directives', leadId],
    queryFn: () => base44.entities.LeadDirective.filter({ lead_id: leadId }, '-created_date', 10).catch(() => []),
    enabled: !!leadId,
    retry: false,
    staleTime: 30000,
  });

  const active = (directives || []).find((d) => d && d.type !== 'frank_comment' && (d.status === 'active' || d.status === 'acknowledged'));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['lead_directives', leadId] });

  const handleCreate = async () => {
    if (!draftText.trim()) return;
    setBusy(true);
    try {
      await base44.entities.LeadDirective.create({
        lead_id: leadId,
        directive_text: draftText.trim(),
        priority: draftPriority,
        status: 'active',
        created_by_email: currentUser?.email || null,
        created_by_name: currentUser?.full_name || currentUser?.email?.split('@')[0] || null,
      });
      setDraftText(''); setComposerOpen(false);
      refresh();
      toast.success('Directive issued');
    } catch (e) { toast.error('Directive failed: ' + (e?.message || 'unknown')); }
    finally { setBusy(false); }
  };

  const handleAcknowledge = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await base44.entities.LeadDirective.update(active.id, {
        status: 'acknowledged',
        acknowledged_by_email: currentUser?.email || null,
        acknowledged_by_name: currentUser?.full_name || null,
        acknowledged_at: new Date().toISOString(),
        ...(replyText.trim() ? { agent_response: replyText.trim() } : {}),
      });
      setReplyText('');
      refresh();
      toast.success('Directive acknowledged');
    } catch (e) { toast.error('Acknowledge failed: ' + (e?.message || 'unknown')); }
    finally { setBusy(false); }
  };

  const handleResolve = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await base44.entities.LeadDirective.update(active.id, { status: 'resolved', resolved_at: new Date().toISOString() });
      refresh();
      toast.success('Directive resolved');
    } catch (e) { toast.error('Resolve failed: ' + (e?.message || 'unknown')); }
    finally { setBusy(false); }
  };

  // ── A. Active directive band ──
  if (active) {
    const meta = PRIORITY_META[active.priority] || PRIORITY_META.normal;
    return (
      <div style={{ marginBottom: 12, borderRadius: 12, border: `1px solid rgba(198,161,91,0.5)`, background: 'linear-gradient(180deg, rgba(198,161,91,0.1), rgba(198,161,91,0.03))', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Crown size={13} style={{ color: GOLD }} />
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD }}>Founder Directive</span>
          <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', padding: '1px 7px', borderRadius: 999, border: `1px solid ${meta.border}`, color: meta.color }}>{meta.label}</span>
          {active.status === 'acknowledged' && <span style={{ fontSize: 8.5, color: '#34d399', border: '1px solid rgba(16,185,129,0.28)', borderRadius: 999, padding: '1px 7px' }}>ACKNOWLEDGED</span>}
          {isAdmin && (
            <button onClick={handleResolve} disabled={busy} title="Mark resolved" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 99, border: `1px solid ${PB.HAIR2}`, background: 'transparent', color: PB.SLATE, fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>
              {busy ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />} Resolve
            </button>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', margin: '7px 0 0', lineHeight: 1.5 }}>{active.directive_text}</p>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', margin: '5px 0 0' }}>
          Issued by {active.created_by_name || active.created_by_email || 'founder'}
          {active.agent_response ? ` · Reply: “${active.agent_response}”` : ''}
        </p>
        {!isAdmin && active.status === 'active' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input
              type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
              placeholder="Optional reply…"
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: PB.WELL, border: `1px solid ${PB.HAIR2}`, color: PB.NAME, fontSize: 11.5, outline: 'none' }}
            />
            <button onClick={handleAcknowledge} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(198,161,91,0.45)', background: 'rgba(198,161,91,0.12)', color: GOLD, fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Acknowledge
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── B. Admin: issue a new directive ──
  if (!isAdmin) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      {!composerOpen ? (
        <button onClick={() => setComposerOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.35)', background: 'transparent', color: GOLD, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
          <Crown size={11} /> + Founder Directive
        </button>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid rgba(198,161,91,0.35)', background: 'rgba(198,161,91,0.04)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Crown size={12} style={{ color: GOLD }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD }}>New Founder Directive</span>
            <button onClick={() => setComposerOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: PB.SLATE, cursor: 'pointer' }}><X size={12} /></button>
          </div>
          <WritingField
            value={draftText}
            onChange={(e) => setDraftText(e?.target?.value ?? '')}
            placeholder="Directive to the agent handling this lead…"
            minHeight={52}
            channel="directive"
            leadId={leadId}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            {['critical', 'high', 'normal'].map((p) => {
              const meta = PRIORITY_META[p];
              const on = draftPriority === p;
              return (
                <button key={p} onClick={() => setDraftPriority(p)} style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${on ? meta.border : PB.HAIR2}`, background: on ? 'rgba(198,161,91,0.1)' : 'transparent', color: on ? meta.color : PB.SLATE, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer' }}>
                  {meta.label}
                </button>
              );
            })}
            <button onClick={handleCreate} disabled={busy || !draftText.trim()} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(198,161,91,0.5)', background: 'rgba(198,161,91,0.14)', color: GOLD, fontSize: 10.5, fontWeight: 700, cursor: (busy || !draftText.trim()) ? 'not-allowed' : 'pointer', opacity: (busy || !draftText.trim()) ? 0.5 : 1 }}>
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Crown size={10} />} Issue Directive
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
