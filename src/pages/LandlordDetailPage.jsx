// LandlordDetailPage.jsx — Erudite CRM  (SELF-CONTAINED · single file)
// Design + live data in ONE file. Paste this as the ENTIRE contents of
// src/pages/LandlordDetailPage.jsx  (replace everything that's there).
// No other files needed. The /landlord/:id route already points here.

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';
import FormAUploadDialog from '@/components/landlord/FormAUploadDialog';
import DocumentUploader from '@/components/landlord/DocumentUploader';
import ListingManagerAssignDialog from '@/components/landlord/ListingManagerAssignDialog';
import MediaPanel from '@/components/landlord/MediaPanel';
import { Clapperboard, Rotate3d, Plane, Ruler, ChevronDown, Users } from 'lucide-react';
import DocumentsTab from '@/components/landlord/DocumentsTab';
import CallsTabList from '@/components/landlord/CallsTabList';
import MandateDrawer from '@/components/landlord/MandateDrawer';
import ContactEvaluation from '@/components/landlord/ContactEvaluation';
import ListingManagerStrip from '@/components/landlord/ListingManagerStrip';
import CallQualificationTab from '@/components/landlord/CallQualificationTab';
import AIIntelligenceCard from '@/components/landlord/AIIntelligenceCard';
import LandlordIdentityHeader from '@/components/landlord/LandlordIdentityHeader';
import EmailComposer from '@/components/landlord/EmailComposer';
import IMessageComposer from '@/components/landlord/IMessageComposer';
import AppointmentComposer from '@/components/landlord/AppointmentComposer';
import FollowupComposerFields from '@/components/landlord/FollowupComposerFields';
import ComposerConfirmChip from '@/components/landlord/ComposerConfirmChip';
import { playSentSound, SendFlash } from '@/components/landlord/sendFeedback';
import { tickOutreachStep, buildOutreachVM } from '@/components/landlord/outreachTick';
import { deriveOpenQuestions, deriveScoreTrend } from '@/components/landlord/landlordAiFields';
import EmailTemplateDialog from '@/components/landlord/EmailTemplateDialog';
import NoteAiDraftBar from '@/components/landlord/NoteAiDraftBar';
import UnifiedChatComposer from '@/components/landlord/UnifiedChatComposer';
import AppointmentFeed from '@/components/landlord/AppointmentFeed';
import HubSpotActivityList from '@/components/landlord/HubSpotActivityList';
import EmailList from '@/components/landlord/EmailList';
import AllActivityTab from '@/components/landlord/AllActivityTab';
import { LANDLORD_STAGE_LABELS as _STAGE_LABELS, LANDLORD_STAGE_KEYS as _STAGE_KEYS } from '@/lib/landlordStages';
import LandlordTabBar from '@/components/landlord/LandlordTabBar';
import LandlordMockTabs from '@/components/landlord/LandlordMockTabs';
import AppointmentBookingDialog from '@/components/appointments/AppointmentBookingDialog';
import GoogleWorkspaceConnectBanner from '@/components/settings/GoogleWorkspaceConnectBanner';

function useQ(key, fn, extra = {}) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false, staleTime: 30000, ...extra });
}

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

/* Convert a CSS declaration string into a React style object (preserves the design 1:1). */
function css(str) {
  const o = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  });
  return o;
}

import { GLOBAL_CSS } from '@/components/landlord/landlordDetailStyles';
import { fmtMsgTime, mapCallStatus, fmtDuration } from '@/lib/landlordStreamHelpers';
import { useLandlordEmails } from '@/lib/useLandlordEmails';

class LandlordDetail extends React.Component {
  constructor(props) {
    super(props);
    this.streamRef = React.createRef(); this.composerRef = React.createRef();
    this.STAGES = _STAGE_LABELS;
    this.STAGE_KEYS = _STAGE_KEYS;
    const landlords = (props.landlords && props.landlords.length) ? props.landlords : [];
    this.state = {
      landlords,
      currentId: props.initialId || (landlords[0] && landlords[0].id) || null,
      activeTab: this.props.defaultTab || 'calls',
      composerType: 'Activity',
      composerText: '',
      appointmentBookingOpen: false,
      composerTime: '',
      composerAttachment: null, // { file_url, file_name, media_type, mime } | null — pending WhatsApp/Telegram attachment
      // AI-draft note state — which AI field seeded the note (snake_case key) and the
      // exact drafted string that was loaded, so we can detect edits before save.
      noteAiSource: null,
      noteAiDraft: null,
      noteSaving: false,
      noteGenerating: null, // 'call' | 'conversation' | null — on-demand note draft in progress
      // AI-draft task state — mirrors the note state. The drafted TITLE lives in composerText
      // (shared with the textarea); taskTitleDraft is its snapshot for edit-detection. due_date
      // and assignee are Task-only editable fields seeded from the AI draft.
      taskAiSource: null,
      taskTitleDraft: null,
      taskDueDate: '',
      taskAssignee: '',
      taskSaving: false,
      // AI-draft follow-up state — mirrors the task state. composerText holds the notes/reason;
      // followupDraft is its snapshot for edit-detection. channel/date/hour are editable fields.
      followupAiSource: null,
      followupDraft: null,
      followupChannel: 'whatsapp',
      followupDate: '',
      followupHour: 10,
      followupMinute: '00',
      followupAmPm: 'AM',
      followupAssignee: '',
      followupSaving: false,
      // AI-draft MESSAGE state (V3 Phase 0: RECORD) — mirrors the note/task pattern. composerText holds
      // the message text; messageAiDraft is the snapshot for edit-detection; messageAiSource is which AI
      // feature drafted it. Used only to STAMP provenance on the sent Message — no behavior change.
      messageAiSource: null,
      messageAiDraft: null,
      analyzing: false,
      chatSending: false,
      streamFilter: 'all',
      aiTasksCollapsed: true,
      aiFollowupsCollapsed: true,
      aiIntelligenceCollapsed: true,
      imessageChecking: false,
      telegramJustSent: false,
      // Shared composerBrain parse→confirm→commit flow (Note/Task/Follow-up). composerParsing
      // shows the "parsing…" send state; composerDraft holds the confirmable { type, draft,
      // confirm_label, rawText } until Confirm/Cancel. composerCommitting guards the create.
      composerParsing: false,
      composerDraft: null,
      composerCommitting: false,
      // Pending pipeline stage selection — the stage isn't saved until the agent presses Save.
      pendingStage: null,
      stageSaving: false,
      stageSaved: false,
      // Unified template system — save/load reusable message templates with access control.
      saveTemplateOpen: false,
      saveTemplatePrefill: null,
      saveTemplateChannel: 'email',
    };
    this.onNavigate = this.props.onNavigate || (() => {});
    this.formAContracts = this.props.formAContracts || [];
  }

  componentDidMount(){ this.scrollBottom(); this.maybeAutoCheckIMessage(); this.maybeAutoAnalyse(); }
  componentDidUpdate(prevProps){ if(prevProps.landlords!==this.props.landlords && this.props.landlords?.length) this.setState({landlords:this.props.landlords}); }

  // Auto-run AI analysis once when a V-card opens, only if never analysed (no ai_processed_at).
  // Already-analysed landlords are left to the manual "Analyse Now" — no reload, refetch in place.
  maybeAutoAnalyse = async ()=>{
    const L = this.cur();
    if(!L || this._autoAnalysed || L.aiProcessedAt || !this.state.currentId) return;
    this._autoAnalysed = true;
    this.setState({ analyzing:true, analyseError:'' });
    try {
      await base44.functions.invoke('landlordOrchestrator', { landlord_id: this.state.currentId, force: true });
      if(this.props.onAnalysed) this.props.onAnalysed();
    } catch(e){ this.setState({ analyseError: e?.message || 'Analysis failed', analyzing:false }); }
  };

  // Auto-check iMessage availability once when a landlord is opened and the status is
  // unknown OR the last check is older than 7 days. Fire-and-forget, background only.
  maybeAutoCheckIMessage = ()=>{
    const L = this.cur();
    if(!L || this._imessageChecking) return;
    // Re-resolve when never resolved OR the last resolution is older than 7 days.
    const resolvedAt = L.imessageResolvedAt ? new Date(L.imessageResolvedAt).getTime() : 0;
    const stale = !resolvedAt || (Date.now() - resolvedAt) > 7 * 24 * 60 * 60 * 1000;
    if(stale){ this.checkIMessage(); }
  };

  // Resolves ALL of the landlord's iMessage handles (phones + emails) and the primary one,
  // via resolveLandlordIMessage — not just the single primary phone.
  checkIMessage = async ()=>{
    const L = this.cur();
    if(!L || this._imessageChecking) return;
    this._imessageChecking = true;
    this.setState({ imessageChecking:true });
    try {
      const res = await base44.functions.invoke('resolveLandlordIMessage', { landlord_id: L.id });
      const data = res?.data ?? res;
      const status = data?.imessage_status || 'error';
      const resolvedAt = data?.imessage_resolved_at || new Date().toISOString();
      const handles = Array.isArray(data?.handles) ? data.handles : [];
      const handle = data?.imessage_handle || '';
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===L.id ? {...l, imessageStatus:status, imessageCheckedAt:resolvedAt, imessageResolvedAt:resolvedAt, imessageHandles:handles, imessageHandle:handle} : l),
        imessageChecking:false,
      }));
    } catch(e){
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===L.id ? {...l, imessageStatus:'error', imessageCheckedAt:new Date().toISOString()} : l),
        imessageChecking:false,
      }));
    } finally {
      this._imessageChecking = false;
    }
  };
  componentDidUpdate(prevProps, prevState){
    // Sync landlords when prop array changes OR when current landlord data changes
    const prevLandlords = prevProps.landlords || [];
    const nextLandlords = this.props.landlords || [];
    const prevCur = prevLandlords.find(l=>l.id===this.state.currentId);
    const nextCur = nextLandlords.find(l=>l.id===this.state.currentId);
    
    // Force sync if array ref changed OR if current landlord's contact/AI/valuation/docs/scores/signals/mandate fields changed
    const needSync = prevProps.landlords !== this.props.landlords || 
      (prevCur && nextCur && (prevCur.phone !== nextCur.phone || prevCur.email !== nextCur.email || prevCur.aiRollingSummary !== nextCur.aiRollingSummary || prevCur.aiNextBestAction !== nextCur.aiNextBestAction || prevCur.aiCoaching !== nextCur.aiCoaching || prevCur.media !== nextCur.media || prevCur.valuation !== nextCur.valuation || prevCur.docs !== nextCur.docs || prevCur.scores !== nextCur.scores || prevCur.redFlags !== nextCur.redFlags || prevCur.buyingSignals !== nextCur.buyingSignals || prevCur.hasStrikeNow !== nextCur.hasStrikeNow || prevCur.mandate !== nextCur.mandate || prevCur.qualification !== nextCur.qualification || prevCur.passport !== nextCur.passport || prevCur.nationality !== nextCur.nationality || prevCur.residence !== nextCur.residence || prevCur.language !== nextCur.language || prevCur.residentUAE !== nextCur.residentUAE));
    
    if (needSync && nextCur) {
      this.setState({ landlords: nextLandlords, analyzeError:'' });
    }
    // Auto-scroll when new messages arrive (count increased) or filter switched.
    // No setState here — just scroll — so no render loop.
    const cnt = (l) => l ? (l.stream||[]).filter(s=>s.t==='msg').length : 0;
    if (cnt(nextCur) > cnt(prevCur) || prevState.streamFilter !== this.state.streamFilter || prevState.composerType !== this.state.composerType) {
      this.scrollBottom();
    }
    // Auto-grow/shrink the composer textarea when text changes (incl. clear-after-send,
    // AI-draft load, landlord switch) — onComposerInput handles in-flight typing, this
    // catches programmatic composerText changes.
    if (prevState.composerText !== this.state.composerText || prevState.composerType !== this.state.composerType) {
      this.autoGrowComposer();
    }
  }
  scrollBottom(){
    const el=this.streamRef.current; if(!el) return;
    // Chat-style tabs (WhatsApp / iMessage / Telegram / SMS) render oldest→newest, so the
    // latest message sits at the bottom — scroll to the bottom to mimic a chat. Activity
    // tabs (Notes/Tasks/Follow-ups) stay newest-first, so scroll to the top.
    const ct=this.state.composerType;
    const isChat = ct==='Chat'||ct==='iMessage'||ct==='Telegram'||ct==='SMS'||ct==='Activity';
    requestAnimationFrame(()=>{ el.scrollTop = isChat ? el.scrollHeight : 0; });
  }
  cur(){ return this.state.landlords.find(l=>l.id===this.state.currentId); }

  // handlers
  onBack = ()=>{ if(this.props.onBack) this.props.onBack(); };
  onSwitch = (e)=>{ this.setState({ currentId:e.target.value, activeTab:this.props.defaultTab||'calls', composerText:'', composerTime:'', composerDraft:null, composerParsing:false, noteAiSource:null, noteAiDraft:null, taskAiSource:null, taskTitleDraft:null, taskDueDate:'', taskAssignee:'', followupAiSource:null, followupDraft:null, messageAiSource:null, messageAiDraft:null, followupChannel:'whatsapp', followupDate:'', followupHour:10, followupMinute:'00', followupAmPm:'AM' }, ()=>this.scrollBottom()); };
  setTab = (id)=> this.setState({ activeTab:id });
  // Manual toggle of an outreach step from the V-card Outreach tab. Optimistically flips the
  // step locally, persists via tickOutreachStep(toggleTo), then refetches the real row.
  onToggleOutreachStep = async (stepKey)=>{
    const L = this.cur();
    if(!L || this._outreachToggling) return;
    const current = !!(L.outreach && L.outreach.steps.find(s=>s.key===stepKey)?.done);
    const next = !current;
    this._outreachToggling = stepKey;
    // Optimistic local flip so the checkbox responds instantly.
    this.setState(s=>({ landlords: s.landlords.map(l=>{
      if(l.id!==s.currentId || !l.outreach) return l;
      const steps = l.outreach.steps.map(st=> st.key===stepKey ? {...st, done:next, at: next ? 'now' : '—'} : st);
      const stepsCompleted = steps.filter(st=>st.done).length;
      return {...l, outreach:{...l.outreach, steps, stepsCompleted}};
    }) }));
    try {
      await tickOutreachStep(stepKey, L, {}, next);
    } finally {
      this._outreachToggling = null;
      if(this.props.onOutreachChanged) this.props.onOutreachChanged();
    }
  };
  // Collapse every open panel/composer on the page without navigating away — one tap to
  // tidy up when too many things are expanded at once.
  collapseAll = ()=> this.setState({
    aiTasksCollapsed: true,
    aiFollowupsCollapsed: true,
    aiIntelligenceCollapsed: true,
    composerType: 'Note',
  });
  setStreamFilter = (mode)=> this.setState(s=>({ streamFilter: s.streamFilter===mode ? 'all' : mode }));
  // Provenance (noteAiSource/noteAiDraft) follows the composer BODY, not the active type —
  // so an AI draft retained across a Note→other→Note round-trip is still recorded as
  // AI-originated rather than silently downgraded to from-scratch.
  setComposerType = (t)=> this.setState({ composerType:t });
  // Emptying the box after an AI draft was loaded means the agent is starting over — drop the
  // AI provenance (note OR task) so a freshly typed entry is correctly recorded as from-scratch.
  onComposerInput = (e)=>{
    const v=e.target.value;
    const ta=e.target;
    ta.style.height='auto';
    ta.style.height=Math.min(200, Math.max(96, ta.scrollHeight))+'px';
    this.setState(s=> (v==='' && (s.noteAiSource || s.taskAiSource || s.followupAiSource || s.messageAiSource)) ? { composerText:v, noteAiSource:null, noteAiDraft:null, taskAiSource:null, taskTitleDraft:null, followupAiSource:null, followupDraft:null, messageAiSource:null, messageAiDraft:null } : { composerText:v });
  };
  autoGrowComposer = ()=>{
    const ta=this.composerRef.current;
    if(!ta) return;
    ta.style.height='auto';
    ta.style.height=Math.min(200, Math.max(96, ta.scrollHeight))+'px';
  };
  onClearTime = ()=> this.setState({ composerTime:'' });
  onNotesInput = (e)=>{ const v=e.target.value; this.setState(s=>({ landlords:s.landlords.map(l=> l.id===s.currentId ? {...l, agentNotes:v} : l) })); };

  fillDraft = (action)=>{
    const typeMap={ followup:'Follow-up', meeting:'Appointment', viewing:'Appointment', call:'Task' };
    // A suggested-action chip is NOT the Task "Next Action" AI-draft source, so clear task
    // provenance — a task sent from here is recorded as from-scratch.
    this.setState({ composerType: typeMap[action.type]||'Follow-up', composerText:action.message, composerTime:action.time, noteAiSource:null, noteAiDraft:null, taskAiSource:null, taskTitleDraft:null, taskDueDate:'', taskAssignee:'', followupAiSource:null, followupDraft:null, messageAiSource:null, messageAiDraft:null, followupChannel:'whatsapp', followupDate:'', followupHour:10, followupMinute:'00', followupAmPm:'AM' });
  };

  // The three AI-draft sources for a Note. `text` is the draftable body ('' when the
  // landlord has no content for that field yet). `key` is the exact Landlord field name
  // persisted to LandlordNote.ai_source. ai_next_best_action is an OBJECT — type-guarded
  // here and read as reasoning, falling back to action; never rendered directly.
  // On-demand note draft grounded in the latest call qualification or conversation.
  generateNoteDraft = async (source)=>{
    const L = this.cur();
    if(!L || this.state.noteGenerating) return;
    this.setState({ noteGenerating: source });
    try {
      const res = await base44.functions.invoke('draftLandlordNote', { landlord_id: L.id, source });
      const data = res?.data ?? res;
      if(!data?.ok || !data.text) throw new Error(data?.error || 'Draft failed');
      this.setState({ composerText: data.text, noteAiSource: source + '_summary', noteAiDraft: data.text });
      toast.success('Draft loaded — edit as needed');
    } catch(e){ toast.error(e?.message || 'Failed to generate draft'); }
    finally { this.setState({ noteGenerating: null }); }
  };

  // Load a static AI draft (Summary/Coaching/Next Action) into the composer.
  pickNoteDraft = (text, key)=>{
    if(!text) return;
    this.setState({ composerText: text, noteAiSource: key, noteAiDraft: text });
  };

  // Reset to a from-scratch note (clears the AI draft + selection).
  clearNoteDraft = ()=> this.setState({ composerText:'', noteAiSource:null, noteAiDraft:null });

  // Local YYYY-MM-DD, N days from today (N may be 0). Shared by the priority-based draft and
  // the TaskTemplate offset-based suggestions, so all due dates use one date-math impl.
  dueDateInDays(days){
    const n = (typeof days === 'number' && isFinite(days)) ? days : 0;
    const d = new Date(); d.setDate(d.getDate() + n);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  // Map ai_next_best_action.priority to a due_date N days out (YYYY-MM-DD).
  // urgent -> +1, high -> +3, medium/low/absent -> +7.
  dueDateFromPriority(priority){
    return this.dueDateInDays(priority === 'urgent' ? 1 : priority === 'high' ? 3 : 7);
  }

  // Resolve a TaskTemplate.routes_to to an email from the current landlord.
  // photographer -> the landlord's assigned photographer if set, else the team photographer
  // (Dari). assigned_agent / listing_manager come from the landlord record and stay blank
  // (editable) when unset — never invent an agent/manager email.
  resolveAssignee(routesTo){
    const L = this.cur();
    if(!L) return '';
    if(routesTo === 'photographer') return L.photographerEmail || 'dari@erudite-estate.com';
    if(routesTo === 'listing_manager') return L.listingManagerEmail || '';
    return L.agentEmail || ''; // assigned_agent (default)
  }

  // Resolve landlord.ai_suggested_tasks against the loaded TaskTemplate library. Each chip
  // carries the matched template + the suggestion's reason. Items whose template_key has no
  // active template are dropped silently (never render an unresolvable button).
  suggestedTaskChips(){
    const L = this.cur();
    if(!L) return [];
    const templates = Array.isArray(this.props.taskTemplates) ? this.props.taskTemplates : [];
    if(!templates.length) return [];
    const byKey = {};
    templates.forEach(t => { if(t && typeof t.template_key === 'string') byKey[t.template_key] = t; });
    const items = Array.isArray(L.aiSuggestedTasks) ? L.aiSuggestedTasks : [];
    return items
      .filter(it => it && typeof it === 'object' && typeof it.template_key === 'string')
      .map(it => {
        const tpl = byKey[it.template_key];
        if(!tpl) return null;
        return { template_key: it.template_key, reason: typeof it.reason === 'string' ? it.reason : '', template: tpl };
      })
      .filter(Boolean);
  }

  // Pre-fill the composer from a suggested-task chip (no auto-save — agent reviews then sends).
  // ai_source records the specific template_key (more precise than 'ai_next_best_action'); the
  // title_template snapshot drives title-only edit-detection at save.
  pickSuggestedTask = (chip)=>{
    if(!chip || !chip.template) return;
    const tpl = chip.template;
    const title = (typeof tpl.title_template === 'string' && tpl.title_template.trim())
      ? tpl.title_template.trim()
      : (typeof tpl.label === 'string' ? tpl.label.trim() : '');
    if(!title) return; // never draft an empty task
    this.setState({
      composerType: 'Task',
      composerText: title,
      taskTitleDraft: title,
      taskAiSource: chip.template_key,
      taskDueDate: this.dueDateInDays(tpl.due_offset_days),
      taskAssignee: this.resolveAssignee(tpl.routes_to),
    });
  };

  // The single AI-draft source for a Task: ai_next_best_action (an OBJECT — type-guarded).
  // title from .action (snake_case label -> spaced, first letter capitalized; existing caps
  // preserved so proper nouns in natural-language actions aren't mangled), falling back to
  // .reasoning. due_date derived from .priority; assignee from the landlord's agent. Trimmed
  // at source so an unedited draft compares equal at save time.
  taskDraftSource(){
    const L = this.cur();
    if(!L) return { available:false, title:'', dueDate:'', assignee:'', emptyMsg:'No next action yet — run Analyse' };
    const str = (v)=> (typeof v === 'string' && v.trim()) ? v.trim() : '';
    const nba = (L.aiNextBestAction && typeof L.aiNextBestAction === 'object') ? L.aiNextBestAction : null;
    const raw = nba ? (str(nba.action) || str(nba.reasoning)) : '';
    const spaced = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const title = spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
    const priority = nba ? str(nba.priority).toLowerCase() : '';
    return {
      available: !!title,
      title,
      dueDate: this.dueDateFromPriority(priority),
      assignee: L.agentEmail || '',
      emptyMsg: 'No next action yet — run Analyse',
    };
  }

  // Load the AI task draft: title into the shared composer box, due_date + assignee into their
  // own fields, and record provenance + the exact title snapshot for edit-detection.
  pickTaskDraft = ()=>{
    const src = this.taskDraftSource();
    if(!src.available) return; // never draft an empty task
    this.setState({ composerText: src.title, taskTitleDraft: src.title, taskAiSource: 'ai_next_best_action', taskDueDate: src.dueDate, taskAssignee: src.assignee });
  };

  // Reset to a from-scratch task (clears the drafted title, provenance, due_date, assignee).
  clearTaskDraft = ()=> this.setState({ composerText:'', taskAiSource:null, taskTitleDraft:null, taskDueDate:'', taskAssignee:'' });

  // Resolve landlord.ai_suggested_followups against the loaded FollowupTemplate library. Each chip
  // carries the matched template + the suggestion's reason/timing/channel (falling back to the
  // template's defaults). Items whose template_key has no active template are dropped silently.
  suggestedFollowupChips(){
    const L = this.cur();
    if(!L) return [];
    const templates = Array.isArray(this.props.followupTemplates) ? this.props.followupTemplates : [];
    if(!templates.length) return [];
    const byKey = {};
    templates.forEach(t => { if(t && typeof t.template_key === 'string') byKey[t.template_key] = t; });
    const items = Array.isArray(L.aiSuggestedFollowups) ? L.aiSuggestedFollowups : [];
    return items
      .filter(it => it && typeof it === 'object' && typeof it.template_key === 'string')
      .map(it => {
        const tpl = byKey[it.template_key];
        if(!tpl) return null;
        const offset = typeof it.when_offset_days === 'number' ? it.when_offset_days
          : (typeof tpl.default_offset_days === 'number' ? tpl.default_offset_days : 1);
        const hour = typeof it.suggested_hour === 'number' ? it.suggested_hour
          : (typeof tpl.default_hour === 'number' ? tpl.default_hour : 10);
        const channel = ['whatsapp','call','email'].includes(it.channel) ? it.channel
          : (['whatsapp','call','email'].includes(tpl.default_channel) ? tpl.default_channel : 'whatsapp');
        return {
          template_key: it.template_key,
          reason: typeof it.reason === 'string' ? it.reason : '',
          when_offset_days: Math.max(0, Math.round(offset)),
          suggested_hour: Math.min(23, Math.max(0, Math.round(hour))),
          channel,
          template: tpl,
        };
      })
      .filter(Boolean);
  }

  // Pre-fill the follow-up composer from a suggestion chip (no auto-save — agent reviews then
  // sends). ai_source records the template_key; the reason snapshot drives edit-detection.
  pickSuggestedFollowup = (chip)=>{
    if(!chip || !chip.template) return;
    const reason = (typeof chip.reason === 'string' && chip.reason.trim())
      ? chip.reason.trim()
      : (typeof chip.template.label === 'string' ? chip.template.label.trim() : '');
    this.setState({
      composerType: 'Follow-up',
      composerText: reason,
      followupDraft: reason,
      followupAiSource: chip.template_key,
      followupChannel: chip.channel || 'whatsapp',
      followupDate: this.dueDateInDays(chip.when_offset_days),
      followupHour: ((chip.suggested_hour + 11) % 12) + 1,
      followupAmPm: chip.suggested_hour >= 12 ? 'PM' : 'AM',
    });
  };

  // Reset to a from-scratch follow-up.
  clearFollowupDraft = ()=> this.setState({ composerText:'', followupAiSource:null, followupDraft:null, messageAiSource:null, messageAiDraft:null, followupChannel:'whatsapp', followupDate:'', followupHour:10, followupMinute:'00', followupAmPm:'AM' });

  onSend = ()=>{
    // Email and iMessage are composed and sent from their dedicated panels (their own buttons),
    // so the shared textarea/send-arrow does nothing for them.
    if(this.state.composerType === 'Email'){ return; }
    if(this.state.composerType === 'iMessage'){ return; }
    // Appointments are parsed & booked from the dedicated AppointmentComposer panel.
    if(this.state.composerType === 'Appointment'){ return; }
    const txt=(this.state.composerText||'').trim(); if(!txt) return;
    // Note/Task/Follow-up persist directly through their dedicated save methods,
    // which already handle provenance, optimistic stream updates and error recovery.
    if(this.state.composerType === 'Note'){ this.saveNote(txt); return; }
    if(this.state.composerType === 'Task'){ this.saveTask(txt); return; }
    if(this.state.composerType === 'Follow-up'){ this.saveFollowup(txt); return; }
    if(this.state.composerType === 'Chat' || this.state.composerType === 'Activity'){ this.sendChat(txt); return; }
    if(this.state.composerType === 'Telegram'){ this.sendTelegram(txt); return; }
    const typeMap={ 'Note':'note', 'Task':'task', 'Follow-up':'followup', 'Appointment':'appointment' };
    const kind=typeMap[this.state.composerType]||'note';
    const order=Date.now();
    const item={ t:'act', kind, title:this.state.composerType + (this.state.composerTime? ' · '+this.state.composerTime : ''), body:txt, time:'Just now', order };
    this.setState(s=>({
      landlords:s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
      composerText:'', composerTime:''
    }), ()=>this.scrollBottom());
  };

  // Persist a Note to the LandlordNote entity (from-scratch baseline / brain fallback).
  saveNote = async (body)=>{
    const L = this.cur();
    if(!L || this._noteSaving) return; // sync re-entry guard (noteSaving state lags a same-tick double-click)
    this._noteSaving = true;
    const { noteAiSource, noteAiDraft } = this.state;
    const createdFromAi = !!noteAiSource;
    const wasEdited = createdFromAi ? (body !== (noteAiDraft || '')) : false;

    this.setState({ noteSaving:true });
    let user = this.props.currentUser;
    if(!user){ try { user = await base44.auth.me(); } catch(_) { user = null; } }

    try {
      await base44.entities.LandlordNote.create({
        landlord_id: L.id,
        author_email: user?.email || null,
        author_name: user?.full_name || user?.email?.split('@')[0] || null,
        body,
        created_from_ai: createdFromAi,
        ai_source: noteAiSource || null,
        was_edited_after_draft: wasEdited,
        pinned: false,
      });
      toast.success(createdFromAi ? 'AI-drafted note saved' : 'Note saved');
      const order = Date.now();
      const item = { t:'act', kind:'note', title:'Note' + (createdFromAi ? ' · AI' : ''), body, time:'Just now', order };
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
        composerText:'', composerTime:'', noteAiSource:null, noteAiDraft:null, noteSaving:false,
      }), ()=>this.scrollBottom());
    } catch(e){
      toast.error('Failed to save note: ' + (e?.message || 'unknown error'));
      this.setState({ noteSaving:false });
    } finally {
      this._noteSaving = false;
    }
  };

  // Persist a Task to the LandlordTask entity. From-scratch is the baseline path and never
  // depends on AI content. Edit-detection tracks the AI-authored TITLE only — changing
  // due_date or assignee does NOT count as editing the draft.
  saveTask = async (title)=>{
    const L = this.cur();
    // Synchronous re-entry guard (this.state.taskSaving lags a same-tick double-click).
    if(!L || this._taskSaving) return;
    this._taskSaving = true;
    const { taskAiSource, taskTitleDraft } = this.state;
    const createdFromAi = !!taskAiSource;
    const wasEdited = createdFromAi ? (title !== (taskTitleDraft || '')) : false;
    // Sensible defaults so one-tap save works: assignee defaults to the landlord's
    // assigned agent; due date defaults to 2 days from now when left blank.
    const assignee = (this.state.taskAssignee || '').trim() || L.agentEmail || undefined;
    const dueDate = this.state.taskDueDate || this.dueDateInDays(2);

    // Optimistic add — reverted on error so the user can retry.
    const order = Date.now();
    const item = { t:'act', kind:'task', title:'Task' + (createdFromAi ? ' · AI' : '') + ' · due '+dueDate, body:title, time:'Just now', order };
    this.setState(s=>({
      landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
      composerText:'', composerTime:'',
    }), ()=>this.scrollBottom());

    this.setState({ taskSaving:true });
    try {
      await base44.entities.LandlordTask.create({
        landlord_id: L.id,
        title,
        due_date: dueDate,
        assignee_email: assignee,
        done: false,
        created_from_ai: createdFromAi,
        ai_source: taskAiSource || undefined,
        was_edited_after_draft: wasEdited,
      });
      toast.success(createdFromAi ? 'AI-drafted task saved' : 'Task saved');
      this.setState(s=>({ taskAiSource:null, taskTitleDraft:null, taskDueDate:'', taskAssignee:'', taskSaving:false }));
    } catch(e){
      // Revert optimistic add and restore the composer so the user can retry.
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream: l.stream.filter(si => si.order !== order)} : l),
        composerText: title,
        taskSaving:false,
      }));
      toast.error('Failed to save task: ' + (e?.message || 'unknown error'));
    } finally {
      this._taskSaving = false;
    }
  };

  // Persist a Follow-up as a LandlordAppointment (no Google Calendar — that's Phase 3).
  // datetime is built in Asia/Dubai (fixed UTC+4, no DST). Edit-detection tracks the AI-authored
  // notes/reason only — changing channel/date/hour does NOT count as editing the draft.
  saveFollowup = async (notes)=>{
    const L = this.cur();
    // Synchronous re-entry guard (this.state.followupSaving lags a same-tick double-click).
    if(!L || this._followupSaving) return;
    this._followupSaving = true;
    const { followupAiSource, followupDraft, followupChannel } = this.state;
    const createdFromAi = !!followupAiSource;
    const wasEdited = createdFromAi ? (notes !== (followupDraft || '')) : false;
    const date = this.state.followupDate || this.dueDateInDays(1);
    let hourNum = Math.min(12, Math.max(1, parseInt(this.state.followupHour, 10) || 12));
    if (this.state.followupAmPm === 'PM' && hourNum < 12) hourNum += 12;
    if (this.state.followupAmPm === 'AM' && hourNum === 12) hourNum = 0;
    const hh = String(hourNum).padStart(2, '0');
    const mm = String(this.state.followupMinute || '00').padStart(2, '0');
    const datetime = `${date}T${hh}:${mm}:00+04:00`;
    const channel = ['whatsapp','call','email','imessage','telegram','sms','meeting','viewing'].includes(followupChannel) ? followupChannel : 'whatsapp';
    const apptType = (channel === 'call' || channel === 'viewing') ? (channel === 'viewing' ? 'viewing' : 'call') : 'meeting'; // legacy required field; channel carries the real axis

    // Optimistic add — reverted on error so the user can retry.
    const order = Date.now();
    const h12 = ((hourNum + 11) % 12) + 1;
    const item = { t:'act', kind:'followup', title:'Follow-up' + (createdFromAi ? ' · AI' : '') + ` · ${channel} · ${date} ${h12}:${mm} ${hourNum>=12?'PM':'AM'}`, body:notes, time:'Just now', order };
    this.setState(s=>({
      landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
      composerText:'', composerTime:'',
    }), ()=>this.scrollBottom());

    this.setState({ followupSaving:true });
    let user = this.props.currentUser;
    if(!user){ try { user = await base44.auth.me(); } catch(_) { user = null; } }
    const assigneeEmail = (this.state.followupAssignee || '').trim() || user?.email || L.agentEmail || undefined;

    try {
      await base44.entities.LandlordAppointment.create({
        landlord_id: L.id,
        agent_email: assigneeEmail,
        datetime,
        type: apptType,
        channel,
        notes,
        status: 'scheduled',
        created_from_ai: createdFromAi,
        ai_source: followupAiSource || undefined,
        was_edited_after_draft: wasEdited,
      });
      toast.success(createdFromAi ? 'AI follow-up scheduled' : 'Follow-up scheduled');
      this.setState(s=>({ followupAiSource:null, followupDraft:null, messageAiSource:null, messageAiDraft:null, followupChannel:'whatsapp', followupDate:'', followupHour:10, followupMinute:'00', followupAmPm:'AM', followupAssignee:'', followupSaving:false }));
    } catch(e){
      // Revert optimistic add and restore the composer so the user can retry.
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream: l.stream.filter(si => si.order !== order)} : l),
        composerText: notes,
        followupSaving:false,
      }));
      toast.error('Failed to schedule follow-up: ' + (e?.message || 'unknown error'));
    } finally {
      this._followupSaving = false;
    }
  };

  sendChat = async (text)=>{
    const L = this.cur();
    if(!L || this._chatSending) return;
    this._chatSending = true;
    this.setState({ chatSending:true });
    const channel = this.state.streamFilter === 'business' ? 'business' : 'personal';
    // V3 Phase 0 (RECORD): AI-draft provenance, mirroring saveTask. created_from_ai is true when the
    // text was seeded from an AI message draft (even if edited); was_edited compares sent vs draft.
    const { messageAiSource, messageAiDraft } = this.state;
    const attachment = this.state.composerAttachment || null;
    const createdFromAi = !!messageAiSource;
    const wasEdited = createdFromAi ? (text !== (messageAiDraft || '')) : false;
    const aiDisposition = createdFromAi ? (wasEdited ? 'edited' : 'accepted') : undefined;
    try {
      const res = await base44.functions.invoke('sendMultiChannelWhatsApp', {
        landlord_id: L.id, text, channel,
        created_from_ai: createdFromAi,
        ai_source: createdFromAi ? messageAiSource : undefined,
        ai_draft_text: createdFromAi ? messageAiDraft : undefined,
        was_edited_after_draft: wasEdited,
        ai_disposition: aiDisposition,
        attachment_url: attachment ? attachment.file_url : undefined,
        attachment_name: attachment ? attachment.file_name : undefined,
        attachment_media_type: attachment ? attachment.media_type : undefined,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success('Sent ✓');
      tickOutreachStep('whatsapp_sent', L).then(()=> this.props.onOutreachChanged && this.props.onOutreachChanged()); // auto-tick today's outreach sequence
      const order = Date.now();
      const item = { t:'msg', dir:'out', mtype:'text', text, wa:channel, time:'Just now', order };
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
        composerText:'', chatSending:false, messageAiSource:null, messageAiDraft:null, composerAttachment: null,
      }), ()=>this.scrollBottom());
    } catch(e){
      toast.error('Failed to send WhatsApp: ' + (e?.message || 'unknown error'));
      this.setState({ chatSending:false });
    } finally {
      this._chatSending = false;
    }
  };

  sendIMessage = async (text)=>{
    const L = this.cur();
    if(!L || this._imessageSending) return;
    this._imessageSending = true;
    this.setState({ imessageSending:true });
    try {
      const res = await base44.functions.invoke('sendIMessage', { landlord_id: L.id, text });
      const data = res?.data ?? res;
      // Graceful fallback: no iMessage-available handle → offer to send via WhatsApp instead.
      if (data?.fallback === 'whatsapp' || (data?.error && /no imessage/i.test(data.error))) {
        toast.error('No iMessage handle for this landlord — sending via WhatsApp instead.');
        this._imessageSending = false;
        this.setState({ imessageSending:false });
        await this.sendChat(text);
        return;
      }
      if (data?.error) throw new Error(data.error);
      toast.success('Sent ✓');
      tickOutreachStep('imessage_sent', L).then(()=> this.props.onOutreachChanged && this.props.onOutreachChanged()); // auto-tick today's outreach sequence
      const order = Date.now();
      const item = { t:'msg', dir:'out', mtype:'text', channel:'imessage', text, time:'Just now', order };
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
        composerText:'', imessageSending:false,
      }), ()=>this.scrollBottom());
    } catch(e){
      toast.error('Failed to send iMessage: ' + (e?.message || 'unknown error'));
      this.setState({ imessageSending:false });
    } finally {
      this._imessageSending = false;
    }
  };

  sendTelegram = async (text)=>{
    const L = this.cur();
    if(!L || this._telegramSending) return;
    this._telegramSending = true;
    const attachment = this.state.composerAttachment||null; this.setState({ telegramSending:true });
    try {
      const res = await base44.functions.invoke('sendTelegram', { landlord_id: L.id, text, attachment_url: attachment?.file_url, attachment_name: attachment?.file_name, attachment_media_type: attachment?.media_type });
      const data = res?.data ?? res;
      // Graceful fallback: landlord hasn't started a chat with the bot → offer WhatsApp instead.
      if (data?.fallback === 'whatsapp' || (data?.error && /no telegram chat/i.test(data.error))) {
        toast.error('No Telegram chat for this landlord — they must message the bot first.');
        this._telegramSending = false;
        this.setState({ telegramSending:false });
        return;
      }
      if (data?.error) throw new Error(data.error);
      // Multi-sensory confirmation: sound + Telegram-blue flash overlay + toast (matches iMessage).
      playSentSound();
      if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (_) {} }
      this.setState({ telegramJustSent:true });
      if (this._telegramFlashTimer) clearTimeout(this._telegramFlashTimer);
      this._telegramFlashTimer = setTimeout(()=> this.setState({ telegramJustSent:false }), 1700);
      toast.success('Sent ✓');
      const order = Date.now();
      const item = { t:'msg', dir:'out', mtype:'text', channel:'telegram', text, time:'Just now', order };
      this.setState(s=>({
        landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
        composerText:'', telegramSending:false, composerAttachment: null,
      }), ()=>this.scrollBottom());
    } catch(e){
      toast.error('Failed to send Telegram: ' + (e?.message || 'unknown error'));
      this.setState({ telegramSending:false });
    } finally {
      this._telegramSending = false;
    }
  };

  onToggleAIIntelligence = () => {
    this.setState(s => ({ aiIntelligenceCollapsed: !s.aiIntelligenceCollapsed }));
  };
  onAnalyse = async ()=>{
    if(!this.state.currentId) return;
    this.setState({ analyzing:true, analyseError:'' });
    try {
      await base44.functions.invoke('landlordOrchestrator', { landlord_id: this.state.currentId, force: true });
      // Refetch landlord to display fresh AI fields immediately
      window.location.reload();
    } catch(e) {
      this.setState({ analyzeError: e?.message || 'Analysis failed — please try again', analyzing:false });
    }
  };

  // Called only when the agent presses Save — the dropdown itself just stores a pending choice.
  onStageChange = async (newStage)=>{
    const L=this.cur(); if(!L||!newStage||this._stageSaving) return;
    const idx = this.state.landlords.findIndex(l=>l.id===this.state.currentId);
    if(idx<0) return;
    this._stageSaving = true;
    this.setState({ stageSaving:true });
    const prevStage = L.stage;
    // Optimistic update
    this.setState(s=>({ landlords: s.landlords.map((l,i)=> i===idx ? {...l, stage:newStage, stageEnteredAt: new Date().toISOString()} : l) }));
    // Persist to database
    try {
      await base44.entities.Landlord.update(L.id, { stage: newStage, stage_entered_at: new Date().toISOString() });
      // Stage change → full re-analysis (best-effort, fire-and-forget).
      base44.functions.invoke('landlordOrchestrator', { landlord_id: L.id, force: true }).catch(() => {});
      // AWAIT the refetch before clearing pendingStage. The componentDidUpdate prop-sync
      // (below) overwrites this.state.landlords from the parent's [mapped] array on every
      // render, so the optimistic stage is clobbered by the still-stale react-query record
      // until the refetch resolves. Keeping pendingStage set pins the dropdown to the chosen
      // stage through that window; once the refetched props reflect the new stage we clear it.
      if (this.props.onAnalysed) await this.props.onAnalysed();
      playSentSound();
      this.setState({ pendingStage:null, stageSaving:false, stageSaved:true });
      if (this._stageSavedTimer) clearTimeout(this._stageSavedTimer);
      this._stageSavedTimer = setTimeout(()=> this.setState({ stageSaved:false }), 1700);
    } catch(err) {
      console.error('Failed to update stage:', err);
      // Revert on error
      this.setState(s=>({ landlords: s.landlords.map((l,i)=> i===idx ? {...l, stage:prevStage, stageEnteredAt:L.stageEnteredAt} : l), stageSaving:false }));
    } finally {
      this._stageSaving = false;
    }
  };

  // style helpers
  scoreColor(n){ return n>=70 ? '#34d399' : n>=40 ? 'hsl(38 92% 58%)' : '#f87171'; }
  tempMeta(t){
    if(t==='hot') return { label:'🔥 Hot', bg:'rgba(239,68,68,0.16)', border:'rgba(239,68,68,0.4)', color:'#fca5a5' };
    if(t==='warm') return { label:'☀ Warm', bg:'hsl(38 92% 50% / 0.16)', border:'hsl(38 92% 50% / 0.4)', color:'hsl(38 92% 62%)' };
    return { label:'❄ Cold', bg:'rgba(59,130,246,0.16)', border:'rgba(59,130,246,0.4)', color:'#93c5fd' };
  }
  tempChip(t){ const m=this.tempMeta(t); return { display:'inline-flex', alignItems:'center', flex:'none', padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:m.bg, border:'1px solid '+m.border, color:m.color, whiteSpace:'nowrap' }; }
  actKindMeta(k){
    const map={ call:['📞','rgba(59,130,246,0.18)','#93c5fd'], note:['📝','rgba(148,163,184,0.18)','rgba(255,255,255,0.7)'], task:['✓','rgba(16,185,129,0.18)','#34d399'], followup:['↻','hsl(38 92% 50% / 0.18)','hsl(38 92% 62%)'], appointment:['📅','rgba(139,92,246,0.18)','#c4b5fd'], stage:['⇪','rgba(16,185,129,0.18)','#34d399'] };
    return map[k]||map.note;
  }
  sugMeta(type){
    const map={ followup:['↻','hsl(38 92% 50% / 0.18)','hsl(38 92% 60%)'], meeting:['🤝','rgba(139,92,246,0.18)','#c4b5fd'], viewing:['🏠','rgba(16,185,129,0.18)','#34d399'], call:['📞','rgba(59,130,246,0.18)','#93c5fd'] };
    return map[type]||map.followup;
  }
  titleize(s){ return String(s||'').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()); }
  rapportMeta(r){
    const map={
      cold:['❄ Cold','rgba(59,130,246,0.16)','rgba(59,130,246,0.4)','#93c5fd'],
      warming:['◐ Warming','hsl(38 92% 50% / 0.16)','hsl(38 92% 50% / 0.4)','hsl(38 92% 62%)'],
      rapport_built:['◑ Rapport built','rgba(16,185,129,0.16)','rgba(16,185,129,0.4)','#34d399'],
      trust_established:['● Trust established','rgba(16,185,129,0.18)','rgba(16,185,129,0.45)','#34d399'],
      champion:['★ Champion','hsl(38 92% 50% / 0.18)','hsl(38 92% 50% / 0.5)','hsl(38 92% 62%)'],
    };
    const m=map[r]||map.cold;
    return { label:m[0], chipStyle:{ display:'inline-flex', alignItems:'center', flex:'none', padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:m[1], border:'1px solid '+m[2], color:m[3], whiteSpace:'nowrap' } };
  }
  priorityMeta(p){
    const map={ urgent:['#f87171','rgba(239,68,68,0.12)','rgba(239,68,68,0.35)'], high:['hsl(38 92% 62%)','hsl(38 92% 50% / 0.1)','hsl(38 92% 50% / 0.3)'], medium:['#93c5fd','rgba(59,130,246,0.1)','rgba(59,130,246,0.3)'], low:['rgba(255,255,255,0.6)','rgba(255,255,255,0.04)','rgba(255,255,255,0.12)'] };
    return map[p]||map.medium;
  }

  // ---------- seed (removed — real data comes from the container page) ----------
  seed(){ return []; }

  cannedAnalysis(){ return null; }

  // ---------- viewmodel ----------
  computeVM(){
    const S=this.state; const L=this.cur();
    const showCoaching = this.props.showCoaching!==false;
    const showSignals = this.props.showSignals!==false;

    const landlordOptions = S.landlords.map(l=>({ id:l.id, name:l.name }));
    const hasAIProcessed = !!L.aiProcessedAt;

    const arr = (x) => Array.isArray(x) ? x : [];
    const sc = L.scores || {};
    // Intelligence panel is driven by ai_processed_at (source of truth for "has this been
    // analysed"). The `ai` VM object is built from real Landlord fields — consumed by the
    // AIIntelligenceCard component (Part B redesign).
    const ai={
      summary: L.aiRollingSummary || '',
      analysedAt: L.aiProcessedAt || null,
      trust: sc.trust != null ? sc.trust : null,
      trustRationale: sc.trustWhy || '',
      urgency: sc.urgency != null ? sc.urgency : null,
      urgencyRationale: sc.urgencyWhy || '',
      win: sc.mandateWin != null ? Math.round(sc.mandateWin * 100) : null,
      winRationale: sc.mandateWhy || '',
      momentum: L.aiMomentum || '',
      strikeNow: L.hasStrikeNow === true,
      strikeText: L.strikeText || '',
      nextBestAction: L.aiNextBestAction || null,
      coaching: L.aiCoaching || '',
      objections: arr(L.aiObjections),
      // V3 Phase 2 (REMEMBER): trajectory + persistent thesis + ask-the-agent questions.
      scoreTrend: L.scoreTrend || null,
      dealThesis: L.aiDealThesis || '',
      openQuestions: arr(L.aiOpenQuestions),
    };

    const sorted=[...L.stream].sort((a,b)=>(b.order||0)-(a.order||0));
    const filterMode=S.streamFilter || 'all';
    const filtered = filterMode==='all' ? sorted
      : filterMode==='email' ? sorted.filter(s => s.channel==='email' || s.kind==='email')
      : filterMode==='imessage' ? sorted.filter(s => s.channel==='imessage')
      : filterMode==='telegram' ? sorted.filter(s => s.channel==='telegram')
      : sorted.filter(s => s.t==='act' || s.wa===filterMode);
    const analyzeError=S.analyzeError || '';
    const stream=filtered.map((s,idx)=>{
      if(s.t==='msg'){
        const out = s.dir==='out';
        const waveform = s.mtype==='voice' ? [9,15,7,18,11,16,6,13,9,17,8,12].map((h,k)=>React.createElement('span',{ key:k, style:{ width:'2px', height:h+'px', borderRadius:'2px', background: out?'hsl(38 92% 55% / 0.7)':'rgba(255,255,255,0.4)' } })) : null;
        return {
          key:idx, isMsg:true, isAct:false,
          isText:s.mtype==='text', isVoice:s.mtype==='voice', isMedia:s.mtype==='media',
          subject:s.subject, emailBody:s.emailBody,
          text:s.text, transcript:s.transcript, translation:s.translation, transcriptLang:s.transcriptLang, mediaLabel:s.mediaLabel, duration:s.duration, waveform, time:s.time,
          sender: s.senderName || (out ? (L.agent || 'Agent') : L.name),
          channel: s.channel==='email' ? 'Email' : s.channel==='imessage' ? 'iMessage' : s.channel==='telegram' ? 'Telegram' : (s.wa==='personal' ? 'WA Personal' : 'WA Business'),
          channelStyle:{ fontSize:'8.5px', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
            color: s.channel==='email' ? 'hsl(38 92% 62%)' : s.channel==='imessage' ? '#60a5fa' : s.channel==='telegram' ? '#29b6f6' : (s.wa==='personal' ? '#93c5fd' : '#4ade80'),
            background: s.channel==='email' ? 'hsl(38 92% 50% / 0.12)' : s.channel==='imessage' ? 'rgba(10,132,255,0.14)' : s.channel==='telegram' ? 'rgba(41,182,246,0.14)' : (s.wa==='personal' ? 'rgba(59,130,246,0.14)' : 'rgba(37,211,102,0.12)'),
            padding:'1px 5px', borderRadius:'4px' },
          rowStyle:{ display:'flex', justifyContent: out?'flex-end':'flex-start' },
          bubbleStyle:{ maxWidth:'96%', padding:'10px 13px', borderRadius: out?'14px 14px 4px 14px':'14px 14px 14px 4px', background: out?'hsl(38 92% 50% / 0.12)':'rgba(255,255,255,0.05)', border:'1px solid '+(out?'hsl(38 92% 50% / 0.28)':'rgba(255,255,255,0.1)') },
          senderStyle:{ fontSize:'10px', fontWeight:700, letterSpacing:'0.03em', textTransform:'uppercase', color: out?'hsl(38 92% 58%)':'rgba(255,255,255,0.45)' },
          timeStyle:{ fontSize:'9.5px', color:'rgba(255,255,255,0.35)', marginTop:'6px', textAlign: out?'right':'left' },
        };
      } else {
        const [icon,bg,color]=this.actKindMeta(s.kind);
        return { key:idx, isMsg:false, isAct:true, time:s.time, actIcon:icon, actTitle:s.title, actBody:s.body,
          _kind: s.kind, _author: s.author || '',
          actIconStyle:{ flex:'none', width:'30px', height:'30px', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', background:bg, color, marginTop:'2px' },
          actLabelStyle:{ fontSize:'12px', fontWeight:700, color } };
      }
    });
    const msgCount=filtered.filter(s=>s.t==='msg').length;
    const actCount=filtered.filter(s=>s.t==='act').length;

    const composerTypes=['Note','Task','Follow-up','Appointment','Chat','iMessage','Telegram','Email'].map(t=>{
      const on=S.composerType===t; const ic={ 'Note':'📝','Task':'✓','Follow-up':'↻','Appointment':'📅','Chat':'💬','iMessage':'','Telegram':'✈','Email':'✉' }[t];
      const isChat = t==='Chat';
      const isIMessage = t==='iMessage';
      const isTelegram = t==='Telegram';
      return { label:t, icon:ic, onClick: ()=>this.setComposerType(t),
        style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'6px 11px', borderRadius:'9px', fontSize:'11.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          background: isTelegram ? (on?'rgba(41,182,246,0.2)':'rgba(41,182,246,0.08)') : isIMessage ? (on?'rgba(10,132,255,0.2)':'rgba(10,132,255,0.08)') : isChat ? (on?'rgba(37,211,102,0.2)':'rgba(37,211,102,0.08)') : (on?'hsl(38 92% 50% / 0.14)':'rgba(255,255,255,0.04)'),
          color: isTelegram ? (on?'#29b6f6':'#4fc3f7') : isIMessage ? (on?'#0A84FF':'#60a5fa') : isChat ? (on?'#22c55e':'#86efac') : (on?'hsl(38 92% 62%)':'rgba(255,255,255,0.6)'),
          border:'1px solid '+(isTelegram ? (on?'rgba(41,182,246,0.5)':'rgba(41,182,246,0.3)') : isIMessage ? (on?'rgba(10,132,255,0.5)':'rgba(10,132,255,0.3)') : isChat ? (on?'rgba(37,211,102,0.5)':'rgba(37,211,102,0.3)') : (on?'hsl(38 92% 50% / 0.45)':'rgba(255,255,255,0.1)')) } };
    });
    const placeholders={ 'Note':'Add a note to the timeline…', 'Task':'Task title…', 'Follow-up':'What’s the follow-up?', 'Appointment':'Appointment details…', 'Chat':'Type a WhatsApp message… (Enter to send)', 'iMessage':'Type an iMessage… (Enter to send)', 'Telegram':'Type a Telegram message… (Enter to send)', 'Email':'Use the AI Email Draft panel above to compose…' };

    const rm=this.rapportMeta(L.rapport);
    const hdr={
      name:L.name, initials:L.initials,
      avatarStyle:{ flex:'none', width:'52px', height:'52px', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:700, color:'hsl(38 92% 62%)', background:'hsl(38 92% 50% / 0.12)', border:'1px solid hsl(38 92% 50% / 0.32)' },
      archetype:this.titleize(L.archetype),
      archetypeStyle:{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'99px', fontSize:'10.5px', fontWeight:700, letterSpacing:'0.03em', textTransform:'uppercase', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.32)', color:'#c4b5fd' },
      bedsSqft: L.unit.beds+' · '+L.unit.sqft,
      unitBuilding: L.unit.building,
      unitLabel: L.unit.label,
      askingLabel: 'Asking '+L.unit.asking,
      stageLabel:this.STAGES[L.stageIndex-1],
      stageStyle:{ display:'inline-flex', alignItems:'center', padding:'5px 12px', borderRadius:'99px', fontSize:'11.5px', fontWeight:700, background:'rgba(139,92,246,0.16)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd' },
      tempLabel:rm.label, tempChipStyle:rm.chipStyle,
      phone: L.phone && L.phone !== '—' ? L.phone : null,
    };

    const total=this.STAGES.length;
    const pct=Math.round((L.stageIndex/total)*100);
    const stage={ index:L.stageIndex, total, label:this.STAGES[L.stageIndex-1],
      barStyle:{ height:'100%', width:pct+'%', background:'linear-gradient(90deg, #8b5cf6, #c4b5fd)' },
      nextLabel: L.stageIndex<total ? ('Next · '+this.STAGES[L.stageIndex]) : 'Final stage' };

    let nextBest={ show:false };
    // First check real AI field, then legacy field
    if(L.aiNextBestAction && typeof L.aiNextBestAction === 'object' && L.aiNextBestAction.action){
      const [color,bg,bd]=this.priorityMeta(L.aiNextBestAction.priority || 'medium');
      nextBest={ show:true, action:L.aiNextBestAction.action, reasoning:L.aiNextBestAction.reasoning || '', priority:this.titleize(L.aiNextBestAction.priority || 'Medium'),
        boxStyle:{ display:'flex', alignItems:'flex-start', gap:'11px', marginTop:'12px', borderRadius:'13px', padding:'13px 15px', border:'1px solid '+bd, background:bg },
        badgeStyle:{ flex:'none', padding:'3px 9px', borderRadius:'99px', fontSize:'9.5px', fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', color, background:'rgba(255,255,255,0.06)', border:'1px solid '+bd },
        accent:color };
    } else if(L.nextBest){
      const [color,bg,bd]=this.priorityMeta(L.nextBest.priority);
      nextBest={ show:true, action:L.nextBest.action, reasoning:L.nextBest.reasoning, priority:this.titleize(L.nextBest.priority),
        boxStyle:{ display:'flex', alignItems:'flex-start', gap:'11px', marginTop:'12px', borderRadius:'13px', padding:'13px 15px', border:'1px solid '+bd, background:bg },
        badgeStyle:{ flex:'none', padding:'3px 9px', borderRadius:'99px', fontSize:'9.5px', fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', color, background:'rgba(255,255,255,0.06)', border:'1px solid '+bd },
        accent:color };
    }
    const flagChips=(L.redFlags||[]).map(f=>({ label:this.titleize(f), style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, color:'#fca5a5', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.28)' }, icon:'⚑' }));
    const buyChips=(L.buyingSignals||[]).map(b=>({ label:this.titleize(b), style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, color:'#34d399', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.28)' }, icon:'✓' }));
    const hasFlags = flagChips.length>0 || buyChips.length>0;

    const connDefs=[
      ['wa_business','WhatsApp Business','💬'], ['wa_personal','WhatsApp Personal','📱'], ['aircall','Aircall','📞'], ['twilio','Twilio Dialer','☎'], ['wa_call','WhatsApp Call','📲'], ['drive','Google Drive','📁'], ['docusign','DocuSign','✍'], ['dld','DLD','🏛']
    ];
    const connections=connDefs.map(([k,label,icon])=>{
      const v=L.connections?L.connections[k]:false; const on=!!v;
      return { key:k, label, icon, detail: on?String(v):'Not linked',
        style:{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'7px 11px', borderRadius:'11px', border:'1px solid '+(on?'rgba(16,185,129,0.28)':'rgba(255,255,255,0.08)'), background: on?'rgba(16,185,129,0.07)':'rgba(255,255,255,0.02)', color: on?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.4)' },
        dotStyle:{ width:'7px', height:'7px', borderRadius:'50%', flex:'none', background: on?'#34d399':'rgba(255,255,255,0.25)', boxShadow: on?'0 0 7px rgba(52,211,153,0.7)':'none' } };
    });

    let signals={ showStrike:false }; let scorecards=[];
    if(L.signals){
      const strike=L.signals.strikeNow;
      signals={
        showStrike:true, strikeKicker:L.signals.strikeKicker, strikeText:L.signals.strikeText,
        strikeAccent: strike?'#fca5a5':'hsl(38 92% 60%)',
        strikeStyle:{ display:'flex', alignItems:'flex-start', gap:'11px', marginTop:'14px', borderRadius:'13px', padding:'13px 15px', border:'1px solid '+(strike?'rgba(239,68,68,0.35)':'rgba(255,255,255,0.1)'), background: strike?'linear-gradient(180deg, rgba(239,68,68,0.12), rgba(239,68,68,0.03))':'rgba(255,255,255,0.03)', animation:'ld-rise 0.48s cubic-bezier(0.22,1,0.36,1) both' },
        strikeDot:{ flex:'none', width:'9px', height:'9px', borderRadius:'50%', marginTop:'4px', background: strike?'#ef4444':'hsl(38 92% 55%)', boxShadow: strike?'0 0 10px rgba(239,68,68,0.8)':'none', animation: strike?'ld-pulse 1.6s ease-in-out infinite':'none' },
      };
    }
    if(L.scores){
      const s=L.scores;
      const mk=(label,val,unit,why)=>{ const n = unit==='%'? Math.round(val*100): val; const col=this.scoreColor(n);
        return { label, value:n, unit, why, color:col, barStyle:{ height:'100%', width:n+'%', background:col } }; };
      scorecards=[ mk('Trust',s.trust,'/100',s.trustWhy), mk('Responsive',s.responsiveness,'/100',s.respWhy), mk('Urgency',s.urgency,'/100',s.urgencyWhy), mk('Mandate win',s.mandateWin,'%',s.mandateWhy) ];
    }

    let market={ hasVal:false };
    const confMeta={ high:['#34d399','rgba(16,185,129,0.16)','High confidence'], medium:['hsl(38 92% 62%)','hsl(38 92% 50% / 0.16)','Medium confidence'], low:['#f87171','rgba(239,68,68,0.16)','Low confidence'] };
    if(L.valuation){
      const cm=confMeta[L.valuation.confidence]||confMeta.medium;
      market.hasVal=true;
      market.estValue=L.valuation.estValue; market.psf=L.valuation.psf; market.basis=L.valuation.basis; market.updatedAt=L.valuation.updatedAt;
      market.confLabel=cm[2]; market.confStyle={ display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, color:cm[0], background:cm[1] };
    }
    if(L.market){ market.comps=L.market.comps; market.trendLabel=L.market.trend; market.trendStyle={ display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:'rgba(16,185,129,0.14)', border:'1px solid rgba(16,185,129,0.32)', color:'#34d399' }; }
    else { market.comps=[]; market.trendLabel=''; market.trendStyle={ display:'none' }; }

    const tabDefs=[ ['calls','Calls'],['documents','Documents'] ];
    const tabs=tabDefs.map(([id,label])=>{
      const on=S.activeTab===id;
      return { id, label, onClick:()=>this.setTab(id),
        style:{ padding:'7px 13px', borderRadius:'9px', fontSize:'12.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          background: on?'hsl(38 92% 50% / 0.14)':'transparent', color: on?'hsl(38 92% 62%)':'rgba(255,255,255,0.55)', border:'1px solid '+(on?'hsl(38 92% 50% / 0.4)':'rgba(255,255,255,0.09)') } };
    });

    const at=S.activeTab;
    const kv=(label,value,accent)=>({ label, value, valueStyle:{ fontSize:'13.5px', fontWeight:600, marginTop:'5px', color: accent||'rgba(255,255,255,0.9)' } });
    let tab={ isList:false, isQualify:false, isCalls:false, isNegotiation:false, isDocuments:false, isOutreach:false };
    if(at==='calls'){
      if(L.calls.length){ tab.isCalls=true;
        const provMeta={ aircall:['Aircall','📞','#93c5fd','rgba(59,130,246,0.16)'], twilio:['Twilio','☎','#34d399','rgba(16,185,129,0.16)'], whatsapp:['WhatsApp','📲','#4ade80','rgba(37,211,102,0.16)'] };
        tab.calls=L.calls.map((c,i)=>{
          const pm=provMeta[c.provider]||provMeta.aircall;
          const stMeta={ done:['rgba(16,185,129,0.16)','#34d399','Completed'], missed:['rgba(239,68,68,0.16)','#f87171','Missed'], voicemail:['rgba(245,158,11,0.16)','hsl(38 92% 62%)','Voicemail'] }[c.status]||['rgba(148,163,184,0.16)','rgba(255,255,255,0.6)',c.status];
          return { key:i, title:(c.dir==='out'?'Outbound · ':'Inbound · ')+c.title, meta:c.who, dur:c.dur,
            icon:c.dir==='out'?'↗':'↙',
            iconStyle:{ flex:'none', width:'34px', height:'34px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', background:c.dir==='out'?'rgba(16,185,129,0.16)':'rgba(59,130,246,0.16)', color:c.dir==='out'?'#34d399':'#93c5fd' },
            provLabel:pm[0], provIcon:pm[1],
            provStyle:{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'99px', fontSize:'10px', fontWeight:700, color:pm[2], background:pm[3] },
            statusLabel:stMeta[2], statusStyle:{ padding:'2px 8px', borderRadius:'99px', fontSize:'10px', fontWeight:700, color:stMeta[1], background:stMeta[0] },
            recording:c.recording,
            recStyle:{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'99px', fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,0.6)', background:'rgba(255,255,255,0.06)' } };
        }); }
      else { tab.isList=true; tab.rows=[ kv('Calls','No call logs yet — Aircall, Twilio & WhatsApp calls appear here') ]; }
    } else if(at==='documents'){
      tab.isDocuments=true; tab.docsLandlordName=L.name; tab.docs=L.docs.map((d,i)=>{
        const sm={ received:['rgba(16,185,129,0.16)','#34d399','✓ Received'], pending:['rgba(245,158,11,0.16)','hsl(38 92% 62%)','◷ Pending'], missing:['rgba(239,68,68,0.16)','#f87171','✕ Missing'] }[d.status]||['rgba(148,163,184,0.16)','rgba(255,255,255,0.6)',d.status];
        return { key:i, icon:d.icon, label:d.label, provider:d.provider, url:d.url || null, status:sm[2], statusStyle:{ padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:sm[0], color:sm[1] } };
      });
    }

    // Always-computed (independent of the bottom Documents & Mandate tab bar) — feeds the
    // top-level Outreach / Unit / Qualify / Negotiation tabs in LandlordMockTabs.
    const oc = L.outreach;
    const outreachVM = {
      outreachDate: oc.date, stepsCompleted: oc.stepsCompleted, dailyScore: oc.dailyScore,
      progressStyle:{ height:'100%', width:Math.round((oc.stepsCompleted/6)*100)+'%', background:'linear-gradient(90deg, hsl(38 92% 52%), hsl(38 92% 62%))' },
      steps: oc.steps.map((st)=>({ key:st.key, label:st.label, at: st.at||'—', done:st.done,
        iconStyle:{ flex:'none', width:'24px', height:'24px', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:800, color: st.done?'#34d399':'rgba(255,255,255,0.35)', background: st.done?'rgba(16,185,129,0.16)':'rgba(255,255,255,0.05)', border:'1px solid '+(st.done?'rgba(16,185,129,0.35)':'rgba(255,255,255,0.1)') },
        icon: st.done?'✓':'○',
        labelStyle:{ fontSize:'13px', fontWeight:600, color: st.done?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.5)' } })),
    };
    const infoRows = [
      kv('Full name', L.name), kv('Phone', L.phone), kv('Source', L.source),
      kv('Archetype', this.titleize(L.archetype), '#c4b5fd'), kv('Owner since', L.ownerSince), kv('Assigned agent', L.agent, 'hsl(38 92% 60%)'),
    ];
    const qualifyRows = L.qualification ? (()=>{ const q=L.qualification; return [
      kv('Motivation', q.motivation), kv('Timeline / urgency', q.timeline, 'hsl(38 92% 60%)'),
      kv('Price expectation', q.priceExpectation), kv('Price vs valuation', q.priceVsValuation),
      kv('Mandate openness', q.mandateOpenness), kv('Decision maker', q.decisionMaker),
      kv('Tenancy', q.tenancy), kv('Mortgage', q.mortgage),
      kv('Call outcome', q.outcome, 'hsl(38 92% 60%)'), kv('Next step', q.nextStep), kv('Follow-up', q.followupDate, 'hsl(38 92% 60%)'),
    ]; })() : [ kv('Qualification', 'Not yet logged — run a CallQualification on the next call') ];
    const unitRows = (()=>{ const u=L.unit; return [
      kv('Unit', u.building+' · '+u.label), kv('Area', u.area), kv('Layout', u.beds+' · '+u.baths),
      kv('Size', u.sqft), kv('View', u.view), kv('Parking', u.parking),
      kv('Service charge', u.serviceCharge), kv('Asking price', u.asking, 'hsl(38 92% 60%)'),
    ]; })();
    const negotiationVM = (()=>{ const u=L.unit;
      const battle = L.battle || { painPoint:'Run AI / battle card to populate.', motivators:[], competitor:'—', pitch:'—', closes:[] };
      const ladder=[
        { label:'Asking', value:u.asking, color:'rgba(255,255,255,0.92)', cardStyle:{ borderRadius:'12px', padding:'12px 13px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' } },
        { label:'Target', value:u.target, color:'hsl(38 92% 60%)', cardStyle:{ borderRadius:'12px', padding:'12px 13px', background:'hsl(38 92% 50% / 0.07)', border:'1px solid hsl(38 92% 50% / 0.28)' } },
        { label:'Floor', value:u.floor, color:'#f87171', cardStyle:{ borderRadius:'12px', padding:'12px 13px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.22)' } },
      ];
      const offers=L.offers.map((o,i)=>{
        const sm={ pending:['rgba(245,158,11,0.16)','hsl(38 92% 62%)','Pending'], accepted:['rgba(16,185,129,0.16)','#34d399','Accepted'], declined:['rgba(239,68,68,0.16)','#f87171','Declined'] }[o.status]||['rgba(148,163,184,0.16)','rgba(255,255,255,0.6)',o.status];
        return { key:i, who:o.who, time:o.time, amount:o.amount, status:sm[2], statusStyle:{ padding:'3px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:700, background:sm[0], color:sm[1] } };
      });
      return { battle, ladder, offers };
    })();

    return {
      currentId:S.currentId, landlordOptions,
      streamCountLabel: msgCount+' messages · '+actCount+' activities',
      streamFilter: filterMode,
      analyzeError,
      businessPillStyle:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
        background: filterMode==='business' ? 'rgba(37,211,102,0.2)' : 'rgba(37,211,102,0.05)',
        border: '1px solid '+(filterMode==='business' ? 'rgba(37,211,102,0.5)' : 'rgba(37,211,102,0.18)'),
        color: filterMode==='business' ? '#4ade80' : 'rgba(74,222,128,0.5)' },
      businessDotStyle:{ width:'6px', height:'6px', borderRadius:'50%', background: filterMode==='business' ? '#25D366' : 'rgba(37,211,102,0.35)' },
      personalPillStyle:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
        background: filterMode==='personal' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.05)',
        border: '1px solid '+(filterMode==='personal' ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.18)'),
        color: filterMode==='personal' ? '#93c5fd' : 'rgba(147,197,253,0.5)' },
      personalDotStyle:{ width:'6px', height:'6px', borderRadius:'50%', background: filterMode==='personal' ? '#3b82f6' : 'rgba(59,130,246,0.35)' },
      emailPillStyle:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
        background: filterMode==='email' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.05)',
        border: '1px solid '+(filterMode==='email' ? 'hsl(38 92% 50% / 0.5)' : 'hsl(38 92% 50% / 0.18)'),
        color: filterMode==='email' ? 'hsl(38 92% 62%)' : 'hsl(38 92% 50% / 0.5)' },
      emailDotStyle:{ width:'6px', height:'6px', borderRadius:'50%', background: filterMode==='email' ? 'hsl(38 92% 55%)' : 'hsl(38 92% 50% / 0.35)' },
      imessagePillStyle:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
        background: filterMode==='imessage' ? 'rgba(10,132,255,0.2)' : 'rgba(10,132,255,0.05)',
        border: '1px solid '+(filterMode==='imessage' ? 'rgba(10,132,255,0.5)' : 'rgba(10,132,255,0.18)'),
        color: filterMode==='imessage' ? '#60a5fa' : 'rgba(96,165,250,0.5)' },
      imessageDotStyle:{ width:'6px', height:'6px', borderRadius:'50%', background: filterMode==='imessage' ? '#0A84FF' : 'rgba(10,132,255,0.35)' },
      telegramPillStyle:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
        background: filterMode==='telegram' ? 'rgba(41,182,246,0.2)' : 'rgba(41,182,246,0.05)',
        border: '1px solid '+(filterMode==='telegram' ? 'rgba(41,182,246,0.5)' : 'rgba(41,182,246,0.18)'),
        color: filterMode==='telegram' ? '#4fc3f7' : 'rgba(79,195,247,0.5)' },
      telegramDotStyle:{ width:'6px', height:'6px', borderRadius:'50%', background: filterMode==='telegram' ? '#29b6f6' : 'rgba(41,182,246,0.35)' },
      analyzing:S.analyzing, notAnalyzing:!S.analyzing,
      aiReady: hasAIProcessed, aiEmpty: !hasAIProcessed,
      ai, showCoaching,
      analyseLabel: S.analyzing?'Analysing…':'Analyse Now',
      analyseIconStyle:{ display:'inline-block', animation: S.analyzing?'ld-spin 0.8s linear infinite':'none' },
      stream,
      composerTypes, composerText:S.composerText, composerPlaceholder:placeholders[S.composerType],
      composerHasTime:!!S.composerTime, composerTime:S.composerTime,
      hdr, stage, connections,
      nextBest, flagChips, buyChips, hasFlags,
      showSignals: showSignals && !!L.scores, signals, scorecards,
      summaryText: L.aiRollingSummary || 'No AI summary yet — run “Analyse Now” in the conversation panel to generate one.',
      market, agentNotes:L.agentNotes,
      tabs, tab,
      media: L.media || null,
      valuation: L.valuation || null,
      mandate: L.mandate || null,
      outreachVM, qualifyRows, unitRows, negotiationVM, infoRows,
    };
  }

  render(){
    const vm = this.computeVM();
    const L = this.cur();
    const { ai, hdr, stage, market, signals, tab } = vm;

    // Filter the VM stream by the active tab — each tab shows ONLY its own data.
    const tabStream = vm.stream.filter(s => {
      const ct = this.state.composerType;
      if (ct === 'Email') return s.isMsg && s.channel === 'Email';
      if (ct === 'Chat') return s.isMsg && (s.channel === 'WA Personal' || s.channel === 'WA Business');
      if (ct === 'iMessage') return s.isMsg && s.channel === 'iMessage';
      if (ct === 'Telegram') return s.isMsg && s.channel === 'Telegram';
      if (ct === 'Note') return s.isAct && s._kind === 'note';
      if (ct === 'Task') return s.isAct && s._kind === 'task';
      if (ct === 'Follow-up') return s.isAct && s._kind === 'followup';
      if (ct === 'SMS') return false;
      return true;
    });
    // Chat-style tabs render oldest→newest so the latest message sits at the bottom (chat UX).
    // vm.stream is newest-first, so reverse for these tabs only.
    if (['Chat','iMessage','Telegram','SMS'].includes(this.state.composerType)) tabStream.reverse();

    return (
      <React.Fragment>
        <style>{GLOBAL_CSS}</style>
        <div className="ld-root" style={css("height:100vh; width:100%; display:flex; flex-direction:column; background:radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%); color:rgba(255,255,255,0.9); font-family:'Inter',sans-serif;")}>

          {/* Top bar — breadcrumbs header */}
          <div className="ld-topbar" style={css("flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 18px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); backdrop-filter:blur(16px);")}>
            <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.7;transform:scale(0.95);}}`}</style>
            {/* Left: back + breadcrumbs trail */}
            <div style={css("display:flex; align-items:center; gap:8px;")}>
              <button onClick={this.onBack} title="Back" style={css("flex:none; display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:1px solid rgba(204,170,102,0.2); background:rgba(38,35,34,0.95); cursor:pointer;")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccaa66" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              </button>
              {/* Breadcrumb: Landlords › [Name] */}
              <div style={css("display:flex; align-items:center; gap:7px;")}>
                <button onClick={()=>this.onNavigate('/landlords')} style={css("font-size:12px; font-weight:500; color:rgba(255,255,255,0.5); background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; padding:2px 0;")}>
                  Landlords
                </button>
                <span style={css("color:rgba(255,255,255,0.2); font-size:12px;")}>›</span>
                <span style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.95); font-family:'Inter',sans-serif;")}>{L.full_name_en || L.full_name || 'Landlord'}</span>
              </div>
            </div>
            {/* Right: two pill containers + Analyse + Go Back */}
            <div style={css("display:flex; align-items:center; gap:8px;")}>
              {/* ── Container 1: AI Intelligence pill (chevron + stalled + metrics + label) ── */}
              {(() => {
                const sm = (n) => n>=70 ? {c:'#34d399',b:'rgba(52,211,153,0.12)'} : n>=40 ? {c:'#e4b94a',b:'rgba(228,185,74,0.12)'} : {c:'#DB7575',b:'rgba(219,117,117,0.12)'};
                const pills = [];
                if (ai.momentum && /stall|stuck|cold|dormant/i.test(ai.momentum)) pills.push({l:'stalled',c:'rgba(255,255,255,0.85)',b:'#343452',bd:'#4a4a6a'});
                if (ai.trust != null) { const m=sm(ai.trust); pills.push({l:'TRUST '+ai.trust,c:m.c,b:m.b,bd:m.c+'50'}); }
                if (ai.urgency != null) { const m=sm(ai.urgency); pills.push({l:'URGENCY '+ai.urgency,c:m.c,b:m.b,bd:m.c+'50'}); }
                if (ai.win != null) { const m=sm(ai.win); pills.push({l:'WIN '+ai.win+'%',c:m.c,b:m.b,bd:m.c+'50'}); }
                const intelOpen = this.state.showCoaching;
                return (
                  <button onClick={() => this.setState(s => ({ showCoaching: !s.showCoaching }))} title="Toggle AI Intelligence panel" style={css("display:inline-flex; align-items:center; gap:7px; padding:5px 12px 5px 9px; border-radius:999px; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.02); border:1px solid transparent; border-image:linear-gradient(135deg, rgba(168,125,86,0.5), rgba(76,76,100,0.4)) 1; white-space:nowrap;")}>
                    <span style={css("flex:none; color:rgba(255,255,255,0.4); font-size:12px; font-weight:700;")}>{intelOpen ? '‹' : '›'}</span>
                    {pills.map((p,i)=>(
                      <span key={i} style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:99,fontSize:9.5,fontWeight:700,whiteSpace:'nowrap',color:p.c,background:p.b,border:'1px solid '+p.bd}}>{p.l}</span>
                    ))}
                    <span style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; color:#8C8C9A;")}>AI INTELLIGENCE</span>
                  </button>
                );
              })()}
              {/* ── Container 2: AI Tasks pill (sparkle + count + chevron) ── */}
              {(() => {
                const chips = this.suggestedTaskChips();
                if (!chips.length) return null;
                const tasksOpen = !this.state.aiTasksCollapsed;
                return (
                  <button onClick={() => this.setState(s => ({ aiTasksCollapsed: !s.aiTasksCollapsed }))} title="Toggle AI suggested tasks" style={css("display:inline-flex; align-items:center; gap:7px; padding:5px 12px; border-radius:999px; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.02); border:1px solid rgba(76,76,100,0.45); white-space:nowrap;")}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                    <span style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; color:rgba(255,255,255,0.85);")}>AI TASKS {chips.length}</span>
                    <span style={css("flex:none; color:rgba(255,255,255,0.4); font-size:12px; font-weight:700;")}>{tasksOpen ? '‹' : '›'}</span>
                  </button>
                );
              })()}
              {/* Analyse button */}
              <button onClick={this.onAnalyse} disabled={vm.analyzing} title="Run AI analysis" style={css("flex:none; display:inline-flex; align-items:center; gap:5px; height:32px; padding:0 12px; border-radius:8px; border:1px solid rgba(212,175,55,0.4); background:rgba(212,175,55,0.14); color:hsl(38 92% 62%); font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; opacity:"+(vm.analyzing?0.5:1)+";")}>
                {vm.analyzing ? 'Analysing…' : '↻ Analyse'}
              </button>
              {/* Assign Listing Manager — opens the assignment dialog */}
              {this.props.onAssignListingManager && (
                <button onClick={this.props.onAssignListingManager} title="Assign listing manager" style={css("flex:none; display:inline-flex; align-items:center; gap:7px; height:32px; padding:0 14px; border-radius:8px; border:1px solid hsl(38 92% 50% / 0.45); background:rgba(212,175,55,0.14); color:hsl(38 92% 62%); font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
                  <Users size={14} style={{ color: '#93a4c4' }} /> Assign Listing Manager
                </button>
              )}
              {/* Go Back — navigates to previous page */}
              <button onClick={this.onBack} title="Go back to previous page" style={css("flex:none; display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 14px; border-radius:8px; border:1px solid rgba(96,165,250,0.35); background:rgba(96,165,250,0.1); color:#93c5fd; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
                ← Go Back
              </button>
            </div>
          </div>

          {/* Two panels */}
          <div className="ld-panels" style={css("flex:1; min-height:0;")}>

            {/* ACTIVITY PANEL (right-side visually via order:2) */}
            <div className="ld-panel" style={css("flex:0 0 65%; min-width:0; height:100%; min-height:0; display:flex; flex-direction:column; order:2; overflow:hidden; background:rgba(255,255,255,0.01);")}>

              {/* AI Suggested Tasks row — intelligence metrics are in the header */}
              <div style={css("flex:none; margin:0 16px 6px;")}>
                {(() => {
                  const chips = this.suggestedTaskChips();
                  if (!chips.length) return null;
                  const collapsed = this.state.aiTasksCollapsed;
                  return (
                    <div style={css("border-radius:12px; border:1px solid rgba(139,92,246,0.22); background:rgba(139,92,246,0.04); overflow:hidden;")}>
                      <button onClick={() => this.setState(s => ({ aiTasksCollapsed: !s.aiTasksCollapsed }))} style={css("width:100%; display:flex; align-items:center; justify-content:space-between; padding:9px 13px; background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif;")}>
                        <span style={css("display:inline-flex; align-items:center; gap:7px; font-size:9.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#c4b5fd;")}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                          AI Tasks
                          <span style={css("font-size:8.5px; font-weight:600; color:rgba(255,255,255,0.4);")}>{chips.length}</span>
                        </span>
                        <span style={css("display:inline-flex; align-items:center; color:rgba(255,255,255,0.4);")}><ChevronDown size={13} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }} /></span>
                      </button>
                      {!collapsed && (
                        <div style={css("display:flex; flex-direction:column; gap:4px; padding:0 10px 9px; max-height:180px; overflow-y:auto;")}>
                          {chips.map((chip, i) => {
                            const isActive = this.state.taskAiSource === chip.template_key;
                            const label = (typeof chip.template.label === 'string' && chip.template.label.trim()) ? chip.template.label : (chip.template.title_template || chip.template_key);
                            return (
                              <button
                                key={chip.template_key + '-' + i}
                                onClick={() => this.pickSuggestedTask(chip)}
                                title={chip.reason || label}
                                style={css(
                                  "display:flex; flex-direction:column; align-items:flex-start; gap:1px; text-align:left; width:100%; padding:6px 9px; border-radius:8px; cursor:pointer; font-family:'Inter',sans-serif; "+
                                  "background:"+(isActive ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.06)")+"; "+
                                  "border:1px solid "+(isActive ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.22)")+";"
                                )}
                              >
                                <span style={css("font-size:11px; font-weight:600; color:"+(isActive ? "#ddd6fe" : "rgba(255,255,255,0.85)")+";")}>{label}</span>
                                {chip.reason && (
                                  <span style={css("font-size:9.5px; line-height:1.3; color:rgba(255,255,255,0.5);")}>{chip.reason}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              {vm.aiEmpty && (
                <div style={css("flex:none; margin:0 16px 6px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); padding:8px 13px; display:flex; align-items:center; gap:6px;")}>
                  <div style={css("display:inline-block; width:11px; height:11px; border:2px solid hsl(38 92% 50% / 0.25); border-top-color:hsl(38 92% 55%); border-radius:50%; animation: ld-spin 0.8s linear infinite;")}></div>
                  <span style={css("font-size:10px; color:rgba(255,255,255,0.55);")}>Analysing…</span>
                </div>
              )}
              {vm.analyzeError && (
                <div style={css("flex:none; margin:0 16px 6px; padding:5px 12px; border-radius:8px; font-size:10px; color:#f87171; background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.5);")}>
                  {vm.analyzeError}
                </div>
              )}

              <LandlordTabBar
                activeTab={this.state.composerType}
                onSelect={(t) => this.setComposerType(t)}
              />

              {/* unified stream — each tab renders only its own data */}
              {this.state.composerType === 'Appointment' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:2px 16px 8px;")}>
                  <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;")}>
                    <GoogleWorkspaceConnectBanner variant="compact" hideWhenConnected />
                    <button onClick={() => this.setState({ appointmentBookingOpen: true })} title="Book appointment with full options"
                      style={css("flex:none; display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:9px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5);")}>
                      ＋ Book appointment
                    </button>
                  </div>
                  <AppointmentFeed landlordId={L.id} />
                </div>
              ) : this.state.composerType === 'Documents' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
                  <DocumentsTab docs={L.documents || []} landlordName={L.full_name_en || L.full_name || 'Landlord'} />
                  <DocumentUploader landlordId={this.state.currentId} landlordName={L.name} onUploadFormA={this.props.onUploadFormA} />
                </div>
              ) : this.state.composerType === 'Calls' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
                  <CallsTabList calls={L.calls || []} />
                </div>
              ) : this.state.composerType === 'Activity' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
                  <AllActivityTab items={L.stream.map((s, i) => ({ ...s, key: i }))} landlordId={L.id} landlordName={L.full_name_en || L.full_name} onReplyGenerated={(t)=>this.setState({composerText:t})} />
                </div>
              ) : this.state.composerType === 'Email' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
                  <EmailList
                    emptyLabel="No email activity yet"
                    items={tabStream.filter(s => s.isMsg).map((s, i) => ({
                      key: 'email-' + i,
                      subject: s.subject || '',
                      sender: s.sender,
                      time: s.time,
                      body: s.emailBody || s.text || '',
                    }))}
                  />
                </div>
              ) : this.state.composerType === 'Note' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
                  <HubSpotActivityList
                    emptyLabel="No notes yet"
                    items={tabStream.filter(s => s.isAct && s._kind === 'note').map((s, i) => ({
                      key: 'note-' + i,
                      icon: s.actIcon,
                      iconBg: 'rgba(139,92,246,0.15)',
                      iconColor: '#c4b5fd',
                      title: s.actTitle,
                      subtitle: s._author ? 'by ' + s._author : null,
                      time: s.time,
                      body: s.actBody,
                    }))}
                  />
                </div>
              ) : this.state.composerType === 'Follow-up' ? (
                <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
                  <HubSpotActivityList
                    emptyLabel="No follow-up activity yet"
                    items={tabStream.filter(s => s.isAct && s._kind === 'followup').map((s, i) => ({
                      key: 'fu-' + i,
                      icon: s.actIcon,
                      iconBg: 'rgba(52,211,153,0.15)',
                      iconColor: '#34d399',
                      title: s.actTitle,
                      subtitle: s._author ? 'by ' + s._author : null,
                      time: s.time,
                      body: s.actBody,
                    }))}
                  />
                </div>
              ) : (
                <div className="ld-scroll" ref={this.streamRef} style={css("flex:1; min-height:0; overflow-y:auto; padding:2px 16px 8px; display:flex; flex-direction:column; gap:8px;")}>
                {tabStream.length === 0 && (
                  <div style={css("display:flex; align-items:center; justify-content:center; flex:1; color:rgba(255,255,255,0.35); font-size:13px; padding:40px 0;")}>
                    No {this.state.composerType} activity yet
                  </div>
                )}
                {tabStream.map((s)=> s.isMsg ? (
                  <div key={s.key} style={s.rowStyle}>
                    <div style={s.bubbleStyle}>
                      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:5px;")}>
                        <span style={s.senderStyle}>{s.sender}</span>
                        <span style={s.channelStyle}>{s.channel}</span>
                      </div>

                      {s.isText && (
                        <div style={css("font-size:14px; line-height:1.5; color:rgba(255,255,255,0.9);")}>{s.text}</div>
                      )}

                      {s.isVoice && (
                        <React.Fragment>
                          <div style={css("display:flex; align-items:center; gap:9px; margin-bottom:8px;")}>
                            <span style={css("flex:none; width:28px; height:28px; border-radius:50%; background:hsl(38 92% 50% / 0.2); display:flex; align-items:center; justify-content:center; color:hsl(38 92% 60%);")}>▶</span>
                            <span style={css("display:flex; align-items:center; gap:2px; height:20px;")}>{s.waveform}</span>
                            <span style={css("font-size:10.5px; color:rgba(255,255,255,0.45);")}>{s.duration}</span>
                          </div>
                          <div style={css("display:inline-block; font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Transcript · {s.transcriptLang}</div>
                          <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{s.transcript}</div>
                          <div style={css("margin-top:7px; padding-top:7px; border-top:1px dashed rgba(255,255,255,0.14);")}>
                            <span style={css("display:inline-block; font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:hsl(38 92% 58%); margin-bottom:3px;")}>EN translation · Whisper</span>
                            <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.7); font-style:italic;")}>{s.translation}</div>
                          </div>
                        </React.Fragment>
                      )}

                      {s.isMedia && (
                        <React.Fragment>
                          {s.mediaUrl ? (
                            <a href={s.mediaUrl} target="_blank" rel="noopener noreferrer" style={css("display:block; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.12); margin-bottom:6px;")}>
                              <img src={s.mediaUrl} alt={s.mediaLabel||'media'} loading="lazy" style={css("display:block; max-width:100%; max-height:240px; object-fit:cover;")} />
                            </a>
                          ) : null}
                          {s.text ? <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{s.text}</div> : null}
                        </React.Fragment>
                      )}

                      <div style={s.timeStyle}>{s.time}</div>
                    </div>
                  </div>
                ) : (
                  <div key={s.key} style={css("display:flex; align-items:flex-start; gap:11px; padding:2px 4px;")}>
                    <span style={s.actIconStyle}>{s.actIcon}</span>
                    <div style={css("flex:1; min-width:0; border-radius:11px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); padding:10px 12px;")}>
                      <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px;")}>
                        <span style={s.actLabelStyle}>{s.actTitle}</span>
                        <span style={css("flex:none; font-size:10.5px; color:rgba(255,255,255,0.38);")}>{s.time}</span>
                      </div>
                      <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.72); margin-top:4px;")}>{s.actBody}</div>
                      {s._author && <div style={css("font-size:10px; color:rgba(255,255,255,0.4); margin-top:3px;")}>by {s._author}</div>}
                    </div>
                  </div>
                ))}
                </div>
              )}

              {/* AI Suggested Tasks moved to right panel */}

              {/* composer */}
              <div style={{ ...css("flex:none; border-top:1px solid rgba(255,255,255,0.08); padding:10px 16px 12px; background:rgba(255,255,255,0.02);"), position: 'relative', overflow: 'hidden' }}>
                {this.state.telegramJustSent && <SendFlash color="#29b6f6" label="Sent!" glyph="✈" />}
                {this.state.composerDraft && (
                  <ComposerConfirmChip
                    type={this.state.composerDraft.type}
                    draft={this.state.composerDraft.draft}
                    confirmLabel={this.state.composerDraft.confirm_label}
                    committing={this.state.composerCommitting}
                    onChange={this.updateComposerDraft}
                    onConfirm={this.confirmComposerDraft}
                    onCancel={this.cancelComposerDraft}
                  />
                )}
                {vm.composerHasTime && (
                  <div style={css("display:inline-flex; align-items:center; gap:6px; margin-bottom:6px; padding:3px 9px; border-radius:99px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); font-size:10px; font-weight:600; color:hsl(38 92% 60%);")}>
                    ⏰ Suggested: {vm.composerTime} <span onClick={this.onClearTime} style={css("cursor:pointer; opacity:0.6;")}>✕</span>
                  </div>
                )}
                {/* Tab navigation moved to top — see LandlordTabBar */}

                {/* AI draft control — only for Notes. Call/Conversation pills generate a fresh
                    draft on demand from the latest call qualification or WhatsApp conversation;
                    Summary/Coaching/Next Action pull from the landlord-level Analyse fields. */}
                {this.state.composerType === 'Note' && (
                  <NoteAiDraftBar
                    landlord={L}
                    noteAiSource={this.state.noteAiSource}
                    noteGenerating={this.state.noteGenerating}
                    onPick={(text, key) => this.pickNoteDraft(text, key)}
                    onGenerate={(src) => this.generateNoteDraft(src)}
                    onClear={this.clearNoteDraft}
                  />
                )}

                {/* AI draft control + extra fields — only for Tasks. Drafts the title from
                    ai_next_best_action; due_date + assignee are editable below. */}
                {this.state.composerType === 'Task' && (()=>{
                  const src = this.taskDraftSource();
                  const taskAiSource = this.state.taskAiSource;
                  const active = taskAiSource === 'ai_next_best_action';
                  const fieldStyle = css("padding:4px 7px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:10.5px; font-family:'Inter',sans-serif;");
                  return (
                    <div style={css("margin-bottom:7px;")}>
                      {/* AI Suggested Tasks moved to standalone collapsible below the conversation stream */}
                      <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:8px;")}>
                        <span style={css("display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#c4b5fd;")}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                          AI draft
                        </span>
                        <button
                          onClick={()=> src.available && this.pickTaskDraft()}
                          disabled={!src.available}
                          title={src.available ? 'Draft this task from the next best action' : src.emptyMsg}
                          style={css(
                            "display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:600; font-family:'Inter',sans-serif; "+
                            (src.available ? "cursor:pointer; " : "cursor:not-allowed; opacity:0.4; ")+
                            "background:"+(active ? "rgba(139,92,246,0.22)" : "rgba(139,92,246,0.06)")+"; "+
                            "color:"+(active ? "#ddd6fe" : "#c4b5fd")+"; "+
                            "border:1px solid "+(active ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.25)")+";"
                          )}
                        >
                          Next Action{!src.available && <span style={css("font-size:9px; font-weight:600; opacity:0.85;")}>· run Analyse</span>}
                        </button>
                        {taskAiSource && (
                          <button onClick={this.clearTaskDraft} title="Clear AI draft — write from scratch" style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 9px; border-radius:8px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.55);")}>✕ Clear</button>
                        )}
                        {taskAiSource && (
                          <span style={css("font-size:10px; color:rgba(255,255,255,0.4);")}>Drafted from AI · title edits tracked</span>
                        )}
                        {!taskAiSource && !src.available && (
                          <span style={css("font-size:10px; color:rgba(255,255,255,0.4);")}>No AI draft yet — run Analyse</span>
                        )}
                      </div>
                      <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
                        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
                          Due
                          <input type="date" value={this.state.taskDueDate} onChange={(e)=>this.setState({ taskDueDate:e.target.value })} style={fieldStyle} />
                        </label>
                        <label style={css("display:inline-flex; align-items:center; gap:4px; flex:1; min-width:160px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
                          Assignee
                          <input type="email" value={this.state.taskAssignee} onChange={(e)=>this.setState({ taskAssignee:e.target.value })} placeholder="assignee@email" style={{...fieldStyle, flex:1, minWidth:0}} />
                        </label>
                      </div>
                    </div>
                  );
                })()}

                {/* AI Suggested Follow-ups + scheduling fields — only for the Follow-up composer.
                    Chips pre-fill notes/channel/date/hour; sending creates a LandlordAppointment
                    (no Google Calendar — Phase 3). Graceful empty-state: no chips, no crash. */}
                {this.state.composerType === 'Follow-up' && (
                  <FollowupComposerFields
                    chips={this.suggestedFollowupChips()}
                    followupAiSource={this.state.followupAiSource}
                    collapsed={this.state.aiFollowupsCollapsed}
                    onToggleCollapsed={() => this.setState(s => ({ aiFollowupsCollapsed: !s.aiFollowupsCollapsed }))}
                    onPickChip={this.pickSuggestedFollowup}
                    channel={this.state.followupChannel}
                    date={this.state.followupDate}
                    hour={this.state.followupHour}
                    minute={this.state.followupMinute}
                    ampm={this.state.followupAmPm}
                    creatorName={(this.props.currentUser?.full_name) || (this.props.currentUser?.email) || 'You'}
                    onChannel={(v) => this.setState({ followupChannel: v })}
                    onDate={(v) => this.setState({ followupDate: v })}
                    onHour={(v) => this.setState({ followupHour: Number(v) })}
                    onMinute={(v) => this.setState({ followupMinute: v })}
                    onAmPm={(v) => this.setState({ followupAmPm: v })}
                    onClearDraft={this.clearFollowupDraft}
                    assignee={this.state.followupAssignee}
                    onAssignee={(v) => this.setState({ followupAssignee: v })}
                  />
                )}

                {this.state.composerType === 'Email' && (
                  <EmailComposer
                    landlordId={L.id}
                    toEmail={L.email}
                    allEmails={Array.isArray(this.props.rawLandlord?.additional_emails) ? this.props.rawLandlord.additional_emails : (Array.isArray(L.additionalEmails) ? L.additionalEmails : [])}
                    onLogged={({ subject, body })=>{
                      tickOutreachStep('email_sent', L).then(()=> this.props.onOutreachChanged && this.props.onOutreachChanged()); // auto-tick today's outreach sequence
                      const order = Date.now();
                      const me = (this.props.currentUser?.full_name) || (this.props.currentUser?.email) || (L.agent || 'Agent');
                      const item = { t:'msg', dir:'out', mtype:'text', channel:'email', subject: subject || '', emailBody: body || '', text: (subject ? subject + '\n' : '') + (body || ''), time:'Just now', order, senderName: me };
                      this.setState(s=>({ landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l) }), ()=>this.scrollBottom());
                    }}
                  />
                )}
                {this.state.composerType === 'Appointment' && (
                  <AppointmentComposer
                    landlordId={L.id}
                    propertyId={L.unit && L.unit.propertyId}
                    agentEmail={L.agentEmail}
                    onBooked={({ when, type })=>{
                      const order = Date.now();
                      const item = { t:'act', kind:'appointment', title:'Appointment booked · ' + (type || 'meeting'), body: when, time:'Just now', order };
                      this.setState(s=>({ landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l) }), ()=>this.scrollBottom());
                    }}
                  />
                )}
                {this.state.composerType === 'iMessage' && (
                  <IMessageComposer
                    landlordId={L.id}
                    imessageStatus={this.props.rawLandlord?.imessage_status || L.imessageStatus || 'unknown'}
                    imessageHandles={this.props.rawLandlord?.imessage_handles || L.imessageHandles || L.imessage_handles || []}
                    onSent={({ text })=>{
                      tickOutreachStep('imessage_sent', L).then(()=> this.props.onOutreachChanged && this.props.onOutreachChanged()); // auto-tick today's outreach sequence
                      const order = Date.now();
                      const item = { t:'msg', dir:'out', mtype:'text', channel:'imessage', text, time:'Just now', order };
                      this.setState(s=>({ landlords: s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l) }), ()=>this.scrollBottom());
                    }}
                    onFallback={(text)=>{ this.setState({ composerType:'Chat', composerText:text }); }}
                  />
                )}
                {(() => {
                  const ct = this.state.composerType;
                  const isChatTab = ct === 'Chat' || ct === 'Telegram' || ct === 'SMS' || ct === 'Activity';
                  if (!isChatTab) return null;
                  const tplChannel = ct === 'Chat' || ct === 'Activity' ? 'whatsapp' : ct === 'Telegram' ? 'telegram' : 'sms';
                  const sending = ct === 'Chat' || ct === 'Activity' ? this.state.chatSending : ct === 'Telegram' ? this.state.telegramSending : false;
                  const waDisabled = (ct === 'Chat' || ct === 'Activity') && (!this.props.currentUser?.whatsapp_instance && this.props.currentUser?.role !== 'admin');
                  const tgDisabled = ct === 'Telegram' && !(this.props.rawLandlord?.telegram_chat_id);
                  const channelDisabled = waDisabled || tgDisabled;
                  const disabledHint = waDisabled ? 'Configure your WhatsApp line in Profile' : tgDisabled ? 'No Telegram chat — the landlord must message the bot first' : '';
                  return (
                    <UnifiedChatComposer
                      composerType={ct}
                      text={vm.composerText}
                      onTextChange={this.onComposerInput}
                      onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if((this.state.composerText||'').trim()) this.onSend(); } }}
                      onSend={this.onSend}
                      sending={sending}
                      parsing={this.state.composerParsing}
                      placeholder={vm.composerPlaceholder}
                      tplChannel={tplChannel}
                      onPickTemplate={(body)=> this.setState({ composerText: body, messageAiSource: null, messageAiDraft: null })}
                      onSaveTemplate={()=> this.setState({
                        saveTemplateOpen: true,
                        saveTemplatePrefill: { title: '', subject: '', body: this.state.composerText },
                        saveTemplateChannel: tplChannel,
                      })}
                      aiSuggestedMessages={ct === 'Chat' ? L.aiSuggestedMessages : []}
                      onPickSuggested={(text)=> this.setState({ composerText: text, messageAiSource: 'landlordOrchestrator.ai_suggested_messages', messageAiDraft: text })}
                      attachment={this.state.composerAttachment}
                      onAttachmentChange={(a)=> this.setState({ composerAttachment: a })}
                      chatTemplatesOpen={this.state.chatTemplatesOpen}
                      onToggleChatTemplates={()=> this.setState(s=>({ chatTemplatesOpen: !s.chatTemplatesOpen }))}
                      landlordId={L.id}
                      phone={L.phone}
                      streamFilter={this.state.streamFilter}
                      channelDisabled={channelDisabled}
                      disabledHint={disabledHint}
                    />
                  );
                })()}
                {this.state.composerType !== 'Email' && this.state.composerType !== 'iMessage' && this.state.composerType !== 'Appointment' && this.state.composerType !== 'Documents' && this.state.composerType !== 'Calls' && this.state.composerType !== 'Chat' && this.state.composerType !== 'Telegram' && this.state.composerType !== 'SMS' && this.state.composerType !== 'Activity' && (
                <div style={css("display:flex; align-items:flex-end; gap:7px;")}>
                  <textarea ref={this.composerRef} value={vm.composerText} onChange={this.onComposerInput} onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if((this.state.composerText||'').trim()) this.onSend(); } }} placeholder={vm.composerPlaceholder} rows={2} style={css("flex:1; resize:none; min-height:44px; max-height:140px; padding:9px 12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12.5px; font-family:'Inter',sans-serif; line-height:1.4; overflow-y:auto;")}></textarea>
                  {(()=>{ const busy = this.state.composerParsing||this.state.noteSaving||this.state.taskSaving||this.state.followupSaving||this.state.chatSending||this.state.imessageSending||this.state.telegramSending; return (
                  <button onClick={this.onSend} disabled={busy} title={this.state.composerParsing ? 'Parsing…' : 'Send'} style={css("flex:none; width:38px; height:38px; border-radius:10px; border:1px solid hsl(38 92% 50% / 0.5); background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:"+(busy?0.6:1)+";")}>{this.state.composerParsing ? '✦' : busy ? '…' : '➤'}</button>
                  ); })()}
                </div>
                )}
              </div>
            </div>

            {/* IDENTITY SIDEBAR (left-side visually via order:1) */}
            <div className="ld-panel ld-scroll" style={css("flex:0 0 35%; min-width:0; height:100%; min-height:0; overflow-y:auto; padding:18px 22px 28px; order:1; border-right:1px solid rgba(255,255,255,0.07);")}>

              {/* header — four-tier identity card (reads the raw Landlord record) */}
              <LandlordIdentityHeader
                landlord={this.props.rawLandlord}
                unit={this.props.rawProperty}
                landlordId={this.state.currentId}
                imessageChecking={this.state.imessageChecking}
                onCheckIMessage={this.checkIMessage}
              />

              <AIIntelligenceCard
                ai={ai}
                analyzing={this.state.analyzing}
                onReanalyse={this.onAnalyse}
                collapsed={this.state.aiIntelligenceCollapsed}
                onToggle={this.onToggleAIIntelligence}
              >
                <ContactEvaluation valuation={vm.valuation} comps={vm.market?.comps} askingPrice={fmtAED(this.props.rawLandlord?.asking_price_aed)} propertyName={(this.props.rawLandlord?.project_name || this.props.rawProperty?.building_name) ? (this.props.rawLandlord?.project_name || this.props.rawProperty?.building_name) : null} />
              </AIIntelligenceCard>

              <LandlordMockTabs
                landlordId={this.state.currentId}
                landlord={this.props.rawLandlord}
                outreachData={vm.outreachVM}
                onToggleOutreachStep={this.onToggleOutreachStep}
                outreachToggling={this._outreachToggling}
                qualifyRows={vm.qualifyRows}
                unitRows={vm.unitRows}
                negotiationData={vm.negotiationVM}
                infoRows={vm.infoRows}
                stage={stage}
                currentStageKey={L.stage}
                pendingStage={this.state.pendingStage}
                onPendingStageChange={(v)=> this.setState({ pendingStage: v })}
                stageSaving={this.state.stageSaving}
                stageSaved={this.state.stageSaved}
                onSaveStage={this.onStageChange}
                stages={this.STAGES}
                stageKeys={this.STAGE_KEYS}
                commissionPct={L.commission_pct_negotiated}
                askingPriceAed={L.asking_price_aed}
                formAContractsCount={this.formAContracts.length}
                onNavigate={this.onNavigate}
                infoExtrasProps={{
                  connections: vm.connections,
                  showSignals: vm.showSignals,
                  scorecards: vm.scorecards,
                  signals,
                  flagChips: vm.flagChips,
                  buyChips: vm.buyChips,
                  hasFlags: vm.hasFlags,
                  summaryText: vm.summaryText,
                  valuation: vm.valuation,
                  market,
                  askingPrice: fmtAED(this.props.rawLandlord?.asking_price_aed),
                  propertyName: (this.props.rawLandlord?.project_name || this.props.rawProperty?.building_name) ? (this.props.rawLandlord?.project_name || this.props.rawProperty?.building_name) : null,
                }}
              />

              <ListingManagerStrip 
                listingManagerEmail={L.listingManagerEmail}
                assignedAgentEmail={L.agentEmail}
                phone={L.phone}
                whatsapp={L.whatsapp}
              />
              <CallQualificationTab landlord={this.props.landlords?.[0] || L} />

              <MediaPanel media={vm.media} />

              {vm.mandate && <MandateDrawer mandate={vm.mandate} />}

            </div>
          </div>

          {/* Unified template dialog — shared by Chat (WhatsApp) & Telegram composers */}
          <EmailTemplateDialog
            open={this.state.saveTemplateOpen}
            onClose={() => this.setState({ saveTemplateOpen: false, saveTemplatePrefill: null })}
            template={this.state.saveTemplatePrefill ? { ...this.state.saveTemplatePrefill, category: 'general', visibility: 'private' } : null}
            channel={this.state.saveTemplateChannel}
            onSaved={() => toast.success('Template saved')}
          />
          {/* HubSpot-style booking dialog — opened from the Appointments tab */}
          <AppointmentBookingDialog open={this.state.appointmentBookingOpen} onOpenChange={(v) => this.setState({ appointmentBookingOpen: v })} prefillLandlordId={L.id} prefillGuestEmail={L.email} prefillTitle={(L.full_name_en || L.full_name) ? `${L.full_name_en || L.full_name} — meeting` : ''} onBooked={() => { this.setState({ appointmentBookingOpen: false }); if (this.props.onAnalysed) this.props.onAnalysed(); }} />
        </div>
      </React.Fragment>
    );
  }
}

/* Stage keys in pipeline order — mirrors Landlords.jsx STAGES (17 stages). */
const STAGE_KEYS = [
  'initial_contact','attempted_to_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing',
  'owner_documents','photos_videos','photographer_scheduling','listing_creation','internal_verification',
  'listing_publication','final_confirmation','marketing_agents','marketing_network','open_house',
  'client_blast','deal_closed',
];

/* ---- small helpers ---- */
const initialsOf = (name) => String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
const fmtAED = (n) => {
if (n == null || isNaN(n)) return '—';
if (n >= 1_000_000) return 'AED ' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
if (n >= 1_000) return 'AED ' + Math.round(n / 1_000) + 'K';
return 'AED ' + n;
};
const fmtPSF = (n) => {
if (n == null || isNaN(n)) return '';
return 'AED ' + Math.round(n).toLocaleString() + '/sqft';
};
const fmtStamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};
const tsOf = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
/* Run a queryFn that may reference an entity that doesn't exist yet — never throw. */
const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };
const latest = (arr, dateKey) => {
  if (!arr || !arr.length) return null;
  return [...arr].sort((a, b) => tsOf(b[dateKey] || b.created_date) - tsOf(a[dateKey] || a.created_date))[0];
};

// Full stage enum from Landlord entity schema (17 values)
const PIPELINE_STAGES = [
  'initial_contact','attempted_to_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing',
  'owner_documents','photos_videos','photographer_scheduling','listing_creation','internal_verification',
  'listing_publication','final_confirmation','marketing_agents','marketing_network','open_house',
  'client_blast','deal_closed',
];

function temperatureFromRapport(rapport) {
  if (rapport === 'champion' || rapport === 'trust_established') return 'hot';
  if (rapport === 'warming' || rapport === 'rapport_built') return 'warm';
  return 'cold';
}

export default function LandlordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [formAOpen, setFormAOpen] = useState(false);
  const [formADialogOpen, setFormADialogOpen] = useState(false);
  const [listingManagerDialogOpen, setListingManagerDialogOpen] = useState(false);
  const [openMediaDrawers, setOpenMediaDrawers] = useState(new Set());
  const [openOwnerDrawers, setOpenOwnerDrawers] = useState(new Set());
  const [mediaInputs, setMediaInputs] = useState({});

  const { data: L, isLoading, refetch: refetchLandlord } = useQ(['landlord', id], () => base44.entities.Landlord.get(id), { enabled: !!id });

  // After any change that mutates this landlord (stage move, analysis, appointment),
  // refresh both this page's record AND the Landlords list cache so the pipeline
  // reflects the new stage when the agent navigates back.
  const handleAnalysed = async () => {
    await refetchLandlord();
    queryClient.invalidateQueries({ queryKey: ['landlords'] });
  };
  // Today's outreach checklist — the REAL sequence state shown in the Outreach tab. Auto-ticked by
  // the composer success handlers (tickOutreachStep) and by Call/Qualification entity automations.
  const OUTREACH_TODAY = new Date().toISOString().slice(0, 10);
  // Load ALL of this landlord's outreach rows (newest first). The Outreach tab shows today's row
  // if it exists, otherwise the most recent prior row — so existing progress is never hidden behind
  // the date filter. Toggles always target today's row (create/update) via tickOutreachStep.
  const { data: outreachAll = [], refetch: refetchOutreach } = useQ(['outreach_checklist', id], () => safe(() => base44.entities.OutreachChecklist.filter({ landlord_id: id }, '-outreach_date', 30)), { enabled: !!id, refetchInterval: 15000 });
  const outreachRows = (() => {
    const todays = outreachAll.find(r => r.outreach_date === OUTREACH_TODAY);
    return todays ? [todays] : (outreachAll[0] ? [outreachAll[0]] : []);
  })();
  const { data: landlordProperties = [] } = useQ(['landlord_properties', id], () => safe(() => base44.entities.LandlordProperty.filter({ landlord_id: id }, '-created_date', 10)), { enabled: !!id });
  const lp = landlordProperties[0] || {};
  const { data: prop = {} } = useQ(['property', lp.property_id], () => base44.entities.Property.get(lp.property_id), { enabled: !!lp.property_id });
  // Fetch MarketTransaction comparables for the building/community
  const { data: marketComps = [] } = useQ(['market_comps', prop?.building_name || prop?.location], () => safe(() => {
    const query = prop?.building_name ? { project_name: prop.building_name } : prop?.location ? { project_name: prop.location } : {};
    return base44.entities.MarketTransaction.filter(query, '-transaction_date', 10);
  }), { enabled: !!(prop?.building_name || prop?.location) });
  // Fetch DocumentChecklistItem records for this landlord
  const { data: docItems = [] } = useQ(['landlord_docs', id], () => safe(() => base44.entities.DocumentChecklistItem.filter({ landlord_id: id }, '-created_date', 50)), { enabled: !!id });
  // V3 Phase 2 (REMEMBER): append-only score history written by the orchestrator (P0). Read-only
  // here — turns the otherwise-invisible LandlordScoreSnapshot rows into a visible trajectory so the
  // agent can see whether trust/win/urgency are climbing or decaying run-over-run. Newest first.
  const { data: scoreSnapshots = [] } = useQ(['landlord_snapshots', id], () => safe(() => base44.entities.LandlordScoreSnapshot.filter({ landlord_id: id }, '-captured_at', 30)), { enabled: !!id });
  // TaskTemplate library (active only) — powers the AI suggested-tasks shortlist; loaded once.
  const { data: taskTemplates = [] } = useQ(['task_templates'], () => safe(() => base44.entities.TaskTemplate.filter({ is_active: true })));
  // FollowupTemplate library (active only) — powers the AI suggested-follow-ups shortlist; loaded once.
  const { data: followupTemplates = [] } = useQ(['followup_templates'], () => safe(() => base44.entities.FollowupTemplate.filter({ is_active: true })));
  // Photography tasks for this landlord — used to resolve a photographer email for
  // routes_to=photographer suggestions (first task with an assigned photographer; blank if none).
  const { data: landlordPhotographyTasks = [] } = useQ(['landlord_photography_tasks', id], () => safe(() => base44.entities.PhotographyTask.filter({ landlord_id: id }, '-created_date', 5)), { enabled: !!id });

  // All CRM users — used to resolve sender emails to real names (not the assigned agent).
  const { data: allUsers = [] } = useQ(['all_users_for_names'], () => safe(() => base44.entities.User.list()));
  const resolveUserName = (email) => {
    if (!email) return null;
    const u = allUsers.find(u => u.email === email);
    return u?.full_name || email.split('@')[0];
  };

  // Connected Systems — live existence checks (read-only)
  const phone = L?.phone;
  const { data: waBusiness = [] } = useQ(['wa_conv_business', phone], () => safe(() => base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phone, channel: 'business' }, '-created_date', 5)), { enabled: !!phone });
  const { data: waPersonal = [] } = useQ(['wa_conv_personal', phone], () => safe(() => base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phone, channel: 'personal' }, '-created_date', 5)), { enabled: !!phone });
  const { data: waMessages = [] } = useQ(['wa_messages', id], () => safe(() => base44.entities.WhatsAppMessage.filter({ landlord_id: id }, '-created_date', 200)), { enabled: !!id });
  const { data: aircallCalls = [] } = useQ(['aircall_calls', id], () => safe(() => base44.entities.AircallCall.filter({ landlord_id: id }, '-started_at', 50)), { enabled: !!id });
  // VAPI + Aircall calls also matched by phone (AircallCall rows often carry no landlord_id) — this is
  // what surfaces VAPI recordings for a number even when the link wasn't stamped. Trigger a VAPI sync
  // first so freshly-placed calls + recordings land before we read them.
  useQ(['vapi_sync_landlord'], () => base44.functions.invoke('syncVapiCalls', {}).catch(() => ({})), { staleTime: 120000 });
  const { data: aircallByPhone = [] } = useQ(['aircall_calls_phone', phone], async () => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 9) return [];
    const suffix = digits.slice(-9);
    const all = await safe(() => base44.entities.AircallCall.list('-started_at', 2000));
    return all.filter(c => {
      const to = String(c.to_number || '').replace(/\D/g, '');
      const from = String(c.from_number || '').replace(/\D/g, '');
      return to.endsWith(suffix) || from.endsWith(suffix);
    });
  }, { enabled: !!phone });
  // Twilio CallLog — match by phone (to_number OR from_number), same proven pattern as wa_stream_msgs.
  // Records have landlord_id: null; the real link sits in lead_id or nowhere. Phone-matching
  // catches BOTH records in each queued+webhook pair regardless of which carries the link.
  const { data: twilioLogs = [] } = useQ(['twilio_logs', phone], async () => {
    const variants = phoneVariants(phone);
    if (!variants.length) return [];
    // Fan the to_number/from_number lookups across all variants out CONCURRENTLY (was a serial
    // await-loop = up to 4 round-trips back-to-back). dedupeById preserves the same first-seen order.
    const batches = await Promise.all(variants.flatMap(v => [
      safe(() => base44.entities.CallLog.filter({ to_number: v }, '-started_at', 100)),
      safe(() => base44.entities.CallLog.filter({ from_number: v }, '-started_at', 100)),
    ]));
    return dedupeById(batches);
  }, { enabled: !!phone, refetchInterval: 60000, refetchOnWindowFocus: false });

  // Emails for the stream — query + realtime subscription live in src/lib/useLandlordEmails.js.
  // Pass ALL the landlord's addresses (primary + additional) so emails sent to any of them
  // by any agent in the org show up in the shared history.
  const landlordEmail = L?.email;
  const allLandlordEmails = [L?.email, ...(Array.isArray(L?.additional_emails) ? L.additional_emails : [])].filter(Boolean);
  const { data: emailMessages = [] } = useLandlordEmails(allLandlordEmails, id);

  // iMessages for the stream — sent/received via BlueBubbles, matched by landlord_id
  const { data: iMessages = [] } = useQ(['imessages', id], () => safe(() => base44.entities.IMessage.filter({ landlord_id: id }, '-sent_at', 200)), { enabled: !!id, refetchInterval: 5000, refetchOnWindowFocus: true });

  // Telegram messages for the stream — sent/received via the Telegram Bot API, matched by landlord_id
  const { data: telegramMessages = [] } = useQ(['telegram_messages', id], () => safe(() => base44.entities.TelegramMessage.filter({ landlord_id: id }, '-sent_at', 200)), { enabled: !!id, refetchInterval: 5000, refetchOnWindowFocus: true });

  // LandlordNote records — historical notes with author + timestamp for the Notes tab.
  const { data: notes = [] } = useQ(['landlord_notes', id], () => safe(() => base44.entities.LandlordNote.filter({ landlord_id: id }, '-created_date', 100)), { enabled: !!id });
  // LandlordTask records — historical tasks with assignee + due date for the Tasks tab.
  const { data: tasks = [] } = useQ(['landlord_tasks', id], () => safe(() => base44.entities.LandlordTask.filter({ landlord_id: id }, '-created_date', 100)), { enabled: !!id });
  // LandlordAppointment records — historical follow-ups with channel + datetime for the Follow-up tab.
  const { data: followups = [] } = useQ(['landlord_followups', id], () => safe(() => base44.entities.LandlordAppointment.filter({ landlord_id: id }, '-datetime', 100)), { enabled: !!id });

  // WhatsApp messages for the stream — match by phone (to_number OR from_number), trying +/- variants
  const { data: waStreamMessages = [] } = useQ(['wa_stream_msgs', phone], async () => {
    const variants = phoneVariants(phone);
    if (!variants.length) return [];
    // from_number/to_number across all variants CONCURRENTLY (was a serial await-loop). Keep the
    // from-before-to order per variant so dedupeById's first-seen result matches the old behaviour.
    const batches = await Promise.all(variants.flatMap(v => [
      safe(() => base44.entities.WhatsAppMessage.filter({ from_number: v }, 'timestamp', 100)),
      safe(() => base44.entities.WhatsAppMessage.filter({ to_number: v }, 'timestamp', 100)),
    ]));
    return dedupeById(batches);
  }, { enabled: !!phone, refetchInterval: 60000, refetchOnWindowFocus: false });

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(222 47% 6%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 12px', borderRadius: '50%', border: '3px solid rgba(245,158,11,0.3)', borderTopColor: 'hsl(38 92% 55%)', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>Loading landlord…</p>
        </div>
      </div>
    );
  }

  const handleFormASuccess = () => {
    refetchLandlord();
    setFormADialogOpen(false);
  };

  const handleListingManagerSuccess = () => {
    refetchLandlord();
    setListingManagerDialogOpen(false);
  };

  const toggleMediaDrawer = (key) => {
    setOpenMediaDrawers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleOwnerDrawer = (key) => {
    setOpenOwnerDrawers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleMediaUpdate = async (field, value) => {
    try {
      await base44.entities.Landlord.update(id, { [field]: value });
      refetchLandlord();
    } catch (err) {
      console.error('Failed to update media field:', err);
    }
  };

  const handleAddMediaUrl = (field) => {
    const url = mediaInputs[field]?.trim();
    if (url) {
      handleMediaUpdate(field, url);
      setMediaInputs(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRemoveMediaUrl = (field) => {
    handleMediaUpdate(field, null);
  };

  if (!L) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(222 47% 6%)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: 12 }}>Landlord not found.</p>
          <button onClick={() => navigate('/landlords')} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid hsl(38 92% 50% / 0.5)', background: 'hsl(38 92% 50% / 0.14)', color: 'hsl(38 92% 62%)', cursor: 'pointer', fontWeight: 600 }}>Back to Landlords</button>
        </div>
      </div>
    );
  }

  const rapport = L.rapport_level || 'cold';
  const stageIdx = L.stage ? (PIPELINE_STAGES.indexOf(L.stage) + 1) : 1;
  const agentEmail = L.assigned_agent_email || '';
  const agentName = agentEmail ? agentEmail.split('@')[0] : 'Unassigned';

  // Build the Conversation & Activity stream from live WhatsApp messages + call logs
  const deriveWaChannel = (msg) => {
    // Check explicit channel field first (most reliable — set by sendWhatsAppMessage backend)
    if (msg.channel === 'personal' || msg.channel === 'business' || msg.channel === 'malik') return msg.channel;
    // Fall back to inferring from our phone numbers in the message
    const eruditeSide = msg.direction === 'inbound' ? msg.to_number : msg.from_number;
    if (eruditeSide) {
      const digits = eruditeSide.replace(/\D/g, '');
      if (digits.endsWith('1806000')) return 'personal';
      if (digits.endsWith('2806000')) return 'business';
      if (digits.endsWith('9871277')) return 'malik';
    }
    return 'business';
  };

  // Deduplicate queued+webhook call pairs: same number AND started_at within 30s.
  // Prefer the record with a twilio_call_sid (webhook outcome); keep lead_id/agent_email from either.
  const dedupCalls = (logs) => {
    const used = new Set(); const out = [];
    const sorted = [...logs].sort((a, b) => tsOf(a.started_at || a.created_date) - tsOf(b.started_at || b.created_date));
    for (const c of sorted) {
      if (used.has(c.id)) continue;
      const t = tsOf(c.started_at || c.created_date);
      const pair = sorted.find(o => o.id !== c.id && !used.has(o.id) &&
        (o.to_number === c.to_number || o.from_number === c.from_number) &&
        Math.abs(tsOf(o.started_at || o.created_date) - t) < 30000);
      if (pair) {
        const base = c.twilio_call_sid ? c : (pair.twilio_call_sid ? pair : c);
        const other = base === c ? pair : c;
        used.add(c.id); used.add(pair.id);
        out.push({ ...base, lead_id: base.lead_id || other.lead_id, agent_email: base.agent_email || other.agent_email });
      } else { used.add(c.id); out.push(c); }
    }
    return out;
  };
  const callLogs = dedupCalls(twilioLogs);

  // Build connections ONLY for systems with real data — missing keys render as grey "Not linked"
  const connections = {};
  if (waBusiness.length) connections.wa_business = waBusiness[0]?.status ? `Active · ${waBusiness[0].status}` : 'Linked';
  if (waPersonal.length) connections.wa_personal = 'Linked';
  if (waMessages.some((m) => m.media_type === 'audio' || m.media_type === 'voice' || m.is_voice_note)) connections.wa_call = 'Voice call';
  if (aircallCalls.length) connections.aircall = `${aircallCalls.length} call${aircallCalls.length > 1 ? 's' : ''}`;
  if (callLogs.length) connections.twilio = `${callLogs.length} call${callLogs.length > 1 ? 's' : ''}`;
  if (lp.title_deed_url || L.form_a_pdf_url) connections.drive = 'Files backed up';
  if ((Array.isArray(L.form_a_contracts) && L.form_a_contracts.length) || ['form_a_drafted', 'form_a_signed'].includes(L.mandate_status)) connections.docusign = `Form A ${L.mandate_status || 'in progress'}`;
  if (lp.title_deed_verified === true) connections.dld = 'Title verified';

  const stream = [];
  emailMessages.forEach(em => {
    const fromLandlord = em.from_email && landlordEmail && em.from_email.toLowerCase() === landlordEmail.toLowerCase();
    const isOut = !fromLandlord;
    stream.push({
      t: 'msg',
      dir: fromLandlord ? 'in' : 'out',
      mtype: 'text',
      channel: 'email',
      subject: em.subject || '',
      emailBody: em.body_text || em.snippet || '',
      text: (em.subject ? em.subject + '\n' : '') + (em.snippet || em.body_text || ''),
      time: fmtMsgTime(em.received_at || em.created_date),
      order: tsOf(em.received_at || em.created_date) || 0,
      fromEmail: em.from_email || '',
      fromName: em.from_name || '',
      senderEmail: isOut ? (em.from_email || '') : '',
      senderName: isOut ? (resolveUserName(em.from_email) || em.from_name || em.from_email || 'Agent') : (em.from_name || L.full_name_en || L.full_name || 'Owner'),
    });
  });
  waStreamMessages.forEach(msg => {
    const hasImage = msg.media_type === 'image' && msg.media_url;
    const hasVoice = msg.media_type === 'audio' || msg.is_voice_note === true;
    const isOut = msg.direction === 'outbound';
    stream.push({
      t: 'msg',
      dir: isOut ? 'out' : 'in',
      mtype: hasImage ? 'media' : hasVoice ? 'voice' : 'text',
      text: msg.caption || msg.body || '',
      mediaUrl: hasImage ? msg.media_url : null,
      mediaLabel: msg.media_type || '',
      transcript: msg.transcription || '',
      transcriptLang: msg.detected_language || '',
      translation: msg.translations && typeof msg.translations === 'object' ? (msg.translations.en || '') : '',
      time: fmtMsgTime(msg.timestamp),
      order: tsOf(msg.timestamp) || 0,
      wa: deriveWaChannel(msg),
      senderEmail: isOut ? (msg.assigned_agent_email || '') : '',
      senderName: isOut ? (resolveUserName(msg.assigned_agent_email) || 'Agent') : (L.full_name_en || L.full_name || 'Owner'),
    });
  });
  iMessages.forEach(msg => {
    const isOut = msg.direction === 'outbound';
    stream.push({
      t: 'msg',
      dir: isOut ? 'out' : 'in',
      mtype: 'text',
      channel: 'imessage',
      text: msg.body || '',
      time: fmtMsgTime(msg.sent_at || msg.created_date),
      order: tsOf(msg.sent_at || msg.created_date) || 0,
      senderEmail: isOut ? (msg.agent_email || '') : '',
      senderName: isOut ? (resolveUserName(msg.agent_email) || 'Agent') : (L.full_name_en || L.full_name || 'Owner'),
    });
  });
  telegramMessages.forEach(msg => {
    const isOut = msg.direction === 'outbound';
    stream.push({
      t: 'msg',
      dir: isOut ? 'out' : 'in',
      mtype: 'text',
      channel: 'telegram',
      text: msg.body || '',
      time: fmtMsgTime(msg.sent_at || msg.created_date),
      order: tsOf(msg.sent_at || msg.created_date) || 0,
      senderEmail: isOut ? (msg.agent_email || '') : '',
      senderName: isOut ? (resolveUserName(msg.agent_email) || 'Agent') : (L.full_name_en || L.full_name || 'Owner'),
    });
  });
  const calls = callLogs.map(c => ({
    provider: 'twilio',
    dir: c.direction === 'outbound' ? 'out' : 'in',
    title: 'Call',
    who: (resolveUserName(c.agent_email) || '—') + ' · ' + fmtMsgTime(c.started_at || c.created_date),
    dur: fmtDuration(c.duration_seconds, c.status),
    status: mapCallStatus(c.status),
    recording: !!c.recording_url,
    recordingUrl: c.recording_url || null,
    _ts: tsOf(c.started_at || c.created_date),
  }));
  // Merge VAPI + Aircall calls (by landlord_id AND by phone), deduped, into the Calls tab so their
  // recordings get an inline play button. VAPI rows are distinguished by source==='vapi'.
  const seenCallIds = new Set();
  [...aircallCalls, ...aircallByPhone].forEach(c => {
    const uid = c.id || c.aircall_id;
    if (!uid || seenCallIds.has(uid)) return;
    seenCallIds.add(uid);
    const isVapi = c.source === 'vapi' || (c.notes && String(c.notes).startsWith('Vapi'));
    calls.push({
      provider: isVapi ? 'vapi' : 'aircall',
      dir: c.direction === 'inbound' ? 'in' : 'out',
      title: 'Call',
      who: (c.agent_name || resolveUserName(c.agent_email) || 'AI') + ' · ' + fmtMsgTime(c.started_at || c.created_date),
      dur: fmtDuration(c.duration, c.status),
      status: ['done', 'ended', 'completed'].includes(c.status) ? 'done' : mapCallStatus(c.status),
      recording: !!(c.recording_url || c.voicemail_url),
      recordingUrl: c.recording_url || c.voicemail_url || null,
      _ts: tsOf(c.started_at || c.created_date),
    });
  });
  // Newest-first so the most recent VAPI call (with its recording) sits at the top of the Calls tab.
  calls.sort((a, b) => (b._ts || 0) - (a._ts || 0));
  aircallCalls.forEach(call => {
    stream.push({ t: 'act', kind: 'call', title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · Aircall`, body: call.from_number || call.to_number || '', time: fmtMsgTime(call.started_at || call.created_date), order: tsOf(call.started_at || call.created_date) || 0 });
  });
  callLogs.forEach(call => {
    stream.push({ t: 'act', kind: 'call', title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · Twilio`, body: call.to_number || call.from_number || '', time: fmtMsgTime(call.started_at || call.created_date), order: tsOf(call.started_at || call.created_date) || 0 });
  });
  // Notes for the stream — historical LandlordNote records with author + timestamp.
  notes.forEach(n => {
    stream.push({
      t: 'act', kind: 'note',
      title: 'Note' + (n.created_from_ai ? ' · AI' : ''),
      body: n.body || '',
      time: fmtMsgTime(n.created_date),
      order: tsOf(n.created_date) || 0,
      author: n.author_name || resolveUserName(n.author_email) || n.author_email || '',
    });
  });
  // Tasks for the stream — historical LandlordTask records with assignee + due date.
  tasks.forEach(t => {
    stream.push({
      t: 'act', kind: 'task',
      title: 'Task' + (t.created_from_ai ? ' · AI' : '') + (t.due_date ? ' · due ' + t.due_date : ''),
      body: t.title || '',
      time: fmtMsgTime(t.created_date),
      order: tsOf(t.created_date) || 0,
      author: t.assignee_email || '',
    });
  });
  // Follow-ups for the stream — historical LandlordAppointment records.
  followups.forEach(f => {
    stream.push({
      t: 'act', kind: 'followup',
      title: 'Follow-up' + (f.created_from_ai ? ' · AI' : '') + ' · ' + (f.channel || 'call') + ' · ' + fmtMsgTime(f.datetime),
      body: f.notes || '',
      time: fmtMsgTime(f.created_date || f.datetime),
      order: tsOf(f.created_date || f.datetime) || 0,
      author: resolveUserName(f.agent_email) || f.agent_email || '',
    });
  });
  stream.sort((a, b) => (b.order || 0) - (a.order || 0));

  const unit = {
    label: prop.unit_no || L.unit_reference || '—',
    building: prop.building_name || L.project_name || '—',
    area: prop.location || L.project_name || '—',
    beds: prop.bedrooms != null ? `${prop.bedrooms} Bed` : '—',
    baths: prop.bathrooms != null ? `${prop.bathrooms} Bath` : '—',
    sqft: prop.area_sqft ? `${prop.area_sqft} sqft` : '—',
    view: prop.view || '—',
    parking: '—',
    serviceCharge: lp.service_charge_arrears_aed ? `${fmtAED(lp.service_charge_arrears_aed)} arrears` : (lp.service_charge_status ? lp.service_charge_status.replace(/_/g, ' ') : '—'),
    asking: prop.price_aed ? fmtAED(prop.price_aed) : (L.asking_price_aed ? fmtAED(L.asking_price_aed) : '—'),
    target: '—',
    floor: '—',
  };

  // Map real AI fields from Landlord entity
  const aiRollingSummary = L.ai_rolling_summary || null;
  const aiNextBestAction = L.ai_next_best_action && typeof L.ai_next_best_action === 'object' ? L.ai_next_best_action : null;
  const aiCoaching = L.ai_coaching_for_agent || null;
  const mandateWinProb = L.mandate_win_probability != null ? Math.round(L.mandate_win_probability) : null;
  // V3 Phase 2 (REMEMBER): persistent strategy + open questions (degrade to null/[] until the
  // orchestrator + live schema populate them; safe to render either way).
  const aiDealThesis = (typeof L.ai_deal_thesis === 'string' && L.ai_deal_thesis.trim()) ? L.ai_deal_thesis.trim() : null;
  const aiOpenQuestions = deriveOpenQuestions(L.ai_open_questions);
  const scoreTrend = deriveScoreTrend(scoreSnapshots);

  // Map media/photography fields from Landlord entity (verbatim field names)
  const media = {
    videoUrl: L.media_video_url || null,
    tour360Url: L.media_tour_360_url || null,
    droneUrl: L.media_drone_url || null,
    floorplanUrl: L.media_floorplan_url || null,
    photographyStatus: L.media_photography_status || 'not_started',
    photographyUrl: L.media_photography_url || null,
  };
  // Map valuation fields from LandlordProperty
  const valuation = lp.ai_estimated_value_aed ? {
    estValue: fmtAED(lp.ai_estimated_value_aed),
    psf: fmtPSF(lp.ai_estimated_price_sqft),
    confLabel: lp.ai_valuation_confidence ? lp.ai_valuation_confidence.charAt(0).toUpperCase() + lp.ai_valuation_confidence.slice(1) + ' confidence' : '',
    confStyle: { display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700,
      color: lp.ai_valuation_confidence === 'high' ? '#34d399' : lp.ai_valuation_confidence === 'medium' ? 'hsl(38 92% 62%)' : '#f87171',
      background: lp.ai_valuation_confidence === 'high' ? 'rgba(16,185,129,0.14)' : lp.ai_valuation_confidence === 'medium' ? 'hsl(38 92% 50% / 0.16)' : 'rgba(239,68,68,0.16)' },
    basis: lp.ai_valuation_basis || '',
    updatedAt: lp.ai_valuation_updated_at ? new Date(lp.ai_valuation_updated_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '',
  } : null;
  // Map comparables from MarketTransaction
  const comps = marketComps.slice(0, 5).map(t => ({
    ref: t.unit_number ? `Unit ${t.unit_number}` : '—',
    note: `${t.bedrooms} · ${t.sale_status === 'ready' ? 'Ready' : 'Offplan'} · ${new Date(t.transaction_date).toLocaleDateString('en-GB', { month:'short', year:'2-digit' })}`,
    price: fmtAED(t.price_aed),
    psf: fmtPSF(t.price_per_sqft),
  }));
  // Map real score fields from Landlord entity
  const hasAnyScore = L.trust_score != null || L.responsiveness_score != null || L.urgency_score != null || L.mandate_win_probability != null;
  const scores = hasAnyScore ? {
    trust: L.trust_score != null ? Math.round(L.trust_score) : null,
    trustWhy: L.trust_score_rationale || '',
    responsiveness: L.responsiveness_score != null ? Math.round(L.responsiveness_score) : null,
    respWhy: L.responsiveness_score_rationale || '',
    urgency: L.urgency_score != null ? Math.round(L.urgency_score) : null,
    urgencyWhy: L.urgency_score_rationale || '',
    mandateWin: L.mandate_win_probability != null ? L.mandate_win_probability : null,
    mandateWhy: L.mandate_win_rationale || '',
  } : null;
  // Map risk/intelligence signals from Landlord entity
  const redFlags = Array.isArray(L.red_flags) ? L.red_flags : [];
  const buyingSignals = Array.isArray(L.buying_signals) ? L.buying_signals : [];
  const aiObjections = Array.isArray(L.ai_objections) ? L.ai_objections : [];
  // ai_strike_now type guard: can be boolean, object, or null
  const aiStrikeNow = L.ai_strike_now;
  const hasStrikeNow = aiStrikeNow === true || (typeof aiStrikeNow === 'object' && aiStrikeNow !== null && (aiStrikeNow.is_strike === true || aiStrikeNow.strike === true || aiStrikeNow.active === true));
  const strikeText = typeof aiStrikeNow === 'object' && aiStrikeNow !== null && aiStrikeNow.message ? aiStrikeNow.message : (hasStrikeNow ? 'High-priority — act now.' : '');
  const strikeKicker = hasStrikeNow ? 'Strike now' : (L.ai_momentum ? 'Momentum' : '');
  // Competitive context
  const hasCompetition = L.is_currently_listed_with_others === true || (typeof L.competing_brokers_count === 'number' && L.competing_brokers_count > 0) || (L.ai_competitive_intel && String(L.ai_competitive_intel).trim());
  const competitionText = L.ai_competitive_intel ? String(L.ai_competitive_intel) : (typeof L.competing_brokers_count === 'number' && L.competing_brokers_count > 0 ? `Listed with ${L.competing_brokers_count} other broker(s)` : (L.is_currently_listed_with_others === true ? 'Listed with other brokers' : ''));

  const archetypeLabels = {
    individual_end_user_relocating: 'End-user (relocating)',
    professional_investor: 'Professional Investor',
    distressed_seller: 'Distressed Seller',
    inherited_owner: 'Inherited Owner',
    developer_resale: 'Developer Resale',
    overseas_owner: 'Overseas Owner',
    default: L.landlord_archetype ? L.landlord_archetype.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null
  };

  const qualificationData = {
    archetype: archetypeLabels[L.landlord_archetype] || archetypeLabels.default,
    rapport: L.rapport_level ? L.rapport_level.charAt(0).toUpperCase() + L.rapport_level.slice(1) : null,
    competition: (L.is_currently_listed_with_others || (L.competing_brokers_count || 0) > 0) ? `Listed with ${L.competing_brokers_count || 'other'} broker(s)`: null,
    priorBrokerage: (L.prior_brokerage_count || 0) > 0 ? `${L.prior_brokerage_count} prior brokerage(s)` : null,
  };
  // Map mandate/deal terms from Landlord entity
  const formAContracts = Array.isArray(L.form_a_contracts) ? L.form_a_contracts : [];
  const hasMandate = L.mandate_status && L.mandate_status !== 'none' && L.mandate_status !== '' || formAContracts.length > 0;
  const mandateStatusMap = { 'form_a_signed': 'Signed', 'form_a_drafted': 'Draft', 'form_a_initiation': 'In Progress', 'expired': 'Expired', 'none': 'None', '': 'None' };
  const mandateTypeMap = { 'exclusive': 'Exclusive', 'non_exclusive': 'Non-exclusive' };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—';
  const mandate = hasMandate ? {
    status: mandateStatusMap[L.mandate_status] || L.mandate_status || 'None',
    type: mandateTypeMap[L.mandate_type] || L.mandate_type || '—',
    askingPrice: L.asking_price_aed ? fmtAED(L.asking_price_aed) : '—',
    commission: L.commission_pct_negotiated != null ? `${L.commission_pct_negotiated}%` : '—',
    startDate: fmtDate(L.mandate_start_date),
    expiryDate: fmtDate(L.mandate_expires_at),
    contractNumber: L.form_a_contract_number || '—',
    pdfUrl: L.form_a_pdf_url || null,
    contracts: formAContracts.map(c => ({
      contractNumber: c.contract_number || '—',
      unit: c.unit || '—',
      type: mandateTypeMap[c.mandate_type] || c.mandate_type || '—',
      askingPrice: c.asking_price_aed ? fmtAED(c.asking_price_aed) : '—',
      startDate: fmtDate(c.mandate_start_date),
      expiryDate: fmtDate(c.mandate_expires_at),
      pdfUrl: c.pdf_url || null,
    })),
  } : null;
  // Map DocumentChecklistItem records to Documents tab shape
  const docs = docItems.map(d => {
    const typeLabel = (d.document_type || '').replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const iconMap = { 'title_deed': '📄', 'passport': '🪪', 'emirates_id_front': '🪪', 'emirates_id_back': '🪪', 'lease_brokerage_agreement': '✍', 'form_a': '✍', 'tenancy_contract': '📋', 'utility_bill': '💡', 'noc': '📝' };
    const icon = iconMap[d.document_type] || '📄';
    const isReceived = d.verified_at || d.status === 'received' || d.received_at;
    const displayStatus = isReceived ? '✓ Received' : (d.status === 'requested' ? '◷ Pending' : '◷ Pending');
    const subtitle = d.received_at ? `Received ${new Date(d.received_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}` : (d.requested_at ? `Requested ${new Date(d.requested_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}` : '—');
    return {
      icon,
      label: typeLabel,
      provider: subtitle,
      status: displayStatus,
      url: d.file_url || null,
    };
  });
  // Add Form A PDF from landlord record if not already in docs
  if (L.form_a_pdf_url && !docs.some(d => d.label.includes('Form A') || d.label.includes('Brokerage'))) {
    docs.unshift({ icon: '✍', label: 'Form A Contract', provider: L.form_a_contract_number ? `Contract ${L.form_a_contract_number}` : 'Signed Form A', status: 'received', url: L.form_a_pdf_url });
  }

    const langMap = {
    ru: 'Russian', en: 'English', ar: 'Arabic', zh: 'Chinese', hi: 'Hindi', ur: 'Urdu', fa: 'Farsi',
  };

  const mediaItems = [
    { key: 'video', label: 'Video walkthrough', field: 'media_video_url', value: media.videoUrl, icon: Clapperboard },
    { key: '360', label: '360° tour', field: 'media_tour_360_url', value: media.tour360Url, icon: Rotate3d },
    { key: 'drone', label: 'Drone footage', field: 'media_drone_url', value: media.droneUrl, icon: Plane },
    { key: 'floorplan', label: 'Floor plan', field: 'media_floorplan_url', value: media.floorplanUrl, icon: Ruler },
  ];

  const photographyStatusConfig = {
    delivered: { label: 'Delivered', color: '#34d399', bg: 'rgba(16,185,129,0.16)' },
    shot: { label: 'Shot', color: '#60a5fa', bg: 'rgba(96,165,250,0.16)' },
    scheduled: { label: 'Scheduled', color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.16)' },
    not_started: { label: 'Not started', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' },
  };

  const mapped = {
    passport: L.passport_no || null,
    nationality: L.nationality || null,
    residence: L.residence_country || null,
    language: L.preferred_language ? (langMap[L.preferred_language] || L.preferred_language.toUpperCase()) : null,
    residentUAE: typeof L.is_resident_uae === 'boolean' ? (L.is_resident_uae ? 'Yes' : 'No') : null,
  id: L.id,
  name: L.full_name_en || L.full_name || 'Unnamed landlord',
  initials: initialsOf(L.full_name_en || L.full_name),
  phone: L.phone || '',
  additionalPhones: Array.isArray(L.additional_phones) ? L.additional_phones : [],
  email: L.email || '',
  additionalEmails: Array.isArray(L.additional_emails) ? L.additional_emails : [],
  whatsapp: L.whatsapp || '',
  source: L.source || '—',
  archetype: L.landlord_archetype || 'first_time_seller',
  agent: agentName,
  agentEmail,
  listingManagerEmail: L.listing_manager_email || '',
  photographerEmail: (landlordPhotographyTasks || []).map(t => t && t.assigned_photographer_email).find(Boolean) || '',
  aiSuggestedTasks: Array.isArray(L.ai_suggested_tasks) ? L.ai_suggested_tasks : [],
  aiSuggestedFollowups: Array.isArray(L.ai_suggested_followups) ? L.ai_suggested_followups : [],
  aiSuggestedMessages: Array.isArray(L.ai_suggested_messages) ? L.ai_suggested_messages : [],
  imessageStatus: L.imessage_status || 'unknown',
  imessageCheckedAt: L.imessage_checked_at || null,
  imessageResolvedAt: L.imessage_resolved_at || null,
  imessageHandle: L.imessage_handle || '',
  imessageHandles: Array.isArray(L.imessage_handles) ? L.imessage_handles : [],
  telegramChatId: L.telegram_chat_id || '',
  telegramUsername: L.telegram_username || '',
  rapport,
  temperature: temperatureFromRapport(rapport),
  stage: L.stage || 'initial_contact',
  stageIndex: stageIdx >= 1 ? stageIdx : 1,
  ownerSince: '—',
  unit,
  agentNotes: L.notes_internal || '',
  redFlags,
  buyingSignals,
  // Wire real AI fields
  aiRollingSummary,
  aiNextBestAction,
  aiCoaching,
  mandateWinProb,
  aiDealThesis,
  aiOpenQuestions,
  scoreTrend,
  aiObjections,
  hasCompetition,
  competitionText,
  hasStrikeNow,
  strikeText,
  strikeKicker,
  aiMomentum: L.ai_momentum || null,
  aiProcessedAt: L.ai_processed_at || null,
  mandate,
  // Legacy fields for backward compat
  nextBest: aiNextBestAction ? { show: true, action: aiNextBestAction.action, reasoning: aiNextBestAction.reasoning, priority: aiNextBestAction.priority } : null,
  valuation,
  qualification: qualificationData,
  scores,
  ai: null,
  signals: hasStrikeNow ? { strikeNow: hasStrikeNow, strikeKicker, strikeText, strikeAccent: '#fca5a5' } : null,
  market: comps.length ? { comps, trendLabel: '', trendStyle: { display:'none' } } : { comps: [], trendLabel: '', trendStyle: { display:'none' } },
  battle: null,
  calls,
  offers: [],
  docs,
  stream,
  connections,
  outreach: buildOutreachVM(outreachRows[0]),
  media,
  formAContractNumber: L.form_a_contract_number || null,
  mandateStatus: L.mandate_status || null,
  mandateType: L.mandate_type || null,
  };

  return (
    <React.Fragment>
      <LandlordDetail
        landlords={[mapped]}
        rawLandlord={L}
        rawProperty={prop}
        initialId={mapped.id}
        onBack={() => navigate('/landlords')}
        showCoaching
        showSignals
        onUploadFormA={() => setFormADialogOpen(true)}
        onAssignListingManager={() => setListingManagerDialogOpen(true)}
        landlord={mapped}
        mediaItems={mediaItems}
        photographyStatus={media.photographyStatus}
        photographyUrl={media.photographyUrl}
        openMediaDrawers={openMediaDrawers}
        toggleMediaDrawer={toggleMediaDrawer}
        mediaInputs={mediaInputs}
        setMediaInputs={setMediaInputs}
        handleAddMediaUrl={handleAddMediaUrl}
        handleRemoveMediaUrl={handleRemoveMediaUrl}
        handleMediaUpdate={handleMediaUpdate}
        photographyStatusConfig={photographyStatusConfig}
        openOwnerDrawers={openOwnerDrawers}
        toggleOwnerDrawer={toggleOwnerDrawer}
        onNavigate={navigate}
        formAContracts={formAContracts}
        currentUser={currentUser}
        taskTemplates={taskTemplates}
        followupTemplates={followupTemplates}
        onOutreachChanged={refetchOutreach}
        onAnalysed={handleAnalysed}
        />
      <FormAUploadDialog
        open={formADialogOpen}
        onClose={() => setFormADialogOpen(false)}
        onSuccess={handleFormASuccess}
      />
      <ListingManagerAssignDialog
        open={listingManagerDialogOpen}
        onClose={() => setListingManagerDialogOpen(false)}
        onSuccess={handleListingManagerSuccess}
        landlordId={id}
        currentListingManager={L?.listing_manager_email || null}
      />
    </React.Fragment>
  );
}