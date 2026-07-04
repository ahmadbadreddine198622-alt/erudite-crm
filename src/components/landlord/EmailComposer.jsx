// EmailComposer — HubSpot-style email composer with rich text editor,
// template picker, merge-field replacement, and Gmail connection enforcement.
//
// The agent MUST connect their Gmail via OAuth (Profile page) before sending.
// When not connected, the Send button is greyed out with "Connect your email to send."
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
import { Lock, ChevronDown, Sparkles, Save } from 'lucide-react';

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

/* ── AI draft config (kept from old composer) ── */
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

const fieldStyle = css("padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; width:100%; outline:none;");

const labelStyle = css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;");

const DELIVERY_META = {
  accepted:  { label: 'Sent — accepted by Gmail', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  sent:      { label: 'Sent — handed to recipient', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  failed:    { label: 'Failed to send', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
};

export default function EmailComposer({ landlordId, toEmail, onLogged }) {
  const { user } = useCurrentUser();

  // Connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailAddress, setGmailAddress] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [checkingConn, setCheckingConn] = useState(true);

  // Compose fields
  const [to, setTo] = useState(toEmail || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // AI draft
  const [showAi, setShowAi] = useState(false);
  const [mode, setMode] = useState('asset_proof');
  const [psychology, setPsychology] = useState('');
  const [buyerDetail, setBuyerDetail] = useState('');
  const [marketFigure, setMarketFigure] = useState('');
  const [generating, setGenerating] = useState(false);
  const [bodyGloss, setBodyGloss] = useState('');
  const [language, setLanguage] = useState('');

  // Send state
  const [sending, setSending] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [justSent, setJustSent] = useState(false);
  const flashTimer = useRef(null);
  const quillRef = useRef(null);

  // Save template
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplatePrefill, setSaveTemplatePrefill] = useState(null);

  // Merge vars (for template field replacement)
  const [mergeVars, setMergeVars] = useState({});

  /* ── Init: check connection, fetch landlord + signature ── */
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
      } catch {
        if (mounted) setGmailConnected(false);
      }
      if (mounted) setCheckingConn(false);

      // Signature from user entity (refreshed by auth.me)
      try {
        const me = await base44.auth.me();
        if (mounted) setSignatureHtml(me?.email_signature_html || '');
      } catch {}

      // Landlord data for merge fields
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

  /* ── Image upload handler for Quill (stable via useCallback) ── */
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
      } catch {
        toast.error('Image upload failed');
      }
    };
  }, []);

  /* ── Memoized Quill modules — stable ref prevents re-init crash ── */
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ size: ['small', false, 'large'] }],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: { image: handleImageUpload },
    },
  }), [handleImageUpload]);

  /* ── AI draft generation ── */
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
      toast.success('Draft loaded into editor');
    } catch (e) {
      toast.error(e?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Template selection with merge field replacement ── */
  const handleTemplateSelect = ({ subject: s, body: b }) => {
    const mergedSubject = replaceMergeFields(s, mergeVars);
    const mergedBody = replaceMergeFields(b, mergeVars);
    setSubject(mergedSubject);
    setBodyHtml(plainTextToHtml(mergedBody));
    toast.success('Template loaded — edit as needed');
  };

  /* ── Save current as template ── */
  const handleSaveAsTemplate = () => {
    const plainText = bodyHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    setSaveTemplatePrefill({
      title: subject ? subject.slice(0, 40) : 'New Template',
      subject: subject || '',
      body: plainText,
    });
    setSaveTemplateOpen(true);
  };

  /* ── Delivery re-check ── */
  const recheckDelivery = async (threadId, messageId) => {
    if (!threadId) return;
    setDelivery((d) => (d ? { ...d, checking: true } : d));
    try {
      const res = await base44.functions.invoke('checkEmailDeliveryStatus', {
        thread_id: threadId, message_id: messageId,
      });
      const data = res?.data ?? res;
      if (data?.ok) {
        setDelivery({ state: data.status, thread_id: threadId, message_id: messageId, reason: data.bounce_reason || null, checking: false });
      } else {
        setDelivery((d) => (d ? { ...d, checking: false } : d));
      }
    } catch {
      setDelivery((d) => (d ? { ...d, checking: false } : d));
    }
  };

  /* ── Send ── */
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
      // Append signature at the bottom
      const sig = signatureHtml && signatureHtml !== '<p><br></p>' ? signatureHtml : '';
      const fullBodyHtml = sig
        ? `${bodyHtml}<div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">${sig}</div>`
        : bodyHtml;

      const payload = {
        to: to.trim(),
        subject: subject.trim(),
        body_html: fullBodyHtml,
        landlord_id: landlordId,
        cc: cc.trim() || undefined,
      };
      const res = await base44.functions.invoke('sendLandlordEmail', payload);
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Email send failed');

      playSentSound();
      if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch {} }
      setJustSent(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustSent(false), 1700);
      toast.success('Sent ✓');
      setDelivery({
        state: data.delivery === 'sent' ? 'sent' : 'accepted',
        thread_id: data.thread_id || null,
        message_id: data.message_id || null,
        reason: null,
        checking: false,
      });
      if (data.thread_id) setTimeout(() => recheckDelivery(data.thread_id, data.message_id), 8000);
      if (onLogged) onLogged({ subject: subject.trim(), to: to.trim(), cc });
    } catch (e) {
      toast.error(e?.message || 'Failed to send email');
      setDelivery({ state: 'failed', reason: e?.message || 'Send failed', checking: false });
    } finally {
      setSending(false);
    }
  };

  const activeMode = MODES.find((m) => m.key === mode);
  const canSend = !checkingConn && gmailConnected && !sending;

  return (
    <div style={{ ...css("margin-bottom:9px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.22); background:hsl(38 92% 50% / 0.04); padding:11px 12px;"), position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes ec-spin { to { transform: rotate(360deg); } }
        @keyframes ec-flash-in { 0% { opacity:0; transform:scale(0.6); } 55% { opacity:1; transform:scale(1.08); } 70% { transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
        @keyframes ec-flash-out { to { opacity:0; } }
        @keyframes ec-plane { 0% { transform:translate(-6px,4px) rotate(-8deg); opacity:0; } 30% { opacity:1; } 100% { transform:translate(70px,-46px) rotate(12deg); opacity:0; } }
        @keyframes ec-ring { 0% { transform:scale(0.4); opacity:0.7; } 100% { transform:scale(2.4); opacity:0; } }
        /* ── Quill dark theme overrides ── */
        .ec-quill .ql-toolbar.ql-snow { border:1px solid rgba(255,255,255,0.12) !important; border-bottom:none !important; background:rgba(255,255,255,0.03); border-radius:8px 8px 0 0; }
        .ec-quill .ql-container.ql-snow { border:1px solid rgba(255,255,255,0.12) !important; border-radius:0 0 8px 8px; background:rgba(255,255,255,0.04); min-height:180px; font-family:'Inter',sans-serif; }
        .ec-quill .ql-editor { color:rgba(255,255,255,0.9); font-size:13px; min-height:180px; line-height:1.6; }
        .ec-quill .ql-editor.ql-blank::before { color:rgba(255,255,255,0.35); font-style:normal; }
        .ec-quill .ql-snow .ql-stroke { stroke:rgba(255,255,255,0.6) !important; }
        .ec-quill .ql-snow .ql-fill { fill:rgba(255,255,255,0.6) !important; }
        .ec-quill .ql-snow .ql-picker-label { color:rgba(255,255,255,0.6) !important; }
        .ec-quill .ql-snow .ql-picker-options { background:#1a2235 !important; border:1px solid rgba(255,255,255,0.12) !important; border-radius:6px; }
        .ec-quill .ql-snow .ql-tooltip { background:#1a2235 !important; border:1px solid rgba(255,255,255,0.15) !important; color:rgba(255,255,255,0.9) !important; box-shadow:0 4px 16px rgba(0,0,0,0.4) !important; }
        .ec-quill .ql-snow .ql-tooltip input[type=text] { background:rgba(255,255,255,0.06) !important; border:1px solid rgba(255,255,255,0.12) !important; color:rgba(255,255,255,0.9) !important; border-radius:4px; }
        .ec-quill .ql-snow.ql-toolbar button:hover .ql-stroke,
        .ec-quill .ql-snow.ql-toolbar button.ql-active .ql-stroke { stroke:#eab308 !important; }
        .ec-quill .ql-snow.ql-toolbar button:hover .ql-fill,
        .ec-quill .ql-snow.ql-toolbar button.ql-active .ql-fill { fill:#eab308 !important; }
        .ec-quill .ql-snow.ql-toolbar button:hover .ql-picker-label,
        .ec-quill .ql-snow.ql-toolbar button.ql-active .ql-picker-label { color:#eab308 !important; }
      `}</style>

      {/* celebratory send flash */}
      {justSent && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))', backdropFilter: 'blur(3px)', borderRadius: 12, animation: 'ec-flash-out 0.4s ease forwards 1.3s' }}>
          <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.6)', animation: 'ec-ring 0.9s ease-out' }} />
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(16,185,129,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#04231a', animation: 'ec-flash-in 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>✓</div>
            <span style={{ position: 'absolute', fontSize: 20, animation: 'ec-plane 0.9s ease-out forwards' }}>✈</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', color: '#34d399', animation: 'ec-flash-in 0.5s ease' }}>Sent!</span>
        </div>
      )}

      {/* Toolbar: AI Draft toggle + Templates */}
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px; justify-content:space-between;")}>
        <button onClick={() => setShowAi((s) => !s)}
          style={css("display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:7px; font-size:10.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:"+(showAi ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.05)")+"; color:"+(showAi ? "#c4b5fd" : "rgba(255,255,255,0.7)")+"; border:1px solid "+(showAi ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.12)")+";")}>
          <Sparkles size={12} /> AI Draft
          <ChevronDown size={11} style={{ transform: showAi ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        <div style={css("display:flex; align-items:center; gap:6px;")}>
          {language && <span style={css("font-size:9px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5);")}>{language}</span>}
          <EmailTemplatePicker onSelect={handleTemplateSelect} />
        </div>
      </div>

      {/* AI Draft panel (collapsible) */}
      {showAi && (
        <div style={css("margin-bottom:10px; padding:10px; border-radius:10px; background:rgba(139,92,246,0.04); border:1px solid rgba(139,92,246,0.2);")}>
          <div style={css("display:flex; gap:5px; flex-wrap:wrap; margin-bottom:7px;")}>
            {MODES.map((m) => {
              const on = mode === m.key;
              return (
                <button key={m.key} onClick={() => setMode(m.key)} title={m.hint}
                  style={css("padding:4px 9px; border-radius:7px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:"+(on ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)")+"; color:"+(on ? "#c4b5fd" : "rgba(255,255,255,0.6)")+"; border:1px solid "+(on ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.1)")+";")}>{m.label}</button>
              );
            })}
          </div>
          {activeMode && <div style={css("font-size:10px; color:rgba(255,255,255,0.45); margin-bottom:7px;")}>{activeMode.hint}</div>}
          <select value={psychology} onChange={(e) => setPsychology(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer', appearance: 'auto', marginBottom: 7 }}>
            {PSYCHOLOGY_OPTIONS.map((p) => <option key={p.value || 'default'} value={p.value} style={{ background: '#1a2235', color: '#fff' }}>{p.label}</option>)}
          </select>
          {REQUIRES_BUYER.includes(mode) && <input value={buyerDetail} onChange={(e) => setBuyerDetail(e.target.value)} placeholder="Buyer detail…" style={{ ...fieldStyle, marginBottom: 7 }} />}
          {REQUIRES_MARKET.includes(mode) && <input value={marketFigure} onChange={(e) => setMarketFigure(e.target.value)} placeholder="Market figure…" style={{ ...fieldStyle, marginBottom: 7 }} />}
          <button onClick={generate} disabled={generating}
            style={css("width:100%; padding:7px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(139,92,246,0.14); color:#c4b5fd; border:1px solid rgba(139,92,246,0.4); opacity:"+(generating ? 0.6 : 1)+";")}>
            {generating ? 'Generating…' : '✦ Generate draft into editor'}
          </button>
        </div>
      )}

      {/* Compose fields */}
      <div style={css("display:flex; flex-direction:column; gap:8px;")}>
        {/* From (locked to connected Gmail) */}
        <div>
          <div style={labelStyle}>From</div>
          <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
            <Lock size={11} style={{ color: gmailConnected ? '#34d399' : '#f87171', flex: 'none' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {checkingConn ? 'Checking connection…' : gmailConnected ? (gmailAddress || user?.email || 'Connected') : 'Not connected'}
            </span>
            {!gmailConnected && !checkingConn && (
              <a href="/profile" style={{ fontSize: 10, fontWeight: 600, color: 'hsl(38 92% 62%)', textDecoration: 'none', flex: 'none' }}>Connect →</a>
            )}
          </div>
        </div>

        {/* To */}
        <div>
          <div style={labelStyle}>To</div>
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@email.com" style={fieldStyle} />
        </div>

        {/* CC */}
        <div>
          <div style={labelStyle}>CC (optional)</div>
          <input type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@email.com" style={fieldStyle} />
        </div>

        {/* Subject */}
        <div>
          <div style={labelStyle}>Subject</div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" style={fieldStyle} />
        </div>

        {/* Rich text editor */}
        <div>
          <div style={labelStyle}>Body</div>
          <div className="ec-quill">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={bodyHtml}
              onChange={setBodyHtml}
              modules={quillModules}
              placeholder="Write your email…"
            />
          </div>
        </div>

        {/* Signature preview */}
        {signatureHtml && signatureHtml !== '<p><br></p>' && (
          <div style={css("border-radius:8px; padding:8px 10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);")}>
            <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:4px;")}>Signature (auto-appended)</div>
            <div dangerouslySetInnerHTML={{ __html: signatureHtml }} style={css("font-size:11px; color:rgba(255,255,255,0.6); line-height:1.5;")} />
          </div>
        )}

        {/* English gloss (if AI-generated in another language) */}
        {bodyGloss && (
          <details style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:7px 10px;")}>
            <summary style={css("font-size:10px; font-weight:600; color:rgba(255,255,255,0.5); cursor:pointer; list-style:none;")}>English translation (for you)</summary>
            <div style={css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.6); margin-top:6px; white-space:pre-wrap;")}>{bodyGloss}</div>
          </details>
        )}

        {/* Send button + Save as Template */}
        <div style={css("display:flex; gap:7px;")}>
          <button onClick={sendEmail} disabled={!canSend}
            style={css(
              "flex:1; padding:10px; border-radius:8px; font-size:12px; font-weight:700; cursor:"+(canSend ? "pointer" : "not-allowed")+"; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; "+
              "background:"+(canSend ? "linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))" : "rgba(255,255,255,0.08)")+"; color:"+(canSend ? "#1a1205" : "rgba(255,255,255,0.4)")+"; border:1px solid "+(canSend ? "hsl(38 92% 50% / 0.5)" : "rgba(255,255,255,0.1)")+"; opacity:1;"
            )}>
            {sending ? (
              <>
                <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(26,18,5,0.35)', borderTopColor: '#1a1205', borderRadius: '50%', animation: 'ec-spin 0.7s linear infinite' }} />
                Sending…
              </>
            ) : gmailConnected ? '✈ Send email' : '🔒 Connect your email to send'}
          </button>
          <button onClick={handleSaveAsTemplate} title="Save current as reusable template"
            style={css("padding:10px 12px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:5px; background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.15);")}>
            <Save size={12} /> Save as Template
          </button>
        </div>

        {!gmailConnected && !checkingConn && (
          <div style={css("font-size:10px; color:#f87171; text-align:center; padding:4px 0;")}>
            ⚠ Connect your Gmail in Profile to send emails. No email will be sent until connected.
          </div>
        )}
        {gmailConnected && !checkingConn && (
          <div style={css("font-size:9px; color:rgba(255,255,255,0.35); text-align:center;")}>Sends immediately from {gmailAddress}</div>
        )}

        {/* Delivery status */}
        {delivery && (() => {
          const meta = DELIVERY_META[delivery.state] || DELIVERY_META.accepted;
          return (
            <div style={{ ...css("border-radius:8px; padding:7px 10px; display:flex; flex-direction:column; gap:4px;"), background: meta.bg, border: '1px solid ' + meta.border }}>
              <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px;")}>
                <span style={{ ...css("font-size:11px; font-weight:700;"), color: meta.color }}>
                  {delivery.checking ? 'Checking delivery…' : meta.label}
                </span>
                {delivery.thread_id && delivery.state !== 'failed' && (
                  <button onClick={() => recheckDelivery(delivery.thread_id, delivery.message_id)} disabled={delivery.checking}
                    style={css("font-size:9.5px; font-weight:600; cursor:pointer; padding:2px 8px; border-radius:99px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.7); font-family:'Inter',sans-serif;")}>
                    ↻ Re-check
                  </button>
                )}
              </div>
              {delivery.reason && <span style={css("font-size:10px; color:rgba(255,255,255,0.6); line-height:1.4;")}>{delivery.reason}</span>}
            </div>
          );
        })()}
      </div>

      {/* Save-as-template dialog */}
      <EmailTemplateDialog
        open={saveTemplateOpen}
        onClose={() => { setSaveTemplateOpen(false); setSaveTemplatePrefill(null); }}
        template={saveTemplatePrefill ? { ...saveTemplatePrefill, category: 'general', visibility: 'private' } : null}
        onSaved={() => toast.success('Template saved')}
      />
    </div>
  );
}