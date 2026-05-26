import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function MetaAdsLeads() {
  const [copied, setCopied] = useState(false);
  const appId = import.meta.env.VITE_APP_ID || 'your-app-id';
  const webhookUrl = `${window.location.origin}/api/functions/metaLeadsWebhook`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meta Ads & Google Leads</h1>
        <p className="text-muted-foreground mt-2">Connect Facebook & Google lead forms to auto-import leads into your CRM</p>
      </div>

      <Tabs defaultValue="meta" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="meta">Meta Lead Ads</TabsTrigger>
          <TabsTrigger value="google">Google Ads Forms</TabsTrigger>
        </TabsList>

        {/* Meta Lead Ads Setup */}
        <TabsContent value="meta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                Setup Instructions
              </CardTitle>
              <CardDescription>Configure Meta Lead Ads webhook</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Webhook URL */}
              <div className="border-l-2 border-yellow-600 pl-4">
                <h3 className="font-semibold mb-2">Step 1: Add Webhook Endpoint</h3>
                <p className="text-sm text-muted-foreground mb-3">Copy this URL and configure it in Meta Business Platform:</p>
                <div className="flex items-center gap-2 bg-secondary rounded-lg p-3">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="border-0 bg-transparent text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Step 2: Verify Token */}
              <div className="border-l-2 border-blue-600 pl-4">
                <h3 className="font-semibold mb-2">Step 2: Set Verify Token</h3>
                <p className="text-sm text-muted-foreground mb-3">Go to Meta Business Platform → Apps → Your App → Webhooks → Lead Form</p>
                <Alert>
                  <AlertDescription className="text-xs">
                    Set any custom verify token (e.g., "my_secure_token_123"). You'll need to save it in app settings.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Step 3: Subscribe to Events */}
              <div className="border-l-2 border-green-600 pl-4">
                <h3 className="font-semibold mb-2">Step 3: Subscribe to Lead Form Events</h3>
                <p className="text-sm text-muted-foreground mb-3">In Meta Webhooks settings, select:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li><code className="bg-secondary px-2 py-1 rounded text-xs">leadgen_qualification</code></li>
                  <li><code className="bg-secondary px-2 py-1 rounded text-xs">leadgen</code></li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <Badge>Status: Ready to receive leads</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Ads Forms Setup */}
        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                Setup Instructions
              </CardTitle>
              <CardDescription>Configure Google Ads lead forms webhook</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Google Ads Webhook */}
              <div className="border-l-2 border-yellow-600 pl-4">
                <h3 className="font-semibold mb-2">Step 1: Configure Lead Form Webhook</h3>
                <p className="text-sm text-muted-foreground mb-3">In Google Ads → Tools → Lead forms → Your Form → Webhook Settings</p>
                <div className="flex items-center gap-2 bg-secondary rounded-lg p-3">
                  <Input
                    readOnly
                    value={`${window.location.origin}/api/functions/googleLeadsWebhook`}
                    className="border-0 bg-transparent text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/functions/googleLeadsWebhook`)}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Step 2: Set Secret */}
              <div className="border-l-2 border-blue-600 pl-4">
                <h3 className="font-semibold mb-2">Step 2: Add Secret Token</h3>
                <p className="text-sm text-muted-foreground mb-3">Create a secret in Google Ads webhook settings and save it in app settings as <code className="bg-secondary px-2 py-1 rounded text-xs">GOOGLE_ADS_WEBHOOK_SECRET</code></p>
              </div>

              {/* Step 3: Test */}
              <div className="border-l-2 border-green-600 pl-4">
                <h3 className="font-semibold mb-2">Step 3: Test Lead Submission</h3>
                <p className="text-sm text-muted-foreground">Submit a test lead through your Google Ads lead form to verify the integration</p>
              </div>

              <div className="pt-4 border-t">
                <Badge>Status: Ready to receive leads</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Imported Leads</CardTitle>
          <CardDescription>Leads from Meta Ads and Google Ads lead forms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No leads imported yet. Configure your webhooks above to start receiving leads.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}