import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AICloser from '@/components/ai/AICloser';
import VIPConcierge from '@/components/vip/VIPConcierge';
import OffMarketExchange from '@/components/exclusive/OffMarketExchange';
import MortgageCalculator from '@/components/finance/MortgageCalculator';

export default function EliteDesk() {
  const [activeTab, setActiveTab] = useState('closer');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[140rem] mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Elite Desk"
          subtitle="AI-powered closing, VIP concierge, and exclusive off-market deals"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-500 font-semibold flex items-center gap-1">
              👑 CEO-Level Tools
            </span>
          </div>
        </PageHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="closer">AI Closer</TabsTrigger>
            <TabsTrigger value="vip">VIP Concierge</TabsTrigger>
            <TabsTrigger value="offmarket">Off-Market</TabsTrigger>
            <TabsTrigger value="mortgage">Mortgage</TabsTrigger>
          </TabsList>

          <TabsContent value="closer" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <AICloser />
            </div>
          </TabsContent>

          <TabsContent value="vip" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <VIPConcierge />
            </div>
          </TabsContent>

          <TabsContent value="offmarket" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <OffMarketExchange />
            </div>
          </TabsContent>

          <TabsContent value="mortgage" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <MortgageCalculator />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}