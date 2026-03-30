import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, QrCode } from 'lucide-react';

export default function WhatsAppWebPanel() {
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef(null);

  const refresh = () => {
    setLoaded(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'https://web.whatsapp.com';
    }
  };

  return (
    <div className={`flex flex-col bg-background border-l border-border transition-all duration-300 ${fullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center">
            <QrCode className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">WhatsApp Web</p>
            <p className="text-[10px] text-muted-foreground">Scan QR to connect your account</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(v => !v)}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
          <a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 flex items-center gap-2 shrink-0">
        <QrCode className="w-3.5 h-3.5 shrink-0" />
        <span>Open WhatsApp on your phone → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → scan the QR code below</span>
      </div>

      {/* Iframe */}
      <div className="relative flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background z-10">
            <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading WhatsApp Web...</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="https://web.whatsapp.com"
          className="w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          title="WhatsApp Web"
          allow="camera; microphone; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}