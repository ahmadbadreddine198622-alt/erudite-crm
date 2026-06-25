// LandlordCommandCenter — the redesigned single-landlord detail page (agent command center).
// Read/consume only: loads the Landlord + related rows, builds a view-model, and renders the
// CommandCenterView. Reuses existing handlers exactly: stage move writes stage + stage_entered_at
// and fires landlordOrchestrator (same as the old page); Re-run brain invokes the orchestrator;
// channel sends go through the existing send functions. No schema changes.
import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CommandCenterView from '@/components/landlord/cc/CommandCenterView';
import { buildCommandCenterVM } from '@/components/landlord/cc/buildCommandCenterVM';

const tsOf = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function useQ(key, fn, extra = {}) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false, staleTime: 30000, ...extra });
}

export default function LandlordCommandCenter() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: L, isLoading, refetch } = useQ(['landlord', id], () => base44.entities.Landlord.get(id), { enabled: !!id });

  // Related rows for the property block and the activity timeline (read-only).
  const { data: landlordProperties = [] } = useQ(['landlord_properties', id], () => safe(() => base44.entities.LandlordProperty.filter({ landlord_id: id }, '-created_date', 10)), { enabled: !!id });
  const lp = landlordProperties[0] || {};
  const { data: prop = {} } = useQ(['property', lp.property_id], () => base44.entities.Property.get(lp.property_id), { enabled: !!lp.property_id });
  const { data: waMessages = [] } = useQ(['cc_wa_messages', id], () => safe(() => base44.entities.WhatsAppMessage.filter({ landlord_id: id }, '-created_date', 60)), { enabled: !!id });
  const { data: iMessages = [] } = useQ(['cc_imessages', id], () => safe(() => base44.entities.IMessage.filter({ landlord_id: id }, '-sent_at', 60)), { enabled: !!id });
  const { data: callLogs = [] } = useQ(['cc_calllogs', id], () => safe(() => base44.entities.CallLog.filter({ landlord_id: id }, '-started_at', 40)), { enabled: !!id, refetchInterval: 60000 });

  // Build the unified reverse-chronological timeline (messages, calls, stage history).
  const timeline = useMemo(() => {
    const ev = [];
    waMessages.forEach((m) => ev.push({ icon: '💬', title: `WhatsApp ${m.direction === 'outbound' ? 'sent' : 'received'}`, body: m.body || '', time: fmtTime(m.timestamp || m.created_date), order: tsOf(m.timestamp || m.created_date) }));
    iMessages.forEach((m) => ev.push({ icon: '📱', title: `iMessage ${m.direction === 'outbound' ? 'sent' : 'received'}`, body: m.body || '', time: fmtTime(m.sent_at || m.created_date), order: tsOf(m.sent_at || m.created_date) }));
    callLogs.forEach((c) => ev.push({ icon: '📞', title: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · ${c.status || ''}`.trim(), body: c.notes || c.to_number || c.from_number || '', time: fmtTime(c.started_at || c.created_date), order: tsOf(c.started_at || c.created_date) }));
    (Array.isArray(L?.stage_history) ? L.stage_history : []).forEach((s) => ev.push({ icon: '⇪', title: `Stage · ${String(s.stage || '').replace(/_/g, ' ')}`, body: '', time: fmtTime(s.entered_at), order: tsOf(s.entered_at) }));
    return ev.sort((a, b) => (b.order || 0) - (a.order || 0));
  }, [waMessages, iMessages, callLogs, L]);

  const listingUrls = useMemo(() => [lp.listing_url, lp.pf_listing_url, lp.bayut_listing_url, L?.listing_url].filter(Boolean), [lp, L]);

  const vm = useMemo(() => (L ? buildCommandCenterVM(L, { property: prop, timeline, listingUrls }) : null), [L, prop, timeline, listingUrls]);

  // Stage move — SAME write as the existing detail page (stage + stage_entered_at), then
  // fire the orchestrator (best-effort) and refetch. Does not fork the pipeline handler.
  const handleStageChange = async (newStage) => {
    if (!L || !newStage) return;
    try {
      await base44.entities.Landlord.update(L.id, { stage: newStage, stage_entered_at: new Date().toISOString() });
      base44.functions.invoke('landlordOrchestrator', { landlord_id: L.id, force: true }).catch(() => {});
      toast.success('Stage updated');
      refetch();
    } catch (e) {
      toast.error('Failed to update stage: ' + (e?.message || 'unknown error'));
    }
  };

  const [isRerunning, setRerunning] = React.useState(false);
  const handleRerunBrain = async () => {
    if (!L || isRerunning) return;
    setRerunning(true);
    try {
      await base44.functions.invoke('landlordOrchestrator', { landlord_id: L.id, force: true });
      toast.success('Brain re-run complete');
      refetch();
    } catch (e) {
      toast.error('Re-run failed: ' + (e?.message || 'unknown error'));
    } finally {
      setRerunning(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1419' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 12px', borderRadius: '50%', border: '3px solid rgba(201,162,75,0.3)', borderTopColor: '#C9A24B', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Montserrat,sans-serif', fontSize: 14 }}>Loading landlord…</p>
        </div>
      </div>
    );
  }

  if (!L || !vm) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1419', color: 'rgba(255,255,255,0.7)', fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: 12 }}>Landlord not found.</p>
          <button onClick={() => navigate('/landlords')} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(201,162,75,0.5)', background: 'rgba(201,162,75,0.14)', color: '#C9A24B', cursor: 'pointer', fontWeight: 600 }}>Back to Landlords</button>
        </div>
      </div>
    );
  }

  return (
    <CommandCenterView
      vm={vm}
      raw={L}
      onStageChange={handleStageChange}
      onRerunBrain={handleRerunBrain}
      onLogged={refetch}
      rerunning={isRerunning}
      landlordOptions={[{ id: L.id, name: vm.name }]}
      currentId={L.id}
      onSwitch={() => {}}
    />
  );
}