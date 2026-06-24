// IMessageComposer — draft & send a landlord iMessage, inline on the V-card.
//
// SAME BEHAVIOR AS THE EMAIL COMPOSER: pressing "iMessage" opens this panel exactly like
// pressing "Email" opens EmailComposer. Same shared brain (`draftLandlordEmail` with
// channel:'imessage'), same mode picker + owner-psychology + generate-then-send flow.
// Sending goes through the existing `sendIMessage` function (which appends the signature
// and the branded banner on first contact). A manual free-text box sits below the AI draft.
//
// Props:
//   landlordId   (string)  — current landlord id
//   onSent       (fn)      — called after an iMessage is sent (e.g. push a stream item)
//   onFallback   (fn)      — called when no iMessage handle exists (caller may route to WhatsApp)

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/* Convert a CSS declaration string into a React style object (matches the V-card pattern). */
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

// SAME modes as the email composer — these come from the one shared brain.
const MODES = [
  { key: 'asset_proof', label: 'Asset proof', hint: 'Shows you know their exact unit — no buyer claim.' },
  { key: 'real_buyer', label: 'Real buyer', hint: 'Built around a specific real buyer (needs buyer detail).' },
  { key: 'market_gift', label: 'Market gift', hint: 'Leads with one market insight (needs a market figure).' },
  { key: 'no_ask_interrupt', label: 'No-ask', hint: 'Explicitly not asking for the listing.' },
  { key: 'collaboration', label: 'Collaboration', hint: 'Work alongside their existing broker.' },
  { key: 'funds_ready', label: 'Funds ready', hint: 'Buyer ready to deposit on signing (needs buyer detail).' },
];

const REQUIRES_BUYER = ['real_buyer', 'funds_ready'];
const REQUIRES_MARKET = ['market_gift'];

// SAME psychology profiles as the email composer.
const PSYCHOLOGY_OPTIONS = [
  { value: '', label: 'Default tone' },
  { value: 'stubborn', label: 'Stubborn / set in their ways' },
  { value: 'dislikes_email', label: 'Dislikes email' },
  { value: 'avoids_talking', label: "Doesn't want to call or meet" },
  { value: 'stressed', label: 'Stressed / overwhelmed' },
  { value: 'skeptical', label: 'Skeptical / distrustful' },
  { value: 'time_poor', label: 'Busy / time-poor' },
  { value: 'analytical', label: 'Analytical / data-driven' },
  { value: 'emotionally_attached', label: 'Attached to the home' },
  { value: 'price_anchored', label: 'High price expectation' },
  { value: 'previously_burned', label: 'Burned by a past broker' },
  { value: 'non_committal', label: 'Slow to respond' },
  { value: 'status_conscious', label: 'Proud / status-conscious' },
];

const fieldStyle = css("padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; width:100%;");

export default function IMessageComposer({ landlordId, onSent, onFallback }) {
  // ── template (shared-brain) state ──
  const [mode, setMode] = useState('asset_proof');
  const [psychology, setPsychology] = useState('');
  const [buyerDetail, setBuyerDetail] = useState('');
  const [marketFigure, setMarketFigure] = useState('');
  const [compReference, setCompReference] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draftBody, setDraftBody] = useState('');
  const [draftGloss, setDraftGloss] = useState('');
  const [language, setLanguage] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);

  // ── manual free-text state (independent — never replaced by templates) ──
  const [manualText, setManualText] = useState('');
  const [sendingManual, setSendingManual] = useState(false);

  const needsBuyer = REQUIRES_BUYER.includes(mode);
  const needsMarket = REQUIRES_MARKET.includes(mode);
  const activeMode = MODES.find((m) => m.key === mode);

  const generate = async () => {
    if (generating) return;
    if (needsBuyer && !buyerDetail.trim()) { toast.error('This mode needs a specific buyer detail'); return; }
    if (needsMarket && !marketFigure.trim()) { toast.error('This mode needs a market figure'); return; }
    setGenerating(true);
    try {
      const agent_inputs = {};
      if (buyerDetail.trim()) agent_inputs.buyer_detail = buyerDetail.trim();
      if (marketFigure.trim()) agent_inputs.market_figure = marketFigure.trim();
      if (compReference.trim()) agent_inputs.comp_reference = compReference.trim();
      // Same brain as email — only channel differs.
      const payload = { landlord_id: landlordId, mode, agent_inputs, channel: 'imessage' };
      if (psychology) payload.psychology = psychology;
      const res = await base44.functions.invoke('draftLandlordEmail', payload);
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Draft generation failed');
      const d = data.draft || {};
      setDraftBody(d.body_native || '');
      setDraftGloss(d.body_english_gloss || '');
      setLanguage(d.language || '');
      setHasDraft(true);
      toast.success('iMessage draft generated — review, then send');
    } catch (e) {
      toast.error(e?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  // Shared send path — sendIMessage appends the signature + first-contact banner.
  const send = async (text, setBusy, onDone) => {
    if (!text.trim()) { toast.error('Nothing to send'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('sendIMessage', { landlord_id: landlordId, text });
      const data = res?.data ?? res;
      if (data?.fallback === 'whatsapp' || (data?.error && /no imessage/i.test(data.error))) {
        toast.error('No iMessage handle for this landlord.');
        if (onFallback) onFallback(text);
        setBusy(false);
        return;
      }
      if (data?.error) throw new Error(data.error);
      toast.success('iMessage sent' + (data?.address ? ' · ' + data.address : ''));
      if (navigator.vibrate) { try { navigator.vibrate([16, 30, 16]); } catch (_) {} }
      if (onSent) onSent({ text });
      if (onDone) onDone();
    } catch (e) {
      toast.error(e?.message || 'Failed to send iMessage');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...css("margin-bottom:9px; border-radius:12px; border:1px solid rgba(10,132,255,0.28); background:rgba(10,132,255,0.05); padding:11px 12px;"), position: 'relative' }}>
      <style>{`@keyframes imc-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px;")}>
        <span style={{ ...css("font-size:10.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase;"), color: '#60a5fa' }}>AI iMessage Draft</span>
        <span style={css("font-size:8.5px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.45);")}>Same brain as email</span>
        {language && <span style={css("font-size:9px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); text-transform:uppercase;")}>{language}</span>}
      </div>

      {/* ── 1) TEMPLATE CHOICES (shared brain) ── */}
      <div style={css("display:flex; gap:5px; flex-wrap:wrap; margin-bottom:7px;")}>
        {MODES.map((m) => {
          const on = mode === m.key;
          return (
            <button key={m.key} onClick={() => setMode(m.key)} title={m.hint}
              style={css(
                "padding:4px 9px; border-radius:7px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; " +
                "background:" + (on ? "rgba(10,132,255,0.2)" : "rgba(255,255,255,0.04)") + "; " +
                "color:" + (on ? "#60a5fa" : "rgba(255,255,255,0.6)") + "; " +
                "border:1px solid " + (on ? "rgba(10,132,255,0.5)" : "rgba(255,255,255,0.1)") + ";"
              )}>{m.label}</button>
          );
        })}
      </div>
      {activeMode && <div style={css("font-size:10px; color:rgba(255,255,255,0.45); margin-bottom:8px; line-height:1.4;")}>{activeMode.hint}</div>}

      <div style={css("margin-bottom:9px;")}>
        <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Owner psychology</div>
        <select value={psychology} onChange={(e) => setPsychology(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer', appearance: 'auto' }}>
          {PSYCHOLOGY_OPTIONS.map((p) => (
            <option key={p.value || 'default'} value={p.value} style={{ background: '#1a2235', color: '#fff' }}>{p.label}</option>
          ))}
        </select>
      </div>

      {needsBuyer && (
        <input value={buyerDetail} onChange={(e) => setBuyerDetail(e.target.value)} placeholder="Specific buyer detail…" style={{ ...fieldStyle, marginBottom: 7 }} />
      )}
      {needsMarket && (
        <input value={marketFigure} onChange={(e) => setMarketFigure(e.target.value)} placeholder="Market figure / insight…" style={{ ...fieldStyle, marginBottom: 7 }} />
      )}
      <input value={compReference} onChange={(e) => setCompReference(e.target.value)} placeholder="Optional comp reference…" style={{ ...fieldStyle, marginBottom: 8 }} />

      <button onClick={generate} disabled={generating}
        style={css(
          "width:100%; padding:8px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; margin-bottom:10px; " +
          "background:rgba(10,132,255,0.14); color:#60a5fa; border:1px solid rgba(10,132,255,0.45); opacity:" + (generating ? 0.6 : 1) + ";"
        )}>
        {generating ? 'Generating…' : hasDraft ? '↻ Regenerate draft' : '✦ Generate iMessage draft'}
      </button>

      {hasDraft && (
        <div style={css("display:flex; flex-direction:column; gap:8px; margin-bottom:4px;")}>
          <div>
            <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Message (editable)</div>
            <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} rows={4}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }} />
          </div>
          {draftGloss && draftGloss !== draftBody && (
            <details style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:7px 10px;")}>
              <summary style={css("font-size:10px; font-weight:600; color:rgba(255,255,255,0.5); cursor:pointer; list-style:none;")}>English translation (for you)</summary>
              <div style={css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.6); margin-top:6px; white-space:pre-wrap;")}>{draftGloss}</div>
            </details>
          )}
          <button onClick={() => send(draftBody, setSendingDraft, () => { setDraftBody(''); setDraftGloss(''); setHasDraft(false); })} disabled={sendingDraft}
            style={css(
              "width:100%; padding:10px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; " +
              "background:linear-gradient(180deg, #0A84FF, #0066cc); color:#fff; border:1px solid rgba(10,132,255,0.6); opacity:" + (sendingDraft ? 0.85 : 1) + ";"
            )}>
            {sendingDraft ? (<><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'imc-spin 0.7s linear infinite' }} />Sending…</>) : '➤ Send iMessage'}
          </button>
        </div>
      )}

      {/* divider */}
      <div style={css("height:1px; background:rgba(255,255,255,0.08); margin:11px 0 10px;")} />

      {/* ── 2) MANUAL FREE-TEXT (alongside templates, not a replacement) ── */}
      <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:5px;")}>Or type your own message</div>
      <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={3} placeholder="Type a normal iMessage by hand…"
        style={{ ...fieldStyle, resize: 'vertical', minHeight: 66, lineHeight: 1.5, marginBottom: 7 }} />
      <button onClick={() => send(manualText, setSendingManual, () => setManualText(''))} disabled={sendingManual || !manualText.trim()}
        style={css(
          "width:100%; padding:9px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; " +
          "background:rgba(10,132,255,0.12); color:#60a5fa; border:1px solid rgba(10,132,255,0.4); opacity:" + (sendingManual || !manualText.trim() ? 0.6 : 1) + ";"
        )}>
        {sendingManual ? (<><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(96,165,250,0.4)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'imc-spin 0.7s linear infinite' }} />Sending…</>) : '➤ Send my message'}
      </button>
      <div style={css("font-size:9px; color:rgba(255,255,255,0.35); text-align:center; margin-top:6px;")}>Signature appends automatically · branded banner on first contact.</div>
    </div>
  );
}