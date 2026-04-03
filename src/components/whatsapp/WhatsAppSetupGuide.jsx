import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const WEBHOOK_URL = 'https://app.base44.app/api/apps/69cabceaeeb8bb5e3a62ead3/functions/whatsappWebhook';

export default function WhatsAppSetupGuide({ onClose }) {
  const [copied, setCopied] = useState(null);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      title: 'Go to Meta Developer Portal',
      content: (
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="gap-2 mt-2">
            <ExternalLink className="w-3.5 h-3.5" /> Open Meta Developers
          </Button>
        </a>
      ),
    },
    {
      title: 'Select your WhatsApp app → WhatsApp → Configuration',
      content: <p className="text-xs text-muted-foreground mt-1">In the left sidebar, go to WhatsApp → Configuration → Webhook</p>,
    },
    {
      title: 'Set the Webhook URL',
      content: (
        <div className="mt-2 flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 break-all">{WEBHOOK_URL}</code>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(WEBHOOK_URL, 'url')}>
            {copied === 'url' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      ),
    },
    {
      title: 'Set the Verify Token',
      content: (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">Use the same value you set as <code className="bg-muted px-1 rounded">WHATSAPP_VERIFY_TOKEN</code> in your app secrets.</p>
        </div>
      ),
    },
    {
      title: 'Subscribe to webhook fields',
      content: (
        <p className="text-xs text-muted-foreground mt-1">
          After saving, click <strong>Manage</strong> next to your webhook and subscribe to: <code className="bg-muted px-1 rounded">messages</code>
        </p>
      ),
    },
    {
      title: 'Verify & save',
      content: <p className="text-xs text-muted-foreground mt-1">Click <strong>Verify and Save</strong>. Once verified, incoming WhatsApp messages will appear in the CRM inbox automatically.</p>,
    },
  ];

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-2xl">📱</span> Connect WhatsApp Business API
        </h2>
        <p className="text-sm text-muted-foreground">Follow these steps to link your WhatsApp Business number to the CRM.</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{step.title}</p>
              {step.content}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Already have the secrets set?</strong> Your <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_ACCESS_TOKEN</code>, and <code>WHATSAPP_VERIFY_TOKEN</code> are already configured. Just complete the webhook registration above.
      </div>

      {onClose && (
        <Button variant="outline" size="sm" onClick={onClose} className="w-full">Done</Button>
      )}
    </div>
  );
}