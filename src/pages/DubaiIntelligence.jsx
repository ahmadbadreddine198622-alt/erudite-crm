import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DubaiROICalculator from '@/components/dubai/DubaiROICalculator';
import DubaiMarketPulse from '@/components/dubai/DubaiMarketPulse';
import GoldenVisaChecker from '@/components/dubai/GoldenVisaChecker';

export default function DubaiIntelligence() {
  const [activeTab, setActiveTab] = useState('roi');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[120rem] mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Dubai Intelligence"
          subtitle="Market insights, ROI calculator, and Golden Visa eligibility"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 font-semibold">
              🇦🇪 Dubai Market
            </span>
          </div>
        </PageHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="roi">ROI Calculator</TabsTrigger>
            <TabsTrigger value="market">Market Pulse</TabsTrigger>
            <TabsTrigger value="visa">Golden Visa</TabsTrigger>
          </TabsList>

          <TabsContent value="roi" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <DubaiROICalculator />
            </div>
          </TabsContent>

          <TabsContent value="market" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <DubaiMarketPulse />
            </div>
          </TabsContent>

          <TabsContent value="visa" className="mt-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <GoldenVisaChecker />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}