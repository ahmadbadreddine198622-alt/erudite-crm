import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Zap, Settings, BookOpen } from 'lucide-react';
import EmbeddedSignup from '@/components/whatsapp/EmbeddedSignup';
import WorkflowBuilder from '@/components/whatsapp/WorkflowBuilder';

const DOCS = [
  {
    title: 'Webhook Configuration',
    steps: [
      'Go to Meta for Developers → Your App → WhatsApp → Configuration',
      'Set Callback URL to: [your-app-url]/api/functions/whatsappWebhook',
      'Set Verify Token to match your WHATSAPP_VERIFY_TOKEN secret',
      'Subscribe to: messages, message_deliveries, message_reads',
    ]
  },
  {
    title: 'System User Token (Recommended)',
    steps: [
      'Go to Meta Business Suite → Settings → Users → System Users',
      'Create a System User with "Admin" role',
      'Generate a Never-Expiring token with whatsapp_business_messaging permission',
      'Save as WHATSAPP_ACCESS_TOKEN in app secrets',
    ]
  },
  {
    title: 'AI Workflows',
    steps: [
      'Create workflows in the "AI Workflows" tab',
      'Choose a trigger (new message, keyword, etc.)',
      'Add steps: send message, AI reply, assign agent, etc.',
      'Toggle "Active" to enable the workflow',
      'Workflows execute automatically via the webhook',
    ]
  },
];

export default function WhatsAppSetup() {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Business API</h1>
          <p className="text-muted-foreground text-sm mt-1">Connect your WhatsApp Business account and build AI-powered automation workflows</p>
        </div>
        <Badge className="ml-auto bg-green-500/10 text-green-700 border-green-500/20 shrink-0">Cloud API</Badge>
      </div>

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection" className="gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Connection
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> AI Workflows
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Setup Guide
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="mt-4">
          <EmbeddedSignup />
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="mt-4">
          <WorkflowBuilder />
        </TabsContent>

        {/* Docs Tab */}
        <TabsContent value="docs" className="mt-4">
          <div className="space-y-4">
            {DOCS.map((section, i) => (
              <div key={i} className="border rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">{section.title}</h3>
                <ol className="space-y-2">
                  {section.steps.map((step, j) => (
                    <li key={j} className="flex gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{j + 1}</span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            {/* Quick Reference */}
            <div className="border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Required App Secrets</h3>
              <div className="space-y-2">
                {[
                  { key: 'WHATSAPP_PHONE_NUMBER_ID', required: true },
                  { key: 'WHATSAPP_ACCESS_TOKEN', required: true },
                  { key: 'WHATSAPP_VERIFY_TOKEN', required: true },
                  { key: 'META_APP_ID', required: false, note: 'For Embedded Signup only' },
                  { key: 'META_APP_SECRET', required: false, note: 'For Embedded Signup only' },
                ].map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">{s.key}</code>
                    {s.required ? (
                      <Badge className="text-xs bg-red-500/10 text-red-600 border-red-500/20">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">{s.note}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}