import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { CheckCircle, TrendingUp, Clock, DollarSign, Brain } from 'lucide-react';

export default function ClosingAI() {
  const stats = {
    dealsInClosing: 14,
    closeRate: 76,
    avgTimeToClose: 18,
    totalValueClosed: 89000000,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Closing AI</h1>
            <p className="text-gray-500 mt-1">Deal-closing assistant and guidance</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
            <Brain className="w-4 h-4" />
            New Deal Review
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Deals in Closing</span>
              <CheckCircle className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.dealsInClosing}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Close Rate</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.closeRate}%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +8%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. Time to Close</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgTimeToClose} days</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              -3 days
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Value Closed</span>
              <DollarSign className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">AED {(stats.totalValueClosed / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +15%
            </p>
          </iOSCard>
        </div>

        {/* Active Closings */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Closings</h2>
              <p className="text-sm text-gray-500">Pipeline</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
            <CheckCircle className="w-12 h-12 mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2 text-gray-700">No deals in closing</h3>
            <p className="text-sm text-center max-w-md text-gray-500">
              AI will guide you through the closing process once deals reach this stage
            </p>
            <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              Review Deals
            </button>
          </div>
        </iOSCard>

        {/* Closing Performance */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Closing Performance</h2>
              <p className="text-sm text-gray-500">Analytics</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-600">
              Deal closing analytics and AI recommendations will appear here
            </p>
          </div>
        </iOSCard>
      </div>
    </div>
  );
}