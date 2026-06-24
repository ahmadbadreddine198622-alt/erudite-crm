// EmailComposer — draft & create a branded Gmail draft for a landlord, inline on the V-card.
// Two backend calls, no window switching:
//   1) draftLandlordEmail   → generates subject + native-language body (+ English gloss)
//   2) createLandlordGmailDraft → turns the (possibly edited) draft into a branded Gmail draft
//
// Props:
//   landlordId   (string)  — current landlord id
//   toEmail      (string)  — recipient (landlord's email), prefilled & editable
//   onLogged     (fn)      — called after a Gmail draft is created (e.g. push a stream item)

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

const MODES = [
  { key: 'asset_proof', label: 'Asset proof', hint: 'Shows you know their exact unit — no buyer claim.' },
  { key: 'real_buyer', label: 'Real buyer', hint: 'Built around a specific real buyer (needs buyer detail).' },
  { key: 'market_gift', label: 'Market gift', hint: 'Leads with one market insight (needs a market figure).' },
  { key: 'no_ask_interrupt', label: 'No-ask', hint: 'Explicitly not asking for the listing.' },
  { key: 'collaboration', label: 'Collaboration', hint: 'Work alongside their existing broker.' },
  { key: 'funds_ready', label: 'Funds ready', hint: 'Buyer ready to deposit on signing (needs buyer detail).' },
];

// Modes that require an agent-supplied specific before the generator will run.
const REQUIRES_BUYER = ['real_buyer', 'funds_ready'];
const REQUIRES_MARKET = ['market_gift'];

const fieldStyle = css("padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; width:100%;");

export default function EmailComposer({ landlordId, toEmail, onLogged }) {
  const [mode, setMode] = useState('asset_proof');
  const [to, setTo] = useState(toEmail || '');
  const [buyerDetail, setBuyerDetail] = useState('');
  const [marketFigure, setMarketFigure] = useState('');
  const [compReference, setCompReference] = useState('');

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  // Delivery status of the last send: null | { state, thread_id, message_id, reason, checking }
  const [delivery, setDelivery] = useState(null);

  // Generated draft (editable before sending to Gmail).
  const [subject, setSubject] = useState('');
  const [bodyNative, setBodyNative] = useState('');
  const [bodyGloss, setBodyGloss] = useState('');
  const [language, setLanguage] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  const needsBuyer = REQUIRES_BUYER.includes(mode);
  const needsMarket = REQUIRES_MARKET.includes(mode);

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

      const res = await base44.functions.invoke('draftLandlordEmail', { landlord_id: landlordId, mode, agent_inputs });
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Draft generation failed');
      const d = data.draft || {};
      setSubject(d.subject || '');
      setBodyNative(d.body_native || '');
      setBodyGloss(d.body_english_gloss || '');
      setLanguage(d.language || '');
      setHasDraft(true);
      toast.success('Draft generated — review, then create the Gmail draft');
    } catch (e) {
      toast.error(e?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

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
    } catch (_) {
      setDelivery((d) => (d ? { ...d, checking: false } : d));
    }
  };

  const sendEmail = async () => {
    if (sending) return;
    if (!to.trim()) { toast.error('Add a recipient email'); return; }
    if (!subject.trim() || !bodyNative.trim()) { toast.error('Subject and body are required'); return; }
    setSending(true);
    setDelivery(null);
    try {
      const res = await base44.functions.invoke('sendLandlordEmail', {
        to: to.trim(), subject: subject.trim(), body_native: bodyNative, landlord_id: landlordId,
      });
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Email send failed');
      toast.success('Email sent to ' + to.trim());
      setDelivery({ state: data.delivery === 'sent' ? 'sent' : 'accepted', thread_id: data.thread_id || null, message_id: data.message_id || null, reason: null, checking: false });
      // Bounces arrive seconds-to-minutes later — re-check the thread after a short delay.
      if (data.thread_id) setTimeout(() => recheckDelivery(data.thread_id, data.message_id), 8000);
      if (onLogged) onLogged({ subject: subject.trim(), to: to.trim() });
    } catch (e) {
      toast.error(e?.message || 'Failed to send email');
      setDelivery({ state: 'failed', reason: e?.message || 'Send failed', checking: false });
    } finally {
      setSending(false);
    }
  };

  const DELIVERY_META = {
    accepted:  { label: 'Sent — accepted by Gmail', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    sent:      { label: 'Sent — handed to recipient server', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    delivered: { label: 'Delivered ✓', color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)' },
    bounced:   { label: 'Bounced — not received', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
    failed:    { label: 'Failed to send', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
  };

  const activeMode = MODES.find(m => m.key === mode);

  return (
    <div style={css("margin-bottom:9px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.22); background:hsl(38 92% 50% / 0.04); padding:11px 12px;")}>
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px;")}>
        <span style={css("font-size:10.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:hsl(38 92% 62%);")}>AI Email Draft</span>
        {language && <span style={css("font-size:9px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); text-transform:uppercase;")}>{language}</span>}
      </div>

      {/* mode picker */}
      <div style={css("display:flex; gap:5px; flex-wrap:wrap; margin-bottom:7px;")}>
        {MODES.map((m) => {
          const on = mode === m.key;
          return (
            <button key={m.key} onClick={() => setMode(m.key)} title={m.hint}
              style={css(
                "padding:4px 9px; border-radius:7px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; "+
                "background:"+(on ? "hsl(38 92% 50% / 0.2)" : "rgba(255,255,255,0.04)")+"; "+
                "color:"+(on ? "hsl(38 92% 64%)" : "rgba(255,255,255,0.6)")+"; "+
                "border:1px solid "+(on ? "hsl(38 92% 50% / 0.5)" : "rgba(255,255,255,0.1)")+";"
              )}>{m.label}</button>
          );
        })}
      </div>
      {activeMode && <div style={css("font-size:10px; color:rgba(255,255,255,0.45); margin-bottom:8px; line-height:1.4;")}>{activeMode.hint}</div>}

      {/* conditional agent inputs */}
      {needsBuyer && (
        <input value={buyerDetail} onChange={(e) => setBuyerDetail(e.target.value)} placeholder="Specific buyer detail (e.g. viewed 2 units in Peninsula 2 last week)…" style={{ ...fieldStyle, marginBottom: 7 }} />
      )}
      {needsMarket && (
        <input value={marketFigure} onChange={(e) => setMarketFigure(e.target.value)} placeholder="Market figure / insight (e.g. similar unit sold AED 2.1M last month)…" style={{ ...fieldStyle, marginBottom: 7 }} />
      )}
      <input value={compReference} onChange={(e) => setCompReference(e.target.value)} placeholder="Optional Peninsula comp reference…" style={{ ...fieldStyle, marginBottom: 8 }} />

      <button onClick={generate} disabled={generating}
        style={css(
          "width:100%; padding:8px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; margin-bottom:10px; "+
          "background:hsl(38 92% 50% / 0.14); color:hsl(38 92% 64%); border:1px solid hsl(38 92% 50% / 0.45); opacity:"+(generating ? 0.6 : 1)+";"
        )}>
        {generating ? 'Generating…' : hasDraft ? '↻ Regenerate draft' : '✦ Generate email draft'}
      </button>

      {/* editable draft */}
      {hasDraft && (
        <div style={css("display:flex; flex-direction:column; gap:8px;")}>
          <div>
            <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>To</div>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@email" style={fieldStyle} />
          </div>
          <div>
            <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Subject</div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Body</div>
            <textarea value={bodyNative} onChange={(e) => setBodyNative(e.target.value)} rows={7}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.5 }} />
          </div>
          {bodyGloss && bodyGloss !== bodyNative && (
            <details style={css("border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:7px 10px;")}>
              <summary style={css("font-size:10px; font-weight:600; color:rgba(255,255,255,0.5); cursor:pointer; list-style:none;")}>English translation (for you)</summary>
              <div style={css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.6); margin-top:6px; white-space:pre-wrap;")}>{bodyGloss}</div>
            </details>
          )}
          <button onClick={sendEmail} disabled={sending}
            style={css(
              "width:100%; padding:9px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; "+
              "background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5); opacity:"+(sending ? 0.6 : 1)+";"
            )}>
            {sending ? 'Sending…' : '✉ Send branded email'}
          </button>
          <div style={css("font-size:9px; color:rgba(255,255,255,0.35); text-align:center;")}>Sends immediately from your connected Gmail — no draft step.</div>

          {delivery && (() => {
            const meta = DELIVERY_META[delivery.state] || DELIVERY_META.accepted;
            return (
              <div style={{ ...css("border-radius:8px; padding:7px 10px; display:flex; flex-direction:column; gap:4px;"), background: meta.bg, border: '1px solid ' + meta.border }}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px;")}>
                  <span style={{ ...css("font-size:11px; font-weight:700;"), color: meta.color }}>
                    {delivery.checking ? 'Checking delivery…' : meta.label}
                  </span>
                  {delivery.thread_id && delivery.state !== 'bounced' && (
                    <button onClick={() => recheckDelivery(delivery.thread_id, delivery.message_id)} disabled={delivery.checking}
                      style={css("font-size:9.5px; font-weight:600; cursor:pointer; padding:2px 8px; border-radius:99px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.7); font-family:'Inter',sans-serif;")}>
                      ↻ Re-check
                    </button>
                  )}
                </div>
                {delivery.reason && (
                  <span style={css("font-size:10px; color:rgba(255,255,255,0.6); line-height:1.4;")}>{delivery.reason}</span>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}