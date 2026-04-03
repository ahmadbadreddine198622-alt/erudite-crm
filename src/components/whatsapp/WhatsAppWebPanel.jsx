import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, QrCode, Smartphone, MonitorSmartphone } from 'lucide-react';

const steps = [
  { step: '1', text: 'Open WhatsApp on your phone' },
  { step: '2', text: 'Tap the menu (⋮) or Settings' },
  { step: '3', text: 'Select "Linked Devices"' },
  { step: '4', text: 'Tap "Link a Device"' },
  { step: '5', text: 'Scan the QR code on WhatsApp Web' },
];

export default function WhatsAppWebPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-6 text-center bg-background">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
        <MonitorSmartphone className="w-10 h-10 text-green-600" />
      </div>

      {/* Heading */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Connect WhatsApp Web</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          WhatsApp Web must be opened in a separate tab. Follow the steps below to scan your QR code.
        </p>
      </div>

      {/* Steps */}
      <div className="w-full max-w-sm space-y-2 text-left">
        {steps.map(({ step, text }) => (
          <div key={step} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {step}
            </span>
            <span className="text-sm">{text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer">
        <Button className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <QrCode className="w-4 h-4" />
          Open WhatsApp Web
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </a>

      <p className="text-xs text-muted-foreground max-w-xs">
        WhatsApp Web cannot be embedded directly due to browser security restrictions. Use the button above to open it in a new tab.
      </p>
    </div>
  );
}