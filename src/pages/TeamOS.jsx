import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Brain, Zap, Users, AlertTriangle, BarChart3, MessageSquare } from 'lucide-react';
import AICommandCenter from '@/components/teamOS/AICommandCenter';
import LeadDistributionEngine from '@/components/teamOS/LeadDistributionEngine';
import ManagerVisibility from '@/components/teamOS/ManagerVisibility';
import TeamPerformanceBoard from '@/components/teamOS/TeamPerformanceBoard';
import AtRiskLeads from '@/components/teamOS/AtRiskLeads';

const TABS = [
  { id: 'command',      label: 'AI Command',    icon: Brain },
  { id: 'distribution', label: 'Lead Engine',   icon: Zap },
  { id: 'visibility',   label: 'Manager View',  icon: Users },
  { id: 'performance',  label: 'Performance',   icon: BarChart3 },
  { id: 'atrisk',       label: 'At Risk',       icon: AlertTriangle },
];

export default function TeamOS() {
  const [activeTab, setActiveTab] = useState('command');

  const { data: leads = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });
  const { data: agents = [] } = useQuery({
    queryKey: ['agent_workload'],
    queryFn: () => base44.entities.AgentWorkload.list('-total_conversations', 100),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date', 500),
  });
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-due_date', 200),
  });

  return (
    <div className="flex flex-col bg-[#0F1117] -m-6 overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Team AI Operating System</h1>
            <p className="text-[10px] text-white/40">Real Estate CRM Brain · Dubai</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/40 font-medium">LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 pb-0 flex-shrink-0 border-b border-white/10 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'text-indigo-300 border-indigo-400 bg-white/5'
                  : 'text-white/40 border-transparent hover:text-white/60 hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'command' && <AICommandCenter leads={leads} agents={agents} activities={activities} />}
        {activeTab === 'distribution' && <LeadDistributionEngine leads={leads} agents={agents} />}
        {activeTab === 'visibility' && <ManagerVisibility leads={leads} agents={agents} activities={activities} reminders={reminders} />}
        {activeTab === 'performance' && <TeamPerformanceBoard leads={leads} agents={agents} activities={activities} />}
        {activeTab === 'atrisk' && <AtRiskLeads leads={leads} agents={agents} />}
      </div>
    </div>
  );
}