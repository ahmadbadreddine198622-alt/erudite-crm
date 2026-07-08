// ChatExtraTools — the three tools from the design reference that UnifiedChatComposer
// doesn't already have: AI Magic (gold ✨), Web Search (🌍), Polish (✦).
// Rendered inside the ModernComposerField toolbar via extraToolbarChildren.

import React, { useState } from 'react';
import { Sparkles, Globe, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOLD = '#d4b483';

function iconBtn(active, color, activeColor) {
  return {
    flex: 'none', width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? (activeColor + '22') : 'transparent',
    color: active ? activeColor : color,
    border: '1px solid ' + (active ? (activeColor + '55') : 'transparent'),
    transition: 'background 0.15s, border-color 0.15s',
  };
}

export default function ChatExtraTools({ text, onTextChange, landlordId, landlordName }) {
  const [magicBusy, setMagicBusy] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  const [polishBusy, setPolishBusy] = useState(false);
  const hasText = !!((text || '').trim());

  // AI Magic — reshape/polish the message for the AI brain (gold sparkle)
  const runMagic = async () => {
    if (magicBusy || !hasText || !landlordId) return;
    setMagicBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Dubai real estate expert. Rewrite this WhatsApp message to the landlord to be warm, precise, short, and actionable — with one clear ask. Keep the original intent. Return ONLY the rewritten message, no quotes, no commentary.\n\nOriginal:\n${text}`,
        response_json_schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      });
      const msg = res?.message || res?.data?.message;
      if (!msg) throw new Error('No message returned');
      onTextChange({ target: { value: msg } });
      toast.success('✨ Message reshaped');
    } catch (e) {
      toast.error(e?.message || 'Magic reshape failed');
    } finally {
      setMagicBusy(false);
    }
  };

  // Web Search — enrich with real-time market context
  const runWebEnrich = async () => {
    if (webBusy || !hasText) return;
    setWebBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Dubai real estate expert assistant. The agent is sending a WhatsApp message to a landlord (${landlordName || 'the landlord'}). Enrich this message with any relevant real-time market context (current prices, trends, news) that would strengthen the message. Keep the agent's original intent and ADD a brief "Market context" line below it.\n\nAgent's message:\n${text}`,
        add_context_from_internet: true,
        response_json_schema: { type: 'object', properties: { enriched_message: { type: 'string' } }, required: ['enriched_message'] },
      });
      const enriched = res?.enriched_message || res?.data?.enriched_message;
      if (!enriched) throw new Error('No enrichment returned');
      onTextChange({ target: { value: enriched } });
      toast.success('🌐 Enriched with market context');
    } catch (e) {
      toast.error(e?.message || 'Web enrichment failed');
    } finally {
      setWebBusy(false);
    }
  };

  // Polish — clean up grammar, structure, and tone
  const runPolish = async () => {
    if (polishBusy || !hasText) return;
    setPolishBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Clean up and polish this WhatsApp message. Fix grammar, tighten sentences, ensure a warm professional tone. Keep it concise. Return ONLY the polished text, no commentary.\n\n${text}`,
        response_json_schema: { type: 'object', properties: { polished: { type: 'string' } }, required: ['polished'] },
      });
      const polished = res?.polished || res?.data?.polished;
      if (!polished) throw new Error('No polished text returned');
      onTextChange({ target: { value: polished } });
      toast.success('✦ Message polished');
    } finally {
      setPolishBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={runMagic} disabled={magicBusy || !hasText}
        title="✨ AI Magic — reshape for impact"
        style={iconBtn(magicBusy, GOLD, GOLD)}>
        {magicBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      </button>
      <button type="button" onClick={runWebEnrich} disabled={webBusy || !hasText}
        title="🌐 Enrich with real-time market context"
        style={iconBtn(webBusy, 'rgba(59,130,246,0.7)', '#3b82f6')}>
        {webBusy ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
      </button>
      <button type="button" onClick={runPolish} disabled={polishBusy || !hasText}
        title="✦ Polish & clean grammar"
        style={iconBtn(polishBusy, 'rgba(167,139,246,0.7)', '#a78bfa')}>
        {polishBusy ? <Loader2 size={13} className="animate-spin" /> : <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>}
      </button>
    </>
  );
}