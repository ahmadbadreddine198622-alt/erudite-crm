// Buyer vCard — LEFT identity sidebar (sections 5.1–5.9). 1:1 clone tokens.
import React, { useState } from 'react';
import {
  Copy, MessageCircle, Send, Phone, Video, Mic, Check, X, Download, Mail,
  Plus, Star, Sparkles, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { T, scoreColor, scoreBg, scoreBorder, winColor, winBg, winBorder, RAPPORT } from '@/lib/buyerVCardTokens';
import {
  buyer, auroraProposal, aiIntel, callScript, leftMedia, pinnedNotes,
} from '@/lib/buyerVCardSample';

const CHANNELS = [
  { key: 'wa', label: 'WhatsApp', color: T.whatsapp, Icon: MessageCircle, check: true },
  { key: 'im', label: 'iMessage', color: T.imessage, Icon: MessageCircle, check: true },
  { key: 'tg', label: 'Telegram', color: T.telegram, Icon: Send, check: true },
  { key: 'call', label: 'Call', color: T.call, Icon: Phone },
  { key: 'ft', label: 'FaceTime', color: T.facetime, Icon: Video },
  { key: 'ac', label: 'Aircall', color: T.aircall, Icon: Phone },
  { key: 'tw', label: 'Twilio', color: T.twilio, Icon: null, text: 'T' },
  { key: 'vapi', label: 'Vapi', color: T.vapi, Icon: Mic },
];

function ChannelCircle({ ch, size = 26 }) {
  return (
    <button title={ch.label} style={{
      width: size, height: size, borderRadius: 999, flex: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${ch.color}55`,
      color: ch.color, cursor: 'pointer', position: 'relative',
      transition: 'background 0.15s ease',
    }}>
      {ch.text ? <span style={{ fontSize: 11, fontWeight: 800 }}>{ch.text}</span>
        : (ch.Icon ? <ch.Icon size={13} strokeWidth={2} /> : null)}
      {ch.check && (
        <span style={{
          position: 'absolute', right: -2, bottom: -2, width: 11, height: 11, borderRadius: 999,
          background: T.success, border: '1.5px solid #0F1419', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}><Check size={7} strokeWidth={3.5} color="#0F1419" /></span>
      )}
    </button>
  );
}

function CopyBtn() {
  return (
    <button title="Copy" style={{
      width: 26, height: 26, borderRadius: 999, flex: 'none', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
    }}><Copy size={12} /></button>
  );
}

function ContactRow({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Pill({ children, color, bg, border, glow, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 11px',
      borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
      background: bg || 'rgba(255,255,255,0.05)', color: color || 'rgba(255,255,255,0.8)',
      border: `1px solid ${border || 'rgba(255,255,255,0.14)'}`,
      boxShadow: glow || '0 2px 8px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

function Fact({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: "'Montserrat',sans-serif" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color || '#fff', fontFamily: "'Montserrat',sans-serif" }}>{value}</span>
    </div>
  );
}

function PanelTitle({ children, color, style }) {
  return (
    <div style={{
      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: color || 'rgba(255,255,255,0.5)', fontFamily: "'Montserrat',sans-serif",
      marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

export default function LeftSidebar() {
  const [activeTab, setActiveTab] = useState('Info');
  const [noteText, setNoteText] = useState('');
  const tabs = ['Info', 'Activity', 'Similar Unit', 'Buyer History', 'Pipeline', 'Outreach', 'Requirements', 'Qualify', 'Negotiation'];

  return (
    <div className="bv-left" style={{ overflowY: 'auto', padding: '18px 22px 28px' }}>
      {/* 5.1 Identity card */}
      <div style={{
        background: T.identityBg, border: `1px solid ${T.identityBorder}`, borderRadius: 16,
        boxShadow: T.identityShadow, padding: '16px 18px', marginBottom: 14,
        animation: 'ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* T1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flex: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800,
            color: '#1a1205', fontFamily: "'Cormorant Garamond',serif",
            background: 'linear-gradient(135deg, #eccd72, #C6A15B)',
            boxShadow: '0 4px 14px rgba(198,161,91,0.35)',
          }}>{buyer.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{
                fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, margin: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(198,161,91,0.85))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{buyer.name}</h1>
              <span style={{ fontSize: 18 }}>{buyer.flag}</span>
              {buyer.ru && <Pill color="rgba(255,255,255,0.8)" bg="rgba(255,255,255,0.06)">RU</Pill>}
              <button title="Download vCard" style={{
                width: 24, height: 24, borderRadius: 999, flex: 'none', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.14)',
                border: '1px solid rgba(34,197,94,0.4)', color: T.whatsapp, cursor: 'pointer',
              }}><Download size={12} /></button>
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{buyer.nameRu}</div>
          </div>
        </div>
        {/* Last activity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: T.success, boxShadow: '0 0 8px rgba(52,211,153,0.7)', flex: 'none' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{buyer.lastActivity}</span>
        </div>
        {/* T2 requirement strip */}
        <div style={{ background: 'rgba(198,161,91,0.06)', border: '1px solid rgba(198,161,91,0.25)', borderRadius: 9, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {buyer.requirements.map((r, i) => (
              <React.Fragment key={r}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{r}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        {/* Budget strip */}
        <div style={{ border: '1px solid rgba(198,161,91,0.18)', borderRadius: 9, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: "'Montserrat',sans-serif" }}>Budget</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.gold, fontFamily: "'Montserrat',sans-serif" }}>{buyer.budget}</span>
            </div>
            <Fact label="Pre-approved" value={buyer.preApproved} color={T.success} />
            <Fact label="Timeline" value={buyer.timeline} />
          </div>
        </div>
        {/* T3 contacts */}
        <div style={{ marginBottom: 14 }}>
          {buyer.phones.map((p) => (
            <ContactRow key={p.num}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Montserrat',sans-serif", minWidth: 130 }}>{p.num}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <CopyBtn />
                {CHANNELS.map((ch) => <ChannelCircle key={ch.key} ch={ch} />)}
              </div>
            </ContactRow>
          ))}
          <ContactRow>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Montserrat',sans-serif", minWidth: 130 }}>{buyer.email}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CopyBtn />
              <ChannelCircle ch={{ key: 'ft', label: 'FaceTime', color: T.facetime, Icon: Video }} />
              <button title="Email" style={{
                width: 26, height: 26, borderRadius: 999, flex: 'none', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.14)',
                border: `1px solid ${T.actionGoldBorder}`, color: T.gold, cursor: 'pointer',
              }}><Mail size={12} /></button>
            </div>
          </ContactRow>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: '1px dashed rgba(198,161,91,0.45)', background: 'transparent', color: T.gold, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}>+ Add phone</button>
            <button style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: '1px dashed rgba(198,161,91,0.45)', background: 'transparent', color: T.gold, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}>+ Add email</button>
          </div>
        </div>
        {/* T4 pills + facts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <Pill color={T.amber} bg="rgba(228,185,74,0.10)" border="rgba(228,185,74,0.4)" glow="0 0 10px rgba(228,185,74,0.25)">{buyer.stagePill}</Pill>
          <Pill color={RAPPORT.warming.c} bg={RAPPORT.warming.bg}>{buyer.rapport}</Pill>
          <Pill color={T.success} bg="rgba(52,211,153,0.12)" border="rgba(52,211,153,0.4)">{buyer.momentum}</Pill>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(198,161,91,0.4), transparent)', margin: '10px 0 12px' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, rowGap: 12 }}>
          <Fact label="Win" value={buyer.facts.win} color={winColor(buyer.facts.win)} />
          <Fact label="Source" value={buyer.facts.source} />
          <Fact label="Stage" value={buyer.facts.stage} />
          <Fact label="Residency" value={buyer.facts.residency} />
          <Fact label="Financing" value={buyer.facts.financing} color={T.success} />
        </div>
      </div>

      {/* 5.2 Aurora Proposes */}
      <div style={{ background: T.aiBg, border: `1px solid ${T.aiBorder}`, borderRadius: 11, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Sparkles size={13} color={T.ai} />
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ai, fontFamily: "'Montserrat',sans-serif" }}>Aurora Proposes · 1</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45, margin: 0, marginBottom: 10 }}>{auroraProposal.title}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'rgba(52,211,153,0.16)', border: '1px solid rgba(52,211,153,0.45)', color: T.success, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}><Check size={12} /> Approve</button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.4)', color: T.error, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}><X size={12} /> Dismiss</button>
        </div>
        <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0' }}>approve to keep · dismiss to teach</p>
      </div>

      {/* 5.3 AI Intelligence */}
      <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 12, padding: '14px', marginBottom: 12 }}>
        <PanelTitle color={T.ai}>AI Intelligence</PanelTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[['Trust', aiIntel.trust], ['Urgency', aiIntel.urgency], ['Win', aiIntel.win]].map(([l, v]) => {
            const isWin = l === 'Win';
            const col = isWin ? winColor(v) : scoreColor(v);
            const bg = isWin ? winBg(v) : scoreBg(v);
            const bd = isWin ? winBorder(v) : scoreBorder(v);
            return (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 10px', borderRadius: 999, background: bg, border: `1px solid ${bd}`, color: col, fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>
                <span style={{ fontSize: 9, opacity: 0.7 }}>{l.toUpperCase()}</span>{String(v)}
              </span>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, margin: 0 }}>{aiIntel.rationale}</p>
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: 'rgba(139,92,246,0.08)', border: `1px solid ${T.aiBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <Sparkles size={11} color={T.ai} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ai, fontFamily: "'Montserrat',sans-serif" }}>Needs your input</span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.45 }}>{aiIntel.needsInput}</p>
        </div>
      </div>

      {/* 5.4 AI Call Script */}
      <div style={{ background: T.panelBg, border: '1px solid rgba(198,161,91,0.3)', borderRadius: 12, padding: '14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <PanelTitle color={T.gold} style={{ marginBottom: 0 }}>AI Call Script</PanelTitle>
          <button title="Regenerate" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: T.actionGoldBg, border: `1px solid ${T.actionGoldBorder}`, color: T.actionGoldText, cursor: 'pointer' }}><RefreshCw size={12} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>“{callScript}”</p>
      </div>

      {/* 5.5 Buyer Dossier */}
      <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 12, padding: '14px', marginBottom: 12 }}>
        <PanelTitle>Buyer Dossier</PanelTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, rowGap: 12 }}>
          <Fact label="Financing" value={buyer.dossier.financing} />
          <Fact label="Proof of funds" value={buyer.dossier.pof} color={T.success} />
          <Fact label="Pre-approval" value={buyer.dossier.preApproval} />
          <Fact label="Passport" value={buyer.dossier.passport} color={T.success} />
        </div>
      </div>

      {/* 5.6 Mini tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {tabs.map((t) => {
          const on = t === activeTab;
          return (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              height: 26, padding: '0 10px', borderRadius: 8, fontSize: 9, fontWeight: 700,
              fontFamily: "'Montserrat',sans-serif", cursor: 'pointer', whiteSpace: 'nowrap',
              background: on ? T.ctaGold : 'rgba(255,255,255,0.04)',
              color: on ? T.ctaGoldText : 'rgba(255,255,255,0.6)',
              border: `1px solid ${on ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
            }}>{t}</button>
          );
        })}
      </div>

      {/* 5.7 Assigned Agent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, background: T.panelBg, border: `1px solid ${T.panelBorder}`, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#1a1205', background: 'linear-gradient(135deg, #eccd72, #C6A15B)', fontFamily: "'Montserrat',sans-serif" }}>{buyer.agent.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: "'Montserrat',sans-serif" }}>Assigned Agent</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{buyer.agent.name}</div>
        </div>
        <button style={{ padding: '6px 12px', borderRadius: 8, background: T.actionGoldBg, border: `1px solid ${T.actionGoldBorder}`, color: T.actionGoldText, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}>Change</button>
      </div>

      {/* 5.8 Media */}
      <div style={{ marginBottom: 12 }}>
        <PanelTitle>Media · 2</PanelTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {leftMedia.map((m) => (
            <div key={m.label} style={{ height: 84, borderRadius: 10, background: m.hue, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-end', padding: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Montserrat',sans-serif" }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5.9 Pinned Notes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>📌</span>
          <PanelTitle style={{ marginBottom: 0 }}>Pinned Notes · 2</PanelTitle>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pinnedNotes.map((n, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(198,161,91,0.18)', borderLeft: '2px solid #C6A15B' }}>
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45, margin: 0, marginBottom: 5 }}>{n.text}</p>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{n.author} · {n.time}</div>
            </div>
          ))}
        </div>
        <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="+ Add note…" style={{ marginTop: 8, width: '100%', padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none', fontFamily: "'Inter',sans-serif" }} />
      </div>
    </div>
  );
}