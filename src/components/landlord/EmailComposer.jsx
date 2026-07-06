// EmailComposer — HubSpot-style compact email composer with icon toolbar,
// AI popover, template picker, merge-field replacement, and Gmail connection enforcement.
//
// Props:
//   landlordId   (string)  — current landlord id (for merge fields + logging)
//   toEmail      (string)  — recipient prefilled
//   onLogged     (fn)      — called after a successful send

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactQuill from 'react-quill';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';
import EmailTemplatePicker from './EmailTemplatePicker';
import EmailTemplateDialog from './EmailTemplateDialog';
import { IconButton, ToolbarDivider } from './ComposerToolbar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { FileText, Sparkles, Paperclip, Save, Send, Lock, ChevronDown, Plus, X } from 'lucide-react';
import { buildAgentSignatureHtml } from '@/lib/agentSignature';

/* ── helpers ── */
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
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch (_) {}
}

function plainTextToHtml(text) {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function replaceMergeFields(text, vars) {
  return String(text ?? '')
    .replace(/\{\{landlord_name\}\}/g, vars.landlord_name || '')
    .replace(/\{\{property_name\}\}/g, vars.property_name || '')
    .replace(/\{\{project_name\}\}/g, vars.project_name || '')
    .replace(/\{\{agent_name\}\}/g, vars.agent_name || '');
}

/* ── AI draft config ── */
const MODES = [
  { key: 'asset_proof', label: 'Asset proof', hint: 'Shows you know their exact unit.' },
  { key: 'real_buyer', label: 'Real buyer', hint: 'Built around a specific buyer.' },
  { key: 'market_gift', label: 'Market gift', hint: 'Leads with a market insight.' },
  { key: 'no_ask_interrupt', label: 'No-ask', hint: 'Not asking for the listing.' },
  { key: 'collaboration', label: 'Collab', hint: 'Work alongside their broker.' },
  { key: 'funds_ready', label: 'Funds ready', hint: 'Buyer ready to deposit.' },
];
const REQUIRES_BUYER = ['real_buyer', 'funds_ready'];
const REQUIRES_MARKET = ['market_gift'];

const PSYCHOLOGY_OPTIONS = [
  { value: '', label: 'Default tone' },
  { value: 'stubborn', label: 'Stubborn' },
  { value: 'dislikes_email', label: 'Dislikes email' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'skeptical', label: 'Skeptical' },
  { value: 'time_poor', label: 'Busy / time-poor' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'price_anchored', label: 'High price expectation' },
];

const fieldSm = "padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:11px; font-family:'Inter',sans-serif; width:100%; outline:none;";
const labelSm = "font-size:8px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:2px;";

const DELIVERY_META = {
  accepted:  { label: 'Sent — accepted by Gmail', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  sent:      { label: 'Sent — handed to recipient', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  failed:    { label: 'Failed to send', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
};

export default function EmailComposer({ landlordId, toEmail, onLogged }) {
  const { user } = useCurrentUser();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailAddress, setGmailAddress] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [checkingConn, setCheckingConn] = useState(true);

  const [to, setTo] = useState(toEmail || '');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // AI draft state
  const [aiOpen, setAiOpen] = useState(false);
  const [mode, setMode] = useState('asset_proof');
  const [psychology, setPsychology] = useState('');
  const [buyerDetail, setBuyerDetail] = useState('');
  const [marketFigure, setMarketFigure] = useState('');
  const [generating, setGenerating] = useState(false);
  const [bodyGloss, setBodyGloss] = useState('');
  const [language, setLanguage] = useState('');

  const [sending, setSending] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [justSent, setJustSent] = useState(false);
  const flashTimer = useRef(null);
  const quillRef = useRef(null);

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplatePrefill, setSaveTemplatePrefill] = useState(null);
  const [mergeVars, setMergeVars] = useState({});
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const res = await base44.functions.invoke('checkGoogleWorkspaceConnection', {});
        const data = res?.data ?? res;
        if (mounted) {
          setGmailConnected(data?.connected === true);
          setGmailAddress(data?.email || user?.email || '');
        }
      } catch { if (mounted) setGmailConnected(false); }
      if (mounted) setCheckingConn(false);
      try {
        const me = await base44.auth.me();
        if (mounted) setSignatureHtml(buildAgentSignatureHtml(me || {}));
      } catch {}
      if (landlordId) {
        try {
          const l = await base44.entities.Landlord.get(landlordId);
          if (mounted) {
            setMergeVars({
              landlord_name: l?.name || l?.full_name || '',
              property_name: l?.property_name || l?.unit_reference || '',
              project_name: l?.project_name || l?.project || '',
              agent_name: user?.full_name || '',
            });
          }
        } catch {}
      }
    };
    init();
    return () => { mounted = false; };
  }, [landlordId]);

  const sigBlock = useMemo(() => (signatureHtml || ''), [signatureHtml]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await base44.integrations.Core.UploadFile({ file });
        const url = res?.file_url || res?.url;
        if (url && quillRef.current) {
          const quill = quillRef.current.getEditor();
          const range = quill.getSelection() || { index: quill.getLength() };
          quill.insertEmbed(range.index, 'image', url);
        }
      } catch { toast.error('Image upload failed'); }
    };
  }, []);

  const handleAttach = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('multiple', '');
    input.click();
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      for (const file of files) {
        try {
          const res = await base44.integrations.Core.UploadFile({ file });
          const url = res?.file_url || res?.url;
          if (url) setAttachments((a) => [...a, { url, filename: file.name, mime: file.type || 'application/octet-stream', size: file.size }]);
        } catch { toast.error(`Failed to upload ${file.name}`); }
      }
    };
  }, []);

  const removeAttachment = useCallback((idx) => setAttachments((a) => a.filter((_, i) => i !== idx)), []);

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image'], ['clean']],
      handlers: { image: handleImageUpload },
    },
  }), [handleImageUpload]);

  const generate = async () => {
    if (generating) return;
    const needsBuyer = REQUIRES_BUYER.includes(mode);
    const needsMarket = REQUIRES_MARKET.includes(mode);
    if (needsBuyer && !buyerDetail.trim()) { toast.error('This mode needs a buyer detail'); return; }
    if (needsMarket && !marketFigure.trim()) { toast.error('This mode needs a market figure'); return; }
    setGenerating(true);
    try {
      const agent_inputs = {};
      if (buyerDetail.trim()) agent_inputs.buyer_detail = buyerDetail.trim();
      if (marketFigure.trim()) agent_inputs.market_figure = marketFigure.trim();
      const payload = { landlord_id: landlordId, mode, agent_inputs };
      if (psychology) payload.psychology = psychology;
      const res = await base44.functions.invoke('draftLandlordEmail', payload);
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Draft generation failed');
      const d = data.draft || {};
      setSubject(d.subject || '');
      setBodyHtml(plainTextToHtml(d.body_native || ''));
      setBodyGloss(d.body_english_gloss || '');
      setLanguage(d.language || '');
      setAiOpen(false);
      toast.success('Draft loaded into editor');
    } catch (e) {
      toast.error(e?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateSelect = ({ subject: s, body: b }) => {
    setSubject(replaceMergeFields(s, mergeVars));
    setBodyHtml(plainTextToHtml(replaceMergeFields(b, mergeVars)));
    toast.success('Template loaded — edit as needed');
  };

  const handleSaveAsTemplate = () => {
    const plainText = bodyHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').trim();
    setSaveTemplatePrefill({ title: subject ? subject.slice(0, 40) : 'New Template', subject: subject || '', body: plainText });
    setSaveTemplateOpen(true);
  };

  const recheckDelivery = async (threadId, messageId) => {
    if (!threadId) return;
    setDelivery((d) => (d ? { ...d, checking: true } : d));
    try {
      const res = await base44.functions.invoke('checkEmailDeliveryStatus', { thread_id: threadId, message_id: messageId });
      const data = res?.data ?? res;
      if (data?.ok) {
        setDelivery({ state: data.status, thread_id: threadId, message_id: messageId, reason: data.bounce_reason || null, checking: false });
      } else { setDelivery((d) => (d ? { ...d, checking: false } : d)); }
    } catch { setDelivery((d) => (d ? { ...d, checking: false } : d)); }
  };

  const sendEmail = async () => {
    if (sending) return;
    if (!gmailConnected) { toast.error('Connect your email to send'); return; }
    if (!to.trim()) { toast.error('Add a recipient email'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    const isEmptyBody = !bodyHtml.trim() || bodyHtml === '<p><br></p>';
    if (isEmptyBody) { toast.error('Body is required'); return; }
    setSending(true);
    setDelivery(null);
    try {
      // Signature already injected into the editor (visible while composing) — just ensure it's present.
      const finalBody = (sigBlock && !bodyHtml.includes('data-signature="1"')) ? bodyHtml + sigBlock : bodyHtml;
      const payload = { to: to.trim(), subject: subject.trim(), body_html: finalBody, landlord_id: landlordId, cc: cc.trim() || undefined, attachments: attachments.map((a) => ({ url: a.url, filename: a.filename, mime: a.mime })) };
      const res = await base44.functions.invoke('sendLandlordEmail', payload);
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Email send failed');
      playSentSound();
      if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch {} }
      setJustSent(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustSent(false), 1700);
      toast.success('Sent ✓');
      setDelivery({ state: data.delivery === 'sent' ? 'sent' : 'accepted', thread_id: data.thread_id || null, message_id: data.message_id || null, reason: null, checking: false });
      if (data.thread_id) setTimeout(() => recheckDelivery(data.thread_id, data.message_id), 8000);
      if (onLogged) onLogged({ subject: subject.trim(), to: to.trim(), cc });
    } catch (e) {
      toast.error(e?.message || 'Failed to send email');
      setDelivery({ state: 'failed', reason: e?.message || 'Send failed', checking: false });
    } finally {
      setSending(false);
    }
  };

  const canSend = !checkingConn && gmailConnected && !sending;
  const activeMode = MODES.find((m) => m.key === mode);

  return (
    <div style={{ ...css("margin-bottom:9px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.22); background:hsl(38 92% 50% / 0.04); padding:10px 12px;"), position: 'relative' }}>
      <style>{`
        @keyframes ec-spin { to { transform: rotate(360deg); } }
        @keyframes ec-flash-in { 0% { opacity:0; transform:scale(0.6); } 55% { opacity:1; transform:scale(1.08); } 70% { transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
        @keyframes ec-flash-out { to { opacity:0; } }
        @keyframes ec-plane { 0% { transform:translate(-6px,4px) rotate(-8deg); opacity:0; } 30% { opacity:1; } 100% { transform:translate(70px,-46px) rotate(12deg); opacity:0; } }
        @keyframes ec-ring { 0% { transform:scale(0.4); opacity:0.7; } 100% { transform:scale(2.4); opacity:0; } }
        .ec-quill .ql-toolbar.ql-snow { border:1px solid rgba(255,255,255,0.12) !important; border-bottom:none !important; background:rgba(255,255,255,0.03); border-radius:8px 8px 0 0; }
        .ec-quill .ql-container.ql-snow { border:1px solid rgba(255,255,255,0.12) !important; border-radius:0 0 8px 8px; background:rgba(255,255,255,0.04); min-height:60px; font-family:'Inter',sans-serif; }
        .ec-quill .ql-editor { color:rgba(255,255,255,0.9); font-size:13px; min-height:60px; line-height:1.5; }
        .ec-quill .ql-editor.ql-blank::before { color:rgba(255,255,255,0.35); font-style:normal; }
        .ec-quill .ql-snow .ql-stroke { stroke:rgba(255,255,255,0.6) !important; }
        .ec-quill .ql-snow .ql-fill { fill:rgba(255,255,255,0.6) !important; }
        .ec-quill .ql-snow .ql-picker-label { color:rgba(255,255,255,0.6) !important; }
        .ec-quill .ql-snow .ql-picker-options { background:#1a2235 !important; border:1px solid rgba(255,255,255,0.12) !important; border-radius:6px; }
        .ec-quill .ql-snow .ql-tooltip { background:#1a2235 !important; border:1px solid rgba(255,255,255,0.15) !important; color:rgba(255,255,255,0.9) !important; box-shadow:0 4px 16px rgba(0,0,0,0.4) !important; }
        .ec-quill .ql-snow .ql-tooltip input[type=text] { background:rgba(255,255,255,0.06) !important; border:1px solid rgba(255,255,255,0.12) !important; color:rgba(255,255,255,0.9) !important; border-radius:4px; }
        .ec-quill .ql-snow.ql-toolbar button:hover .ql-stroke, .ec-quill .ql-snow.ql-toolbar button.ql-active .ql-stroke { stroke:#eab308 !important; }
        .ec-quill .ql-snow.ql-toolbar button:hover .ql-fill, .ec-quill .ql-snow.ql-toolbar button.ql-active .ql-fill { fill:#eab308 !important; }
        .ec-quill .ql-snow.ql-toolbar button:hover .ql-picker-label, .ec-quill .ql-snow.ql-toolbar button.ql-active .ql-picker-label { color:#eab308 !important; }
      `}</style>

      {justSent && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))', backdropFilter: 'blur(3px)', borderRadius: 12, overflow: 'hidden', animation: 'ec-flash-out 0.4s ease forwards 1.3s' }}>
          <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.6)', animation: 'ec-ring 0.9s ease-out' }} />
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(16,185,129,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#04231a', animation: 'ec-flash-in 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>✓</div>
            <span style={{ position: 'absolute', fontSize: 20, animation: 'ec-plane 0.9s ease-out forwards' }}>✈</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', color: '#34d399', animation: 'ec-flash-in 0.5s ease' }}>Sent!</span>
        </div>
      )}

      {/* From + To on one line, with Cc toggle */}
      <div style={css("display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:end; margin-bottom:7px;")}>
        <div>
          <div style={css(labelSm)}>From</div>
          <div style={{ ...css(fieldSm), display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}>
            <Lock size={10} style={{ color: gmailConnected ? '#34d399' : '#f87171', flex: 'none' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {checkingConn ? '…' : gmailConnected ? (gmailAddress || user?.email || 'Connected') : 'Not connected'}
            </span>
            {!gmailConnected && !checkingConn && <a href="/profile" style={{ fontSize: 8, fontWeight: 600, color: 'hsl(38 92% 62%)', textDecoration: 'none', flex: 'none' }}>→</a>}
          </div>
        </div>
        <div>
          <div style={css(labelSm)}>To</div>
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@email.com" style={css(fieldSm)} />
        </div>
        <button type="button" onClick={() => setShowCc(s => !s)} title="Show CC field"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '27px', padding: '0 8px', borderRadius: '6px', fontSize: '9.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", background: showCc ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
          Cc
        </button>
      </div>

      {/* CC (collapsible) */}
      {showCc && (
        <div style={css("margin-bottom:7px;")}>
          <div style={css(labelSm)}>CC</div>
          <input type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@email.com" style={css(fieldSm)} />
        </div>
      )}

      {/* Subject */}
      <div style={css("margin-bottom:7px;")}>
        <div style={css(labelSm)}>Subject</div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" style={css(fieldSm)} />
      </div>

      {/* Body — compact ReactQuill */}
      <div style={css("margin-bottom:6px;")}>
        <div className="ec-quill">
          <ReactQuill ref={quillRef} theme="snow" value={bodyHtml} onChange={setBodyHtml} modules={quillModules} placeholder="Write your email…" />
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div style={css("display:flex; flex-wrap:wrap; gap:5px; margin-bottom:6px;")}>
          {attachments.map((a, i) => (
            <div key={i} style={css("display:flex; align-items:center; gap:5px; padding:3px 7px 3px 6px; border-radius:7px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); font-size:10px; color:#a5b4fc; font-family:'Inter',sans-serif;")}>
              <Paperclip size={10} style={{ flex: 'none' }} />
              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</span>
              <button type="button" onClick={() => removeAttachment(i)} title="Remove" style={css("display:flex; align-items:center; justify-content:center; background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); padding:0;")}>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Signature preview — auto-added to every email (shown on white like the sent email) */}
      {sigBlock && (
        <div style={{ marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 9, color: '#9a9a9a', padding: '4px 8px 0', fontFamily: "'Inter',sans-serif" }}>SIGNATURE — auto-added to every email</div>
          <div style={{ padding: 4 }} dangerouslySetInnerHTML={{ __html: sigBlock }} />
        </div>
      )}

      {/* Slim icon toolbar */}
      <div style={css("display:flex; align-items:center; gap:4px; justify-content:space-between;")}>
        <div style={css("display:flex; align-items:center; gap:4px;")}>
          {/* Templates */}
          <div style={css("position:relative;")}>
            <EmailTemplatePicker onSelect={handleTemplateSelect} compact />
          </div>
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
              {REQUIRES_BUYER.includes(mode) && (
                <div style={css("margin-bottom:6px;")}>
                  <div style={css(labelSm)}>Buyer detail</div>
                  <input value={buyerDetail} onChange={(e) => setBuyerDetail(e.target.value)} placeholder="Specific buyer…" style={css(fieldSm)} />
                </div>
              )}
              {REQUIRES_MARKET.includes(mode) && (
                <div style={css("margin-bottom:6px;")}>
                  <div style={css(labelSm)}>Market figure</div>
                  <input value={marketFigure} onChange={(e) => setMarketFigure(e.target.value)} placeholder="Market insight…" style={css(fieldSm)} />
                </div>
              )}
              <button type="button" onClick={generate} disabled={generating}
                style={css("width:100%; padding:6px; border-radius:7px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(139,92,246,0.14); color:#c4b5fd; border:1px solid rgba(139,92,246,0.4); opacity:" + (generating ? 0.6 : 1) + ";")}>
                {generating ? 'Generating…' : '✦ Generate draft'}
              </button>
            </PopoverContent>
          </Popover>
          {/* Attach */}
          <IconButton icon={Paperclip} onClick={handleAttach} title="Attach files" />
          {/* Save as template */}
          <IconButton icon={Save} onClick={handleSaveAsTemplate} title="Save as template" />
        </div>
        {/* Send icon */}
        <button type="button" onClick={sendEmail} disabled={!canSend}
          title={!gmailConnected ? 'Connect your email to send' : 'Send email'}
          className="flex items-center justify-center gap-2 px-4 h-8 rounded-lg transition-all border"
          style={{
            background: canSend ? 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))' : 'rgba(255,255,255,0.08)',
            color: canSend ? '#1a1205' : 'rgba(255,255,255,0.4)',
            border: `1px solid ${canSend ? 'hsl(38 92% 50% / 0.5)' : 'rgba(255,255,255,0.1)'}`,
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontSize: '11px', fontWeight: 700, fontFamily: "'Inter',sans-serif",
          }}>
          {sending ? (
            <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(26,18,5,0.35)', borderTopColor: '#1a1205', borderRadius: '50%', animation: 'ec-spin 0.7s linear infinite' }} />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {sending ? '' : 'Send'}
        </button>
      </div>

      {!gmailConnected && !checkingConn && (
        <div style={css("font-size:9px; color:#f87171; text-align:center; padding:3px 0 0;")}>
          ⚠ Connect your Gmail in Profile to send emails.
        </div>
      )}

      {/* Delivery status */}
      {delivery && (() => {
        const meta = DELIVERY_META[delivery.state] || DELIVERY_META.accepted;
        return (
          <div style={{ ...css("border-radius:6px; padding:5px 8px; margin-top:6px; display:flex; align-items:center; justify-content:space-between; gap:6px;"), background: meta.bg, border: '1px solid ' + meta.border }}>
            <span style={{ ...css("font-size:10px; font-weight:600;"), color: meta.color }}>
              {delivery.checking ? 'Checking delivery…' : meta.label}
            </span>
            {delivery.thread_id && delivery.state !== 'failed' && (
              <button type="button" onClick={() => recheckDelivery(delivery.thread_id, delivery.message_id)} disabled={delivery.checking}
                style={css("font-size:9px; font-weight:600; cursor:pointer; padding:1px 7px; border-radius:99px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.6); font-family:'Inter',sans-serif;")}>
                ↻
              </button>
            )}
          </div>
        );
      })()}

      <EmailTemplateDialog
        open={saveTemplateOpen}
        onClose={() => { setSaveTemplateOpen(false); setSaveTemplatePrefill(null); }}
        template={saveTemplatePrefill ? { ...saveTemplatePrefill, category: 'general', visibility: 'private' } : null}
        onSaved={() => toast.success('Template saved')}
      />
    </div>
  );
}