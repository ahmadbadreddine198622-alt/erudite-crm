// Buyer vCard page — route /buyer/:id. 1:1 clone of the Landlord vCard, dark theme.
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, RefreshCw, Users, Star } from 'lucide-react';
import { T, scoreColor, scoreBg, scoreBorder, winColor, winBg, winBorder } from '@/lib/buyerVCardTokens';
import { buyer, aiIntel } from '@/lib/buyerVCardSample';
import LeftSidebar from '@/components/buyervcard/LeftSidebar';
import RightPanel from '@/components/buyervcard/RightPanel';

export default function BuyerVCard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const intel = [
    ['TRUST', aiIntel.trust],
    ['URGENCY', aiIntel.urgency],
    ['WIN', aiIntel.win],
  ];

  return (
    <div style={{ minHeight: '100vh', background: T.base, color: T.text, fontFamily: "'Inter',sans-serif" }}>
      {/* 2 · TOP BAR */}
      <div className="bv-topbar" style={{
        position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14,
        padding: '9px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      }}>
        {/* Left */}
        <button onClick={() => navigate('/')} title="Go Back" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
          borderRadius: 8, background: 'rgba(79,106,180,0.12)', border: '1px solid rgba(79,106,180,0.4)',
          color: T.goBack, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
        }}><ArrowLeft size={15} /> Go Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          <span>Buyers</span><span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#fff', fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", fontSize: 15 }}>{buyer.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
          <button title="Previous" style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><ChevronLeft size={15} /></button>
          <button title="Next" style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><ChevronRight size={15} /></button>
        </div>

        {/* Right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* AI Intelligence pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px',
            borderRadius: 999, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)',
          }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8C8C9A', fontFamily: "'Montserrat',sans-serif", letterSpacing: '0.04em' }}>AI INTELLIGENCE</span>
            {intel.map(([l, v]) => {
              const isWin = l === 'WIN';
              const col = isWin ? winColor(v) : scoreColor(v);
              const bg = isWin ? winBg(v) : scoreBg(v);
              const bd = isWin ? winBorder(v) : scoreBorder(v);
              return (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 22, padding: '0 8px', borderRadius: 999, background: bg, border: `1px solid ${bd}`, color: col, fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>
                  <span style={{ fontSize: 8, opacity: 0.7 }}>{l}</span>{String(v)}
                </span>
              );
            })}
          </div>
          {/* AI Tasks pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px',
            borderRadius: 999, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.4)',
            color: T.ai, fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
          }}>
            <Sparkles size={13} /> AI TASKS 3
          </div>
          {/* Analyse */}
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 8, background: T.actionGoldBg, border: `1px solid ${T.actionGoldBorder}`, color: T.actionGoldText, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}><RefreshCw size={13} /> Analyse</button>
          {/* Assign Agent */}
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 8, background: T.actionGoldBg, border: `1px solid ${T.actionGoldBorder}`, color: T.actionGoldText, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}><Users size={14} color="#93a4c4" /> Assign Agent</button>
        </div>
      </div>

      {/* 3 · FOUNDER STRIP */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px',
        background: 'rgba(198,161,91,0.07)', borderBottom: '1px solid rgba(198,161,91,0.25)',
        fontSize: 12, color: 'rgba(255,255,255,0.88)',
      }}>
        <Star size={14} color={T.gold} fill={T.gold} />
        <span style={{ fontWeight: 800, color: T.gold, fontSize: 10, letterSpacing: '0.08em', fontFamily: "'Montserrat',sans-serif" }}>FOUNDER</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>—</span>
        <span>Qualify budget on the first call — no viewings before proof of funds.</span>
      </div>

      {/* 4 · BODY */}
      <div className="bv-body" style={{ minHeight: 'calc(100vh - 96px)' }}>
        <LeftSidebar />
        <RightPanel />
      </div>
    </div>
  );
}