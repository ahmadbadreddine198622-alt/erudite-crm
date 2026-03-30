import React, { useState, useMemo } from 'react';
import { Loader2, Copy, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const LANGUAGE_NAMES = {
  'en': 'English',
  'ru': 'Russian',
  'ar': 'Arabic',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'pt': 'Portuguese',
  'hi': 'Hindi'
};

export default function VoiceMessageBubble({ message }) {
  const [expandTranslations, setExpandTranslations] = useState(false);

  const transcription = message.transcription;
  const detected_language = message.detected_language;
  const translations = message.translations || {};

  if (!transcription) {
    return (
      <div className="flex gap-2 items-center bg-muted/30 px-3 py-2 rounded-lg text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Transcribing voice message...
      </div>
    );
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-2">
      {/* Original transcription */}
      <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-green-700">
              {LANGUAGE_NAMES[detected_language] || detected_language.toUpperCase()}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleCopy(transcription)}
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
        <p className="text-sm text-foreground">{transcription}</p>
      </div>

      {/* Translations */}
      {Object.keys(translations).length > 1 && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandTranslations(!expandTranslations)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
          >
            {expandTranslations ? '− Hide translations' : '+ Show translations'}
          </button>

          {expandTranslations && (
            <div className="space-y-2">
              {Object.entries(translations).map(([lang, text]) => {
                if (lang === detected_language) return null;
                return (
                  <div
                    key={lang}
                    className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-blue-700 border-blue-300">
                        {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleCopy(text)}
                      >
                        <Copy className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                    <p className="text-sm text-foreground">{text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}