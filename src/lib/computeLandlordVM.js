import React from 'react';

/**
 * computeLandlordVM — the view-model for LandlordDetailPage, extracted so the
 * page file stays under the editor line limit. `self` is the LandlordDetail class
 * instance; the body is the verbatim former computeVM() with `this` → `self`.
 */
export function computeLandlordVM(self) {
    const S=self.state; const L=self.cur();
    const showCoaching = self.props.showCoaching!==false;
    const showSignals = self.props.showSignals!==false;

    const landlordOptions = S.landlords.map(l=>({ id:l.id, name:l.name }));
    const hasAIProcessed = !!L.aiProcessedAt;

    const arr = (x) => Array.isArray(x) ? x : [];
    const sc = L.scores || {};
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
      scoreTrend: L.scoreTrend || null,
      dealThesis: L.aiDealThesis || '',
      openQuestions: arr(L.aiOpenQuestions),
      confidence: L.aiConfidence || null,
      leverageUnknown: L.aiLeverageUnknown || '',
      reasoningTrace: arr(L.aiReasoningTrace),
      campaignPlan: L.aiCampaignPlan || null,
      council: L.aiCouncil || null,
    };

    const sorted=[...L.stream].sort((a,b)=>(a.order||0)-(b.order||0));
    const filterMode=S.streamFilter || 'all';
    const filtered = filterMode==='all' ? sorted
      : filterMode==='email' ? sorted.filter(s => s.channel==='email' || s.kind==='email')
      : filterMode==='imessage' ? sorted.filter(s => s.channel==='imessage')
      : filterMode==='telegram' ? sorted.filter(s => s.channel==='telegram')
      : sorted.filter(s => s.t==='act' || s.wa===filterMode);
    const analyzeError=S.analyzeError || '';
    const imessageHasBB2 = sorted.some(s => s.channel === 'imessage' && (s.instance || 'bb1') === 'bb2');
    const stream=filtered.map((s,idx)=>{
      if(s.t==='msg'){
        const out = s.dir==='out';
        const waveform = s.mtype==='voice' ? [9,15,7,18,11,16,6,13,9,17,8,12].map((h,k)=>React.createElement('span',{ key:k, style:{ width:'2px', height:h+'px', borderRadius:'2px', background: out?'hsl(38 92% 55% / 0.7)':'rgba(255,255,255,0.4)' } })) : null;
        return {
          key:idx, isMsg:true, isAct:false,
          isText:s.mtype==='text', isVoice:s.mtype==='voice', isMedia:s.mtype==='media',
          subject:s.subject, emailBody:s.emailBody,
          text:s.text, transcript:s.transcript, translation:s.translation, transcriptLang:s.transcriptLang, mediaLabel:s.mediaLabel, duration:s.duration, waveform, time:s.time,
          sender: out ? (s.senderName || (s.fromNumber ? (self.props.resolveAgentByPhone?.(s.fromNumber) || L.agent || 'Agent') : (L.agent || 'Agent'))) : (s.senderName || L.name),
          channel: s.channel==='email' ? 'Email' : s.channel==='imessage' ? 'iMessage' : s.channel==='telegram' ? 'Telegram' : s.channel==='sms' ? 'SMS' : (s.wa==='personal' ? 'WA Personal' : s.wa==='agent' ? 'WA Agent' : 'WA Business'),
          channelStyle:{ fontSize:'8.5px', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
            color: s.channel==='email' ? 'hsl(38 92% 62%)' : s.channel==='imessage' ? '#60a5fa' : s.channel==='telegram' ? '#29b6f6' : s.channel==='sms' ? '#38bdf8' : (s.wa==='personal' ? '#93c5fd' : s.wa==='agent' ? '#2dd4bf' : '#4ade80'),
            background: s.channel==='email' ? 'hsl(38 92% 50% / 0.12)' : s.channel==='imessage' ? 'rgba(10,132,255,0.14)' : s.channel==='telegram' ? 'rgba(41,182,246,0.14)' : s.channel==='sms' ? 'rgba(56,189,248,0.14)' : (s.wa==='personal' ? 'rgba(59,130,246,0.14)' : s.wa==='agent' ? 'rgba(45,212,191,0.14)' : 'rgba(37,211,102,0.12)'),
            padding:'1px 5px', borderRadius:'4px' },
          imessageInstance: s.channel==='imessage' ? (s.instance || 'bb1') : null,
          showInstanceLabel: imessageHasBB2 && s.channel==='imessage',
          rowStyle:{ display:'flex', justifyContent: out?'flex-end':'flex-start' },
          bubbleStyle:{ maxWidth:'96%', padding:'10px 13px', borderRadius: out?'14px 14px 4px 14px':'14px 14px 14px 4px', background: out?'hsl(38 92% 50% / 0.12)':'rgba(255,255,255,0.05)', border:'1px solid '+(out?'hsl(38 92% 50% / 0.28)':'rgba(255,255,255,0.1)') },
          senderStyle:{ fontSize:'10px', fontWeight:700, letterSpacing:'0.03em', textTransform:'uppercase', color: out?'hsl(38 92% 58%)':'rgba(255,255,255,0.45)' },
          timeStyle:{ fontSize:'9.5px', color:'rgba(255,255,255,0.35)', marginTop:'6px', textAlign: out?'right':'left' },
        };
      } else {
        const [icon,bg,color]=self.actKindMeta(s.kind);
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
      return { label:t, icon:ic, onClick: ()=>self.setComposerType(t),
        style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'6px 11px', borderRadius:'9px', fontSize:'11.5px', fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          background: isTelegram ? (on?'rgba(41,182,246,0.2)':'rgba(41,182,246,0.08)') : isIMessage ? (on?'rgba(10,132,255,0.2)':'rgba(10,132,255,0.08)') : isChat ? (on?'rgba(37,211,102,0.2)':'rgba(37,211,102,0.08)') : (on?'hsl(38 92% 50% / 0.14)':'rgba(255,255,255,0.04)'),
          color: isTelegram ? (on?'#29b6f6':'#4fc3f7') : isIMessage ? (on?'#0A84FF':'#60a5fa') : isChat ? (on?'#22c55e':'#86efac') : (on?'hsl(38 92% 62%)':'rgba(255,255,255,0.6)'),
          border:'1px solid '+(isTelegram ? (on?'rgba(41,182,246,0.5)':'rgba(41,182,246,0.3)') : isIMessage ? (on?'rgba(10,132,255,0.5)':'rgba(10,132,255,0.3)') : isChat ? (on?'rgba(37,211,102,0.5)':'rgba(37,211,102,0.3)') : (on?'hsl(38 92% 50% / 0.45)':'rgba(255,255,255,0.1)')) } };
    });
    const placeholders={ 'Note':'Add a note to the timeline…', 'Task':'Task title…', 'Follow-up':'What’s the follow-up?', 'Appointment':'Appointment details…', 'Chat':'Type a WhatsApp message… (Enter to send)', 'iMessage':'Type an iMessage… (Enter to send)', 'Telegram':'Type a Telegram message… (Enter to send)', 'Email':'Use the AI Email Draft panel above to compose…' };

    const rm=self.rapportMeta(L.rapport);
    const hdr={
      name:L.name, initials:L.initials,
      avatarStyle:{ flex:'none', width:'52px', height:'52px', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:700, color:'hsl(38 92% 62%)', background:'hsl(38 92% 50% / 0.12)', border:'1px solid hsl(38 92% 50% / 0.32)' },
      archetype:self.titleize(L.archetype),
      archetypeStyle:{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'99px', fontSize:'10.5px', fontWeight:700, letterSpacing:'0.03em', textTransform:'uppercase', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.32)', color:'#c4b5fd' },
      bedsSqft: L.unit.beds+' · '+L.unit.sqft,
      unitBuilding: L.unit.building,
      unitLabel: L.unit.label,
      askingLabel: 'Asking '+L.unit.asking,
      stageLabel:self.STAGES[L.stageIndex-1],
      stageStyle:{ display:'inline-flex', alignItems:'center', padding:'5px 12px', borderRadius:'99px', fontSize:'11.5px', fontWeight:700, background:'rgba(139,92,246,0.16)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd' },
      tempLabel:rm.label, tempChipStyle:rm.chipStyle,
      phone: L.phone && L.phone !== '—' ? L.phone : null,
    };

    const total=self.STAGES.length;
    const pct=Math.round((L.stageIndex/total)*100);
    const stage={ index:L.stageIndex, total, label:self.STAGES[L.stageIndex-1],
      barStyle:{ height:'100%', width:pct+'%', background:'linear-gradient(90deg, #8b5cf6, #c4b5fd)' },
      nextLabel: L.stageIndex<total ? ('Next · '+self.STAGES[L.stageIndex]) : 'Final stage' };

    let nextBest={ show:false };
    if(L.aiNextBestAction && typeof L.aiNextBestAction === 'object' && L.aiNextBestAction.action){
      const [color,bg,bd]=self.priorityMeta(L.aiNextBestAction.priority || 'medium');
      nextBest={ show:true, action:L.aiNextBestAction.action, reasoning:L.aiNextBestAction.reasoning || '', priority:self.titleize(L.aiNextBestAction.priority || 'Medium'),
        boxStyle:{ display:'flex', alignItems:'flex-start', gap:'11px', marginTop:'12px', borderRadius:'13px', padding:'13px 15px', border:'1px solid '+bd, background:bg },
        badgeStyle:{ flex:'none', padding:'3px 9px', borderRadius:'99px', fontSize:'9.5px', fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', color, background:'rgba(255,255,255,0.06)', border:'1px solid '+bd },
        accent:color };
    } else if(L.nextBest){
      const [color,bg,bd]=self.priorityMeta(L.nextBest.priority);
      nextBest={ show:true, action:L.nextBest.action, reasoning:L.nextBest.reasoning, priority:self.titleize(L.nextBest.priority),
        boxStyle:{ display:'flex', alignItems:'flex-start', gap:'11px', marginTop:'12px', borderRadius:'13px', padding:'13px 15px', border:'1px solid '+bd, background:bg },
        badgeStyle:{ flex:'none', padding:'3px 9px', borderRadius:'99px', fontSize:'9.5px', fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', color, background:'rgba(255,255,255,0.06)', border:'1px solid '+bd },
        accent:color };
    }
    const flagChips=(L.redFlags||[]).map(f=>({ label:self.titleize(f), style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, color:'#fca5a5', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.28)' }, icon:'⚑' }));
    const buyChips=(L.buyingSignals||[]).map(b=>({ label:self.titleize(b), style:{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'99px', fontSize:'10.5px', fontWeight:600, color:'#34d399', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.28)' }, icon:'✓' }));
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
      const mk=(label,val,unit,why)=>{ const n = unit==='%'? Math.round(val*100): val; const col=self.scoreColor(n);
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
      return { id, label, onClick:()=>self.setTab(id),
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
      kv('Archetype', self.titleize(L.archetype), '#c4b5fd'), kv('Owner since', L.ownerSince), kv('Assigned agent', L.agent, 'hsl(38 92% 60%)'),
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