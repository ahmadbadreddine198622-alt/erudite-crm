import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle, Settings, Zap, FileText, Bot, Users, TrendingUp,
  CheckCircle2, AlertCircle, Phone, Wifi, Copy, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import WorkflowBuilder from '@/components/whatsapp/WorkflowBuilder';
import AutomationDashboard from '@/components/whatsapp/AutomationDashboard';
import TemplateManager from '@/components/whatsapp/TemplateManager';
import TemplateSelector from '@/components/whatsapp/TemplateSelector';
import WhatsAppSetupGuide from '@/components/whatsapp/WhatsAppSetupGuide';

export default function WhatsAppHub() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
            <MessageCircle className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Business Hub</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Complete WhatsApp integration for your CRM</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/whatsapp">
            <Button variant="outline" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Open Inbox
            </Button>
          </Link>
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            WhatsApp Web
          </a>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Setup</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Automation</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground mt-1">8 unread messages</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <Send className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground mt-1">3 automated today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">4 favorites</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Connection Status
                </CardTitle>
                <CardDescription>Your WhatsApp Business API configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone Number ID</p>
                      <p className="text-xs text-muted-foreground">111463521666858</p>
                    </div>
                  </div>
                  <Badge variant="outline">Configured</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">API Status</p>
                      <p className="text-xs text-muted-foreground">Access token active</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Connected</Badge>
                </div>
                <Button onClick={() => setActiveTab('setup')} variant="outline" className="w-full">
                  Manage Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common WhatsApp tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveTab('workflows')}>
                  <Zap className="w-4 h-4" />
                  Create New Workflow
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveTab('templates')}>
                  <FileText className="w-4 h-4" />
                  Manage Message Templates
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveTab('automation')}>
                  <Bot className="w-4 h-4" />
                  Configure Automation Rules
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                  <Link to="/whatsapp">
                    <MessageCircle className="w-4 h-4" />
                    Open Message Inbox
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Setup Tab */}
        <TabsContent value="setup">
          <WhatsAppSetupGuide />
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows">
          <WorkflowBuilder />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <AutomationDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Send({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}