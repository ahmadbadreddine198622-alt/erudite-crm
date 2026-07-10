// EruditeToneButton — AI-powered brand-voice tone adjustment.
// Fetches the active BrandVoice record (charter_text + language_rules +
// banned_patterns) and rewrites the current draft to match, preserving
// the draft language.

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Crown, Loader2 } from 'lucide-react';

export default function EruditeToneButton({ text, onReplace, style }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!text?.trim() || busy) return;
    setBusy(true);
    try {
      const voices = await base44.entities.BrandVoice.filter({ is_active: true }, '-updated_date', 1);
      const bv = voices?.[0];
      if (!bv) { toast.error('No BrandVoice configured — set one in Brand Settings'); return; }

      const prompt = [
        'You are a tone-adjustment AI for Erudite Real Estate (Dubai).',
        'Rewrite the message below so it matches the brand voice exactly.',
        'Preserve the original language — do NOT translate.',
        'Return ONLY the rewritten message text, no commentary.',
        '',
        'BRAND VOICE CHARTER:',
        bv.charter_text || '(none)',
        '',
        'LANGUAGE RULES:',
        bv.language_rules || '(none)',
        '',
        'BANNED PATTERNS (avoid):',
        JSON.stringify(bv.banned_patterns || []),
        '',
        'ORIGINAL MESSAGE:',
        text,
      ].join('\n');

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', properties: { rewritten: { type: 'string' } } },
      });
      const rewritten = res?.rewritten || (typeof res === 'string' ? res : '');
      if (rewritten && rewritten.trim()) {
        onReplace(rewritten.trim());
        toast.success('Tone adjusted to brand voice ✓');
      } else {
        toast.error('No rewrite returned');
      }
    } catch (e) {
      toast.error('Tone adjustment failed: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!text?.trim() || busy}
      title="Erudite Tone — match brand voice"
      style={style || {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
        background: 'rgba(212,175,55,0.1)', color: '#d4af37',
        border: '1px solid rgba(212,175,55,0.3)', transition: 'background 0.15s',
        opacity: (!text?.trim() || busy) ? 0.4 : 1,
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
    </button>
  );
}