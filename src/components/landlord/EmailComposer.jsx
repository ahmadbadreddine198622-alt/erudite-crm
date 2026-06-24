// EmailComposer — draft & create a branded Gmail draft for a landlord, inline on the V-card.
// Two backend calls, no window switching:
//   1) draftLandlordEmail   → generates subject + native-language body (+ English gloss)
//   2) createLandlordGmailDraft → turns the (possibly edited) draft into a branded Gmail draft
//
// Props:
//   landlordId   (string)  — current landlord id
//   toEmail      (string)  — recipient (landlord's email), prefilled & editable
//   onLogged     (fn)      — called after a Gmail draft is created (e.g. push a stream item)

import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/* Play a short "whoosh / sent" sound via the Web Audio API — no asset file needed. */
function playSentSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Rising swoosh
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
    // Bright confirm "ping" at the end
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
  } catch (_) { /* sound is best-effort */ }
}

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

// Optional reader-psychology profiles. value '' = default tone (psychology omitted from the call).
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

export default function EmailComposer({ landlordId, toEmail, onLogged }) {
  const [mode, setMode] = useState('asset_proof');
  const [psychology, setPsychology] = useState('');
  const [to, setTo] = useState(toEmail || '');
  const [buyerDetail, setBuyerDetail] = useState('');
  const [marketFigure, setMarketFigure] = useState('');
  const [compReference, setCompReference] = useState('');

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  // Delivery status of the last send: null | { state, thread_id, message_id, reason, checking }
  const [delivery, setDelivery] = useState(null);
  // Brief celebratory flash overlay right after a successful send.
  const [justSent, setJustSent] = useState(false);
  const flashTimer = useRef(null);

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

      const payload = { landlord_id: landlordId, mode, agent_inputs };
      if (psychology) payload.psychology = psychology;
      const res = await base44.functions.invoke('draftLandlordEmail', payload);
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
      // Multi-sensory confirmation: sound + flash overlay + toast.
      playSentSound();
      if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (_) {} }
      setJustSent(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustSent(false), 1700);
      toast.success('✉ Sent to ' + to.trim(), { description: 'Your email is on its way.' });
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
    <div style={{ ...css("margin-bottom:9px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.22); background:hsl(38 92% 50% / 0.04); padding:11px 12px;"), position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes ec-spin { to { transform: rotate(360deg); } }
        @keyframes ec-flash-in { 0% { opacity:0; transform:scale(0.6); } 55% { opacity:1; transform:scale(1.08); } 70% { transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
        @keyframes ec-flash-out { to { opacity:0; } }
        @keyframes ec-plane { 0% { transform:translate(-6px,4px) rotate(-8deg); opacity:0; } 30% { opacity:1; } 100% { transform:translate(70px,-46px) rotate(12deg); opacity:0; } }
        @keyframes ec-ring { 0% { transform:scale(0.4); opacity:0.7; } 100% { transform:scale(2.4); opacity:0; } }
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

      {/* optional owner psychology */}
      <div style={css("margin-bottom:9px;")}>
        <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;")}>Owner psychology</div>
        <select value={psychology} onChange={(e) => setPsychology(e.target.value)}
          style={{ ...fieldStyle, cursor: 'pointer', appearance: 'auto' }}>
          {PSYCHOLOGY_OPTIONS.map((p) => (
            <option key={p.value || 'default'} value={p.value} style={{ background: '#1a2235', color: '#fff' }}>{p.label}</option>
          ))}
        </select>
      </div>

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
              "width:100%; padding:10px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; transition:transform 0.12s ease; "+
              "background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5); opacity:"+(sending ? 0.85 : 1)+";"
            )}>
            {sending ? (
              <>
                <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(26,18,5,0.35)', borderTopColor: '#1a1205', borderRadius: '50%', animation: 'ec-spin 0.7s linear infinite' }} />
                Sending…
              </>
            ) : '✈ Send branded email'}
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