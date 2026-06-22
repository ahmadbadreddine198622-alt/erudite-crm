// LandlordDetailPage.jsx — Erudite CRM  (SELF-CONTAINED · single file)
// Design + live data in ONE file. Paste this as the ENTIRE contents of
// src/pages/LandlordDetailPage.jsx  (replace everything that's there).
// No other files needed. The /landlord/:id route already points here.

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import FormAUploadDialog from '@/components/landlord/FormAUploadDialog';
import ListingManagerAssignDialog from '@/components/landlord/ListingManagerAssignDialog';
import MediaPanel from '@/components/landlord/MediaPanel';
import Scorecards from '@/components/landlord/Scorecards';
import RiskSignals from '@/components/landlord/RiskSignals';
import DocumentsTab from '@/components/landlord/DocumentsTab';
import MandatePanel from '@/components/landlord/MandatePanel';
import QualificationStrip from '@/components/landlord/QualificationStrip';
import CallSuite from '@/components/landlord/CallSuite';
import ContactEvaluation from '@/components/landlord/ContactEvaluation';
import ListingManagerStrip from '@/components/landlord/ListingManagerStrip';

function useQ(key, fn, extra = {}) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false, staleTime: 30000, ...extra });
}

// LandlordDetail.jsx — Erudite CRM
// Self-contained React component. No external packages, no separate CSS, no image assets.
// Drop in at src/components/LandlordDetail.jsx (or src/pages/) and render <LandlordDetail />.
//
// Wiring to live Base44 data (optional): pass a `landlords` array prop shaped like the seed()
// objects below. With no prop it renders the built-in sample data so it works immediately.
//
//   import LandlordDetail from "@/components/LandlordDetail";
//   <LandlordDetail landlords={rows} initialId={rows[0]?.id} onBack={() => navigate(-1)} />
//
// Props: landlords?, initialId?, onBack?, defaultTab?, showCoaching?, showSignals?



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

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap');
.ld-root *, .ld-root *::before, .ld-root *::after { box-sizing: border-box; }
.ld-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.ld-root ::-webkit-scrollbar-track { background: transparent; }
.ld-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
.ld-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
@keyframes ld-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ld-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ld-spin { to { transform: rotate(360deg); } }
@keyframes ld-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.ld-panels { display: flex; }
@media (max-width: 820px) {
  .ld-root { height: auto !important; }
  .ld-panels { flex-direction: column !important; }
  .ld-panel { flex: 1 1 auto !important; height: auto !important; max-height: none !important; border-right: none !important; }
  .ld-scroll { max-height: 640px; }
}
`;

class LandlordDetail extends React.Component {
  constructor(props) {
    super(props);
    this.streamRef = React.createRef();
    this.STAGES = ['Initial Contact','Price Discovery','Listing Commitment','Form A Initiation','Form A Signing','Owner Documents','Photos & Videos','Photographer Scheduling','Listing Creation','Internal Verification','Listing Publication','Final Confirmation','Marketing — Agents','Marketing — Network','Open House','Client Blast','Deal Closed'];
    this.STAGE_KEYS = ['initial_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing','owner_documents','photos_videos','photographer_scheduling','listing_creation','internal_verification','listing_publication','final_confirmation','marketing_agents','marketing_network','open_house','client_blast','deal_closed'];
    const landlords = (props.landlords && props.landlords.length) ? props.landlords : [];
    this.state = {
      landlords,
      currentId: props.initialId || (landlords[0] && landlords[0].id) || null,
      activeTab: this.props.defaultTab || 'outreach',
      composerType: 'Note',
      composerText: '',
      composerTime: '',
      analyzing: false,
      streamFilter: 'all',
    };
  }

  componentDidMount(){ this.scrollBottom(); }
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
    if (cnt(nextCur) > cnt(prevCur) || prevState.streamFilter !== this.state.streamFilter) {
      this.scrollBottom();
    }
  }
  scrollBottom(){ const el=this.streamRef.current; if(el){ requestAnimationFrame(()=>{ el.scrollTop = el.scrollHeight; }); } }
  cur(){ return this.state.landlords.find(l=>l.id===this.state.currentId); }

  // handlers
  onBack = ()=>{ if(this.props.onBack) this.props.onBack(); };
  onSwitch = (e)=>{ this.setState({ currentId:e.target.value, activeTab:this.props.defaultTab||'outreach', composerText:'', composerTime:'' }, ()=>this.scrollBottom()); };
  setTab = (id)=> this.setState({ activeTab:id });
  setStreamFilter = (mode)=> this.setState(s=>({ streamFilter: s.streamFilter===mode ? 'all' : mode }));
  setComposerType = (t)=> this.setState({ composerType:t });
  onComposerInput = (e)=> this.setState({ composerText:e.target.value });
  onClearTime = ()=> this.setState({ composerTime:'' });
  onNotesInput = (e)=>{ const v=e.target.value; this.setState(s=>({ landlords:s.landlords.map(l=> l.id===s.currentId ? {...l, agentNotes:v} : l) })); };

  fillDraft = (action)=>{
    const typeMap={ followup:'Follow-up', meeting:'Appointment', viewing:'Appointment', call:'Task' };
    this.setState({ composerType: typeMap[action.type]||'Follow-up', composerText:action.message, composerTime:action.time });
  };

  onSend = ()=>{
    const txt=(this.state.composerText||'').trim(); if(!txt) return;
    const typeMap={ 'Note':'note', 'Task':'task', 'Follow-up':'followup', 'Appointment':'appointment' };
    const kind=typeMap[this.state.composerType]||'note';
    const order=Date.now();
    const item={ t:'act', kind, title:this.state.composerType + (this.state.composerTime? ' · '+this.state.composerTime : ''), body:txt, time:'Just now', order };
    this.setState(s=>({
      landlords:s.landlords.map(l=> l.id===s.currentId ? {...l, stream:[...l.stream, item]} : l),
      composerText:'', composerTime:''
    }), ()=>this.scrollBottom());
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

  onStageChange = async (newStage)=>{
    const L=this.cur(); if(!L||!newStage) return;
    const idx = this.state.landlords.findIndex(l=>l.id===this.state.currentId);
    if(idx<0) return;
    // Optimistic update
    this.setState(s=>({ landlords: s.landlords.map((l,i)=> i===idx ? {...l, stage:newStage, stageEnteredAt: new Date().toISOString()} : l) }));
    // Persist to database
    try {
      await base44.entities.Landlord.update(L.id, { stage: newStage, stage_entered_at: new Date().toISOString() });
    } catch(err) {
      console.error('Failed to update stage:', err);
      // Revert on error
      this.setState(s=>({ landlords: s.landlords.map((l,i)=> i===idx ? {...l, stage:L.stage, stageEnteredAt:L.stageEnteredAt} : l) }));
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

  // cannedAnalysis removed — real AI data comes from ConversationInsight/ConversationCoach
  // entities fetched by the LandlordDetailPage container. The Analyse button invokes the
  // real analyzeLandlordConversation backend function; no demo/fallback content is injected.
  cannedAnalysis(){ return null; }

  // ---------- viewmodel ----------
  computeVM(){
    const S=this.state; const L=this.cur();
    const showCoaching = this.props.showCoaching!==false;
    const showSignals = this.props.showSignals!==false;

    const landlordOptions = S.landlords.map(l=>({ id:l.id, name:l.name }));
    const hasAI=!!L.ai;

    const arr = (x) => Array.isArray(x) ? x : [];
    let ai={};
    if(hasAI){
      const c = L.ai.coach || {};
      ai={
        summary:L.ai.summary || '', language:L.ai.language || '—', analysedAt:L.ai.analysedAt || '',
        tempLabel:this.tempMeta(L.ai.temperature || 'warm').label, tempChipStyle:this.tempChip(L.ai.temperature || 'warm'),
        keyFacts:arr(L.ai.keyFacts), outstanding:arr(L.ai.outstanding),
        coach:{ score:c.score ?? 0, scoreColor:this.scoreColor(c.score ?? 0), bestLine:c.bestLine || '—', doneWell:arr(c.doneWell), missed:arr(c.missed), objections:arr(c.objections), nextMove:c.nextMove || '—' },
        actions:arr(L.ai.suggestions).map(a=>{
          const [icon,bg,color]=this.sugMeta(a.type);
          return { title:a.title, reason:a.reason, time:a.time, icon, onClick:()=>this.fillDraft(a),
            iconStyle:{ flex:'none', width:'30px', height:'30px', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', background:bg, color, marginTop:'1px' },
            chipStyle:{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'9px 11px', borderRadius:'11px', border:'1px solid hsl(38 92% 50% / 0.28)', background:'hsl(38 92% 50% / 0.06)', cursor:'pointer', fontFamily:"'Inter',sans-serif", textAlign:'left', width:'100%' } };
        }),
      };
    }

    const sorted=[...L.stream].sort((a,b)=>a.order-b.order);
    const filterMode=S.streamFilter || 'all';
    const filtered = filterMode==='all' ? sorted : sorted.filter(s => s.t==='act' || s.wa===filterMode);
    const analyzeError=S.analyzeError || '';
    const stream=filtered.map((s,idx)=>{
      if(s.t==='msg'){
        const out = s.dir==='out';
        const waveform = s.mtype==='voice' ? [9,15,7,18,11,16,6,13,9,17,8,12].map((h,k)=>React.createElement('span',{ key:k, style:{ width:'2px', height:h+'px', borderRadius:'2px', background: out?'hsl(38 92% 55% / 0.7)':'rgba(255,255,255,0.4)' } })) : null;
        return {
          key:idx, isMsg:true, isAct:false,
          isText:s.mtype==='text', isVoice:s.mtype==='voice', isMedia:s.mtype==='media',
          text:s.text, transcript:s.transcript, translation:s.translation, transcriptLang:s.transcriptLang, mediaLabel:s.mediaLabel, duration:s.duration, waveform, time:s.time,
          sender: out ? (L.agent+' · Erudite') : L.name,
          channel: s.wa==='personal' ? 'WA Personal' : 'WA Business',
          channelStyle:{ fontSize:'8.5px', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
            color: s.wa==='personal' ? '#93c5fd' : '#4ade80',
            background: s.wa==='personal' ? 'rgba(59,130,246,0.14)' : 'rgba(37,211,102,0.12)',
            padding:'1px 5px', borderRadius:'4px' },
          rowStyle:{ display:'flex', justifyContent: out?'flex-end':'flex-start' },
          bubbleStyle:{ maxWidth:'82%', padding:'10px 13px', borderRadius: out?'14px 14px 4px 14px':'14px 14px 14px 4px', background: out?'hsl(38 92% 50% / 0.12)':'rgba(255,255,255,0.05)', border:'1px solid '+(out?'hsl(38 92% 50% / 0.28)':'rgba(255,255,255,0.1)') },
          senderStyle:{ fontSize:'10px', fontWeight:700, letterSpacing:'0.03em', textTransform:'uppercase', color: out?'hsl(38 92% 58%)':'rgba(255,255,255,0.45)' },
          timeStyle:{ fontSize:'9.5px', color:'rgba(255,255,255,0.35)', marginTop:'6px', textAlign: out?'right':'left' },
        };
      } else {
        const [icon,bg,color]=this.actKindMeta(s.kind);
        return { key:idx, isMsg:false, isAct:true, time:s.time, actIcon:icon, actTitle:s.title, actBody:s.body,
          actIconStyle:{ flex:'none', width:'30px', height:'30px', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', background:bg, color, marginTop:'2px' },
          actLabelStyle:{ fontSize:'12px', fontWeight:700, color } };
      }
    });
    const msgCount=filtered.filter(s=>s.t==='msg').length;
    const actCount=filtered.filter(s=>s.t==='act').length;

    const composerTypes=['Note','Task','Follow-up','Appointment','Chat'].map(t=>{
      const on=S.composerType===t; const ic={ 'Note':'📝','Task':'✓','Follow-up':'↻','Appointment':'📅','Chat':'💬' }[t];
      const isChat = t==='Chat';
      return { label:t, icon:ic, onClick:()=>this.setComposerType(t),
        style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'6px 11px', borderRadius:'9px', fontSize:'11.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          background: isChat ? (on?'rgba(37,211,102,0.2)':'rgba(37,211,102,0.08)') : (on?'hsl(38 92% 50% / 0.14)':'rgba(255,255,255,0.04)'),
          color: isChat ? (on?'#22c55e':'#86efac') : (on?'hsl(38 92% 62%)':'rgba(255,255,255,0.6)'),
          border:'1px solid '+(isChat ? (on?'rgba(37,211,102,0.5)':'rgba(37,211,102,0.3)') : (on?'hsl(38 92% 50% / 0.45)':'rgba(255,255,255,0.1)')) } };
    });
    const placeholders={ 'Note':'Add a note to the timeline…', 'Task':'Describe the task…', 'Follow-up':'What’s the follow-up?', 'Appointment':'Appointment details…' };

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

    const tabDefs=[ ['outreach','Outreach'],['qualify','Qualify'],['calls','Calls'],['overview','Overview'],['unit','Unit'],['negotiation','Negotiation'],['documents','Documents'] ];
    const tabs=tabDefs.map(([id,label])=>{
      const on=S.activeTab===id;
      return { id, label, onClick:()=>this.setTab(id),
        style:{ padding:'7px 13px', borderRadius:'9px', fontSize:'12.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          background: on?'hsl(38 92% 50% / 0.14)':'transparent', color: on?'hsl(38 92% 62%)':'rgba(255,255,255,0.55)', border:'1px solid '+(on?'hsl(38 92% 50% / 0.4)':'rgba(255,255,255,0.09)') } };
    });

    const at=S.activeTab;
    const kv=(label,value,accent)=>({ label, value, valueStyle:{ fontSize:'13.5px', fontWeight:600, marginTop:'5px', color: accent||'rgba(255,255,255,0.9)' } });
    let tab={ isList:false, isQualify:false, isCalls:false, isNegotiation:false, isDocuments:false, isOutreach:false };
    if(at==='outreach'){
      tab.isOutreach=true; const oc=L.outreach;
      tab.outreachDate=oc.date; tab.stepsCompleted=oc.stepsCompleted; tab.dailyScore=oc.dailyScore;
      tab.progressStyle={ height:'100%', width:Math.round((oc.stepsCompleted/6)*100)+'%', background:'linear-gradient(90deg, hsl(38 92% 52%), hsl(38 92% 62%))' };
      tab.steps=oc.steps.map((st,i)=>({ key:i, label:st.label, at: st.at||'—', done:st.done,
        iconStyle:{ flex:'none', width:'24px', height:'24px', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:800, color: st.done?'#34d399':'rgba(255,255,255,0.35)', background: st.done?'rgba(16,185,129,0.16)':'rgba(255,255,255,0.05)', border:'1px solid '+(st.done?'rgba(16,185,129,0.35)':'rgba(255,255,255,0.1)') },
        icon: st.done?'✓':'○',
        labelStyle:{ fontSize:'13px', fontWeight:600, color: st.done?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.5)' } }));
    } else if(at==='overview'){
      tab.isList=true; tab.rows=[
        kv('Full name', L.name), kv('Phone', L.phone), kv('Source', L.source),
        kv('Archetype', this.titleize(L.archetype), '#c4b5fd'), kv('Owner since', L.ownerSince), kv('Assigned agent', L.agent, 'hsl(38 92% 60%)'),
      ];
    } else if(at==='qualify'){
      tab.isList=true;
      if(L.qualification){ const q=L.qualification; tab.rows=[
        kv('Motivation', q.motivation), kv('Timeline / urgency', q.timeline, 'hsl(38 92% 60%)'),
        kv('Price expectation', q.priceExpectation), kv('Price vs valuation', q.priceVsValuation),
        kv('Mandate openness', q.mandateOpenness), kv('Decision maker', q.decisionMaker),
        kv('Tenancy', q.tenancy), kv('Mortgage', q.mortgage),
        kv('Call outcome', q.outcome, 'hsl(38 92% 60%)'), kv('Next step', q.nextStep), kv('Follow-up', q.followupDate, 'hsl(38 92% 60%)'),
      ]; }
      else { tab.rows=[ kv('Qualification', 'Not yet logged — run a CallQualification on the next call') ]; }
    } else if(at==='unit'){
      tab.isList=true; const u=L.unit; tab.rows=[
        kv('Unit', u.building+' · '+u.label), kv('Area', u.area), kv('Layout', u.beds+' · '+u.baths),
        kv('Size', u.sqft), kv('View', u.view), kv('Parking', u.parking),
        kv('Service charge', u.serviceCharge), kv('Asking price', u.asking, 'hsl(38 92% 60%)'),
      ];
    } else if(at==='calls'){
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
    } else if(at==='negotiation'){
      tab.isNegotiation=true; const u=L.unit;
      tab.battle = L.battle || { painPoint:'Run AI / battle card to populate.', motivators:[], competitor:'—', pitch:'—', closes:[] };
      tab.ladder=[
        { label:'Asking', value:u.asking, color:'rgba(255,255,255,0.92)', cardStyle:{ borderRadius:'12px', padding:'12px 13px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' } },
        { label:'Target', value:u.target, color:'hsl(38 92% 60%)', cardStyle:{ borderRadius:'12px', padding:'12px 13px', background:'hsl(38 92% 50% / 0.07)', border:'1px solid hsl(38 92% 50% / 0.28)' } },
        { label:'Floor', value:u.floor, color:'#f87171', cardStyle:{ borderRadius:'12px', padding:'12px 13px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.22)' } },
      ];
      tab.offers=L.offers.map((o,i)=>{
        const sm={ pending:['rgba(245,158,11,0.16)','hsl(38 92% 62%)','Pending'], accepted:['rgba(16,185,129,0.16)','#34d399','Accepted'], declined:['rgba(239,68,68,0.16)','#f87171','Declined'] }[o.status]||['rgba(148,163,184,0.16)','rgba(255,255,255,0.6)',o.status];
        return { key:i, who:o.who, time:o.time, amount:o.amount, status:sm[2], statusStyle:{ padding:'3px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:700, background:sm[0], color:sm[1] } };
      });
    } else if(at==='documents'){
      tab.isDocuments=true; tab.docs=L.docs.map((d,i)=>{
        const sm={ received:['rgba(16,185,129,0.16)','#34d399','✓ Received'], pending:['rgba(245,158,11,0.16)','hsl(38 92% 62%)','◷ Pending'], missing:['rgba(239,68,68,0.16)','#f87171','✕ Missing'] }[d.status]||['rgba(148,163,184,0.16)','rgba(255,255,255,0.6)',d.status];
        return { key:i, icon:d.icon, label:d.label, provider:d.provider, status:sm[2], statusStyle:{ padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:sm[0], color:sm[1] } };
      });
    }

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
      analyzing:S.analyzing, notAnalyzing:!S.analyzing,
      aiReady: hasAI && !S.analyzing, aiEmpty: !hasAI,
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
    };
  }

  render(){
    const vm = this.computeVM();
    const L = this.cur();
    const { ai, hdr, stage, market, signals, tab } = vm;

    return (
      <React.Fragment>
        <style>{GLOBAL_CSS}</style>
        <div className="ld-root" style={css("height:100vh; display:flex; flex-direction:column; background:hsl(222 47% 6%); color:rgba(255,255,255,0.9); font-family:'Inter',sans-serif;")}>

          {/* Top bar */}
          <div style={css("flex:none; display:flex; align-items:center; justify-content:space-between; gap:18px; padding:13px 22px; border-bottom:1px solid rgba(255,255,255,0.07); background:rgba(8,12,22,0.6); backdrop-filter:blur(14px);")}>
            <div style={css("display:flex; align-items:center; gap:14px; min-width:0;")}>
              <button onClick={this.onBack} style={css("flex:none; display:inline-flex; align-items:center; gap:7px; padding:8px 13px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.7); font-size:12.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
                <span style={css("font-size:14px; line-height:1;")}>‹</span> Landlords
              </button>
              <div style={css("display:flex; align-items:center; gap:9px; min-width:0;")}>
                <div style={css("width:6px; height:6px; border-radius:2px; background:hsl(38 92% 50%); box-shadow:0 0 9px hsl(38 92% 50% / 0.7);")}></div>
                <span style={css("font-size:10.5px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:hsl(38 92% 55%); white-space:nowrap;")}>Erudite · Landlord</span>
              </div>
            </div>
            <div style={css("display:flex; align-items:center; gap:10px;")}>
              <span style={css("font-size:11.5px; color:rgba(255,255,255,0.4);")}>Viewing</span>
              <select value={vm.currentId} onChange={this.onSwitch} style={css("padding:9px 12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer;")}>
                {vm.landlordOptions.map(o=>(
                  <option key={o.id} value={o.id} style={{background:'#13182a'}}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Two panels */}
          <div className="ld-panels" style={css("flex:1; min-height:0;")}>

            {/* LEFT PANEL */}
            <div className="ld-panel" style={css("flex:0 0 45%; min-width:0; height:100%; min-height:0; display:flex; flex-direction:column; border-right:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.012);")}>

              <div style={css("flex:none; display:flex; align-items:center; justify-content:space-between; padding:16px 20px 12px;")}>
                <div>
                  <div style={css("font-family:'Playfair Display',serif; font-size:19px; font-weight:600; color:rgba(255,255,255,0.96);")}>Conversation &amp; Activity</div>
                  <div style={css("font-size:11.5px; color:rgba(255,255,255,0.4); margin-top:2px;")}>{vm.streamCountLabel}</div>
                </div>
                <div style={css("display:flex; align-items:center; gap:6px;")}>
                  <button onClick={()=>this.setStreamFilter('business')} style={vm.businessPillStyle}>
                    <span style={vm.businessDotStyle}></span> Business
                  </button>
                  <button onClick={()=>this.setStreamFilter('personal')} style={vm.personalPillStyle}>
                    <span style={vm.personalDotStyle}></span> Personal
                  </button>
                </div>
              </div>

              {/* pinned AI card */}
              <div style={css("flex:none; margin:0 16px 10px; border-radius:16px; border:1px solid hsl(38 92% 50% / 0.28); background:linear-gradient(180deg, hsl(38 92% 50% / 0.07), rgba(255,255,255,0.02)); overflow:hidden; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid hsl(38 92% 50% / 0.16);")}>
                  <span style={css("display:inline-flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 60%);")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 60%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                    AI Conversation Intelligence
                  </span>
                  <button onClick={this.onAnalyse} disabled={vm.analyzing} style={css("display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:9px; border:1px solid hsl(38 92% 50% / 0.45); background:hsl(38 92% 50% / 0.14); color:hsl(38 92% 62%); font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; opacity:"+ (vm.analyzing ? 0.6 : 1))}>
                    <span style={vm.analyseIconStyle}>↻</span> {vm.analyseLabel}
                  </button>
                </div>
                {vm.analyzeError && (
                  <div style={css("padding:10px 15px; font-size:11.5px; color:#fca5a5; background:rgba(239,68,68,0.08); border-top:1px solid rgba(239,68,68,0.15);")}>
                    {vm.analyzeError}
                  </div>
                )}

                {vm.aiReady && (
                  <div style={css("padding:14px 15px; max-height:368px; overflow-y:auto;")}>
                    <div style={css("display:flex; align-items:flex-start; gap:10px; margin-bottom:6px;")}>
                      <span style={ai.tempChipStyle}>{ai.tempLabel}</span>
                      <p style={css("margin:0; font-size:13px; line-height:1.55; color:rgba(255,255,255,0.82);")}>{ai.summary}</p>
                    </div>
                    <div style={css("font-size:10px; color:rgba(255,255,255,0.32); margin-bottom:8px;")}>Detected language · {ai.language} · analysed {ai.analysedAt}</div>

                    <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin:14px 0 7px;")}>Key facts</div>
                    <div style={css("display:flex; flex-direction:column; gap:5px;")}>
                      {ai.keyFacts.map((f,i)=>(
                        <div key={i} style={css("display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:rgba(255,255,255,0.74); line-height:1.45;")}>
                          <span style={css("flex:none; width:5px; height:5px; border-radius:50%; background:hsl(38 92% 55%); margin-top:6px;")}></span>{f}
                        </div>
                      ))}
                    </div>

                    <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:#fca5a5; margin:15px 0 7px;")}>Outstanding · unanswered questions</div>
                    <div style={css("display:flex; flex-direction:column; gap:6px;")}>
                      {ai.outstanding.map((q,i)=>(
                        <div key={i} style={css("display:flex; align-items:flex-start; gap:8px; padding:8px 10px; border-radius:9px; background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.18); font-size:12.5px; color:rgba(255,255,255,0.78); line-height:1.45;")}>
                          <span style={css("flex:none; color:#f87171; font-weight:700;")}>?</span>{q}
                        </div>
                      ))}
                    </div>

                    {vm.showCoaching && (
                      <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(139,92,246,0.3); background:linear-gradient(180deg, rgba(139,92,246,0.12), rgba(139,92,246,0.03)); overflow:hidden;")}>
                        <div style={css("display:flex; align-items:center; justify-content:space-between; padding:10px 13px; border-bottom:1px solid rgba(139,92,246,0.18);")}>
                          <span style={css("display:inline-flex; align-items:center; gap:7px; font-size:10.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#c4b5fd;")}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z"/></svg>
                            Conversation Coach
                          </span>
                          <span style={css("display:inline-flex; align-items:baseline; gap:5px;")}>
                            <span style={css("font-size:10px; color:rgba(255,255,255,0.45);")}>Quality</span>
                            <span style={{...css("font-size:15px; font-weight:800;"), color:ai.coach.scoreColor}}>{ai.coach.score}</span>
                            <span style={css("font-size:10px; color:rgba(255,255,255,0.4);")}>/100</span>
                          </span>
                        </div>
                        <div style={css("padding:11px 13px;")}>
                          <div style={css("font-size:9.5px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:#a78bfa; margin-bottom:5px;")}>Best line to use now</div>
                          <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.92); font-style:italic; padding:9px 11px; border-radius:9px; background:rgba(139,92,246,0.1); border-left:2px solid #8b5cf6;")}>“{ai.coach.bestLine}”</div>

                          <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:11px; margin-top:12px;")}>
                            <div>
                              <div style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#34d399; margin-bottom:5px;")}>Done well</div>
                              <div style={css("display:flex; flex-direction:column; gap:4px;")}>
                                {ai.coach.doneWell.map((w,i)=>(
                                  <div key={i} style={css("display:flex; align-items:flex-start; gap:6px; font-size:11.5px; color:rgba(255,255,255,0.66); line-height:1.4;")}><span style={css("flex:none; color:#34d399;")}>✓</span>{w}</div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#f0abfc; margin-bottom:5px;")}>Missed</div>
                              <div style={css("display:flex; flex-direction:column; gap:4px;")}>
                                {ai.coach.missed.map((m,i)=>(
                                  <div key={i} style={css("display:flex; align-items:flex-start; gap:6px; font-size:11.5px; color:rgba(255,255,255,0.66); line-height:1.4;")}><span style={css("flex:none; color:#f0abfc;")}>✕</span>{m}</div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {(ai.coach.objections.length > 0 || (L.aiObjections && L.aiObjections.length > 0)) && (
                            <div style={css("margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;")}>
                              {ai.coach.objections.map((ob,i)=>(
                                <span key={i} style={css("display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:99px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); font-size:10.5px; color:#fca5a5;")}>⚑ {ob}</span>
                              ))}
                              {(L.aiObjections || []).map((ob,i)=>(
                                <span key={`ai-${i}`} style={css("display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:99px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); font-size:10.5px; color:#fca5a5;")}>⚑ {ob}</span>
                              ))}
                            </div>
                          )}

                          {L.aiCoaching && (
                            <div style={css("margin-top:11px; padding:9px 11px; border-radius:9px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2);")}>
                              <span style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#a78bfa;")}>Agent coaching</span>
                              <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82); margin-top:3px;")}>{L.aiCoaching}</div>
                            </div>
                          )}
                          {L.hasCompetition && L.competitionText && (
                            <div style={css("margin-top:11px; padding:9px 11px; border-radius:9px; background:rgba(245,158,11,0.08); border:1px solid hsl(38 92% 50% / 0.2);")}>
                              <span style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:hsl(38 92% 60%);")}>Competition</span>
                              <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82); margin-top:3px;")}>{L.competitionText}</div>
                            </div>
                          )}
                          <div style={css("margin-top:11px; padding:9px 11px; border-radius:9px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2);")}>
                            <span style={css("font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#a78bfa;")}>Next move</span>
                            <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82); margin-top:3px;")}>{ai.coach.nextMove}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin:16px 0 8px;")}>Suggested actions · tap to draft</div>
                    <div style={css("display:flex; flex-direction:column; gap:7px;")}>
                      {ai.actions.map((a,i)=>(
                        <button key={i} onClick={a.onClick} style={a.chipStyle}>
                          <span style={a.iconStyle}>{a.icon}</span>
                          <span style={css("min-width:0; flex:1;")}>
                            <span style={css("display:flex; align-items:center; justify-content:space-between; gap:8px;")}>
                              <span style={css("font-weight:600; font-size:12.5px; color:rgba(255,255,255,0.9);")}>{a.title}</span>
                              <span style={css("flex:none; font-size:10px; font-weight:600; color:hsl(38 92% 60%);")}>{a.time}</span>
                            </span>
                            <span style={css("display:block; font-size:11px; color:rgba(255,255,255,0.5); margin-top:2px; line-height:1.4;")}>{a.reason}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {vm.aiEmpty && (
                  <div style={css("padding:26px 18px; text-align:center;")}>
                    {vm.analyzing && (
                      <React.Fragment>
                        <div style={css("display:inline-block; width:26px; height:26px; border:2.5px solid hsl(38 92% 50% / 0.25); border-top-color:hsl(38 92% 55%); border-radius:50%; animation: ld-spin 0.8s linear infinite;")}></div>
                        <div style={css("font-size:12.5px; color:rgba(255,255,255,0.55); margin-top:12px;")}>Analysing conversation…</div>
                      </React.Fragment>
                    )}
                    {vm.notAnalyzing && (
                      <React.Fragment>
                        <div style={css("font-size:30px; opacity:0.5;")}>✦</div>
                        <div style={css("font-size:13px; color:rgba(255,255,255,0.6); margin-top:8px; line-height:1.5;")}>No analysis yet for this landlord.<br/>Run the AI to surface insights &amp; coaching.</div>
                        <button onClick={this.onAnalyse} style={css("margin-top:14px; padding:10px 20px; border-radius:11px; border:1px solid hsl(38 92% 50% / 0.5); background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; font-size:13px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif;")}>Analyse Now</button>
                      </React.Fragment>
                    )}
                  </div>
                )}
              </div>

              {/* unified stream */}
              <div className="ld-scroll" ref={this.streamRef} style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px 14px; display:flex; flex-direction:column; gap:12px;")}>
                {vm.stream.map((s)=> s.isMsg ? (
                  <div key={s.key} style={s.rowStyle}>
                    <div style={s.bubbleStyle}>
                      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:5px;")}>
                        <span style={s.senderStyle}>{s.sender}</span>
                        <span style={s.channelStyle}>{s.channel}</span>
                      </div>

                      {s.isText && (
                        <div style={css("font-size:13px; line-height:1.5; color:rgba(255,255,255,0.9);")}>{s.text}</div>
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
                          <div style={css("border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); height:128px; display:flex; align-items:center; justify-content:center; margin-bottom:6px;")}>
                            <span style={css("font-size:11px; color:rgba(255,255,255,0.45);")}>📎 {s.mediaLabel}</span>
                          </div>
                          <div style={css("font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{s.text}</div>
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
                    </div>
                  </div>
                ))}
              </div>

              {/* composer */}
              <div style={css("flex:none; border-top:1px solid rgba(255,255,255,0.08); padding:11px 16px 13px; background:rgba(8,12,22,0.5);")}>
                {vm.composerHasTime && (
                  <div style={css("display:inline-flex; align-items:center; gap:6px; margin-bottom:8px; padding:4px 10px; border-radius:99px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); font-size:11px; font-weight:600; color:hsl(38 92% 60%);")}>
                    ⏰ Suggested: {vm.composerTime} <span onClick={this.onClearTime} style={css("cursor:pointer; opacity:0.6;")}>✕</span>
                  </div>
                )}
                <div style={css("display:flex; gap:6px; margin-bottom:9px;")}>
                  {vm.composerTypes.map((t)=>(
                    <button key={t.label} onClick={t.onClick} style={t.style}>{t.icon} {t.label}</button>
                  ))}
                </div>
                <div style={css("display:flex; align-items:flex-end; gap:9px;")}>
                  <textarea value={vm.composerText} onChange={this.onComposerInput} placeholder={vm.composerPlaceholder} rows={1} style={css("flex:1; resize:none; min-height:42px; max-height:120px; padding:11px 13px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:13px; font-family:'Inter',sans-serif; line-height:1.45;")}></textarea>
                  <button onClick={this.onSend} style={css("flex:none; width:42px; height:42px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.5); background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; font-size:17px; cursor:pointer; display:flex; align-items:center; justify-content:center;")}>➤</button>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="ld-panel ld-scroll" style={css("flex:1; min-width:0; height:100%; min-height:0; overflow-y:auto; padding:18px 22px 28px;")}>

              {/* header */}
              <div style={css("display:flex; align-items:flex-start; justify-content:space-between; gap:18px; flex-wrap:wrap; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("display:flex; align-items:center; gap:14px; min-width:0;")}>
                  <div style={hdr.avatarStyle}>{hdr.initials}</div>
                  <div style={css("min-width:0;")}>
                    <div style={css("display:flex; align-items:center; gap:9px; flex-wrap:wrap;")}>
                      <h1 style={css("font-family:'Playfair Display',serif; font-weight:600; font-size:27px; letter-spacing:-0.01em; margin:0; color:rgba(255,255,255,0.97);")}>{hdr.name}</h1>
                      <span style={hdr.archetypeStyle}>{hdr.archetype}</span>
                    </div>
                    <div style={css("display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:7px;")}>
                      {L.phone && L.phone !== '—' && (
                        <span style={css("font-size:12.5px; color:hsl(38 92% 60%); font-weight:600;")}>📞 {L.phone}</span>
                      )}
                      {(L.phone && L.phone !== '—') && <span style={css("color:rgba(255,255,255,0.22);")}>·</span>}
                      <span style={css("font-size:12.5px; color:rgba(255,255,255,0.55);")}>{hdr.bedsSqft}</span>
                      <span style={css("color:rgba(255,255,255,0.22);")}>·</span>
                      <span style={css("font-size:12.5px; color:rgba(255,255,255,0.55);")}>{hdr.unitBuilding}</span>
                      <span style={css("display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:8px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.4);")}>
                        <span style={css("font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:hsl(38 92% 55%); opacity:0.8;")}>Unit</span>
                        <span style={css("font-family:'SF Mono','Menlo',monospace; font-size:13.5px; font-weight:700; letter-spacing:0.02em; color:hsl(38 92% 64%);")}>{hdr.unitLabel}</span>
                      </span>
                      <span style={css("color:rgba(255,255,255,0.22);")}>·</span>
                      <span style={css("font-size:12.5px; color:rgba(255,255,255,0.55);")}>{hdr.askingLabel}</span>
                    </div>
                  </div>
                </div>
                <div style={css("display:flex; align-items:center; gap:9px;")}>
                  <span style={hdr.stageStyle}>{hdr.stageLabel}</span>
                  <span style={hdr.tempChipStyle}>{hdr.tempLabel}</span>
                </div>
              </div>

              <ListingManagerStrip 
                listingManagerEmail={L.listing_manager_email}
                assignedAgentEmail={L.assigned_agent_email}
                phone={L.phone}
                whatsapp={L.whatsapp}
              />
              <QualificationStrip qualification={L.qualification} />

              {/* pipeline progress + stage selector */}
              <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.43s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;")}>
                  <span style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>Pipeline</span>
                  <span style={css("font-size:11px; color:hsl(38 92% 60%); font-weight:600;")}>Stage {stage.index} of {stage.total}</span>
                </div>
                <div style={css("height:6px; border-radius:99px; background:rgba(255,255,255,0.07); overflow:hidden;")}><div style={stage.barStyle}></div></div>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px;")}>
                  <span style={css("font-size:11px; color:rgba(255,255,255,0.45);")}>{stage.nextLabel}</span>
                  <select
                    value={L.stage || 'initial_contact'}
                    onChange={(e)=> this.onStageChange(e.target.value)}
                    style={css("padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.85); font-size:11px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer;")}
                  >
                    {this.STAGES.map((s,i)=> (
                      <option key={s} value={this.STAGE_KEYS[i]||s} style={{background:'#13182a'}}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Owner Information */}
              <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.46s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:10px;")}>Owner Information</div>
                <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px;")}>
                  {L.phone && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Phone</div>
                      <a href={`tel:${L.phone}`} style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9); text-decoration:none;")}>{L.phone}</a>
                      <CallSuite phone={L.phone} />
                    </div>
                  )}
                  {L.additionalPhones && L.additionalPhones.length > 0 && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Additional Phones</div>
                      <div style={css("display:flex; flex-direction:column; gap:6px; margin-top:5px;")}>
                        {L.additionalPhones.map((p, i) => (
                          <div key={i}>
                            <a href={`tel:${p}`} style={css("font-size:12.5px; color:rgba(255,255,255,0.85); text-decoration:none; display:block; margin-bottom:3px;")}>{p}</a>
                            <CallSuite phone={p} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {L.email && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Email</div>
                      <a href={`mailto:${L.email}`} style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9); overflow:hidden; text-overflow:ellipsis; display:block; text-decoration:none;")}>{L.email}</a>
                    </div>
                  )}
                  {L.additionalEmails && L.additionalEmails.length > 0 && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Additional Emails</div>
                      <div style={css("display:flex; flex-direction:column; gap:4px; margin-top:5px;")}>
                        {L.additionalEmails.map((e, i) => (
                          <a key={i} href={`mailto:${e}`} style={css("font-size:12.5px; color:rgba(255,255,255,0.85); text-decoration:none;")}>{e}</a>
                        ))}
                      </div>
                    </div>
                  )}
                  {L.whatsapp && L.whatsapp !== L.phone && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>WhatsApp</div>
                      <a href={`tel:${L.whatsapp}`} style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9); text-decoration:none; display:block; margin-bottom:6px;")}>{L.whatsapp}</a>
                      <CallSuite phone={L.whatsapp} />
                    </div>
                  )}
                  {L.passport && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Passport</div>
                      <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{L.passport}</div>
                    </div>
                  )}
                  {L.nationality && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Nationality</div>
                      <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{L.nationality}</div>
                    </div>
                  )}
                  {L.residence && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Residence</div>
                      <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{L.residence}</div>
                    </div>
                  )}
                  {L.language && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Language</div>
                      <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{L.language}</div>
                    </div>
                  )}
                  {L.residentUAE && (
                    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                      <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>UAE Resident</div>
                      <div style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9);")}>{L.residentUAE}</div>
                    </div>
                  )}
                </div>
              </div>

              <MediaPanel media={vm.media} />

              {vm.mandate && <MandatePanel mandate={vm.mandate} />}

              {/* connections strip */}
              <div style={css("margin-top:14px; animation: ld-rise 0.46s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:8px;")}>Connected systems</div>
                <div style={css("display:flex; flex-wrap:wrap; gap:8px;")}>
                  {vm.connections.map((cn)=>(
                    <span key={cn.key} style={cn.style}>
                      <span style={cn.dotStyle}></span>
                      <span style={css("font-size:13px; line-height:1;")}>{cn.icon}</span>
                      <span style={css("display:flex; flex-direction:column; line-height:1.2;")}>
                        <span style={css("font-size:11.5px; font-weight:600;")}>{cn.label}</span>
                        <span style={css("font-size:9.5px; opacity:0.7;")}>{cn.detail}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {vm.showSignals && <Scorecards scorecards={vm.scorecards} />}
              <RiskSignals signals={signals} flagChips={vm.flagChips} buyChips={vm.buyChips} hasFlags={vm.hasFlags} />

              {/* AI summary */}
              <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
                <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 60%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                  <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>AI Summary</span>
                </div>
                <p style={css("margin:0; font-size:13.5px; line-height:1.6; color:rgba(255,255,255,0.8);")}>{vm.summaryText}</p>
              </div>

              {/* Contact Evaluation — Peninsula 2 */}
              <ContactEvaluation valuation={vm.valuation} comps={vm.market?.comps} />

              {/* market intelligence */}
              <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;")}>
                  <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Market Intelligence</span>
                  <span style={market.trendStyle}>{market.trendLabel}</span>
                </div>
                {market.hasVal && (
                  <React.Fragment>
                    <div style={css("display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px;")}>
                      <div>
                        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>AI estimated value</div>
                        <div style={css("display:flex; align-items:baseline; gap:9px; margin-top:4px;")}>
                          <span style={css("font-size:24px; font-weight:800; color:rgba(255,255,255,0.96);")}>{market.estValue}</span>
                          <span style={css("font-size:13px; color:hsl(38 92% 60%); font-weight:600;")}>{market.psf}</span>
                        </div>
                      </div>
                      <span style={market.confStyle}>{market.confLabel}</span>
                    </div>
                    <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.6); padding:9px 11px; border-radius:9px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); margin-bottom:13px;")}>{market.basis} <span style={css("opacity:0.6;")}>· {market.updatedAt}</span></div>
                  </React.Fragment>
                )}
                <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:7px;")}>Comparable units · DLD</div>
                <div style={css("display:flex; flex-direction:column; gap:6px;")}>
                  {market.comps.map((c,i)=>(
                    <div key={i} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 11px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);")}>
                      <div style={css("min-width:0;")}>
                        <div style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);")}>{c.ref}</div>
                        <div style={css("font-size:11px; color:rgba(255,255,255,0.45); margin-top:1px;")}>{c.note}</div>
                      </div>
                      <div style={css("text-align:right; flex:none;")}>
                        <div style={css("font-size:13px; font-weight:700; color:rgba(255,255,255,0.9);")}>{c.price}</div>
                        <div style={css("font-size:10.5px; color:hsl(38 92% 58%); margin-top:1px;")}>{c.psf}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* agent notes */}
              <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
                <div style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6); margin-bottom:9px;")}>Agent Notes</div>
                <textarea value={vm.agentNotes} onChange={this.onNotesInput} rows={3} style={css("width:100%; resize:vertical; min-height:64px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.85); font-size:13px; line-height:1.55; font-family:'Inter',sans-serif;")}></textarea>
              </div>

              {/* tabs */}
              <div style={css("margin-top:18px;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;")}>
                  <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Documents & Mandate</span>
                  <div style={css("display:flex; gap:6px; flex-wrap:wrap;")}>
                    {this.props.onUploadFormA && (
                      <button onClick={this.props.onUploadFormA} style={css("display:inline-flex; align-items:center; gap:7px; padding:7px 12px; border-radius:9px; border:1px solid hsl(38 92% 50% / 0.45); background:hsl(38 92% 50% / 0.14); color:hsl(38 92% 62%); font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
                        <span style={css("font-size:14px; line-height:1;")}>📄</span> Upload Form A
                      </button>
                    )}
                    {this.props.onAssignListingManager && (
                      <button onClick={this.props.onAssignListingManager} style={css("display:inline-flex; align-items:center; gap:7px; padding:7px 12px; border-radius:9px; border:1px solid hsl(38 92% 50% / 0.45); background:hsl(38 92% 50% / 0.14); color:hsl(38 92% 62%); font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
                        <span style={css("font-size:14px; line-height:1;")}>👥</span> Assign Listing Manager
                      </button>
                    )}
                  </div>
                </div>
                <div style={css("display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:11px; margin-bottom:15px;")}>
                  {vm.tabs.map((tb)=>(
                    <button key={tb.id} onClick={tb.onClick} style={tb.style}>{tb.label}</button>
                  ))}
                </div>

                {tab.isOutreach && (
                  <React.Fragment>
                    <div style={css("display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;")}>
                      <div>
                        <div style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.9);")}>Daily outreach sequence · {tab.outreachDate}</div>
                        <div style={css("font-size:11.5px; color:rgba(255,255,255,0.45); margin-top:2px;")}>{tab.stepsCompleted} of 6 steps complete</div>
                      </div>
                      <div style={css("text-align:right;")}>
                        <div style={css("font-size:20px; font-weight:800; color:hsl(38 92% 60%);")}>{tab.dailyScore}</div>
                        <div style={css("font-size:10px; color:rgba(255,255,255,0.4);")}>daily score</div>
                      </div>
                    </div>
                    <div style={css("height:6px; border-radius:99px; background:rgba(255,255,255,0.07); overflow:hidden; margin-bottom:14px;")}><div style={tab.progressStyle}></div></div>
                    <div style={css("display:flex; flex-direction:column; gap:7px;")}>
                      {tab.steps.map((os)=>(
                        <div key={os.key} style={css("display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                          <span style={os.iconStyle}>{os.icon}</span>
                          <span style={os.labelStyle}>{os.label}</span>
                          <span style={css("margin-left:auto; font-size:11px; color:rgba(255,255,255,0.4);")}>{os.at}</span>
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                )}

                {tab.isList && (
                  <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px;")}>
                    {tab.rows.map((r,i)=>(
                      <div key={i} style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); padding:11px 13px;")}>
                        <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>{r.label}</div>
                        <div style={r.valueStyle}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {tab.isCalls && (
                  <div style={css("display:flex; flex-direction:column; gap:8px;")}>
                    {tab.calls.map((cl)=>(
                      <div key={cl.key} style={css("display:flex; align-items:center; gap:12px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                        <span style={cl.iconStyle}>{cl.icon}</span>
                        <div style={css("flex:1; min-width:0;")}>
                          <div style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.88);")}>{cl.title}</div>
                          <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px;")}>
                            <span style={cl.provStyle}>{cl.provIcon} {cl.provLabel}</span>
                            <span style={cl.statusStyle}>{cl.statusLabel}</span>
                            {cl.recording && (<span style={cl.recStyle}>▶ Recording</span>)}
                            <span style={css("font-size:11px; color:rgba(255,255,255,0.42);")}>{cl.meta}</span>
                          </div>
                        </div>
                        <span style={css("font-size:12px; font-weight:600; color:rgba(255,255,255,0.6);")}>{cl.dur}</span>
                      </div>
                    ))}
                  </div>
                )}

                {tab.isNegotiation && (
                  <React.Fragment>
                    <div style={css("border-radius:14px; border:1px solid hsl(38 92% 50% / 0.3); background:linear-gradient(180deg, hsl(38 92% 50% / 0.08), rgba(255,255,255,0.02)); overflow:hidden; margin-bottom:16px;")}>
                      <div style={css("display:flex; align-items:center; gap:8px; padding:11px 14px; border-bottom:1px solid hsl(38 92% 50% / 0.16);")}>
                        <span style={css("font-size:14px;")}>⚔</span>
                        <span style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 60%);")}>Battle Card</span>
                        <span style={css("margin-left:auto; font-size:10.5px; color:rgba(255,255,255,0.4);")}>generateBattleCard</span>
                      </div>
                      <div style={css("padding:13px 14px;")}>
                        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#fca5a5; margin-bottom:4px;")}>Pain point</div>
                        <div style={css("font-size:13px; line-height:1.5; color:rgba(255,255,255,0.85); margin-bottom:12px;")}>{tab.battle.painPoint}</div>

                        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:6px;")}>Top motivators</div>
                        <div style={css("display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;")}>
                          {tab.battle.motivators.map((mo,i)=>(
                            <span key={i} style={css("padding:5px 11px; border-radius:99px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); font-size:11.5px; color:rgba(255,255,255,0.8);")}>{mo}</span>
                          ))}
                        </div>

                        <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:11px; margin-bottom:12px;")}>
                          <div style={css("border-radius:10px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); padding:10px 12px;")}>
                            <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#fca5a5; margin-bottom:4px;")}>Competitor intel</div>
                            <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.78);")}>{tab.battle.competitor}</div>
                          </div>
                          <div style={css("border-radius:10px; background:hsl(38 92% 50% / 0.07); border:1px solid hsl(38 92% 50% / 0.25); padding:10px 12px;")}>
                            <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 60%); margin-bottom:4px;")}>Winning pitch</div>
                            <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82);")}>{tab.battle.pitch}</div>
                          </div>
                        </div>

                        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:6px;")}>Closing techniques</div>
                        <div style={css("display:flex; flex-direction:column; gap:5px;")}>
                          {tab.battle.closes.map((cz,i)=>(
                            <div key={i} style={css("display:flex; align-items:flex-start; gap:8px; font-size:12px; color:rgba(255,255,255,0.74); line-height:1.45;")}><span style={css("flex:none; color:hsl(38 92% 58%); font-weight:700;")}>→</span>{cz}</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={css("display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:15px;")}>
                      {tab.ladder.map((l,i)=>(
                        <div key={i} style={l.cardStyle}>
                          <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.45);")}>{l.label}</div>
                          <div style={{...css("font-size:18px; font-weight:800; margin-top:5px;"), color:l.color}}>{l.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:7px;")}>Offers received</div>
                    <div style={css("display:flex; flex-direction:column; gap:6px;")}>
                      {tab.offers.map((of)=>(
                        <div key={of.key} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                          <div>
                            <div style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85);")}>{of.who}</div>
                            <div style={css("font-size:11px; color:rgba(255,255,255,0.45); margin-top:1px;")}>{of.time}</div>
                          </div>
                          <div style={css("display:flex; align-items:center; gap:10px;")}>
                            <span style={css("font-size:14px; font-weight:700; color:rgba(255,255,255,0.92);")}>{of.amount}</span>
                            <span style={of.statusStyle}>{of.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                )}

                {tab.isDocuments && (
                  <DocumentsTab docs={tab.docs} />
                )}
              </div>

            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

// LandlordDetailPage.jsx — Erudite CRM
// Container page that fills the /landlord/:id route your app ALREADY navigates to
// (Landlords.jsx + KanbanBoard + LockedLeadQueue all call navigate(`/landlord/${id}`)).
//
// It fetches the real Base44 entities by id, maps your real schema fields into the
// presentational <LandlordDetail/> component, and degrades gracefully: any missing
// entity/field simply yields an empty state (e.g. "Analyse Now"), never a crash.
//
// FILES & PLACEMENT
//   src/components/LandlordDetail.jsx   <- the presentational component (already delivered)
//   src/pages/LandlordDetailPage.jsx    <- THIS file
//
// ROUTE (add to src/App.jsx, inside the <AppLayout> group, next to /landlords):
//   import LandlordDetailPage from '@/pages/LandlordDetailPage';
//   <Route path="/landlord/:id" element={<LandlordDetailPage />} />
//
// No new npm packages. Uses your existing react-query + @/api/base44Client conventions.







/* Stage keys in pipeline order — mirrors Landlords.jsx STAGES (17 stages). */
const STAGE_KEYS = [
  'initial_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing',
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
  'initial_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing',
  'owner_documents','photos_videos','photographer_scheduling','listing_creation','internal_verification',
  'listing_publication','final_confirmation','marketing_agents','marketing_network','open_house',
  'client_blast','deal_closed',
];

const EMPTY_OUTREACH = {
  date: 'Today', stepsCompleted: 0, dailyScore: 0,
  steps: [
    { key:'email_sent', label:'Email', done:false, at:null },
    { key:'whatsapp_sent', label:'WhatsApp', done:false, at:null },
    { key:'imessage_sent', label:'iMessage', done:false, at:null },
    { key:'sms_sent', label:'SMS', done:false, at:null },
    { key:'called', label:'Called', done:false, at:null },
    { key:'qualification_logged', label:'Qualification logged', done:false, at:null },
  ],
};

function temperatureFromRapport(rapport) {
  if (rapport === 'champion' || rapport === 'trust_established') return 'hot';
  if (rapport === 'warming' || rapport === 'rapport_built') return 'warm';
  return 'cold';
}

export default function LandlordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formAOpen, setFormAOpen] = useState(false);
  const [formADialogOpen, setFormADialogOpen] = useState(false);
  const [listingManagerDialogOpen, setListingManagerDialogOpen] = useState(false);

  const { data: L, isLoading, refetch: refetchLandlord } = useQ(['landlord', id], () => base44.entities.Landlord.get(id), { enabled: !!id });
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

  // Connected Systems — live existence checks (read-only)
  const phone = L?.phone;
  const { data: waBusiness = [] } = useQ(['wa_conv_business', phone], () => safe(() => base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phone, channel: 'business' }, '-created_date', 5)), { enabled: !!phone });
  const { data: waPersonal = [] } = useQ(['wa_conv_personal', phone], () => safe(() => base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phone, channel: 'personal' }, '-created_date', 5)), { enabled: !!phone });
  const { data: waMessages = [] } = useQ(['wa_messages', id], () => safe(() => base44.entities.WhatsAppMessage.filter({ landlord_id: id }, '-created_date', 200)), { enabled: !!id });
  const { data: aircallCalls = [] } = useQ(['aircall_calls', id], () => safe(() => base44.entities.AircallCall.filter({ landlord_id: id }, '-started_at', 50)), { enabled: !!id });
  // Twilio CallLog — match by phone (to_number OR from_number), same proven pattern as wa_stream_msgs.
  // Records have landlord_id: null; the real link sits in lead_id or nowhere. Phone-matching
  // catches BOTH records in each queued+webhook pair regardless of which carries the link.
  const { data: twilioLogs = [] } = useQ(['twilio_logs', phone], async () => {
    if (!phone) return [];
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const variants = [cleaned];
    if (cleaned.startsWith('+')) variants.push(cleaned.slice(1));
    else variants.push('+' + cleaned);
    const seen = new Set(); const results = [];
    for (const v of variants) {
      const toCalls = await safe(() => base44.entities.CallLog.filter({ to_number: v }, '-started_at', 100));
      const fromCalls = await safe(() => base44.entities.CallLog.filter({ from_number: v }, '-started_at', 100));
      [...(toCalls || []), ...(fromCalls || [])].forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); results.push(c); } });
    }
    return results;
  }, { enabled: !!phone, refetchInterval: 15000, refetchOnWindowFocus: true });

  // WhatsApp messages for the stream — match by phone (to_number OR from_number), trying +/- variants
  const { data: waStreamMessages = [] } = useQ(['wa_stream_msgs', phone], async () => {
    if (!phone) return [];
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const variants = [cleaned];
    if (cleaned.startsWith('+')) variants.push(cleaned.slice(1));
    else variants.push('+' + cleaned);
    const seen = new Set(); const results = [];
    for (const v of variants) {
      const fromMsgs = await safe(() => base44.entities.WhatsAppMessage.filter({ from_number: v }, 'timestamp', 100));
      const toMsgs = await safe(() => base44.entities.WhatsAppMessage.filter({ to_number: v }, 'timestamp', 100));
      [...(fromMsgs || []), ...(toMsgs || [])].forEach(m => { if (!seen.has(m.id)) { seen.add(m.id); results.push(m); } });
    }
    return results;
  }, { enabled: !!phone, refetchInterval: 15000, refetchOnWindowFocus: true });

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
  const fmtMsgTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts); if (isNaN(d)) return String(ts);
    return d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const deriveWaChannel = (msg) => {
    const eruditeSide = msg.direction === 'inbound' ? msg.to_number : msg.from_number;
    if (eruditeSide) {
      const digits = eruditeSide.replace(/\D/g, '');
      if (digits.endsWith('1806000')) return 'personal';
      if (digits.endsWith('2806000')) return 'business';
    }
    if (msg.channel === 'personal' || msg.channel === 'business') return msg.channel;
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
  waStreamMessages.forEach(msg => {
    stream.push({
      t: 'msg',
      dir: msg.direction === 'outbound' ? 'out' : 'in',
      mtype: 'text',
      text: msg.body || '',
      time: fmtMsgTime(msg.timestamp),
      order: tsOf(msg.timestamp) || 0,
      wa: deriveWaChannel(msg),
    });
  });
  const mapCallStatus = (s) => {
    if (s === 'completed') return 'done';
    if (s === 'no-answer' || s === 'busy' || s === 'failed') return 'missed';
    if (s === 'queued' || s === 'initiated' || s === 'ringing') return 'missed';
    return 'missed';
  };
  const fmtDuration = (sec, status) => {
    if (sec && sec > 0) { const m = Math.floor(sec / 60), s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
    if (status === 'no-answer') return 'No answer';
    if (status === 'busy') return 'Busy';
    if (status === 'failed') return 'Failed';
    if (status === 'queued') return 'Queued';
    return '—';
  };
  const calls = callLogs.map(c => ({
    provider: 'twilio',
    dir: c.direction === 'outbound' ? 'out' : 'in',
    title: 'Call',
    who: (c.agent_email ? c.agent_email.split('@')[0] : '—') + ' · ' + fmtMsgTime(c.started_at || c.created_date),
    dur: fmtDuration(c.duration_seconds, c.status),
    status: mapCallStatus(c.status),
    recording: !!c.recording_url,
  }));
  aircallCalls.forEach(call => {
    stream.push({ t: 'act', kind: 'call', title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · Aircall`, body: call.from_number || call.to_number || '', time: fmtMsgTime(call.started_at || call.created_date), order: tsOf(call.started_at || call.created_date) || 0 });
  });
  callLogs.forEach(call => {
    stream.push({ t: 'act', kind: 'call', title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · Twilio`, body: call.to_number || call.from_number || '', time: fmtMsgTime(call.started_at || call.created_date), order: tsOf(call.started_at || call.created_date) || 0 });
  });
  stream.sort((a, b) => a.order - b.order);

  const unit = {
    label: prop.unit_no || '—',
    building: prop.building_name || '—',
    area: prop.location || '—',
    beds: prop.bedrooms != null ? `${prop.bedrooms} Bed` : '—',
    baths: prop.bathrooms != null ? `${prop.bathrooms} Bath` : '—',
    sqft: prop.area_sqft ? `${prop.area_sqft} sqft` : '—',
    view: prop.view || '—',
    parking: '—',
    serviceCharge: '—',
    asking: prop.price_aed ? fmtAED(prop.price_aed) : '—',
    target: '—',
    floor: '—',
  };

  // Map real AI fields from Landlord entity
  const aiRollingSummary = L.ai_rolling_summary || null;
  const aiNextBestAction = L.ai_next_best_action && typeof L.ai_next_best_action === 'object' ? L.ai_next_best_action : null;
  const aiCoaching = L.ai_coaching_for_agent || null;
  const mandateWinProb = L.mandate_win_probability != null ? Math.round(L.mandate_win_probability) : null;

  // Map media/photography fields from LandlordProperty
  const media = {
    hasVideo: !!lp.has_video_walkthrough,
    videoWalkthroughUrl: lp.video_walkthrough_url || null,
    has360: !!lp.has_360_tour,
    tour360Url: lp.tour_360_url || null,
    hasDrone: !!lp.has_drone_footage,
    droneFootageUrl: lp.drone_footage_url || null,
    hasFloorPlan: !!lp.has_floor_plan,
    floorPlanUrl: lp.floor_plan_url || null,
    photographyStatus: lp.photography_status || 'none',
    photoshootScheduledAt: lp.photoshoot_scheduled_at || null,
    keysLocation: lp.keys_location || null,
    keyAccessInstructions: lp.key_access_instructions || null,
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
    const statusMap = { 'received': 'received', 'requested': 'pending', 'verified': 'received' };
    const displayStatus = d.verified_at ? 'received' : (statusMap[d.status] || d.status || 'pending');
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
  rapport,
  temperature: temperatureFromRapport(rapport),
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
  aiObjections,
  hasCompetition,
  competitionText,
  hasStrikeNow,
  strikeText,
  strikeKicker,
  aiMomentum: L.ai_momentum || null,
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
  outreach: EMPTY_OUTREACH,
  media,
  formAContractNumber: L.form_a_contract_number || null,
  mandateStatus: L.mandate_status || null,
  mandateType: L.mandate_type || null,
  };

  return (
    <React.Fragment>
      <LandlordDetail
        landlords={[mapped]}
        initialId={mapped.id}
        onBack={() => navigate('/landlords')}
        showCoaching
        showSignals
        onUploadFormA={() => setFormADialogOpen(true)}
        onAssignListingManager={() => setListingManagerDialogOpen(true)}
        landlord={mapped}
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