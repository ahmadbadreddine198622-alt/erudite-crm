import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, QrCode, MonitorSmartphone } from 'lucide-react';

export default function WhatsAppWebPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
        <MonitorSmartphone className="w-10 h-10 text-green-600" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Connect WhatsApp Web</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          WhatsApp Web cannot be embedded due to browser security restrictions. Click below to open it in a new tab.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2 text-left">
        {[
          { n: '1', t: 'Open WhatsApp on your phone' },
          { n: '2', t: 'Tap the menu (⋮) or Settings' },
          { n: '3', t: 'Select "Linked Devices"' },
          { n: '4', t: 'Tap "Link a Device"' },
          { n: '5', t: 'Scan the QR code on WhatsApp Web' },
        ].map(({ n, t }) => (
          <div key={n} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {n}
            </span>
            <span className="text-sm">{t}</span>
          </div>
        ))}
      </div>

      <a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer">
        <Button className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <QrCode className="w-4 h-4" />
          Open WhatsApp Web
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </a>
    </div>
  );
}