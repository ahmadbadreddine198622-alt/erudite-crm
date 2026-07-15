import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Volume2, Gauge, Play, Mic, Languages } from 'lucide-react';
import { useReadAloud } from '@/lib/ReadAloudContext';
import { getDictationSettings, setDictationSettings, DICTATION_LANGUAGES } from '@/lib/dictationSettings';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * VoiceAudioSettings — "Voice & Audio" section in Profile.
 * Lets the user pick their preferred voice, default speed, and
 * toggle auto-play for Academy lessons.
 */
export default function VoiceAudioSettings() {
  const {
    voices, voiceURI, rate, autoPlay, setVoiceURI, setRate, setAutoPlay, isSupported, play,
  } = useReadAloud();

  const [dictationSettings, setDictationState] = useState(getDictationSettings());
  useEffect(() => {
    const handler = () => setDictationState(getDictationSettings());
    window.addEventListener('dictation-settings-changed', handler);
    return () => window.removeEventListener('dictation-settings-changed', handler);
  }, []);

  const handleTest = () => {
    play(
      ['This is a test of your selected voice. The Erudite Academy will read your lessons with this tone and speed.'],
      'Voice Test',
      { id: 'voice-test' },
    );
  };

  return (
    <Card className="glass-card border-accent/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-accent">
          <Volume2 className="w-4 h-4" /> Voice & Audio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported ? (
          <p className="text-sm text-muted-foreground">
            Text-to-speech is not supported in this browser. Try Chrome, Safari, or Edge.
          </p>
        ) : (
          <>
            {/* Voice info */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" /> Voice
              </label>
              <div className="glass-input w-full px-3 py-2.5 text-sm rounded-md flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                  <Volume2 className="w-3.5 h-3.5 text-accent" />
                </div>
                <div>
                  <p className="text-foreground font-medium text-sm leading-tight">Erudite Leader</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Deep, authoritative — natural human tone</p>
                </div>
              </div>
            </div>

            {/* Default speed */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Gauge className="w-3 h-3" /> Default playback speed
              </label>
              <div className="flex gap-2">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => setRate(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      rate === s
                        ? 'bg-accent text-accent-foreground border border-accent/50'
                        : 'bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-play Academy lessons */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Play className="w-3 h-3" /> Auto-play Academy lessons
                </label>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Automatically start reading when you open a lesson.
                </p>
              </div>
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  autoPlay ? 'bg-accent' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    autoPlay ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Test voice */}
            <button
              onClick={handleTest}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
            >
              <Play className="w-3 h-3" /> Test voice
            </button>

            {/* ── Dictation ── */}
            <div className="pt-2 border-t border-white/8">
              <p className="text-xs font-semibold text-accent flex items-center gap-1.5 mb-3">
                <Mic className="w-3 h-3" /> Voice Dictation
              </p>

              {/* Enable toggle */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mic className="w-3 h-3" /> Dictation enabled
                  </label>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Show mic buttons on text inputs across the CRM
                  </p>
                </div>
                <button
                  onClick={() => setDictationSettings({ enabled: !dictationSettings.enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    dictationSettings.enabled ? 'bg-accent' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      dictationSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Language preference */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                  <Languages className="w-3 h-3" /> Dictation language
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DICTATION_LANGUAGES.map(l => (
                    <button
                      key={l.value}
                      onClick={() => setDictationSettings({ language: l.value })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        dictationSettings.language === l.value
                          ? 'bg-accent text-accent-foreground border border-accent/50'
                          : 'bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-2">
                  Uses Deepgram Nova-2 streaming. Falls back to browser speech if unavailable.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}