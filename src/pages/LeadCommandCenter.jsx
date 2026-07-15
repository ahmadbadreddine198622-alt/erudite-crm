// LeadCommandCenter — full lead detail page mirroring the Landlord Command Center.
// Three-panel architecture: LEFT info panel · CENTER unified activity stream · composer bar.
// Private Bank × Light design. All channels wired with lead_id. Degrade-safe everywhere.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, MessageCircle, Send, Trash2, Building2, User, MapPin,
  DollarSign, Zap, Flame, AlertTriangle, TrendingUp, FileText, Calendar, Plus,
  CheckCircle2, Clock, Loader2, ExternalLink, Bell, Save, Sparkles, RefreshCw,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';
import { normalizePhone, waMeUrl } from '@/lib/phone';
import { PB, champagneInk, formatAEDCompact, isAtRisk, isHot, hasSignals, leadScore, daysInStage } from '@/lib/buyerPipelineTokens';
import { buildLeadStream } from '@/lib/buildLeadStream';
import { fmtMsgTime } from '@/lib/landlordStreamHelpers';
import WritingField from '@/components/shared/WritingField';
import ModernComposerField from '@/components/landlord/ModernComposerField';
import EmailTemplatePicker from '@/components/landlord/EmailTemplatePicker';
import EmailTemplateDialog from '@/components/landlord/EmailTemplateDialog';
import ReadAloudButton from '@/components/shared/ReadAloudButton';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import { STAGES, getStagesForIntent } from '@/lib/pipeline';
import InlineKaraokeBody from '@/components/shared/InlineKaraokeBody';
import BuyerCallScript from '@/components/buyer/BuyerCallScript';
import BuyerMandateDossierCard from '@/components/buyer/BuyerMandateDossierCard';
import AuroraProposalsStrip from '@/components/landlord/AuroraProposalsStrip';
import LeadDirectiveStrip from '@/components/buyer/LeadDirectiveStrip';

// ── Helpers ──────────────────────────────────────────────────────────────────
function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}
function dedupeById(batches) {
  const seen = new Set(); const out = [];
  for (const row of (batches || []).flat()) {
    if (row && !seen.has(row.id)) { seen.add(row.id); out.push(row); }
  }
  return out;
}
const safe = (fn) => fn().catch(() => []);
const tsOf = (v) => v ? new Date(v).getTime() : 0;

function useQ(key, fn, extra = {}) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false, staleTime: 30000, ...extra });
}

// ── Design helpers ───────────────────────────────────────────────────────────
const HAIR = PB.HAIR, HAIR2 = PB.HAIR2, WELL = PB.WELL, GOLD = PB.GOLD, SLATE = PB.SLATE, NAME = PB.NAME, CLARET = PB.CLARET, CLARET_TEXT = PB.CLARET_TEXT;

function Chip({ children, dot, style, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: 'transparent', border: `1px solid ${HAIR2}`,
      color: SLATE, fontSize: 9.5, fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      whiteSpace: 'nowrap', lineHeight: 1.1, ...style,
    }}>
      {dot}{children}
    </span>
  );
}

function ScoreRing({ score, size = 40, children }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(100, score || 0));
  const arc = (s / 100) * circ;
  const arcColor = s < 40 ? CLARET_TEXT : GOLD;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        {s > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={arcColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${circ - arc}`} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ position: 'absolute', width: size - 8, height: size - 8, borderRadius: 999, background: 'rgba(198,161,91,0.06)' }} />
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: size - 10, height: size - 10, borderRadius: 999, overflow: 'hidden' }}>
          {children}
        </span>
      </div>
    </div>
  );
}

// ── Stream item renderer ─────────────────────────────────────────────────────
function StreamItem({ item }) {
  if (item.t === 'msg') {
    const isOut = item.dir === 'out';
    return (
      <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
        <div style={{
          maxWidth: '78%', borderRadius: 12, padding: '8px 12px',
          background: isOut ? 'rgba(198,161,91,0.08)' : WELL,
          border: `1px solid ${isOut ? 'rgba(198,161,91,0.2)' : HAIR}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: isOut ? GOLD : NAME }}>{item.sender || (isOut ? 'Agent' : 'Lead')}</span>
            {item.channel && <span style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: SLATE }}>{item.channel}</span>}
            {item.wa && <span style={{ fontSize: 8.5, textTransform: 'uppercase', color: SLATE }}>{item.wa}</span>}
          </div>
          {item.subject && <div style={{ fontSize: 12, fontWeight: 600, color: NAME, marginBottom: 2 }}>{item.subject}</div>}
          {item.text && (() => {
            const speakTitle = `${item.channel || 'Message'} · ${item.sender || (isOut ? 'Agent' : 'Lead')}${item.time ? ' · ' + item.time : ''}`;
            return (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <InlineKaraokeBody text={item.text} title={speakTitle} style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.9)', flex: 1 }} activeColor={isOut ? '#D8B26A' : '#93c5fd'} />
                <ReadAloudButton text={item.text} title={speakTitle} size={18} style={{ flex: 'none', marginTop: -2 }} />
              </div>
            );
          })()}
          {item.transcript && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontStyle: 'italic' }}>{item.transcript}</div>}
          {item.mediaUrl && (
            <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 4, borderRadius: 8, overflow: 'hidden', border: `1px solid ${HAIR2}` }}>
              <img src={item.mediaUrl} alt="" loading="lazy" style={{ display: 'block', maxWidth: '100%', maxHeight: 200, objectFit: 'cover' }} />
            </a>
          )}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: isOut ? 'right' : 'left' }}>{item.time}</div>
        </div>
      </div>
    );
  }
  // Activity item (note, task, followup, call, coaching)
  const kindIcon = {
    note: FileText, task: CheckCircle2, followup: Calendar, call: Phone,
    founder_directive: Bell, coaching_comment: Bell,
  };
  const Icon = kindIcon[item.kind] || FileText;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '6px 8px', borderRadius: 8, background: WELL, border: `1px solid ${HAIR}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(198,161,91,0.06)', border: `1px solid ${HAIR2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: SLATE }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: NAME }}>{item.title}</div>
        {item.body && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 1.4 }}>{item.body}</div>}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
          {item.author && <span>{item.author} · </span>}
          {item.time}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const COMPOSER_TABS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'imessage', label: 'iMessage', icon: MessageCircle },
  { key: 'telegram', label: 'Telegram', icon: Send },
  { key: 'sms', label: 'SMS', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'note', label: 'Note', icon: FileText },
  { key: 'task', label: 'Task', icon: CheckCircle2 },
  { key: 'call', label: 'Call Log', icon: Phone },
];

const STREAM_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp', match: (i) => i.channel === 'whatsapp' || i.wa },
  { key: 'imessage', label: 'iMessage', match: (i) => i.channel === 'imessage' },
  { key: 'telegram', label: 'Telegram', match: (i) => i.channel === 'telegram' },
  { key: 'email', label: 'Email', match: (i) => i.channel === 'email' },
  { key: 'call', label: 'Calls', match: (i) => i.kind === 'call' || i.t === 'call' },
  { key: 'note', label: 'Notes', match: (i) => i.kind === 'note' },
  { key: 'task', label: 'Tasks', match: (i) => i.kind === 'task' },
];

export default function LeadCommandCenter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const { getPhotoForPhone } = usePhotoByPhone();

  const [composerTab, setComposerTab] = useState('whatsapp');
  const [composerText, setComposerText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [streamFilter, setStreamFilter] = useState('all');
  const [sending, setSending] = useState(false);
  const streamRef = useRef(null);

  // ── Load lead ──
  const { data: lead, isLoading, refetch: refetchLead } = useQ(
    ['lead', id],
    () => base44.entities.Lead.get(id),
    { enabled: !!id },
  );

  const phone = lead?.phone;
  const e164 = normalizePhone(phone);
  const email = lead?.email;
  const score = leadScore(lead);

  // ── BUYER BRAIN ON-OPEN TRIGGER (B1.5a) — mirrors LandlordDetailPage: wake the brain
  // (the backend's own debounce decides whether it actually runs), then forge the channel
  // drafts (force only when the brain just ran). Once per visit per lead id. ──
  const brainWokeFor = useRef(null);
  const [brainRunning, setBrainRunning] = useState(false);
  const [draftsForging, setDraftsForging] = useState(false);
  useEffect(() => {
    if (!id || !lead?.id || brainWokeFor.current === id) return;
    brainWokeFor.current = id;
    (async () => {
      let brainRan = false;
      try {
        setBrainRunning(!lead.ai_processed_at);
        const bres = await base44.functions.invoke('buyerOrchestrator', { lead_id: id });
        const bdata = bres?.data ?? bres;
        brainRan = !!bdata && !bdata.skipped && !bdata.error;
        if (brainRan) await refetchLead();
      } catch (_) { /* brain wake is best-effort — the page never blocks on it */ }
      setBrainRunning(false);
      try {
        setDraftsForging(!lead.ai_approach_drafts);
        const res = await base44.functions.invoke('forgeBuyerApproachDrafts', { lead_id: id, force: brainRan });
        const data = res?.data ?? res;
        if (data?.forged) await refetchLead();
      } catch (_) { /* drafts are best-effort */ }
      setDraftsForging(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lead?.id]);

  // Manual re-analyse (force) — the button in the AI Intelligence header.
  const handleAnalyseNow = async () => {
    if (!id || brainRunning) return;
    setBrainRunning(true);
    try {
      const res = await base44.functions.invoke('buyerOrchestrator', { lead_id: id, force: true });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      await refetchLead();
      toast.success('Analysis refreshed');
      try {
        setDraftsForging(true);
        await base44.functions.invoke('forgeBuyerApproachDrafts', { lead_id: id, force: true });
        await refetchLead();
      } finally { setDraftsForging(false); }
    } catch (e) { toast.error('Analysis failed: ' + (e?.message || 'unknown')); }
    finally { setBrainRunning(false); }
  };

  // ── Load all related entities (degrade-safe) ──
  const { data: allUsers = [] } = useQ(['all_users_for_names_lead'], () => safe(() => base44.entities.User.list()));
  const resolveUserName = (em) => {
    if (!em) return null;
    const u = allUsers.find((u) => u.email === em);
    return u?.display_name || u?.full_name || em.split('@')[0];
  };
  const resolveAgentByPhone = (fn) => {
    const d = String(fn || '').replace(/\D/g, '');
    const u = allUsers.find((u) => { const ud = String(u.whatsapp_number || '').replace(/\D/g, ''); return ud && ud === d; });
    return u?.display_name || u?.full_name || null;
  };

  // WhatsApp messages by lead_id or phone
  const { data: waMessages = [] } = useQ(['lead_wa_msgs', id], async () => {
    const byId = await safe(() => base44.entities.WhatsAppMessage.filter({ lead_id: id }, 'timestamp', 200));
    if (byId.length) return byId;
    // Fallback: phone match
    const variants = phoneVariants(phone);
    if (!variants.length) return [];
    const batches = await Promise.all(variants.flatMap((v) => [
      safe(() => base44.entities.WhatsAppMessage.filter({ from_number: v }, 'timestamp', 100)),
      safe(() => base44.entities.WhatsAppMessage.filter({ to_number: v }, 'timestamp', 100)),
    ]));
    return dedupeById(batches);
  }, { enabled: !!id, refetchInterval: 5000 });

  // iMessages by lead_id
  const { data: iMessages = [] } = useQ(['lead_imsg', id], () => safe(() => base44.entities.IMessage.filter({ lead_id: id }, '-sent_at', 200)), { enabled: !!id, refetchInterval: 5000 });

  // Telegram messages by lead_id
  const { data: telegramMessages = [] } = useQ(['lead_tg', id], () => safe(() => base44.entities.TelegramMessage.filter({ lead_id: id }, '-sent_at', 200)), { enabled: !!id, refetchInterval: 5000 });

  // Emails by lead_id or email match
  const { data: emailMessages = [] } = useQ(['lead_emails', id], async () => {
    const byId = await safe(() => base44.entities.Email.filter({ lead_id: id }, '-created_date', 100));
    if (byId.length) return byId;
    if (!email) return [];
    const batches = await Promise.all([
      safe(() => base44.entities.Email.filter({ to_email: email }, '-created_date', 100)),
      safe(() => base44.entities.Email.filter({ from_email: email }, '-created_date', 100)),
    ]);
    return dedupeById(batches);
  }, { enabled: !!id, refetchInterval: 10000 });

  // CallLogs by phone
  const { data: twilioLogs = [] } = useQ(['lead_twilio', phone], async () => {
    const variants = phoneVariants(phone);
    if (!variants.length) return [];
    const batches = await Promise.all(variants.flatMap((v) => [
      safe(() => base44.entities.CallLog.filter({ to_number: v }, '-started_at', 100)),
      safe(() => base44.entities.CallLog.filter({ from_number: v }, '-started_at', 100)),
    ]));
    return dedupeById(batches);
  }, { enabled: !!phone, refetchInterval: 60000 });

  // AircallCall by lead_id or phone
  const { data: aircallCalls = [] } = useQ(['lead_aircall', id], () => safe(() => base44.entities.AircallCall.filter({ lead_id: id }, '-started_at', 50)), { enabled: !!id });
  const { data: aircallByPhone = [] } = useQ(['lead_aircall_phone', phone], async () => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 9) return [];
    const suffix = digits.slice(-9);
    const all = await safe(() => base44.entities.AircallCall.list('-started_at', 2000));
    return all.filter((c) => {
      const to = String(c.to_number || '').replace(/\D/g, '');
      const from = String(c.from_number || '').replace(/\D/g, '');
      return to.endsWith(suffix) || from.endsWith(suffix);
    });
  }, { enabled: !!phone });

  // Notes by linked_lead_id
  const { data: notes = [] } = useQ(['lead_notes', id], () => safe(() => base44.entities.Note.filter({ linked_lead_id: id }, '-created_date', 100)), { enabled: !!id });

  // Reminders by lead_id (serves as tasks + follow-ups)
  const { data: reminders = [] } = useQ(['lead_reminders', id], () => safe(() => base44.entities.Reminder.filter({ lead_id: id }, '-created_date', 100)), { enabled: !!id });

  // ── AURORA PROPOSALS (B1) — materialized buyer-brain proposals awaiting a human verdict.
  // (Mirrors the landlord Followup/LandlordTask aurora rows; buyer side lives on Reminder.) ──
  const { data: auroraReminders = [] } = useQ(
    ['lead_aurora_proposals', id],
    () => safe(() => base44.entities.Reminder.filter({ lead_id: id, origin: 'aurora', proposal_status: 'proposed', status: 'pending' }, '-created_date', 20)),
    { enabled: !!id, refetchInterval: 30000 },
  );
  const auroraProposals = useMemo(() => (auroraReminders || []).map((r) => ({
    ...r,
    type: r.type === 'follow_up' ? 'followup' : 'task',
    scheduled_at: r.due_date,
  })), [auroraReminders]);
  const [proposalBusyId, setProposalBusyId] = useState(null);
  const handleProposalAction = async (p, verdict) => {
    setProposalBusyId(p.id);
    try {
      await base44.entities.Reminder.update(p.id, verdict === 'approved'
        ? { proposal_status: 'approved' }
        : { proposal_status: 'dismissed', status: 'cancelled' });
      queryClient.invalidateQueries({ queryKey: ['lead_aurora_proposals', id] });
      queryClient.invalidateQueries({ queryKey: ['lead_reminders', id] });
      toast.success(verdict === 'approved' ? 'Proposal approved' : 'Proposal dismissed');
    } catch (e) { toast.error('Proposal update failed: ' + (e?.message || 'unknown')); }
    finally { setProposalBusyId(null); }
  };

  // ── BRAIN QUALIFY (B4a) — transcript → proposed Lead field updates; the human
  // clicking Apply IS the confirmation (the write happens here, client-side). ──
  const [qualifyBusy, setQualifyBusy] = useState(false);
  const [qualifyResult, setQualifyResult] = useState(null);
  const [applyingField, setApplyingField] = useState(null);
  const handleBrainQualify = async () => {
    if (qualifyBusy) return;
    setQualifyBusy(true);
    try {
      const res = await base44.functions.invoke('buyerBrainQualify', { lead_id: id });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setQualifyResult(data);
      if (!data?.proposed_updates?.length) toast.info('Call analysed — no new field values to propose.');
    } catch (e) { toast.error('Brain Qualify: ' + (e?.message || 'unknown')); }
    finally { setQualifyBusy(false); }
  };
  const handleApplyQualify = async (p) => {
    setApplyingField(p.field_key);
    try {
      await base44.entities.Lead.update(id, { [p.field_key]: p.value });
      setQualifyResult((q) => q ? { ...q, proposed_updates: q.proposed_updates.filter((x) => x.field_key !== p.field_key) } : q);
      await refetchLead();
      toast.success(`${p.field_key.replace(/_/g, ' ')} updated`);
    } catch (e) { toast.error('Apply failed: ' + (e?.message || 'unknown')); }
    finally { setApplyingField(null); }
  };

  // ── POST-CALL DEBRIEF (B4c) — rolling-summary delta + aurora follow-up proposals. ──
  const [debriefBusy, setDebriefBusy] = useState(false);
  const handleDebrief = async () => {
    if (debriefBusy) return;
    setDebriefBusy(true);
    try {
      const res = await base44.functions.invoke('leadPostCallDebrief', { lead_id: id });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      await refetchLead();
      queryClient.invalidateQueries({ queryKey: ['lead_aurora_proposals', id] });
      toast.success(`Call debriefed${data?.proposals_created?.length ? ` · ${data.proposals_created.length} follow-up proposal(s)` : ''}`);
    } catch (e) { toast.error('Debrief: ' + (e?.message || 'unknown')); }
    finally { setDebriefBusy(false); }
  };

  // ── Brain suggestion quick-adds (B1) — a HUMAN clicking Add IS the approval. ──
  const [addingSuggestion, setAddingSuggestion] = useState(null);
  const handleAddSuggestedTask = async (t, idx) => {
    setAddingSuggestion(`task_${idx}`);
    try {
      await base44.entities.Reminder.create({
        lead_id: id, lead_name: lead?.full_name || '',
        title: (t.template_key || 'task').replace(/_/g, ' '),
        notes: t.reason || '', type: 'task', status: 'pending',
        assigned_to: lead?.assigned_agent_email || currentUser?.email || '',
        origin: 'aurora', proposal_status: 'approved', ai_source: t.template_key || '',
      });
      queryClient.invalidateQueries({ queryKey: ['lead_reminders', id] });
      toast.success('Task added');
    } catch (e) { toast.error('Task add failed: ' + (e?.message || 'unknown')); }
    finally { setAddingSuggestion(null); }
  };
  const handleAddSuggestedFollowup = async (f, idx) => {
    setAddingSuggestion(`fu_${idx}`);
    try {
      const due = new Date();
      due.setDate(due.getDate() + (Number(f.when_offset_days) || 1));
      due.setHours(Math.min(21, Math.max(9, Number(f.suggested_hour) || 10)), 0, 0, 0);
      await base44.entities.Reminder.create({
        lead_id: id, lead_name: lead?.full_name || '',
        title: `${(f.template_key || 'follow up').replace(/_/g, ' ')}${f.channel ? ` (${f.channel})` : ''}`,
        notes: f.reason || '', type: 'follow_up', status: 'pending',
        due_date: due.toISOString(),
        assigned_to: lead?.assigned_agent_email || currentUser?.email || '',
        origin: 'aurora', proposal_status: 'approved', ai_source: f.template_key || '',
      });
      queryClient.invalidateQueries({ queryKey: ['lead_reminders', id] });
      toast.success('Follow-up scheduled');
    } catch (e) { toast.error('Follow-up add failed: ' + (e?.message || 'unknown')); }
    finally { setAddingSuggestion(null); }
  };

  // Projects for name lookup
  const { data: projects = [] } = useQ(['projects_lead', id], () => safe(() => base44.entities.Project.list('name', 200)));
  const project = projects.find((p) => p.id === lead?.project_id);

  // WhatsApp channel derivation (same logic as landlord page)
  const deriveWaChannel = (msg) => {
    if (msg.channel === 'personal' || msg.channel === 'business' || msg.channel === 'agent' || msg.channel === 'malik') return msg.channel;
    const eruditeSide = msg.direction === 'inbound' ? msg.to_number : msg.from_number;
    if (eruditeSide) {
      const digits = eruditeSide.replace(/\D/g, '');
      if (digits.endsWith('1806000')) return 'personal';
      if (digits.endsWith('2806000')) return 'business';
    }
    return 'business';
  };

  // Build unified stream
  const { stream, calls } = useMemo(() => buildLeadStream({
    emailMessages, waStreamMessages: waMessages, iMessages, telegramMessages,
    callLogs: twilioLogs, aircallCalls, aircallByPhone,
    notes, reminders, activityComments: [],
    leadEmail: email, L: lead || {}, resolveUserName, resolveAgentByPhone, deriveWaChannel, tsOf,
  }), [emailMessages, waMessages, iMessages, telegramMessages, twilioLogs, aircallCalls, aircallByPhone, notes, reminders, lead, email, allUsers]);

  // Filtered stream
  const filteredStream = useMemo(() => {
    if (streamFilter === 'all') return stream;
    const filter = STREAM_FILTERS.find((f) => f.key === streamFilter);
    if (!filter?.match) return stream;
    return stream.filter(filter.match);
  }, [stream, streamFilter]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [filteredStream.length, composerTab]);

  // ── Send handlers ──
  const handleSendWhatsApp = async () => {
    if (!composerText.trim() || !e164) { toast.error('No phone number'); return; }
    setSending(true);
    try {
      await base44.functions.invoke('sendWhatsAppMessageFromCRM', { phone_number: e164, message_text: composerText.trim() });
      toast.success('WhatsApp sent');
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['lead_wa_msgs', id] });
    } catch (e) { toast.error('WhatsApp send failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleSendIMessage = async () => {
    if (!composerText.trim() || !e164) { toast.error('No phone number for iMessage'); return; }
    setSending(true);
    try {
      await base44.functions.invoke('sendIMessage', { address: e164, text: composerText.trim() });
      toast.success('iMessage sent');
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['lead_imsg', id] });
    } catch (e) { toast.error('iMessage send failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleSendSMS = async () => {
    if (!composerText.trim() || !e164) { toast.error('No phone number'); return; }
    setSending(true);
    try {
      await base44.functions.invoke('twilioSendSMS', { lead_id: id, to_phone: e164, body: composerText.trim() });
      toast.success('SMS sent');
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['lead_twilio', phone] });
    } catch (e) { toast.error('SMS send failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleSendEmail = async () => {
    if (!composerText.trim() || !email) { toast.error('No email address'); return; }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: email, subject: emailSubject || 'Following up', body: composerText.trim() });
      toast.success('Email sent');
      setComposerText(''); setEmailSubject('');
      queryClient.invalidateQueries({ queryKey: ['lead_emails', id] });
    } catch (e) { toast.error('Email send failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleSaveNote = async () => {
    if (!composerText.trim()) return;
    setSending(true);
    try {
      await base44.entities.Note.create({ linked_lead_id: id, body: composerText.trim(), author_email: currentUser?.email || '' });
      toast.success('Note saved');
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['lead_notes', id] });
    } catch (e) { toast.error('Note save failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleSaveTask = async () => {
    if (!composerText.trim()) return;
    setSending(true);
    try {
      await base44.entities.Reminder.create({ lead_id: id, title: composerText.trim(), agent_email: currentUser?.email || '', status: 'pending', type: 'task' });
      toast.success('Task saved');
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['lead_reminders', id] });
    } catch (e) { toast.error('Task save failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleLogCall = async () => {
    if (!composerText.trim()) return;
    setSending(true);
    try {
      await base44.entities.CallLog.create({
        lead_id: id, direction: 'outbound', to_number: e164 || '',
        notes: composerText.trim(), agent_email: currentUser?.email || '',
        started_at: new Date().toISOString(), status: 'done',
      });
      toast.success('Call logged');
      setComposerText('');
      queryClient.invalidateQueries({ queryKey: ['lead_twilio', phone] });
    } catch (e) { toast.error('Call log failed: ' + (e?.message || 'unknown')); }
    finally { setSending(false); }
  };

  const handleCall = async () => {
    if (!e164) { toast.error('No phone number'); return; }
    try {
      const numsRes = await base44.functions.invoke('getTwilioNumbers', {});
      const nums = numsRes.data?.numbers || [];
      if (!nums.length) { toast.error('No Twilio numbers configured'); return; }
      await base44.functions.invoke('twilioMakeCall', { lead_id: id, to_phone: e164, from_phone: nums[0].phone_number, lead_name: lead?.full_name });
      toast.success('Calling…');
    } catch (e) { toast.error('Call failed: ' + (e?.message || 'unknown')); }
  };

  // Conversation tabs use ModernComposerField (full writing toolkit); note/task/call keep WritingField.
  const CONVERSATION_TABS = new Set(['whatsapp', 'imessage', 'telegram', 'sms', 'email']);
  const isConversationTab = CONVERSATION_TABS.has(composerTab);
  // tplChannel matches the tab key directly (whatsapp/imessage/telegram/sms/email).
  const tplChannel = composerTab;

  // Enter-to-send (Shift+Enter for newline) — conversation tabs only.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Save the current composer text as a reusable message template.
  const handleSaveTemplate = () => {
    if (!composerText.trim()) return;
    setSaveTemplateOpen(true);
  };

  const handleSend = () => {
    switch (composerTab) {
      case 'whatsapp': return handleSendWhatsApp();
      case 'imessage': return handleSendIMessage();
      case 'sms': return handleSendSMS();
      case 'email': return handleSendEmail();
      case 'note': return handleSaveNote();
      case 'task': return handleSaveTask();
      case 'call': return handleLogCall();
      case 'telegram': toast.info('Telegram sending for leads requires a connected chat — incoming messages still appear in the stream.'); return;
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PB.BASE }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: GOLD }} />
          <p style={{ color: SLATE, fontSize: 14 }}>Loading lead…</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PB.BASE }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: NAME, fontSize: 16, marginBottom: 12 }}>Lead not found.</p>
          <button onClick={() => navigate('/pipeline')} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${GOLD}80`, background: 'rgba(198,161,91,0.14)', color: GOLD, cursor: 'pointer', fontWeight: 600 }}>Back to Pipeline</button>
        </div>
      </div>
    );
  }

  const dInStage = daysInStage(lead);
  const atRisk = isAtRisk(lead);
  const hot = isHot(lead);
  const signals = lead.ai_buying_signals || [];
  const photoUrl = getPhotoForPhone ? getPhotoForPhone(lead.phone || lead.whatsapp) : null;
  const trackStages = getStagesForIntent(lead.intent || 'unknown');
  const stageMeta = STAGES[lead.stage] || {};
  const stageLabel = stageMeta.label || lead.stage?.replace(/_/g, ' ') || '—';

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: PB.BASE }}>
      {/* ── Header ── */}
      <div className="shrink-0" style={{ background: PB.CARD, borderBottom: `1px solid ${HAIR}`, padding: '8px 16px' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pipeline')} className="flex items-center gap-1.5 text-xs px-2.5 rounded-md shrink-0" style={{ height: 32, background: 'transparent', border: `1px solid ${HAIR2}`, color: SLATE, transition: 'color 150ms ease, border-color 150ms ease' }}>
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Pipeline
          </button>
          <ScoreRing score={score ?? 0} size={36}>
            {photoUrl ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }} /> : <span style={{ fontSize: 14, fontWeight: 600, color: GOLD }}>{lead.full_name?.[0]?.toUpperCase() || '?'}</span>}
          </ScoreRing>
          <div className="min-w-0 flex-1">
            <h1 className="text-base truncate" style={{ fontFamily: "'Cormorant',serif", fontWeight: 700, color: NAME }}>{lead.full_name || lead.name || 'Unknown Lead'}</h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Chip dot={<span style={{ width: 6, height: 6, borderRadius: 999, background: GOLD, flex: 'none', boxShadow: '0 0 6px rgba(198,161,91,0.7)' }} />}>{stageLabel}</Chip>
              {lead.source && <Chip>{lead.source.replace(/_/g, ' ')}</Chip>}
              {lead.intent && lead.intent !== 'unknown' && <Chip>{lead.intent}</Chip>}
              {hot && <Chip dot={<Flame className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: GOLD, flex: 'none' }} />} style={{ color: GOLD, borderColor: 'rgba(198,161,91,0.35)' }}>HOT</Chip>}
              {atRisk && <Chip style={{ color: CLARET_TEXT, borderColor: PB.CLARET_BORDER, background: PB.CLARET_BG }}>AT RISK{dInStage != null ? ` · ${dInStage}D` : ''}</Chip>}
              {hasSignals(lead) && <Chip dot={<Zap className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: GOLD, flex: 'none' }} />} style={{ color: GOLD, borderColor: 'rgba(198,161,91,0.3)' }} title={signals.join(', ')}>{signals.length} SIGNAL{signals.length !== 1 ? 'S' : ''}</Chip>}
            </div>
          </div>
          {/* Quick actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleCall} disabled={!e164} className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'transparent', border: `1px solid ${HAIR2}`, color: e164 ? GOLD : 'rgba(255,255,255,0.25)', cursor: e164 ? 'pointer' : 'not-allowed', transition: 'border-color 150ms ease' }} title="Call via Twilio">
              <Phone className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <a href={e164 ? waMeUrl(e164) : '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!e164) e.preventDefault(); }} className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'transparent', border: `1px solid ${HAIR2}`, color: e164 ? GOLD : 'rgba(255,255,255,0.25)', transition: 'border-color 150ms ease' }} title="WhatsApp">
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
            </a>
            {email && (
              <a href={`mailto:${email}`} className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'transparent', border: `1px solid ${HAIR2}`, color: GOLD, transition: 'border-color 150ms ease' }} title="Email">
                <Mail className="w-4 h-4" strokeWidth={1.5} />
              </a>
            )}
            {lead.stage === 'closing_dld' && (
              <div onClick={(e) => e.stopPropagation()}>
                <SendToClosingButton leadId={lead.id} propertyRef={lead.closing_property_ref} projectId={lead.closing_project_id} size="xs" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Three-panel layout ── */}
      <div className="flex-1 min-h-0 flex" style={{ overflow: 'hidden' }}>
        {/* LEFT panel — info */}
        <div className="shrink-0 overflow-y-auto" style={{ width: 320, background: PB.CARD, borderRight: `1px solid ${HAIR}`, padding: 12 }}>
          {/* Founder's Directive — gold strip, top authority (B4d) */}
          <LeadDirectiveStrip leadId={id} currentUser={currentUser} isAdmin={currentUser?.role === 'admin'} />

          {/* Contact details */}
          <Section title="Contact">
            <ContactRow icon={Phone} label="Phone" value={lead.phone} />
            <ContactRow icon={MessageCircle} label="WhatsApp" value={lead.whatsapp || lead.phone} />
            <ContactRow icon={Mail} label="Email" value={lead.email} />
            <ContactRow icon={User} label="Nationality" value={lead.nationality} />
            <ContactRow icon={MapPin} label="Residence" value={lead.residence_country} />
            <ContactRow icon={Building2} label="Project" value={project?.name} />
            <ContactRow icon={User} label="Agent" value={lead.assigned_agent_email?.split('@')[0] || 'Unassigned'} />
          </Section>

          {/* Budget & Requirements — RENT TRACK: money is ANNUAL RENT, move-in drives urgency */}
          {(lead.budget_min != null || lead.budget_max != null || lead.financing_method || lead.bedrooms_min != null || lead.preferred_locations?.length || lead.move_in_timeline || lead.cheques_count) ? (
            <Section title="Budget & Requirements">
              {(lead.budget_min != null || lead.budget_max != null) && (
                <div className="mb-2">
                  <span style={{ fontSize: 10, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lead.intent === 'tenant' ? 'Annual Rent Budget' : 'Budget'}</span>
                  <p style={{ fontSize: 14, fontWeight: 600, color: NAME, fontVariantNumeric: 'tabular-nums' }}>
                    {lead.budget_min != null && lead.budget_max != null ? `${formatAEDCompact(lead.budget_min)} – ${formatAEDCompact(lead.budget_max)}`
                      : lead.budget_max != null ? `Up to ${formatAEDCompact(lead.budget_max)}`
                      : formatAEDCompact(lead.budget_min || 0)}{lead.intent === 'tenant' ? '/yr' : ''}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {lead.financing_method && lead.intent !== 'tenant' && <Chip>{lead.financing_method}</Chip>}
                {(lead.bedrooms_min != null || lead.bedrooms_max != null) && <Chip>{lead.bedrooms_min != null && lead.bedrooms_max != null ? `${lead.bedrooms_min}–${lead.bedrooms_max} BR` : `${lead.bedrooms_min || lead.bedrooms_max} BR`}</Chip>}
                {lead.intent === 'tenant' && lead.cheques_count && <Chip title="Preferred number of rent cheques per year">{`${lead.cheques_count} cheques`}</Chip>}
                {lead.move_in_timeline && <Chip title="Move-in timeline" style={lead.intent === 'tenant' ? { color: GOLD, borderColor: 'rgba(198,161,91,0.35)' } : undefined}>{`Move-in: ${String(lead.move_in_timeline).replace(/_/g, ' ')}`}</Chip>}
              </div>
              {lead.preferred_locations?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{lead.preferred_locations.map((l) => <Chip key={l}>{l}</Chip>)}</div>}
            </Section>
          ) : null}

          {/* AI Intelligence */}
          <Section title="AI Intelligence">
            {/* Brain status + manual re-analyse (the on-open trigger already woke the brain) */}
            <div className="flex items-center gap-2 mb-2">
              {brainRunning ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 600, background: 'rgba(198,161,91,0.12)', border: '1px solid rgba(198,161,91,0.3)', color: GOLD }}>
                  <RefreshCw size={9} className="animate-spin" /> Analysing…
                </span>
              ) : (
                <span style={{ fontSize: 9, color: SLATE }}>
                  {lead.ai_processed_at ? `Analysed ${new Date(lead.ai_processed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${new Date(lead.ai_processed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Not analysed yet'}
                </span>
              )}
              <button
                onClick={handleAnalyseNow}
                disabled={brainRunning}
                title="Force a fresh brain run"
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.4)', background: 'rgba(198,161,91,0.1)', color: GOLD, fontSize: 9, fontWeight: 600, cursor: brainRunning ? 'not-allowed' : 'pointer', opacity: brainRunning ? 0.5 : 1 }}
              >
                <Sparkles size={9} /> Analyse
              </button>
            </div>

            {/* STRIKE NOW — hot signals + matched inventory + finance readiness aligned */}
            {lead.ai_strike_now && (
              <div className="mb-3 p-2.5 rounded-md" style={{ background: 'rgba(198,161,91,0.12)', border: '1px solid rgba(198,161,91,0.45)' }}>
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD }}>Strike Now</span>
                  {lead.ai_momentum && <Chip style={{ color: GOLD, borderColor: 'rgba(198,161,91,0.35)' }}>{lead.ai_momentum}</Chip>}
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 1.4 }}>The brain sees hot signals, matched inventory and finance readiness aligned — act today.</p>
              </div>
            )}
            {!lead.ai_strike_now && lead.ai_momentum && (
              <div className="mb-2"><Chip title="Momentum read from the last brain run">{`Momentum: ${lead.ai_momentum}`}</Chip></div>
            )}

            {/* Lead score */}
            <div className="flex items-center gap-3 mb-3">
              <ScoreRing score={score ?? 0} size={48}>
                {photoUrl ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }} /> : <span style={{ fontSize: 16, fontWeight: 600, color: GOLD }}>{lead.full_name?.[0]?.toUpperCase() || '?'}</span>}
              </ScoreRing>
              <div>
                <span style={{ fontSize: 10, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lead Score</span>
                <p style={{ fontSize: 18, fontWeight: 700, color: score != null ? (score >= 80 ? GOLD : score >= 50 ? NAME : CLARET_TEXT) : SLATE, fontVariantNumeric: 'tabular-nums' }}>
                  {score != null ? Math.round(score) : '—'}<span style={{ fontSize: 11, color: SLATE }}>/100</span>
                </p>
                {lead.ai_score_trend && <span style={{ fontSize: 10, color: lead.ai_score_trend === 'rising' ? '#34d399' : lead.ai_score_trend === 'falling' ? CLARET_TEXT : SLATE }}>{lead.ai_score_trend === 'rising' ? '↑' : lead.ai_score_trend === 'falling' ? '↓' : '→'} {lead.ai_score_trend}</span>}
              </div>
            </div>
            {lead.ai_lead_score_rationale && (
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: -6, marginBottom: 10, lineHeight: 1.4 }}>{lead.ai_lead_score_rationale}</p>
            )}

            {/* Conversion probability */}
            {lead.ai_conversion_probability != null && (
              <StatBar label="Conversion Probability" value={Math.round(lead.ai_conversion_probability * 100)} suffix="%" color={lead.ai_conversion_probability >= 0.7 ? GOLD : SLATE} />
            )}
            {lead.ai_conversion_rationale && (
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: -4, marginBottom: 10, lineHeight: 1.4 }}>{lead.ai_conversion_rationale}</p>
            )}

            {/* Churn prediction */}
            {lead.ai_churn_prediction?.probability != null && (
              <StatBar label="Churn Risk" value={Math.round(lead.ai_churn_prediction.probability * 100)} suffix="%" color={lead.ai_churn_prediction.probability >= 0.6 ? CLARET_TEXT : SLATE} />
            )}
            {lead.ai_churn_prediction?.risk_level && (
              <Chip style={{ marginBottom: 8, color: lead.ai_churn_prediction.risk_level === 'high' || lead.ai_churn_prediction.risk_level === 'critical' ? CLARET_TEXT : SLATE, borderColor: lead.ai_churn_prediction.risk_level === 'high' || lead.ai_churn_prediction.risk_level === 'critical' ? PB.CLARET_BORDER : HAIR2 }}>
                Risk: {lead.ai_churn_prediction.risk_level}
              </Chip>
            )}

            {/* Deal value */}
            {lead.deal_value_aed > 0 && (
              <div className="mb-2">
                <span style={{ fontSize: 10, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deal Value{lead.intent === 'tenant' ? ' · Annual Rent' : ''}</span>
                <p style={{ ...champagneInk, fontSize: 16, fontWeight: 700 }}>{formatAEDCompact(lead.deal_value_aed)}{lead.intent === 'tenant' ? '/yr' : ''}</p>
              </div>
            )}

            {/* Estimated commission — computed in CODE from a real basis (linked deals) only */}
            {lead.estimated_commission_aed > 0 && (
              <div className="mb-2">
                <span style={{ fontSize: 10, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est. Commission</span>
                <p style={{ ...champagneInk, fontSize: 14, fontWeight: 700 }}>{formatAEDCompact(lead.estimated_commission_aed)}</p>
              </div>
            )}

            {/* AI rolling summary */}
            {lead.ai_rolling_summary && (
              <div className="mt-2 p-2.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>AI Summary</span>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 1.5 }}>{lead.ai_rolling_summary}</p>
              </div>
            )}

            {/* Deal thesis — the brain's living strategy for this lead */}
            {lead.ai_deal_thesis && (
              <div className="mt-2 p-2.5 rounded-md" style={{ background: 'rgba(198,161,91,0.05)', border: '1px solid rgba(198,161,91,0.22)' }}>
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Deal Thesis</span>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 4, lineHeight: 1.5 }}>{lead.ai_deal_thesis}</p>
              </div>
            )}

            {/* AI coaching */}
            {lead.ai_coaching_for_agent && (
              <div className="mt-2 p-2.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Agent Coaching</span>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 1.5 }}>{lead.ai_coaching_for_agent}</p>
              </div>
            )}

            {/* Buying signals */}
            {signals.length > 0 && (
              <div className="mt-2">
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Buying Signals</span>
                <div className="mt-1.5 flex flex-wrap gap-1">{signals.map((s, i) => <Chip key={i} dot={<Zap className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: GOLD, flex: 'none' }} />}>{s}</Chip>)}</div>
              </div>
            )}

            {/* Red flags */}
            {lead.ai_red_flags?.length > 0 && (
              <div className="mt-2">
                <span style={{ fontSize: 10, color: CLARET_TEXT, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Red Flags</span>
                <div className="mt-1.5 flex flex-wrap gap-1">{lead.ai_red_flags.map((s, i) => <Chip key={i} dot={<AlertTriangle className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: CLARET_TEXT, flex: 'none' }} />} style={{ color: CLARET_TEXT, borderColor: PB.CLARET_BORDER }}>{s}</Chip>)}</div>
              </div>
            )}

            {/* Next best actions */}
            {lead.ai_next_best_actions?.length > 0 && (
              <div className="mt-2">
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Next Best Actions</span>
                {lead.ai_next_best_actions.slice(0, 3).map((a, i) => (
                  <div key={i} className="mt-1.5 p-2 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                    <div className="flex items-center gap-1.5">
                      <Chip style={{ fontSize: 8.5, padding: '1px 6px', color: a.priority === 'urgent' ? CLARET_TEXT : a.priority === 'high' ? GOLD : SLATE, borderColor: a.priority === 'urgent' ? PB.CLARET_BORDER : a.priority === 'high' ? 'rgba(198,161,91,0.35)' : HAIR2 }}>{a.priority}</Chip>
                      <span style={{ fontSize: 11, fontWeight: 600, color: NAME, textTransform: 'capitalize' }}>{a.action?.replace(/_/g, ' ')}</span>
                    </div>
                    {a.reasoning && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.4 }}>{a.reasoning}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* AI persona */}
            {lead.ai_persona?.archetype && (
              <div className="mt-2 p-2.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Persona</span>
                <p style={{ fontSize: 12, color: NAME, marginTop: 4, textTransform: 'capitalize' }}>{lead.ai_persona.archetype.replace(/_/g, ' ')}</p>
                {lead.ai_persona.persona_summary && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, lineHeight: 1.4 }}>{lead.ai_persona.persona_summary}</p>}
              </div>
            )}

            {/* Suggested tasks — one click adds a Reminder (the human click IS the approval) */}
            {Array.isArray(lead.ai_suggested_tasks) && lead.ai_suggested_tasks.length > 0 && (
              <div className="mt-2">
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Suggested Tasks</span>
                {lead.ai_suggested_tasks.slice(0, 4).map((t, i) => (
                  <div key={i} className="mt-1.5 p-2 rounded-md flex items-start gap-2" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: NAME, textTransform: 'capitalize' }}>{(t.template_key || 'task').replace(/_/g, ' ')}</span>
                      {t.reason && <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.4 }}>{t.reason}</p>}
                    </div>
                    <button
                      onClick={() => handleAddSuggestedTask(t, i)}
                      disabled={addingSuggestion === `task_${i}`}
                      title="Add as a task"
                      style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.4)', background: 'rgba(198,161,91,0.1)', color: GOLD, fontSize: 9.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {addingSuggestion === `task_${i}` ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />} Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested follow-ups — one click schedules a Reminder at the suggested slot */}
            {Array.isArray(lead.ai_suggested_followups) && lead.ai_suggested_followups.length > 0 && (
              <div className="mt-2">
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Suggested Follow-ups</span>
                {lead.ai_suggested_followups.slice(0, 4).map((f, i) => (
                  <div key={i} className="mt-1.5 p-2 rounded-md flex items-start gap-2" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span style={{ fontSize: 11, fontWeight: 600, color: NAME, textTransform: 'capitalize' }}>{(f.template_key || 'follow up').replace(/_/g, ' ')}</span>
                        <Chip style={{ fontSize: 8.5, padding: '1px 6px' }}>{`D+${f.when_offset_days ?? 1} · ${String(f.suggested_hour ?? 10).padStart(2, '0')}:00${f.channel ? ' · ' + f.channel : ''}`}</Chip>
                      </div>
                      {f.reason && <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.4 }}>{f.reason}</p>}
                    </div>
                    <button
                      onClick={() => handleAddSuggestedFollowup(f, i)}
                      disabled={addingSuggestion === `fu_${i}`}
                      title="Schedule this follow-up"
                      style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.4)', background: 'rgba(198,161,91,0.1)', color: GOLD, fontSize: 9.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {addingSuggestion === `fu_${i}` ? <Loader2 size={9} className="animate-spin" /> : <Calendar size={9} />} Schedule
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Brain Qualify + Post-call Debrief (B4a/B4c) — call intelligence to fields/proposals */}
          <Section title="Call Intelligence">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleBrainQualify}
                disabled={qualifyBusy}
                title="Extract proposed field updates from the last call transcript — you confirm each before it writes"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.4)', background: 'rgba(198,161,91,0.1)', color: GOLD, fontSize: 9.5, fontWeight: 600, cursor: qualifyBusy ? 'not-allowed' : 'pointer', opacity: qualifyBusy ? 0.5 : 1 }}
              >
                {qualifyBusy ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />} Brain Qualify
              </button>
              <button
                onClick={handleDebrief}
                disabled={debriefBusy}
                title="Debrief the last call: dated summary delta + follow-up proposals for your verdict"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, border: `1px solid ${HAIR2}`, background: 'transparent', color: SLATE, fontSize: 9.5, fontWeight: 600, cursor: debriefBusy ? 'not-allowed' : 'pointer', opacity: debriefBusy ? 0.5 : 1 }}
              >
                {debriefBusy ? <Loader2 size={10} className="animate-spin" /> : <Phone size={10} />} Debrief Last Call
              </button>
            </div>
            {qualifyResult?.call_summary && (
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 1.4 }}>{qualifyResult.call_summary}</p>
            )}
            {qualifyResult?.proposed_updates?.length > 0 && (
              <div className="mt-2">
                <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Proposed Updates — you confirm each</span>
                {qualifyResult.proposed_updates.map((p, i) => (
                  <div key={i} className="mt-1.5 p-2 rounded-md flex items-start gap-2" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span style={{ fontSize: 11, fontWeight: 600, color: NAME, textTransform: 'capitalize' }}>{p.field_key.replace(/_/g, ' ')}</span>
                        <Chip style={{ fontSize: 8.5, padding: '1px 6px', color: GOLD, borderColor: 'rgba(198,161,91,0.35)' }}>{Array.isArray(p.value) ? p.value.join(', ') : String(p.value)}</Chip>
                        {p.current != null && <span style={{ fontSize: 9, color: SLATE }}>was: {Array.isArray(p.current) ? p.current.join(', ') : String(p.current)}</span>}
                      </div>
                      {p.quote && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.4, fontStyle: 'italic' }}>“{p.quote}”</p>}
                    </div>
                    <button
                      onClick={() => handleApplyQualify(p)}
                      disabled={applyingField === p.field_key}
                      title="Apply this update to the lead"
                      style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.4)', background: 'rgba(198,161,91,0.1)', color: GOLD, fontSize: 9.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {applyingField === p.field_key ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />} Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* AI Call Script — forged from the brain's analysis (B1.5b) */}
          <BuyerCallScript
            leadId={id}
            aiCallScript={lead.ai_call_script}
            aiCallScriptAt={lead.ai_call_script_at}
            aiProcessedAt={lead.ai_processed_at}
            onGenerated={refetchLead}
          />

          {/* Mandate Dossier for this unit — shows the buyer why deal with Erudite (read-only) */}
          <BuyerMandateDossierCard
            unitReference={lead.unit_reference}
            projectName={lead.project_name || project?.name}
          />

          {/* Internal notes */}
          {lead.notes && (
            <Section title="Internal Notes">
              <div className="p-2.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{lead.notes}</p>
              </div>
            </Section>
          )}
        </div>

        {/* CENTER — stream + composer */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ background: PB.BASE }}>
          {/* Aurora proposals — materialized brain proposals awaiting a human verdict (B1) */}
          {auroraProposals.length > 0 && (
            <div className="shrink-0 px-3 pt-2">
              <AuroraProposalsStrip
                proposals={auroraProposals}
                onApprove={(p) => handleProposalAction(p, 'approved')}
                onDismiss={(p) => handleProposalAction(p, 'dismissed')}
                busyId={proposalBusyId}
              />
            </div>
          )}

          {/* Stream filter tabs */}
          <div className="shrink-0 flex items-center gap-1 px-3 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${HAIR}` }}>
            {STREAM_FILTERS.map((f) => {
              const isActive = streamFilter === f.key;
              const count = f.key === 'all' ? stream.length : stream.filter(f.match || (() => false)).length;
              return (
                <button key={f.key} onClick={() => setStreamFilter(isActive && f.key !== 'all' ? 'all' : f.key)} className="flex items-center gap-1 px-2.5 rounded-md text-xs font-semibold shrink-0 whitespace-nowrap" style={{ height: 28, background: isActive ? 'rgba(198,161,91,0.08)' : 'transparent', border: `1px solid ${isActive ? 'rgba(198,161,91,0.35)' : HAIR2}`, color: isActive ? GOLD : SLATE, transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease' }}>
                  {f.label}
                  <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isActive ? GOLD : SLATE }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Stream */}
          <div ref={streamRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin' }}>
            {filteredStream.length === 0 ? (
              <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
                <p style={{ color: SLATE, fontSize: 13 }}>No activity yet for this lead.</p>
              </div>
            ) : (
              filteredStream.map((item, i) => <StreamItem key={item._entityId || i} item={item} />)
            )}
          </div>

          {/* Composer bar */}
          <div className="shrink-0" style={{ background: PB.CARD, borderTop: `1px solid ${HAIR}`, padding: '8px 12px' }}>
            {/* Channel tabs */}
            <div className="flex items-center gap-1 mb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {COMPOSER_TABS.map((tab) => {
                const isActive = composerTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button key={tab.key} onClick={() => setComposerTab(tab.key)} className="flex items-center gap-1.5 px-2.5 rounded-md text-xs font-semibold shrink-0 whitespace-nowrap" style={{ height: 28, background: isActive ? 'rgba(198,161,91,0.08)' : 'transparent', border: `1px solid ${isActive ? 'rgba(198,161,91,0.35)' : HAIR2}`, color: isActive ? GOLD : SLATE, transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease' }}>
                    <Icon className="w-3 h-3" strokeWidth={1.5} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* AI drafts for the active channel (B1) — forged by the buyer approach forge;
                the agent reviews, edits, and presses Send. Never auto-sent. */}
            {isConversationTab && (() => {
              const drafts = lead.ai_approach_drafts;
              const draft = drafts && typeof drafts === 'object' ? drafts[composerTab] : null;
              const suggested = (Array.isArray(lead.ai_suggested_messages) ? lead.ai_suggested_messages : [])
                .filter((m) => m && m.text && (m.channel === composerTab || (composerTab === 'whatsapp' && !m.channel)))
                .slice(0, 2);
              if (!draft?.body_native && !suggested.length && !draftsForging) return null;
              const loadDraft = (text, subject) => {
                setComposerText(text || '');
                if (composerTab === 'email' && subject != null) setEmailSubject(subject);
              };
              return (
                <div className="mb-2 p-2 rounded-md" style={{ background: 'rgba(198,161,91,0.04)', border: '1px solid rgba(198,161,91,0.18)' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={10} style={{ color: GOLD }} />
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: GOLD }}>AI Drafts</span>
                    {drafts?.angle_used && <Chip style={{ fontSize: 8.5, padding: '1px 6px' }}>{String(drafts.angle_used).replace(/_/g, ' ')}</Chip>}
                    {drafts?.mode && <Chip style={{ fontSize: 8.5, padding: '1px 6px' }}>{drafts.mode}</Chip>}
                    {draftsForging && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: GOLD }}>
                        <RefreshCw size={9} className="animate-spin" /> Forging…
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        if (draftsForging) return;
                        setDraftsForging(true);
                        try {
                          await base44.functions.invoke('forgeBuyerApproachDrafts', { lead_id: id, force: true });
                          await refetchLead();
                          toast.success('Drafts re-forged');
                        } catch (e) { toast.error('Forge failed: ' + (e?.message || 'unknown')); }
                        finally { setDraftsForging(false); }
                      }}
                      title="Re-forge the drafts with a fresh angle"
                      style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.35)', background: 'transparent', color: GOLD, fontSize: 8.5, fontWeight: 600, cursor: draftsForging ? 'not-allowed' : 'pointer', opacity: draftsForging ? 0.5 : 1 }}
                    >
                      <RefreshCw size={8} className={draftsForging ? 'animate-spin' : undefined} /> Regenerate
                    </button>
                  </div>
                  {draft?.body_native && (
                    <div className="flex items-start gap-2 p-2 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {composerTab === 'email' && draft.subject && <div style={{ fontSize: 11, fontWeight: 600, color: NAME, marginBottom: 2 }}>{draft.subject}</div>}
                        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{draft.body_native}</p>
                        {draft.body_english_gloss && draft.body_english_gloss !== draft.body_native && (
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.4, fontStyle: 'italic' }}>{draft.body_english_gloss}</p>
                        )}
                      </div>
                      <button
                        onClick={() => loadDraft(draft.body_native, draft.subject)}
                        title="Load this draft into the composer"
                        style={{ flex: 'none', padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.45)', background: 'rgba(198,161,91,0.12)', color: GOLD, fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Use
                      </button>
                    </div>
                  )}
                  {suggested.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md mt-1.5" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          {m.mode && <Chip style={{ fontSize: 8, padding: '1px 5px' }}>{m.mode.replace(/_/g, ' ')}</Chip>}
                          {m.tone && <Chip style={{ fontSize: 8, padding: '1px 5px' }}>{m.tone}</Chip>}
                        </div>
                        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.text}</p>
                      </div>
                      <button
                        onClick={() => loadDraft(m.text)}
                        title="Load this suggestion into the composer"
                        style={{ flex: 'none', padding: '4px 10px', borderRadius: 99, border: `1px solid ${HAIR2}`, background: 'transparent', color: SLATE, fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Email subject (email tab only) */}
            {composerTab === 'email' && (
              <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject" className="w-full mb-2 px-3 py-1.5 text-xs rounded-md" style={{ background: WELL, border: `1px solid ${HAIR2}`, color: NAME, outline: 'none' }} />
            )}

            {/* Composer — conversation tabs use ModernComposerField (full writing toolkit);
                note/task/call keep WritingField + the champagne Send button. */}
            {isConversationTab ? (
              <ModernComposerField
                value={composerText}
                onChange={setComposerText}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                onSend={handleSend}
                sending={sending}
                sendDisabled={!composerText.trim()}
                sendLabel="Send"
                accent={PB.CHAMPAGNE}
                targetLanguage={lead.preferred_language}
                leadId={id}
                channel={tplChannel}
                landlordContext={{ name: lead.full_name || '', unit: lead.unit_reference || '', project: lead.project_name || '', asking: lead.budget_max || '', agentName: currentUser?.email || '' }}
                minHeight={44}
              >
                {/* Template picker */}
                <EmailTemplatePicker
                  channel={tplChannel}
                  landlordId={id}
                  compact
                  preferredLanguage={lead.preferred_language}
                  onSelect={({ body }) => setComposerText(body || '')}
                />
                {/* Save as template */}
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!composerText.trim()}
                  title="Save as template"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8, cursor: composerText.trim() ? 'pointer' : 'not-allowed',
                    background: 'transparent', color: composerText.trim() ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
                    border: '1px solid transparent', transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <Save size={14} />
                </button>
              </ModernComposerField>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <WritingField
                    value={composerText}
                    onChange={setComposerText}
                    placeholder={`Compose ${composerTab === 'note' ? 'a note' : composerTab === 'task' ? 'a task' : 'call notes'}…`}
                    minHeight={38}
                    channel={composerTab}
                    leadId={id}
                    targetLanguage={lead.preferred_language}
                  />
                </div>
                <button onClick={handleSend} disabled={sending || !composerText.trim()} className="flex items-center gap-1.5 px-4 rounded-md text-xs font-semibold shrink-0" style={{ height: 38, background: sending || !composerText.trim() ? 'rgba(198,161,91,0.15)' : PB.CHAMPAGNE, color: sending || !composerText.trim() ? 'rgba(255,255,255,0.4)' : PB.BASE, border: `1px solid ${GOLD}80`, cursor: sending || !composerText.trim() ? 'not-allowed' : 'pointer', transition: 'background 150ms ease' }}>
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  {composerTab === 'note' || composerTab === 'task' ? 'Save' : 'Send'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save-as-template dialog */}
      <EmailTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        template={composerText.trim() ? { title: composerText.trim().slice(0, 40), body: composerText.trim(), category: 'general', visibility: 'private', channel: tplChannel } : null}
        onSaved={() => { toast.success('Template saved'); setSaveTemplateOpen(false); }}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="mb-4">
      <h3 style={{ fontSize: 10, fontWeight: 600, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{title}</h3>
      {children}
    </div>
  );
}

function ContactRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} style={{ color: SLATE }} />
      <span style={{ fontSize: 11, color: SLATE, minWidth: 60 }}>{label}</span>
      <span style={{ fontSize: 12, color: NAME, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function StatBar({ label, value, suffix, color }) {
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 10, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}{suffix}</span>
      </div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 1, transition: 'width 200ms ease' }} />
      </div>
    </div>
  );
}