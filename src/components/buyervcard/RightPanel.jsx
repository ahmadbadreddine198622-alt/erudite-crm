// Buyer vCard — RIGHT activity panel (sections 6.1–6.5). 1:1 clone tokens.
import React, { useState } from 'react';
import {
  Sparkles, ChevronDown, Pin, Paperclip, Smile, Mic, Languages, Gauge, Send, CornerDownLeft, RefreshCw,
} from 'lucide-react';
import { T } from '@/lib/buyerVCardTokens';
import { aiTasks, channelTabs, pinnedStrip, whatsappThread, composerDraft } from '@/lib/buyerVCardSample';

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState('WhatsApp');
  const [draftOpen, setDraftOpen] = useState(true);
  const [line, setLine] = useState('Personal');
  const [msg, setMsg] = useState('');

  return (
    <div className="bv-right" style={{ background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '14px 18px 0' }}>
        {/* 6.1 AI TASKS strip */}
        <div style={{
          background: T.aiBg, border: `1px solid ${T.aiBorder}`, borderRadius: 12, padding: '12px 14px', marginBottom: 12,
        }}>
          <button onClick={() => setDraftOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: draftOpen ? 10 : 0 }}>
            <Sparkles size={13} color={T.ai} />
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ai, fontFamily: "'Montserrat',sans-serif" }}>AI Tasks · 3</span>
            <ChevronDown size={13} color="rgba(255,255,255,0.4)" style={{ marginLeft: 'auto', transform: draftOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }} />
          </button>
          {draftOpen && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {aiTasks.map((t, i) => (
                <div key={i} style={{
                  flex: 'none', minWidth: 220, maxWidth: 280, padding: '10px 12px', borderRadius: 10,
                  background: i === 0 ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.06)',
                  border: `1px solid ${i === 0 ? T.aiBorderStrong : T.aiBorder}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: T.ai, color: '#1a1205', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif" }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Montserrat',sans-serif" }}>{t.title}</span>
                  </div>
                  <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>{t.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6.2 Channel tabs */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {channelTabs.map((c) => {
            const on = c === activeTab;
            return (
              <button key={c} onClick={() => setActiveTab(c)} style={{
                flex: 'none', height: 28, padding: '0 12px', borderRadius: 8, fontSize: 10.5, fontWeight: 700,
                fontFamily: "'Montserrat',sans-serif", cursor: 'pointer', whiteSpace: 'nowrap',
                background: on ? T.ctaGold : 'rgba(255,255,255,0.04)',
                color: on ? T.ctaGoldText : 'rgba(255,255,255,0.6)',
                border: `1px solid ${on ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              }}>{c}</button>
            );
          })}
        </div>
      </div>

      {/* 6.3 Pinned strip */}
      <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
          <Pin size={12} color={T.gold} /> {pinnedStrip.text}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>· {pinnedStrip.count} pinned</span>
        </span>
        <input placeholder="Quick-update pinned note…" style={{
          marginLeft: 'auto', width: 240, padding: '6px 10px', borderRadius: 8, fontSize: 11,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontFamily: "'Inter',sans-serif",
        }} />
      </div>

      {/* 6.4 WhatsApp thread */}
      <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {whatsappThread.map((m, i) => {
          const out = m.dir === 'out';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', padding: '9px 13px', borderRadius: 11,
                background: out ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                border: out ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, margin: 0, marginBottom: 4 }}>{m.text}</p>
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', textAlign: out ? 'right' : 'left' }}>{m.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6.5 Composer deck */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 18px', background: 'rgba(255,255,255,0.01)' }}>
        {/* Follow-up draft strip */}
        <div style={{ border: '1px solid rgba(250,180,40,0.18)', borderRadius: 11, background: 'rgba(250,180,40,0.04)', padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={12} color={T.gold} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.gold, fontFamily: "'Montserrat',sans-serif" }}>Follow-up Draft</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', padding: '1px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>GLEB'S VOICE</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.gold, padding: '1px 7px', borderRadius: 999, background: 'rgba(198,161,91,0.12)', border: '1px solid rgba(198,161,91,0.3)' }}>viewing_confirmed</span>
            <button title="Load draft" onClick={() => setMsg(composerDraft)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: T.actionGoldBg, border: `1px solid ${T.actionGoldBorder}`, color: T.actionGoldText, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}><CornerDownLeft size={11} /> Load</button>
            <button title="Regenerate" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: T.gold, cursor: 'pointer' }}><RefreshCw size={11} /></button>
          </div>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5, margin: 0 }}>{composerDraft}</p>
        </div>

        {/* Line selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {['Personal', 'Business'].map((l) => {
            const on = line === l;
            return (
              <button key={l} onClick={() => setLine(l)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 11px', borderRadius: 999,
                fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", cursor: 'pointer',
                background: on ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${on ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: on ? T.whatsapp : 'rgba(255,255,255,0.6)',
              }}>{on && <span style={{ width: 6, height: 6, borderRadius: 999, background: T.whatsapp }} />}{l} line</button>
            );
          })}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type a WhatsApp message…" style={{
            flex: 1, padding: '11px 14px', borderRadius: 11, fontSize: 13,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontFamily: "'Inter',sans-serif",
          }} />
          <button style={{ height: 44, width: 44, borderRadius: 11, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: T.whatsappSend, border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}><Send size={17} /></button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          {[Paperclip, Smile, Mic, Languages, Gauge].map((Icon, i) => (
            <button key={i} style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><Icon size={14} /></button>
          ))}
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto', fontFamily: "'Montserrat',sans-serif" }}>{msg.trim() ? msg.trim().split(/\s+/).length : 0} words</span>
        </div>
      </div>
    </div>
  );
}