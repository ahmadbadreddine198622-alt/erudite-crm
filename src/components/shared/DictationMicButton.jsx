import React, { useState, useEffect } from 'react';
import { AudioLines, Square } from 'lucide-react';
import { useDictation } from '@/hooks/useDictation';
import { getDictationSettings, onDictationSettingsChange } from '@/lib/dictationSettings';
import DictationBar from '@/components/shared/DictationBar';

/**
 * DictationMicButton — Claude.ai-style live dictation control.
 *
 * Renders ONE prominent rounded-square button (36px) with a gold background
 * and navy AudioLines icon — noticeably bigger than surrounding toolbar icons.
 * When recording it turns into a pulsing stop state.
 *
 * A thin live waveform strip (DictationBar) renders INSIDE the input bar area,
 * with interim words streaming into the bound field (dimmed/italic until final).
 *
 * Props:
 *   value     — current text value of the bound field
 *   onChange   — setter that accepts a string
 *   language   — optional override ('auto' | 'en' | 'ar' | 'ru')
 *   style      — extra inline styles for the wrapper
 *   disabled   — disable the button
 */
export default function DictationMicButton({
  value,
  onChange,
  language: languageProp,
  style,
  disabled,
  focusTargetRef,
}) {
  const [settings, setSettings] = useState(getDictationSettings());
  useEffect(() => onDictationSettingsChange(() => setSettings(getDictationSettings())), []);

  const language = languageProp || settings.language || 'auto';
  const { isListening, interimText, start, stop, analyser } = useDictation({ value, onChange, language });

  if (!settings.enabled) return null;

  const BTN = 36; // button size — noticeably bigger than 32px toolbar icons

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      // Focus the bound textarea before starting so the user sees text stream in
      // without having to click into the field first.
      if (focusTargetRef?.current) {
        focusTargetRef.current.focus();
      }
      start();
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title={isListening ? 'Stop dictation' : 'Dictate'}
        aria-label={isListening ? 'Stop dictation' : 'Dictate'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: BTN,
          height: BTN,
          borderRadius: 9,
          background: isListening
            ? 'linear-gradient(135deg, #d4af37, #b8862b)'
            : '#d4af37',
          border: 'none',
          color: '#1a1205',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: isListening
            ? '0 0 0 4px rgba(212,175,55,0.18), 0 2px 12px rgba(212,175,55,0.35)'
            : '0 1px 6px rgba(212,175,55,0.18)',
          animation: isListening ? 'dmb-pulse 1.3s ease-in-out infinite' : 'none',
        }}
      >
        {isListening ? (
          <Square size={15} style={{ fill: 'currentColor' }} strokeWidth={0} />
        ) : (
          <AudioLines size={18} strokeWidth={2.2} />
        )}
      </button>

      {isListening && (
        <DictationBar analyser={analyser} onStop={stop} interimText={interimText} />
      )}
    </div>
  );
}