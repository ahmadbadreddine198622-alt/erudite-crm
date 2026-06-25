// LandlordDetailPage — Erudite CRM agent command center (full redesign).
// Read/consume only: binds to existing Landlord fields, reuses existing handlers
// (stage move-arrows, Email/iMessage/Appointment composers, sendMultiChannelWhatsApp,
// sendTelegram, resolveLandlordIMessage, landlordOrchestrator). NO schema changes.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import CommandHeader from '@/components/landlord/command/CommandHeader.jsx';
import VitalSigns from '@/components/landlord/command/VitalSigns.jsx';
import LeftColumn from '@/components/landlord/command/LeftColumn.jsx';
import RightColumn from '@/components/landlord/command/RightColumn.jsx';
import ComposerModal from '@/components/landlord/command/ComposerModal.jsx';
import { PALETTE, initialsOf, STAGE_LABELS, titleize } from '@/components/landlord/command/cmdHelpers.js';

const tsOf = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };
function useQ(key, fn, extra = {}) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false, staleTime: 30000, ...extra });
}

export default function LandlordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [composer, setComposer] = useState({ open: false, channel: null, prefill: '' });
  const [reanalyzing, setReanalyzing] = useState(false);

  const { data: L, isLoading, refetch } = useQ(['landlord', id], () => base44.entities.Landlord.get(id), { enabled: !!id });

  // Linked property for the Property card.
  const { data: landlordProperties = [] } = useQ(['landlord_properties', id], () => safe(() => base44.entities.LandlordProperty.filter({ landlord_id: id }, '-created_date', 5)), { enabled: !!id });
  const lp = landlordProperties[0] || {};
  const { data: prop = {} } = useQ(['property', lp.property_id], () => base44.entities.Property.get(lp.property_id), { enabled: !!lp.property_id });

  // Timeline sources (read-only).
  const phone = L?.phone;
  const { data: waMessages = [] } = useQ(['wa_stream', id], () => safe(() => base44.entities.WhatsAppMessage.filter({ landlord_id: id }, '-created_date', 100)), { enabled: !!id });
  const { data: iMessages = [] } = useQ(['imsgs', id], () => safe(() => base44.entities.IMessage.filter({ landlord_id: id }, '-sent_at', 100)), { enabled: !!id });
  const { data: telegramMessages = [] } = useQ(['tg_msgs', id], () => safe(() => base44.entities.TelegramMessage.filter({ landlord_id: id }, '-sent_at', 100)), { enabled: !!id });
  const { data: aircallCalls = [] } = useQ(['aircall', id], () => safe(() => base44.entities.AircallCall.filter({ landlord_id: id }, '-started_at', 50)), { enabled: !!id });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PALETTE.page }}>
        <div className="text-center">
          <Loader2 className="w-9 h-9 animate-spin mx-auto mb-3" style={{ color: PALETTE.gold }} />
          <p style={{ color: PALETTE.textDim }}>Loading landlord…</p>
        </div>
      </div>
    );
  }
  if (!L) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PALETTE.page, color: PALETTE.textDim }}>
        <div className="text-center">
          <p className="mb-3">Landlord not found.</p>
          <button onClick={() => navigate('/landlords')} className="h-9 px-4 rounded-lg font-semibold" style={{ background: `${PALETTE.gold}1f`, color: PALETTE.gold, border: `1px solid ${PALETTE.gold}55` }}>Back to Landlords</button>
        </div>
      </div>
    );
  }

  // Light view-model only for header display strings; everything else binds to L (raw) directly.
  const vm = {
    id: L.id,
    name: L.full_name_en || L.full_name || 'Unnamed landlord',
    initials: initialsOf(L.first_name, L.last_name),
    lead_type: L.lead_type,
    sqft: prop.area_sqft ? `${prop.area_sqft} sqft` : null,
  };
  const raw = { ...L, bedrooms: prop.bedrooms };

  // Stage move — reuse the same write shape as the pipeline drag/arrows, then re-analyse.
  const handleStageChange = async ({ id: lid, newStage }) => {
    if (!lid || !newStage) return;
    try {
      await base44.entities.Landlord.update(lid, { stage: newStage, stage_entered_at: new Date().toISOString() });
      refetch();
      base44.functions.invoke('landlordOrchestrator', { landlord_id: lid, force: true }).catch(() => {});
    } catch (e) {
      toast.error('Failed to move stage: ' + (e?.message || 'unknown error'));
    }
  };

  const openComposer = (channel, prefill = '') => setComposer({ open: true, channel, prefill });

  const handleAction = (action) => {
    if (action === 'call') { if (raw.phone) window.open(`tel:${raw.phone}`); return; }
    if (action === 'email' || action === 'imessage' || action === 'whatsapp' || action === 'telegram' || action === 'log_call') {
      openComposer(action);
    }
  };

  // "Do it" — if the next-best-action implies a message, preload the top suggested message
  // into the matching channel composer; otherwise open Log Call.
  const handleDoNextBest = (nba) => {
    const msgs = Array.isArray(raw.ai_suggested_messages) ? raw.ai_suggested_messages : [];
    const actionText = `${nba?.action || ''}`.toLowerCase();
    const isMessage = /message|whatsapp|text|email|telegram|imessage|reply|send/.test(actionText) || msgs.length > 0;
    if (isMessage && msgs[0]) {
      const ch = (msgs[0].channel || '').toLowerCase();
      const channel = ch.includes('email') ? 'email' : ch.includes('telegram') ? 'telegram' : ch.includes('imessage') || ch.includes('sms') ? 'imessage' : 'whatsapp';
      openComposer(channel, msgs[0].text || '');
    } else {
      openComposer('log_call');
    }
  };

  const handleSendSuggested = async (msg) => {
    const ch = (msg.channel || '').toLowerCase();
    const channel = ch.includes('email') ? 'email' : ch.includes('telegram') ? 'telegram' : ch.includes('imessage') || ch.includes('sms') ? 'imessage' : 'whatsapp';
    openComposer(channel, msg.text || '');
  };

  const handleCreateTask = async (t) => {
    try {
      await base44.entities.LandlordTask.create({ landlord_id: id, title: titleize(t.template_key), created_from_ai: true, ai_source: t.template_key });
      toast.success('Task created');
    } catch (e) {
      toast.error('Failed to create task: ' + (e?.message || 'unknown error'));
    }
  };

  const handleResolveIMessage = async () => {
    try {
      const res = await base44.functions.invoke('resolveLandlordIMessage', { landlord_id: id });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success('iMessage handles resolved');
      refetch();
    } catch (e) {
      toast.error('Resolve failed: ' + (e?.message || 'unknown error'));
    }
  };

  const handleReanalyse = async () => {
    setReanalyzing(true);
    try {
      await base44.functions.invoke('landlordOrchestrator', { landlord_id: id, force: true });
      toast.success('Brain re-run complete');
      refetch();
    } catch (e) {
      toast.error('Re-run failed: ' + (e?.message || 'unknown error'));
    } finally {
      setReanalyzing(false);
    }
  };

  // Unified reverse-chronological timeline.
  const fmtTitle = (dir, ch) => `${dir === 'out' || dir === 'outbound' ? 'Outbound' : 'Inbound'} · ${ch}`;
  const timeline = [];
  waMessages.forEach((m) => timeline.push({ icon: '💬', title: fmtTitle(m.direction, 'WhatsApp'), body: m.body, ts: m.timestamp || m.created_date }));
  iMessages.forEach((m) => timeline.push({ icon: '🔵', title: fmtTitle(m.direction, 'iMessage'), body: m.body, ts: m.sent_at || m.created_date }));
  telegramMessages.forEach((m) => timeline.push({ icon: '✈', title: fmtTitle(m.direction, 'Telegram'), body: m.body, ts: m.sent_at || m.created_date }));
  aircallCalls.forEach((c) => timeline.push({ icon: '📞', title: fmtTitle(c.direction, c.source === 'vapi' ? 'VAPI Call' : 'Aircall'), body: c.from_number || c.to_number || '', ts: c.started_at || c.created_date }));
  (Array.isArray(L.stage_history) ? L.stage_history : []).forEach((h) => timeline.push({ icon: '⇪', title: `Stage → ${STAGE_LABELS[h.stage] || titleize(h.stage)}`, body: '', ts: h.entered_at }));
  timeline.sort((a, b) => tsOf(b.ts) - tsOf(a.ts));

  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['wa_stream', id] });
    queryClient.invalidateQueries({ queryKey: ['imsgs', id] });
    queryClient.invalidateQueries({ queryKey: ['tg_msgs', id] });
  };

  return (
    <div className="min-h-screen" style={{ background: PALETTE.page, color: PALETTE.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600;700&display=swap');`}</style>

      <CommandHeader
        landlord={vm}
        raw={raw}
        options={[{ id: vm.id, name: vm.name }]}
        onSwitch={() => {}}
        onStageChange={handleStageChange}
        onAction={handleAction}
      />

      <div className="px-4 py-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        {/* Back + Re-run */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={() => navigate('/landlords')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: PALETTE.textDim, border: `1px solid ${PALETTE.cardBorder}` }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Landlords
          </button>
          <button onClick={handleReanalyse} disabled={reanalyzing} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold" style={{ background: `${PALETTE.gold}1a`, color: PALETTE.gold, border: `1px solid ${PALETTE.gold}44`, opacity: reanalyzing ? 0.6 : 1 }}>
            {reanalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-run brain
          </button>
        </div>

        {/* Vital signs */}
        <div className="mb-4">
          <VitalSigns raw={raw} />
        </div>

        {/* Two columns → one column on narrow widths */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-3 items-start">
          <LeftColumn
            raw={raw}
            vm={vm}
            onDoNextBest={handleDoNextBest}
            onSendSuggested={handleSendSuggested}
            onCreateTask={handleCreateTask}
            timeline={timeline}
          />
          <RightColumn raw={raw} prop={prop} onResolveIMessage={handleResolveIMessage} />
        </div>
      </div>

      <ComposerModal
        open={composer.open}
        channel={composer.channel}
        raw={raw}
        prefill={composer.prefill}
        onClose={() => setComposer({ open: false, channel: null, prefill: '' })}
        onSent={() => { setComposer({ open: false, channel: null, prefill: '' }); refresh(); }}
      />
    </div>
  );
}