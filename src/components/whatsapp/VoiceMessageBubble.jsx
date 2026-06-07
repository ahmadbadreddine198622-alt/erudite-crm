import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGUAGE_BADGES = {
  'en': { label: 'EN', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'ar': { label: 'AR', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'ru': { label: 'RU', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'fr': { label: 'FR', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export default function VoiceMessageBubble({ message, isOutbound }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const audioRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const mediaUrl = message.media_url;
  const transcript = message.transcript;
  const transcriptLang = message.transcript_lang;
  const translatedText = message.translated_text;
  // transcriptStatus unused — transcription disabled
  const mediaDuration = message.media_duration;

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const handleLoadedMetadata = () => setDuration(audio.duration);
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleEnded = () => setIsPlaying(false);
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    if (audioRef.current) {
      audioRef.current.currentTime = percentage * duration;
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const langBadge = LANGUAGE_BADGES[transcriptLang] || { label: transcriptLang?.toUpperCase() || '??', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

  // Voice message player (transcription shown below if available)
  return (
    <div className="space-y-2">
      <div className={cn('rounded-xl px-3 py-2.5', isOutbound ? 'bg-[#243044]' : 'bg-[#1A2230]')}>
        <audio ref={audioRef} src={mediaUrl} className="hidden" />
        
        {/* Audio player */}
        <div className="flex items-center gap-3 mb-2.5">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-[#C9A24B]/20 hover:bg-[#C9A24B]/30 flex items-center justify-center transition-colors shrink-0"
          >
            {isPlaying ? <Pause className="w-5 h-5 text-[#C9A24B]" /> : <Play className="w-5 h-5 text-[#C9A24B] ml-0.5" />}
          </button>
          
          <div className="flex-1">
            <div
              className="h-1.5 bg-white/10 rounded-full cursor-pointer relative group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-[#C9A24B] rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div className="absolute inset-0 bg-[#C9A24B]/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          
          <span className="text-xs text-white/60 shrink-0">
            {formatTime(currentTime)} / {formatTime(duration || mediaDuration || 0)}
          </span>
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${langBadge.color}`}>
                {langBadge.label}
              </span>
              {translatedText && (
                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="text-[10px] text-[#C9A24B] hover:text-[#C9A24B]/80 underline underline-offset-2"
                >
                  {showTranslation ? 'Show original' : 'See translation'}
                </button>
              )}
            </div>
            
            <p className="text-sm text-white/90 leading-relaxed">
              {showTranslation && translatedText ? translatedText : transcript}
            </p>
            
            {showTranslation && translatedText && (
              <p className="text-xs text-white/50 italic border-t border-white/10 pt-2 mt-2">
                Original: {transcript}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}