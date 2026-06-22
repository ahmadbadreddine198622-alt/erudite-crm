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

import React from "react";

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

export default class LandlordDetail extends React.Component {
  constructor(props) {
    super(props);
    this.streamRef = React.createRef();
    this.STAGES = ['Initial Contact','Price Discovery','Listing Commitment','Form A Initiation','Form A Signing','Owner Documents','Photos & Videos','Photographer Scheduling','Listing Creation','Internal Verification','Listing Publication','Final Confirmation','Marketing — Agents','Marketing — Network','Open House','Client Blast','Deal Closed'];
    const landlords = (props.landlords && props.landlords.length) ? props.landlords : this.seed();
    this.state = {
      landlords,
      currentId: props.initialId || landlords[0].id,
      activeTab: this.props.defaultTab || 'outreach',
      composerType: 'Note',
      composerText: '',
      composerTime: '',
      analyzing: false,
    };
  }

  componentDidMount(){ this.scrollBottom(); }
  scrollBottom(){ const el=this.streamRef.current; if(el){ requestAnimationFrame(()=>{ el.scrollTop = el.scrollHeight; }); } }
  cur(){ return this.state.landlords.find(l=>l.id===this.state.currentId); }

  // handlers
  onBack = ()=>{ if(this.props.onBack) this.props.onBack(); };
  onSwitch = (e)=>{ this.setState({ currentId:e.target.value, activeTab:this.props.defaultTab||'outreach', composerText:'', composerTime:'' }, ()=>this.scrollBottom()); };
  setTab = (id)=> this.setState({ activeTab:id });
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

  onAnalyse = ()=>{
    this.setState({ analyzing:true });
    setTimeout(()=>{
      this.setState(s=>({
        analyzing:false,
        landlords:s.landlords.map(l=>{
          if(l.id!==s.currentId) return l;
          if(l.ai) return l;
          const c=this.cannedAnalysis(l.id);
          return {...l, ai:c.ai, scores:c.scores, signals:c.signals, market:c.market, temperature:c.ai.temperature };
        })
      }), ()=>this.scrollBottom());
    }, 1500);
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

  // ---------- seed (aligned to live Base44 schema) ----------
  seed(){
    return [
      {
        id:'l1', name:'Yelena Vasquez', initials:'YV', phone:'+971 58 204 7781', source:'Property Finder',
        archetype:'portfolio_optimizer', ownerSince:'Mar 2022', agent:'Mohamed Adel', agentEmail:'mohamed@erudite-estate.com',
        stageIndex:4, temperature:'hot', rapport:'rapport_built',
        redFlags:['shopping_brokers'], buyingSignals:['requested_viewing','shared_unit_photos','stated_target_price'],
        nextBest:{ action:'Secure the exclusive Form A at Thursday’s viewing', priority:'urgent', reasoning:'A competitor is in play and a viewing is booked in 2 days — the natural moment to close the mandate.' },
        valuation:{ estValue:'AED 2.42M', psf:'AED 1,806/sqft', confidence:'high', basis:'Based on 6 sold 2BRs in Marquise Square (last 90 days), adjusted +4% for canal-view premium and high floor.', updatedAt:'Updated 2 days ago' },
        outreach:{ date:'Today', stepsCompleted:4, dailyScore:67, steps:[
          { key:'email_sent', label:'Email', done:true, at:'09:10' },
          { key:'whatsapp_sent', label:'WhatsApp', done:true, at:'09:12' },
          { key:'imessage_sent', label:'iMessage', done:false, at:null },
          { key:'sms_sent', label:'SMS', done:false, at:null },
          { key:'called', label:'Called · WhatsApp call', done:true, at:'18:10' },
          { key:'qualification_logged', label:'Qualification logged', done:true, at:'18:30' },
        ]},
        qualification:{ motivation:'Upgrading to a villa; wants to free up capital', timeline:'This quarter (high)', priceExpectation:'AED 2.45M', priceVsValuation:'+1.2% above AI valuation', mandateOpenness:'Open to exclusive if price is right', tenancy:'Vacant — ready to show', mortgage:'Free-hold, no mortgage', decisionMaker:'Yes — sole owner', outcome:'Viewing booked', rapportAfter:'rapport_built', nextStep:'Present CMA & sign Form A', followupDate:'Thursday 5 PM' },
        unit:{ label:'P2-1407', building:'Marquise Square Tower', area:'Business Bay', beds:'2 Bed', baths:'2 Bath', sqft:'1,340 sqft', view:'Canal & Burj view', parking:'1 covered', serviceCharge:'AED 18.2/sqft', asking:'AED 2.45M', target:'AED 2.40M', floor:'AED 2.30M' },
        agentNotes:'Anchored to 2.45M from a 2.10M purchase in 2022. Responds fastest to evening voice notes. Comparing us with one other agency — push exclusivity at Thursday viewing.',
        scores:{ trust:78, trustWhy:'Shares info openly, consistent replies', responsiveness:80, respWhy:'Avg reply < 30 min, evenings', urgency:72, urgencyWhy:'Wants to transact this quarter', mandateWin:0.72, mandateWhy:'Strong rapport; one competitor in play', quality:78 },
        connections:{ wa_business:'erudite · connected', wa_personal:'erudite_whatsapp · connected', aircall:'2 calls · recorded', twilio:'Browser calling ready', wa_call:'1 voice call', drive:'2 files', docusign:'Form A — draft', dld:'Title verified' },
        ai:{
          summary:'Yelena is a motivated seller of her 2BR at Marquise Square, anchored to AED 2.45M after buying at 2.10M in 2022. She is actively comparing Erudite with one other agency and replies fastest to evening voice notes. A viewing is booked for Thursday 5 PM — the moment to convert her to a signed exclusive mandate.',
          temperature:'hot', language:'Russian / English', analysedAt:'2 min ago',
          keyFacts:[
            'Owns 2BR · Marquise Square Tower (1,340 sqft, canal view)',
            'Target AED 2.45M — paid 2.10M in Mar 2022',
            'Comparing Erudite vs one other agency',
            'Prefers evening voice notes · Russian / English',
            'Viewing booked Thursday 5 PM',
          ],
          outstanding:[
            'Is she open to an exclusive (vs open) listing?',
            'Title deed & NOC readiness not yet confirmed',
            'Flexible on price for a cash buyer closing in 14 days?',
          ],
          coach:{
            score:78,
            bestLine:'Yelena, if I bring you a verified cash buyer at AED 2.4M who can close in 14 days, would you sign an exclusive with Erudite on Thursday?',
            doneWell:[ 'Led with the 23-day track record', 'Sent comparable evidence proactively' ],
            missed:[ 'Never asked for the signed Form A', 'Didn’t tackle the “other agency” objection' ],
            objections:[ 'Other agency quoted higher', 'Price anchored to purchase cost' ],
            nextMove:'At Thursday’s viewing, present the 6-comp CMA, then ask directly for an exclusive mandate and walk her through the Form A on the spot.',
          },
          suggestions:[
            { type:'followup', title:'Send comparable report', reason:'She asked for evidence before committing on price', time:'Today, 6:00 PM', message:'Hi Yelena — here’s the Marquise Square comparable report I promised. 6 similar 2BRs sold in the last 90 days at a median of AED 1,780/sqft. Happy to walk you through it before Thursday.' },
            { type:'viewing', title:'Confirm Thursday viewing', reason:'Lock the slot and set the agenda', time:'Tomorrow, 10:00 AM', message:'Looking forward to Thursday at 5 PM. I’ll bring the listing paperwork and the price-positioning plan so we can move fast once you’re ready.' },
            { type:'meeting', title:'Ask for exclusive mandate', reason:'Stage 5 — close the commitment while warm', time:'Thursday, 5:00 PM', message:'Yelena, with an exclusive mandate I can put Erudite’s full marketing engine behind your unit and target a 23-day sale. Shall we sign the exclusive Form A on Thursday?' },
          ],
        },
        signals:{ strikeNow:true, strikeKicker:'Strike now', strikeText:'Viewing in 2 days and she’s comparing agencies — secure the exclusive Thursday before the competitor does.' },
        market:{
          trend:'+3.8% QoQ', trendUp:true,
          stats:[ {value:'6', label:'Sold · 90 days'}, {value:'1,780', label:'Median AED/sqft'}, {value:'31', label:'Avg days on market'} ],
          comps:[
            { ref:'Marquise Square · 2BR · 14th fl', note:'Sold · canal view', price:'AED 2.38M', psf:'1,776/sqft' },
            { ref:'Marquise Square · 2BR · 9th fl', note:'Sold · partial view', price:'AED 2.21M', psf:'1,690/sqft' },
            { ref:'Executive Tower · 2BR · 18th fl', note:'Listed · 41 days', price:'AED 2.55M', psf:'1,840/sqft' },
          ],
        },
        battle:{
          painPoint:'Comparing two agencies; fears under-pricing and a slow, uncertain sale.',
          motivators:['Top achievable price','Fast, certain close','Hands-off process'],
          competitor:'A rival pitched an open listing at AED 2.55M — over-priced bait to win the mandate.',
          pitch:'Exclusive mandate + 23-day average sale at 98% of asking, backed by 6 verified Marquise comps.',
          closes:[ 'Assumptive: “Shall we start marketing Thursday after you sign?”', 'Scarcity: verified cash buyer ready near AED 2.4M', 'Risk-reversal: 21-day exclusivity — cancel free if no viewings' ],
        },
        calls:[
          { provider:'aircall', title:'Price discussion', who:'Mohamed Adel · Mon 14:30', dur:'12m 04s', dir:'out', status:'done', recording:true },
          { provider:'whatsapp', title:'Asked about fees', who:'Mohamed Adel · Fri 18:10', dur:'4m 22s', dir:'in', status:'done', recording:false },
          { provider:'twilio', title:'Quick follow-up (browser)', who:'Mohamed Adel · Last Wed 16:20', dur:'3m 12s', dir:'out', status:'done', recording:true },
          { provider:'aircall', title:'Intro call', who:'Mohamed Adel · Last Tue 11:05', dur:'0m 00s', dir:'out', status:'missed', recording:false },
        ],
        offers:[
          { who:'Buyer via Erudite (cash)', time:'Yesterday', amount:'AED 2.31M', status:'pending' },
          { who:'Buyer via portal (mortgage)', time:'4 days ago', amount:'AED 2.18M', status:'declined' },
        ],
        docs:[
          { icon:'📄', label:'Title Deed', provider:'Google Drive · verified', status:'received' },
          { icon:'✍', label:'Form A (listing agreement)', provider:'DocuSign · draft sent', status:'pending' },
          { icon:'🪪', label:'Passport / Emirates ID', provider:'Google Drive', status:'received' },
          { icon:'🏢', label:'NOC from developer', provider:'Awaiting request', status:'missing' },
          { icon:'🪪', label:'Trakheesi permit', provider:'Needed for Marketing Live', status:'missing' },
        ],
        stream:[
          { t:'act', kind:'stage', title:'Stage → First Contact', body:'Lead imported from Property Finder enquiry.', time:'Tue 10:40', order:1 },
          { t:'msg', dir:'out', mtype:'text', text:'Good morning Yelena, this is Mohamed from Erudite Property. I understand you’re considering selling your 2BR at Marquise Square — I’d love to help you get the best price.', time:'Tue 10:42', order:2 },
          { t:'msg', dir:'in', mtype:'text', text:'Hi Mohamed, yes I’m thinking about it. But I already spoke to another agency. What can you offer that’s different?', time:'Tue 11:15', order:3 },
          { t:'act', kind:'call', title:'Call · intro & rapport', body:'Aircall · 7m 41s outbound. Discussed motivation and rough price expectation (~2.5M).', time:'Tue 11:20', order:4 },
          { t:'msg', dir:'out', mtype:'text', text:'Completely understand. We average a 23-day sale in Business Bay at 98% of asking. I’ll send you a full comparable report so you can see exactly where your unit sits.', time:'Tue 11:34', order:5 },
          { t:'msg', dir:'in', mtype:'voice', wa:'personal', duration:'0:38', transcriptLang:'RU', transcript:'Я заплатила два миллиона сто тысяч два года назад, и хочу как минимум два с половиной. Меньше не интересно.', translation:'I paid 2.1 million two years ago, and I want at least 2.5 million. Less than that doesn’t interest me.', time:'Fri 18:08', order:6 },
          { t:'act', kind:'call', title:'Call · fees & process', body:'Aircall · 4m 22s inbound. Asked about agency fee (2%) and timeline.', time:'Fri 18:10', order:7 },
          { t:'msg', dir:'in', mtype:'media', wa:'personal', mediaLabel:'IMG · living room & canal view', text:'Here are some photos of the apartment, the view is the best in the building.', time:'Fri 18:25', order:8 },
          { t:'msg', dir:'out', mtype:'text', text:'Stunning — that canal view is a real selling point. Based on recent sales, 2.45M is achievable and I can show you the data. Could we meet at the unit Thursday at 5 PM?', time:'Fri 18:40', order:9 },
          { t:'msg', dir:'in', mtype:'text', text:'Okay, Thursday 5 PM works. Bring the numbers.', time:'Mon 09:12', order:10 },
          { t:'act', kind:'appointment', title:'Appointment · unit viewing', body:'Thursday 5:00 PM at Marquise Square P2-1407. Synced to Google Calendar. Bring comps + Form A.', time:'Mon 09:15', order:11 },
          { t:'act', kind:'stage', title:'Stage → Form A Initiation', body:'Price aligned; preparing the exclusive Form A for Thursday.', time:'Mon 09:18', order:12 },
        ],
      },
      {
        id:'l2', name:'Rashid Al-Marri', initials:'RA', phone:'+971 50 661 2204', source:'Referral',
        archetype:'overseas_owner', ownerSince:'Jan 2020', agent:'Sarah Idris', agentEmail:'sarah@erudite-estate.com',
        stageIndex:1, temperature:'cold', rapport:'cold',
        redFlags:[], buyingSignals:[], nextBest:null, valuation:null,
        outreach:{ date:'Today', stepsCompleted:1, dailyScore:17, steps:[
          { key:'email_sent', label:'Email', done:false, at:null },
          { key:'whatsapp_sent', label:'WhatsApp', done:true, at:'09:05' },
          { key:'imessage_sent', label:'iMessage', done:false, at:null },
          { key:'sms_sent', label:'SMS', done:false, at:null },
          { key:'called', label:'Called', done:false, at:null },
          { key:'qualification_logged', label:'Qualification logged', done:false, at:null },
        ]},
        qualification:null,
        unit:{ label:'P2-0905', building:'Marquise Square Tower', area:'Business Bay', beds:'1 Bed', baths:'1 Bath', sqft:'820 sqft', view:'Boulevard view', parking:'1 covered', serviceCharge:'AED 17.6/sqft', asking:'AED 1.35M', target:'AED 1.32M', floor:'AED 1.28M' },
        agentNotes:'',
        scores:null,
        connections:{ wa_business:'erudite · connected', wa_personal:false, aircall:false, twilio:'Browser calling ready', wa_call:false, drive:false, docusign:false, dld:'Title verified' },
        ai:null, signals:null, market:null,
        battle:null,
        calls:[], offers:[],
        docs:[
          { icon:'📄', label:'Title Deed', provider:'Not requested', status:'pending' },
          { icon:'✍', label:'Form A (listing agreement)', provider:'DocuSign', status:'missing' },
          { icon:'🪪', label:'Passport / Emirates ID', provider:'Not requested', status:'pending' },
          { icon:'🏢', label:'NOC from developer', provider:'DocuSign', status:'missing' },
        ],
        stream:[
          { t:'act', kind:'stage', title:'Stage → First Contact', body:'Referral from existing client. No reply yet.', time:'Today 09:02', order:1 },
          { t:'msg', dir:'out', mtype:'text', text:'Hello Rashid, this is Sarah from Erudite Property. Your friend suggested I reach out about your unit at Marquise Square. Is now a good time?', time:'Today 09:05', order:2 },
        ],
      },
    ];
  }

  cannedAnalysis(id){
    return {
      ai:{
        summary:'Rashid is an early-stage referral who owns a 1BR at Marquise Square. He has not yet replied to the first outreach. Intent is unconfirmed — a short, warm follow-up referencing the mutual contact is the best next step to open the conversation.',
        temperature:'warm', language:'English / Arabic', analysedAt:'just now',
        keyFacts:[ 'Owns 1BR · Marquise Square Tower (820 sqft)', 'Referral from an existing Erudite client', 'No reply to first message yet', 'Owner since Jan 2020 · overseas' ],
        outstanding:[ 'Is Rashid looking to sell or let?', 'Preferred contact channel & time unknown', 'Price expectation not established' ],
        coach:{
          score:41,
          bestLine:'Hi Rashid — [referrer] mentioned you might be weighing your options on the Marquise unit. No pressure; would a quick 10-minute call this week help you see where prices are right now?',
          doneWell:[ 'Reached out same day as referral' ],
          missed:[ 'First message was generic — didn’t name the referrer', 'No value hook (recent sale in his building)' ],
          objections:[ 'No engagement yet' ],
          nextMove:'Send a warm, referrer-named follow-up with one concrete data point (a recent 1BR sale in his tower) and a low-friction call-to-action.',
        },
        suggestions:[
          { type:'followup', title:'Warm referral follow-up', reason:'No reply — name the referrer to build trust', time:'Today, 5:00 PM', message:'Hi Rashid — [referrer] mentioned you might be weighing your options on the Marquise unit. A 1BR just sold in your building at AED 1.34M. Worth a quick chat this week?' },
          { type:'call', title:'Schedule intro call', reason:'Overseas owner — a call moves faster than chat', time:'Tomorrow, 11:00 AM', message:'Quick one Rashid — happy to call and tell you what your unit could achieve today. What time works in your timezone?' },
        ],
      },
      scores:{ trust:48, trustWhy:'Referral basis; unproven', responsiveness:20, respWhy:'Messaged, no reply yet', urgency:30, urgencyWhy:'No signals yet', mandateWin:0.34, mandateWhy:'Early stage, intent unclear', quality:41 },
      signals:{ strikeNow:false, strikeKicker:'Warm up', strikeText:'No reply yet — send the referral follow-up today to open the conversation.' },
      market:{
        trend:'+3.8% QoQ', trendUp:true,
        stats:[ {value:'4', label:'Sold · 90 days'}, {value:'1,620', label:'Median AED/sqft'}, {value:'38', label:'Avg days on market'} ],
        comps:[
          { ref:'Marquise Square · 1BR · 12th fl', note:'Sold · boulevard view', price:'AED 1.34M', psf:'1,634/sqft' },
          { ref:'Marquise Square · 1BR · 6th fl', note:'Sold · low floor', price:'AED 1.27M', psf:'1,560/sqft' },
        ],
      },
    };
  }

  // ---------- viewmodel ----------
  computeVM(){
    const S=this.state; const L=this.cur();
    const showCoaching = this.props.showCoaching!==false;
    const showSignals = this.props.showSignals!==false;

    const landlordOptions = S.landlords.map(l=>({ id:l.id, name:l.name }));
    const hasAI=!!L.ai;

    let ai={};
    if(hasAI){
      ai={
        summary:L.ai.summary, language:L.ai.language, analysedAt:L.ai.analysedAt,
        tempLabel:this.tempMeta(L.ai.temperature).label, tempChipStyle:this.tempChip(L.ai.temperature),
        keyFacts:L.ai.keyFacts, outstanding:L.ai.outstanding,
        coach:{ score:L.ai.coach.score, scoreColor:this.scoreColor(L.ai.coach.score), bestLine:L.ai.coach.bestLine, doneWell:L.ai.coach.doneWell, missed:L.ai.coach.missed, objections:L.ai.coach.objections, nextMove:L.ai.coach.nextMove },
        actions:L.ai.suggestions.map(a=>{
          const [icon,bg,color]=this.sugMeta(a.type);
          return { title:a.title, reason:a.reason, time:a.time, icon, onClick:()=>this.fillDraft(a),
            iconStyle:{ flex:'none', width:'30px', height:'30px', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', background:bg, color, marginTop:'1px' },
            chipStyle:{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'9px 11px', borderRadius:'11px', border:'1px solid hsl(38 92% 50% / 0.28)', background:'hsl(38 92% 50% / 0.06)', cursor:'pointer', fontFamily:"'Inter',sans-serif", textAlign:'left', width:'100%' } };
        }),
      };
    }

    const sorted=[...L.stream].sort((a,b)=>a.order-b.order);
    const stream=sorted.map((s,idx)=>{
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
    const msgCount=sorted.filter(s=>s.t==='msg').length;
    const actCount=sorted.filter(s=>s.t==='act').length;

    const composerTypes=['Note','Task','Follow-up','Appointment'].map(t=>{
      const on=S.composerType===t; const ic={ 'Note':'📝','Task':'✓','Follow-up':'↻','Appointment':'📅' }[t];
      return { label:t, icon:ic, onClick:()=>this.setComposerType(t),
        style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'6px 11px', borderRadius:'9px', fontSize:'11.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          background: on?'hsl(38 92% 50% / 0.14)':'rgba(255,255,255,0.04)', color: on?'hsl(38 92% 62%)':'rgba(255,255,255,0.6)', border:'1px solid '+(on?'hsl(38 92% 50% / 0.45)':'rgba(255,255,255,0.1)') } };
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
    };

    const total=this.STAGES.length;
    const pct=Math.round((L.stageIndex/total)*100);
    const stage={ index:L.stageIndex, total, label:this.STAGES[L.stageIndex-1],
      barStyle:{ height:'100%', width:pct+'%', background:'linear-gradient(90deg, #8b5cf6, #c4b5fd)' },
      nextLabel: L.stageIndex<total ? ('Next · '+this.STAGES[L.stageIndex]) : 'Final stage' };

    let nextBest={ show:false };
    if(L.nextBest){
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
      waPersonalBadgeStyle:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 9px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600,
        background: L.connections && L.connections.wa_personal ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.04)',
        border: '1px solid '+(L.connections && L.connections.wa_personal ? 'rgba(59,130,246,0.32)' : 'rgba(255,255,255,0.1)'),
        color: L.connections && L.connections.wa_personal ? '#93c5fd' : 'rgba(255,255,255,0.4)' },
      waPersonalDotStyle:{ width:'6px', height:'6px', borderRadius:'50%', background: L.connections && L.connections.wa_personal ? '#3b82f6' : 'rgba(255,255,255,0.25)' },
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
      summaryText: hasAI ? L.ai.summary : 'No AI summary yet — run “Analyse Now” in the conversation panel to generate one.',
      market, agentNotes:L.agentNotes,
      tabs, tab,
    };
  }

  render(){
    const vm = this.computeVM();
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
                  <span style={css("display:inline-flex; align-items:center; gap:5px; padding:5px 9px; border-radius:99px; background:rgba(37,211,102,0.12); border:1px solid rgba(37,211,102,0.3); font-size:10.5px; font-weight:600; color:#4ade80;")}>
                    <span style={css("width:6px; height:6px; border-radius:50%; background:#25D366;")}></span> Business
                  </span>
                  <span style={vm.waPersonalBadgeStyle}>
                    <span style={vm.waPersonalDotStyle}></span> Personal
                  </span>
                </div>
              </div>

              {/* pinned AI card */}
              <div style={css("flex:none; margin:0 16px 10px; border-radius:16px; border:1px solid hsl(38 92% 50% / 0.28); background:linear-gradient(180deg, hsl(38 92% 50% / 0.07), rgba(255,255,255,0.02)); overflow:hidden; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid hsl(38 92% 50% / 0.16);")}>
                  <span style={css("display:inline-flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 60%);")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 60%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                    AI Conversation Intelligence
                  </span>
                  <button onClick={this.onAnalyse} style={css("display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:9px; border:1px solid hsl(38 92% 50% / 0.45); background:hsl(38 92% 50% / 0.14); color:hsl(38 92% 62%); font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif;")}>
                    <span style={vm.analyseIconStyle}>↻</span> {vm.analyseLabel}
                  </button>
                </div>

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

                          <div style={css("margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;")}>
                            {ai.coach.objections.map((ob,i)=>(
                              <span key={i} style={css("display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:99px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); font-size:10.5px; color:#fca5a5;")}>⚑ {ob}</span>
                            ))}
                          </div>

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

              {/* pipeline progress */}
              <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.43s cubic-bezier(0.22,1,0.36,1) both;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;")}>
                  <span style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>Pipeline · {stage.label}</span>
                  <span style={css("font-size:11px; color:hsl(38 92% 60%); font-weight:600;")}>Stage {stage.index} of {stage.total}</span>
                </div>
                <div style={css("height:6px; border-radius:99px; background:rgba(255,255,255,0.07); overflow:hidden;")}><div style={stage.barStyle}></div></div>
                <div style={css("font-size:11px; color:rgba(255,255,255,0.45); margin-top:7px;")}>{stage.nextLabel}</div>
              </div>

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

              {/* strike now banner */}
              {signals.showStrike && (
                <div style={signals.strikeStyle}>
                  <span style={signals.strikeDot}></span>
                  <div style={css("min-width:0;")}>
                    <span style={{...css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase;"), color:signals.strikeAccent}}>{signals.strikeKicker}</span>
                    <div style={css("font-size:13px; line-height:1.45; color:rgba(255,255,255,0.88); margin-top:3px;")}>{signals.strikeText}</div>
                  </div>
                </div>
              )}

              {/* next best action */}
              {vm.nextBest.show && (
                <div style={vm.nextBest.boxStyle}>
                  <span style={css("font-size:16px; line-height:1.2;")}>🎯</span>
                  <div style={css("min-width:0; flex:1;")}>
                    <div style={css("display:flex; align-items:center; gap:8px; flex-wrap:wrap;")}>
                      <span style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.45);")}>Next best action</span>
                      <span style={vm.nextBest.badgeStyle}>{vm.nextBest.priority}</span>
                    </div>
                    <div style={css("font-size:13.5px; font-weight:600; color:rgba(255,255,255,0.92); margin-top:5px;")}>{vm.nextBest.action}</div>
                    <div style={css("font-size:11.5px; color:rgba(255,255,255,0.55); margin-top:3px; line-height:1.45;")}>{vm.nextBest.reasoning}</div>
                  </div>
                </div>
              )}

              {/* red flags + buying signals */}
              {vm.hasFlags && (
                <div style={css("display:flex; flex-wrap:wrap; gap:7px; margin-top:12px;")}>
                  {vm.flagChips.map((fc,i)=>(<span key={'f'+i} style={fc.style}>{fc.icon} {fc.label}</span>))}
                  {vm.buyChips.map((bc,i)=>(<span key={'b'+i} style={bc.style}>{bc.icon} {bc.label}</span>))}
                </div>
              )}

              {/* scorecard row */}
              {vm.showSignals && (
                <div style={css("display:grid; grid-template-columns:repeat(4, 1fr); gap:11px; margin-top:14px; animation: ld-rise 0.5s cubic-bezier(0.22,1,0.36,1) both;")}>
                  {vm.scorecards.map((sc,i)=>(
                    <div key={i} style={css("border-radius:13px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.03); padding:12px 13px;")}>
                      <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.42);")}>{sc.label}</div>
                      <div style={css("display:flex; align-items:baseline; gap:3px; margin-top:5px;")}>
                        <span style={{...css("font-size:19px; font-weight:800;"), color:sc.color}}>{sc.value}</span>
                        <span style={css("font-size:10px; color:rgba(255,255,255,0.38);")}>{sc.unit}</span>
                      </div>
                      <div style={css("height:4px; border-radius:99px; background:rgba(255,255,255,0.08); margin-top:7px; overflow:hidden;")}><div style={sc.barStyle}></div></div>
                      <div style={css("font-size:10px; color:rgba(255,255,255,0.4); margin-top:6px; line-height:1.4;")}>{sc.why}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI summary */}
              <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
                <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 60%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
                  <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>AI Summary</span>
                </div>
                <p style={css("margin:0; font-size:13.5px; line-height:1.6; color:rgba(255,255,255,0.8);")}>{vm.summaryText}</p>
              </div>

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
                  <div style={css("display:flex; flex-direction:column; gap:7px;")}>
                    {tab.docs.map((dc)=>(
                      <div key={dc.key} style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                        <div style={css("display:flex; align-items:center; gap:11px; min-width:0;")}>
                          <span style={css("font-size:15px;")}>{dc.icon}</span>
                          <div style={css("min-width:0;")}>
                            <div style={css("font-size:13px; color:rgba(255,255,255,0.85);")}>{dc.label}</div>
                            <div style={css("font-size:10.5px; color:rgba(255,255,255,0.42); margin-top:1px;")}>{dc.provider}</div>
                          </div>
                        </div>
                        <span style={dc.statusStyle}>{dc.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}
