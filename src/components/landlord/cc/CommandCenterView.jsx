// CommandCenterView — presentational shell for the redesigned Landlord detail page.
// Receives a fully-mapped `vm` + `actions` and a few raw ids needed by reused composers.
// Hosts the channel composer modals (Email/iMessage/Appointment reused as-is) and the
// manual call-log modal. All business logic lives in the page container / reused functions.
import React, { useState } from 'react';
import { CC_FONT_CSS, PAGE_BG } from './ccPrimitives';
import CCHeader from './CCHeader';
import CCVitalSigns from './CCVitalSigns';
import CCLeftColumn from './CCLeftColumn';
import CCRightSidebar from './CCRightSidebar';
import CCModal from './CCModal';
import CCLogCallModal from './CCLogCallModal';
import EmailComposer from '@/components/landlord/EmailComposer';
import IMessageComposer from '@/components/landlord/IMessageComposer';
import { waMeUrl, normalizePhone } from '@/lib/phone';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CommandCenterView({ vm, raw, onStageChange, onRerunBrain, onLogged, landlordOptions, currentId, onSwitch, rerunning }) {
  const [modal, setModal] = useState(null); // 'email' | 'imessage' | 'logcall' | null

  const e164 = normalizePhone(vm.phone);

  // Send a suggested message on its declared channel using existing send functions.
  const sendSuggested = async (msg) => {
    const ch = String(msg.channel || '').toLowerCase();
    try {
      if (ch.includes('imessage')) {
        const res = await base44.functions.invoke('sendIMessage', { landlord_id: raw.id, text: msg.text });
        if (res?.data?.error) throw new Error(res.data.error);
        toast.success('iMessage sent');
      } else if (ch.includes('telegram')) {
        const res = await base44.functions.invoke('sendTelegram', { landlord_id: raw.id, text: msg.text });
        if (res?.data?.error) throw new Error(res.data.error);
        toast.success('Telegram sent');
      } else if (ch.includes('email')) {
        setModal('email');
        return;
      } else {
        // default → WhatsApp (business/personal handled by the function's own logic)
        const channel = ch.includes('business') ? 'business' : 'personal';
        const res = await base44.functions.invoke('sendMultiChannelWhatsApp', { landlord_id: raw.id, text: msg.text, channel });
        if (res?.data?.error) throw new Error(res.data.error);
        toast.success('WhatsApp sent');
      }
      onLogged?.();
    } catch (e) {
      toast.error('Failed to send: ' + (e?.message || 'unknown error'));
    }
  };

  // "Do it" on the Next Best Action: if it implies a message, send the top suggested message;
  // otherwise open the call-log form as a sensible default action.
  const doNextAction = () => {
    const top = Array.isArray(vm.aiSuggestedMessages) ? vm.aiSuggestedMessages[0] : null;
    const txt = String(vm.aiNextBestAction?.action || '').toLowerCase();
    if (top && /(message|whatsapp|text|imessage|send|email|telegram|reply)/.test(txt)) {
      sendSuggested(top);
    } else if (/call/.test(txt)) {
      setModal('logcall');
    } else if (top) {
      sendSuggested(top);
    } else {
      setModal('logcall');
    }
  };

  // Create a LandlordTask from a suggested-task chip (one-tap).
  const createTask = async (t) => {
    try {
      await base44.entities.LandlordTask.create({
        landlord_id: raw.id,
        title: t.label || String(t.template_key || 'Task').replace(/_/g, ' '),
        assignee_email: vm.people?.assignedAgent || undefined,
        done: false,
        created_from_ai: true,
        ai_source: t.template_key || 'ai_suggested_tasks',
      });
      toast.success('Task created');
      onLogged?.();
    } catch (e) {
      toast.error('Failed to create task: ' + (e?.message || 'unknown error'));
    }
  };

  const actions = {
    onCall: () => { if (e164) window.open(`tel:${e164}`); },
    onWhatsApp: () => { const p = normalizePhone(vm.whatsapp || vm.phone); if (p) window.open(waMeUrl(p), '_blank', 'noopener'); },
    onIMessage: () => setModal('imessage'),
    onEmail: () => setModal('email'),
    onTelegram: async () => {
      try {
        const text = vm.aiSuggestedMessages?.[0]?.text;
        if (!text) { toast.info('No suggested message — open the landlord chat to compose.'); return; }
        const res = await base44.functions.invoke('sendTelegram', { landlord_id: raw.id, text });
        if (res?.data?.error) throw new Error(res.data.error);
        toast.success('Telegram sent');
        onLogged?.();
      } catch (e) { toast.error('Telegram failed: ' + (e?.message || 'unknown error')); }
    },
    onLogCall: () => setModal('logcall'),
    onStageBack: () => vm.prevStageKey && onStageChange(vm.prevStageKey),
    onStageForward: () => vm.nextStageKey && onStageChange(vm.nextStageKey),
    onSendSuggested: sendSuggested,
    onDoNextAction: doNextAction,
    onCreateTask: createTask,
    onResolveIMessage: async () => {
      try {
        toast.loading('Resolving iMessage…', { id: 'cc-im' });
        const res = await base44.functions.invoke('resolveLandlordIMessage', { landlord_id: raw.id });
        if (res?.data?.error) throw new Error(res.data.error);
        toast.success('iMessage resolved', { id: 'cc-im' });
        onLogged?.();
      } catch (e) { toast.error('Resolve failed: ' + (e?.message || 'unknown error'), { id: 'cc-im' }); }
    },
    onRerunBrain,
  };

  const headerVm = { ...vm, rerunning };

  return (
    <div className="cc-root" style={{ minHeight: '100dvh', background: PAGE_BG, color: 'rgba(255,255,255,0.9)' }}>
      <style>{CC_FONT_CSS}</style>
      <CCHeader vm={headerVm} actions={actions} landlordOptions={landlordOptions} currentId={currentId} onSwitch={onSwitch} />

      <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CCVitalSigns vm={vm} />
        <div className="cc-grid">
          <CCLeftColumn vm={vm} actions={actions} />
          <CCRightSidebar vm={{ ...vm, rerunning }} actions={actions} />
        </div>
      </div>

      <CCModal open={modal === 'email'} title="Email" onClose={() => setModal(null)}>
        <EmailComposer landlordId={raw.id} toEmail={vm.email} onLogged={() => { onLogged?.(); setModal(null); }} />
      </CCModal>
      <CCModal open={modal === 'imessage'} title={vm.imessageAvailable ? 'iMessage' : 'iMessage / SMS'} onClose={() => setModal(null)}>
        <IMessageComposer landlordId={raw.id} onSent={() => { onLogged?.(); }} onFallback={() => toast.info('No iMessage handle — try WhatsApp.')} />
      </CCModal>
      <CCModal open={modal === 'logcall'} title="Log Call" onClose={() => setModal(null)}>
        <CCLogCallModal landlordId={raw.id} phone={vm.phone} agentEmail={vm.people?.assignedAgent} onLogged={() => { onLogged?.(); setModal(null); }} />
      </CCModal>
    </div>
  );
}