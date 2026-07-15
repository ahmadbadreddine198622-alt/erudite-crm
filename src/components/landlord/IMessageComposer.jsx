// IMessageComposer — compact HubSpot-style iMessage composer with icon toolbar
// and AI popover. One short textarea + slim icon row. Same shared brain as email.
//
// Props:
//   landlordId   (string)  — current landlord id
//   onSent       (fn)      — called after an iMessage is sent
//   onFallback   (fn)      — called when no iMessage handle exists

import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import EmailTemplatePicker from './EmailTemplatePicker';
import EmailTemplateDialog from './EmailTemplateDialog';
import { IconButton } from './ComposerToolbar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Sparkles, Send, Save, X } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import ModernComposerField from './ModernComposerField';
import TemplateField from '@/components/common/TemplateField';
import ApproachDraftStrip from './ApproachDraftStrip';

function playSentSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
    const ping = ctx.createOscillator();
    const pgain = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1320, now + 0.16);
    pgain.gain.setValueAtTime(0.0001, now + 0.16);
    pgain.gain.exponentialRampToValueAtTime(0.1, now + 0.2);
    pgain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    ping.connect(pgain).connect(ctx.destination);
    ping.start(now + 0.16);
    ping.stop(now + 0.52);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch (_) {}
}

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

const MODES = [
  { key: 'asset_proof', label: 'Asset proof', hint: 'Shows you know their exact unit.' },
  { key: 'real_buyer', label: 'Real buyer', hint: 'Built around a specific real buyer.' },
  { key: 'market_gift', label: 'Market gift', hint: 'Leads with one market insight.' },
  { key: 'no_ask_interrupt', label: 'No-ask', hint: 'Not asking for the listing.' },
  { key: 'collaboration', label: 'Collaboration', hint: 'Work alongside their broker.' },
  { key: 'funds_ready', label: 'Funds ready', hint: 'Buyer ready to deposit.' },
];
const REQUIRES_BUYER = ['real_buyer', 'funds_ready'];
const REQUIRES_MARKET = ['market_gift'];

const PSYCHOLOGY_OPTIONS = [
  { value: '', label: 'Default tone' },
  { value: 'stubborn', label: 'Stubborn' },
  { value: 'dislikes_email', label: 'Dislikes email' },
  { value: 'avoids_talking', label: "Doesn't want to call" },
  { value: 'stressed', label: 'Stressed' },
  { value: 'skeptical', label: 'Skeptical' },
  { value: 'time_poor', label: 'Busy / time-poor' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'emotionally_attached', label: 'Attached to home' },
  { value: 'price_anchored', label: 'High price expectation' },
  { value: 'previously_burned', label: 'Burned by broker' },
  { value: 'non_committal', label: 'Slow to respond' },
  { value: 'status_conscious', label: 'Status-conscious' },
];

const fieldSm = "padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:11px; font-family:'Inter',sans-serif; width:100%; outline:none;";
const labelSm = "font-size:8px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:2px;";

export default function IMessageComposer({ landlordId, onSent, onFallback, imessageStatus = 'unknown', imessageHandles = [], approachDrafts, approachForging, onRegenerateApproach }) {
  const blocked = imessageStatus === 'not_available' || imessageStatus === 'error';
  const handles = Array.isArray(imessageHandles) ? imessageHandles : [];
  const availableHandles = handles.filter((h) => h && h.imessage_status === 'available');
  const [selectedAddress, setSelectedAddress] = useState('all');
  const [instance, setInstance] = useState('bb1');
  const [mode, setMode] = useState('asset_proof');
  const [psychology, setPsychology] = useState('');
  const [buyerDetail, setBuyerDetail] = useState('');
  const [marketFigure, setMarketFigure] = useState('');
  const [compReference, setCompReference] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Unified text area — serves as both AI draft and manual text
  const [text, setText] = useState('');
  const [draftGloss, setDraftGloss] = useState('');
  const [language, setLanguage] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [sending, setSending] = useState(false);

  const [justSent, setJustSent] = useState(false);
  const flashTimer = useRef(null);
  const [lastSent, setLastSent] = useState(null);
  const [sentExpanded, setSentExpanded] = useState(false);

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplatePrefill, setSaveTemplatePrefill] = useState(null);

  // Pending voice-note (or other) attachment to send alongside / instead of text.
  const [attachment, setAttachment] = useState(null);

  const taRef = useRef(null);

  // Approach Forge — load the auto-forged iMessage draft into the text area (agent reviews, then sends).
  const loadApproachDraft = (d) => {
    if (!d || !d.body_native) return;
    setText(d.body_native || '');
    setDraftGloss(d.body_english_gloss || '');
    setLanguage((approachDrafts && approachDrafts.language) || '');
    setHasDraft(true);
    toast.success('Approach draft loaded — review, then send');
  };

  // Insert an emoji at the cursor position in the textarea.
  const insertEmoji = (emoji) => {
    const ta = taRef.current;
    if (!ta) { setText((text || '') + emoji); return; }
    const start = ta.selectionStart ?? (text || '').length;
    const end = ta.selectionEnd ?? (text || '').length;
    const next = (text || '').slice(0, start) + emoji + (text || '').slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const [signatureText, setSignatureText] = useState('');
  const [llCtx, setLlCtx] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await base44.entities.CompanySettings.list('', 1);
        if (mounted) setSignatureText(settings?.[0]?.imessage_signature_text || '');
      } catch (_) {}
      if (landlordId) {
        try {
          const l = await base44.entities.Landlord.get(landlordId);
          if (mounted) setLlCtx({
            name: l?.full_name_en || l?.full_name || '',
            unit: l?.unit_reference || '',
            project: l?.project_name || '',
            asking: l?.asking_price_aed || '',
            agentName: l?.assigned_agent_email || '',
          });
        } catch (_) {}
      }
    })();
    return () => { mounted = false; };
  }, [landlordId]);

  const handleTemplateSelect = ({ body }) => {
    setText(body || '');
    setHasDraft(false);
    toast.success('Template loaded — edit as needed');
  };

  const handleSaveAsTemplate = () => {
    if (!text.trim()) { toast.error('Nothing to save'); return; }
    setSaveTemplatePrefill({ title: text.slice(0, 40), subject: '', body: text });
    setSaveTemplateOpen(true);
  };

  const needsBuyer = REQUIRES_BUYER.includes(mode);
  const needsMarket = REQUIRES_MARKET.includes(mode);
  const activeMode = MODES.find((m) => m.key === mode);

  const generate = async () => {
    if (generating) return;
    if (needsBuyer && !buyerDetail.trim()) { toast.error('This mode needs a buyer detail'); return; }
    if (needsMarket && !marketFigure.trim()) { toast.error('This mode needs a market figure'); return; }
    setGenerating(true);
    try {
      const agent_inputs = {};
      if (buyerDetail.trim()) agent_inputs.buyer_detail = buyerDetail.trim();
      if (marketFigure.trim()) agent_inputs.market_figure = marketFigure.trim();
      if (compReference.trim()) agent_inputs.comp_reference = compReference.trim();
      const payload = { landlord_id: landlordId, mode, agent_inputs, channel: 'imessage' };
      if (psychology) payload.psychology = psychology;
      const res = await base44.functions.invoke('draftLandlordEmail', payload);
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Draft generation failed');
      const d = data.draft || {};
      setText(d.body_native || '');
      setDraftGloss(d.body_english_gloss || '');
      setLanguage(d.language || '');
      setHasDraft(true);
      setAiOpen(false);
      toast.success('Draft loaded — review, then send');
    } catch (e) {
      toast.error(e?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (blocked) return;
    if (!text.trim() && !attachment) { toast.error('Nothing to send'); return; }
    setSending(true);
    try {
      // Resolve which iMessage handle(s) to send to. When the landlord has 2+
      // confirmed-available handles, the agent can pick one or "All".
      let targets;
      if (availableHandles.length >= 2) {
        targets = selectedAddress === 'all' ? availableHandles.map((h) => h.handle) : [selectedAddress];
      } else if (availableHandles.length === 1) {
        targets = [availableHandles[0].handle];
      } else {
        targets = [null]; // no resolved handle — let the backend use the landlord default
      }

      for (let i = 0; i < targets.length; i++) {
        const addr = targets[i];
        const payload = { landlord_id: landlordId, text, origin: window.location.origin, instance };
        if (addr) payload.address = addr;
        if (i > 0) payload.skip_banner = true; // attach the first-contact banner only once
        if (attachment) payload.attachment = attachment; // voice note / file attachment
        const res = await base44.functions.invoke('sendIMessage', payload);
        const data = res?.data ?? res;
        if (data?.fallback === 'whatsapp' || (data?.error && /no imessage/i.test(data.error))) {
          toast.error('No iMessage handle for this landlord.');
          setSending(false);
          return;
        }
        if (data?.error) throw new Error(data.error);
      }
      playSentSound();
      if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (_) {} }
      setJustSent(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustSent(false), 1700);
      toast.success(targets.length > 1 ? `Sent to ${targets.length} handles ✓` : 'Sent ✓');
      const sentText = text.trim() || (attachment ? '🎙 Voice note' : '');
      setLastSent({ text: sentText, to: targets.filter(Boolean).join(', ') || 'iMessage' });
      setSentExpanded(true);
      if (onSent) onSent({ text });
      setText(''); setDraftGloss(''); setLanguage(''); setHasDraft(false); setAttachment(null);
    } catch (e) {
      toast.error(e?.message || 'Failed to send iMessage');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="glass-card" style={{ ...css("margin-bottom:9px; border-radius:14px; padding:12px 14px 10px;"), position: 'relative', overflow: 'hidden', borderTopColor: 'rgba(10,132,255,0.35)', boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(10,132,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
      <style>{`
        @keyframes imc-spin { to { transform: rotate(360deg); } }
        @keyframes imc-flash-in { 0% { opacity:0; transform:scale(0.6); } 55% { opacity:1; transform:scale(1.08); } 70% { transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
        @keyframes imc-flash-out { to { opacity:0; } }
        @keyframes imc-plane { 0% { transform:translate(-6px,4px) rotate(-8deg); opacity:0; } 30% { opacity:1; } 100% { transform:translate(70px,-46px) rotate(12deg); opacity:0; } }
        @keyframes imc-ring { 0% { transform:scale(0.4); opacity:0.7; } 100% { transform:scale(2.4); opacity:0; } }
      `}</style>
      {/* iMessage header strip */}
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px; padding-bottom:7px; border-bottom:1px solid rgba(10,132,255,0.15);")}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0A84FF', boxShadow: '0 0 8px rgba(10,132,255,0.5)', flex: 'none' }} />
        <span style={css("font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#60a5fa; font-family:'Inter',sans-serif;")}>iMessage</span>
        {!blocked && availableHandles.length > 0 && <span style={css("font-size:9px; color:rgba(255,255,255,0.35); margin-left:auto; font-family:'Inter',sans-serif;")}>{availableHandles.length} handle{availableHandles.length === 1 ? '' : 's'}</span>}
      </div>

      {/* iMessage line selector — Erudite Main (bb1) vs Operations Line (bb2) */}
      <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:8px;")}>
        <span style={css("font-size:8.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); flex:none;")}>Line</span>
        {[
          { key: 'bb1', label: 'Erudite Main' },
          { key: 'bb2', label: 'Operations' },
        ].map((opt) => {
          const on = instance === opt.key;
          return (
            <button key={opt.key} type="button" onClick={() => setInstance(opt.key)} title={opt.key === 'bb1' ? 'Erudite Main (bb1)' : 'Operations Line (bb2)'}
              style={{ ...css("padding:3px 9px; border-radius:99px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap;"), background: on ? 'rgba(10,132,255,0.2)' : 'rgba(255,255,255,0.05)', color: on ? '#60a5fa' : 'rgba(255,255,255,0.5)', border: '1px solid ' + (on ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.12)') }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {justSent && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(180deg, rgba(10,132,255,0.24), rgba(10,132,255,0.08))', backdropFilter: 'blur(3px)', borderRadius: 12, animation: 'imc-flash-out 0.4s ease forwards 1.3s' }}>
          <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(96,165,250,0.7)', animation: 'imc-ring 0.9s ease-out' }} />
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#0A84FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', animation: 'imc-flash-in 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>✓</div>
            <span style={{ position: 'absolute', fontSize: 20, animation: 'imc-plane 0.9s ease-out forwards' }}>➤</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', color: '#60a5fa', animation: 'imc-flash-in 0.5s ease' }}>Sent!</span>
        </div>
      )}

      {/* Last sent preview — shows the sent iMessage text after the body is cleared */}
      {lastSent && (
        <div style={{ ...css("border-radius:8px; padding:8px 10px; margin-bottom:6px;"), background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.3)' }}>
          <div style={css("display:flex; align-items:center; justify-content:space-between; cursor:pointer; gap:8px;")} onClick={() => setSentExpanded(s => !s)}>
            <span style={css("font-size:11px; font-weight:700; color:#60a5fa; display:flex; align-items:center; gap:5px;")}>✓ Sent — {(lastSent.text || '').slice(0, 40)}{lastSent.text && lastSent.text.length > 40 ? '…' : ''}</span>
            <span style={css("font-size:9px; font-weight:600; color:rgba(255,255,255,0.55); white-space:nowrap;")}>{sentExpanded ? 'Hide' : 'View sent message'}</span>
          </div>
          {sentExpanded && (
            <div style={css("margin-top:7px; padding-top:7px; border-top:1px solid rgba(10,132,255,0.2); font-size:11px; color:rgba(255,255,255,0.8); line-height:1.55; white-space:pre-wrap; max-height:220px; overflow:auto;")}>
              <div style={css("font-size:9px; color:rgba(255,255,255,0.45); margin-bottom:5px;")}>To: {lastSent.to}</div>
              {lastSent.text || '(empty)'}
            </div>
          )}
        </div>
      )}

      {/* Recipient selector — show the send target for any number of confirmed handles */}
      {availableHandles.length >= 1 && (
        <div style={css("display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:6px;")}>
          <span style={css("font-size:8.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); flex:none;")}>To iMessage</span>
          {availableHandles.length >= 2 && (
            <button type="button" onClick={() => setSelectedAddress('all')} title="Send to every iMessage handle"
              style={{ ...css("padding:3px 8px; border-radius:99px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap;"), background: selectedAddress === 'all' ? 'rgba(10,132,255,0.2)' : 'rgba(255,255,255,0.05)', color: selectedAddress === 'all' ? '#60a5fa' : 'rgba(255,255,255,0.5)', border: '1px solid ' + (selectedAddress === 'all' ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.12)') }}>
              All ({availableHandles.length})
            </button>
          )}
          {availableHandles.map((h) => {
            const on = availableHandles.length === 1 || selectedAddress === h.handle;
            return (
              <button key={h.handle} type="button" onClick={() => availableHandles.length >= 2 && setSelectedAddress(h.handle)} title={`Send to ${h.handle}`}
                style={{ ...css("padding:3px 8px; border-radius:99px; font-size:10px; font-weight:600; cursor:" + (availableHandles.length >= 2 ? 'pointer' : 'default') + "; font-family:'Inter',sans-serif; white-space:nowrap;"), background: on ? 'rgba(10,132,255,0.2)' : 'rgba(255,255,255,0.05)', color: on ? '#60a5fa' : 'rgba(255,255,255,0.5)', border: '1px solid ' + (on ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.12)') }}>
                {h.handle}
              </button>
            );
          })}
        </div>
      )}

      {/* English gloss is now shown inside ModernComposerField via the `gloss` prop */}

      {blocked && (
        <div style={css("margin-bottom:6px; padding:6px 10px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); font-size:10.5px; color:#fca5a5;")}>⚠ No iMessage handle for this landlord</div>
      )}

      {/* Approach Forge — the auto-forged iMessage draft, one tap to load (never auto-sent).
          ALWAYS shown when a draft exists — channel availability gates SENDING, never the draft. */}
      <ApproachDraftStrip
        channel="imessage"
        drafts={approachDrafts}
        forging={approachForging}
        onLoad={loadApproachDraft}
        onRegenerate={onRegenerateApproach}
        accent="#0A84FF"
      />

      {/* Signature + link preview — appended automatically on send */}
      {signatureText && (
        <div style={css("margin-bottom:6px; padding:6px 10px; border-radius:8px; background:rgba(10,132,255,0.06); border:1px solid rgba(10,132,255,0.15); font-size:10px; color:rgba(255,255,255,0.4); white-space:pre-wrap; line-height:1.4;")}>
          <span style={css("font-size:8px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.3); display:block; margin-bottom:3px;")}>Auto-appended on send</span>
          {signatureText}
          <span style={css("display:block; color:rgba(10,132,255,0.6);")}>https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264</span>
        </div>
      )}
      <ModernComposerField
        value={text}
        onChange={(e) => { setText(e.target.value); if (hasDraft && e.target.value !== text) setHasDraft(false); }}
        onKeyDown={handleKeyDown}
        placeholder="Type an iMessage… (Enter to send, Shift+Enter for new line)"
        onSend={send}
        sending={sending}
        sendDisabled={blocked}
        accent="#0A84FF"
        voiceEnabled
        voiceCanSendAudio
        onVoiceSent={(url, name) => { setAttachment({ file_url: url, file_name: name, media_type: 'audio' }); setTimeout(() => { send(); }, 80); }}
        onVoiceText={(t) => { setText(t); setHasDraft(false); }}
        gloss={hasDraft ? draftGloss : undefined}
        targetLanguage={language || undefined}
        landlordContext={llCtx}
        landlordId={landlordId}
        channel="imessage"
        inputRef={taRef}
        minHeight={54}
      >
        {/* Templates */}
        <EmailTemplatePicker channel="imessage" landlordId={landlordId} onSelect={handleTemplateSelect} compact />

        {/* AI Draft popover */}
        <Popover open={aiOpen} onOpenChange={setAiOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="AI draft — choose a strategy and generate"
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all border ${aiOpen ? 'bg-violet-500/15 border-violet-500/30' : 'border-transparent hover:bg-white/10'}`}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: aiOpen ? '#c4b5fd' : 'rgba(255,255,255,0.6)' }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;")}>
              <span style={css("font-size:11px; font-weight:700; color:#c4b5fd; display:flex; align-items:center; gap:5px;")}><Sparkles size={12} /> AI Draft Strategy</span>
              <button type="button" onClick={() => setAiOpen(false)} style={css("cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.4);")}><X size={13} /></button>
            </div>
            {language && <div style={css("font-size:8px; font-weight:600; padding:1px 5px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); margin-bottom:6px; display:inline-block; text-transform:uppercase;")}>{language}</div>}
            <div style={css("margin-bottom:6px;")}>
              <div style={css(labelSm)}>Strategy</div>
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...css(fieldSm), cursor: 'pointer', appearance: 'auto' }}>
                {MODES.map((m) => <option key={m.key} value={m.key} style={{ background: '#1a2235', color: '#fff' }}>{m.label}</option>)}
              </select>
              {activeMode && <div style={css("font-size:9px; color:rgba(255,255,255,0.4); margin-top:3px;")}>{activeMode.hint}</div>}
            </div>
            <div style={css("margin-bottom:6px;")}>
              <div style={css(labelSm)}>Psychology</div>
              <select value={psychology} onChange={(e) => setPsychology(e.target.value)} style={{ ...css(fieldSm), cursor: 'pointer', appearance: 'auto' }}>
                {PSYCHOLOGY_OPTIONS.map((p) => <option key={p.value || 'default'} value={p.value} style={{ background: '#1a2235', color: '#fff' }}>{p.label}</option>)}
              </select>
            </div>
            {needsBuyer && (
              <div style={css("margin-bottom:6px;")}>
                <div style={css(labelSm)}>Buyer detail</div>
                <input value={buyerDetail} onChange={(e) => setBuyerDetail(e.target.value)} placeholder="Specific buyer…" style={css(fieldSm)} />
              </div>
            )}
            {needsMarket && (
              <div style={css("margin-bottom:6px;")}>
                <div style={css(labelSm)}>Market figure</div>
                <input value={marketFigure} onChange={(e) => setMarketFigure(e.target.value)} placeholder="Market insight…" style={css(fieldSm)} />
              </div>
            )}
            <div style={css("margin-bottom:6px;")}>
              <div style={css(labelSm)}>Comp reference</div>
              <input value={compReference} onChange={(e) => setCompReference(e.target.value)} placeholder="Optional comp…" style={css(fieldSm)} />
            </div>
            <button type="button" onClick={generate} disabled={generating}
              style={css("width:100%; padding:6px; border-radius:7px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(139,92,246,0.14); color:#c4b5fd; border:1px solid rgba(139,92,246,0.4); opacity:" + (generating ? 0.6 : 1) + ";")}>
              {generating ? 'Generating…' : '✦ Generate draft'}
            </button>
          </PopoverContent>
        </Popover>

        {/* Save as template */}
        <IconButton icon={Save} onClick={handleSaveAsTemplate} title="Save as template" disabled={!text.trim()} />

        {/* Emoji picker */}
        <EmojiPicker onSelect={insertEmoji} />
      </ModernComposerField>

      <div style={css("font-size:8.5px; color:rgba(255,255,255,0.35); text-align:center; margin-top:4px;")}>Branded banner attached on first contact</div>

      <EmailTemplateDialog
        open={saveTemplateOpen}
        onClose={() => { setSaveTemplateOpen(false); setSaveTemplatePrefill(null); }}
        template={saveTemplatePrefill ? { ...saveTemplatePrefill, category: 'general', visibility: 'private' } : null}
        channel="imessage"
        onSaved={() => toast.success('Template saved')}
      />
    </div>
  );
}