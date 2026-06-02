import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { Megaphone, Plus, Mail, TrendingUp, Users, BarChart3 } from 'lucide-react';

export default function Broadcasts() {
  const stats = {
    total: 24,
    sentThisMonth: 8456,
    avgOpenRate: 72,
    avgCtr: 24,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Broadcasts</h1>
            <p className="text-gray-500 mt-1">Bulk messaging and campaign management</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Campaigns</span>
              <Megaphone className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Sent This Month</span>
              <Mail className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.sentThisMonth.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +18%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. Open Rate</span>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgOpenRate}%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +5%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. CTR</span>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgCtr}%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +3%
            </p>
          </iOSCard>
        </div>

        {/* Campaign Library */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Campaign Library</h2>
              <p className="text-sm text-gray-500">Broadcasts</p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
            <Megaphone className="w-12 h-12 mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2 text-gray-700">No campaigns yet</h3>
            <p className="text-sm text-center max-w-md text-gray-500">
              Create your first broadcast campaign to engage your audience
            </p>
            <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              Create Campaign
            </button>
          </div>
        </iOSCard>

        {/* Audience Reach */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Audience Reach</h2>
              <p className="text-sm text-gray-500">Analytics</p>
            </div>
          </div>
          <div className="p-6 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-500">
              Campaign reach and engagement analytics will appear here
            </p>
          </div>
        </iOSCard>
      </div>
    </div>
  );
}