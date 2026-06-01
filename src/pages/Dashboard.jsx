import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Users, Brain, Bell, MessageCircle, Handshake, Eye, 
  Building2, TrendingUp, ArrowUpRight, AlertCircle
} from 'lucide-react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import iOSButton from '@/components/ios/iOSButton';
import iOSStat from '@/components/ios/iOSStat';
import PFListingsGrid from '@/components/properties/PFListingsGrid';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) setUserEmail(u.email);
      if (u?.full_name) setUserName(u.full_name);
    }).catch(() => {});
  }, []);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders-pending'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 50),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 50),
  });

  const { data: offers = [] } = useQuery({
    queryKey: ['offers'],
    queryFn: () => base44.entities.Offer.filter({ status: 'submitted' }, '-submitted_at', 50),
  });

  const { data: viewings = [] } = useQuery({
    queryKey: ['viewings'],
    queryFn: () => base44.entities.Reminder.filter({ type: 'viewing', status: 'pending' }, '-due_date', 20),
  });

  const stats = {
    activeLeads: leads.filter(l => l.status === 'active').length,
    hotLeads: leads.filter(l => (l.ai_lead_score || 0) >= 75).length,
    pendingReminders: reminders.length,
    unreadWhatsApp: conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
    activeOffers: offers.length,
    upcomingViewings: viewings.length,
  };

  const recentLeads = leads.slice(0, 5);
  const overdueReminders = reminders.filter(r => {
    const dueDate = new Date(r.due_date);
    return dueDate < new Date() && r.status === 'pending';
  }).slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {userName || userEmail?.split('@')[0] || 'User'}
            </h1>
            <p className="text-gray-500 mt-1">
              Here's what's happening with your real estate business today
            </p>
          </div>
          <iOSButton
            variant="primary"
            icon={Building2}
            onClick={() => navigate('/landlords')}
          >
            Landlord Pipeline
          </iOSButton>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSStat
            label="Active Leads"
            value={stats.activeLeads}
            trend={12}
            icon={Users}
            color="blue"
          />
          <iOSStat
            label="Hot Leads"
            value={stats.hotLeads}
            icon={Brain}
            color="orange"
          />
          <iOSStat
            label="Pending Tasks"
            value={stats.pendingReminders}
            icon={Bell}
            color="red"
          />
          <iOSStat
            label="WhatsApp"
            value={stats.unreadWhatsApp}
            icon={MessageCircle}
            color="green"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100">
                <Handshake className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Offers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeOffers}</p>
              </div>
            </div>
          </iOSCard>

          <iOSCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-100">
                <Eye className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Upcoming Viewings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.upcomingViewings}</p>
              </div>
            </div>
          </iOSCard>

          <iOSCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Deals This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {leads.filter(l => l.stage === 'closing_dld' || l.stage === 'negotiation_deal_lock').length}
                </p>
              </div>
            </div>
          </iOSCard>
        </div>

        {/* Property Finder Listings */}
        <iOSCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Property Finder Listings</h2>
                <p className="text-sm text-gray-500">Your active listings from Property Finder</p>
              </div>
            </div>
          </div>
          <PFListingsGrid />
        </iOSCard>

        {/* AI Insights + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Insights */}
          <iOSCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
                <p className="text-sm text-gray-500">Your intelligence hub</p>
              </div>
            </div>
            <div className="space-y-3">
              {stats.hotLeads > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{stats.hotLeads} Hot Leads</p>
                      <p className="text-xs text-gray-500">High conversion probability</p>
                    </div>
                  </div>
                  <iOSButton variant="ghost" onClick={() => navigate('/leads')}>
                    View
                  </iOSButton>
                </div>
              )}
              {overdueReminders.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{overdueReminders.length} Overdue Tasks</p>
                      <p className="text-xs text-gray-500">Need immediate attention</p>
                    </div>
                  </div>
                  <iOSButton variant="ghost" onClick={() => navigate('/reminders')}>
                    View
                  </iOSButton>
                </div>
              )}
              {stats.activeOffers > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center gap-3">
                    <Handshake className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{stats.activeOffers} Active Offers</p>
                      <p className="text-xs text-gray-500">In negotiation</p>
                    </div>
                  </div>
                  <iOSButton variant="ghost" onClick={() => navigate('/offers')}>
                    View
                  </iOSButton>
                </div>
              )}
              {stats.hotLeads === 0 && overdueReminders.length === 0 && stats.activeOffers === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Everything looks good! No urgent actions needed.
                </p>
              )}
            </div>
          </iOSCard>

          {/* Recent Leads */}
          <iOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
                  <p className="text-sm text-gray-500">Latest additions to your pipeline</p>
                </div>
              </div>
              <iOSButton variant="ghost" onClick={() => navigate('/leads')}>
                View All
              </iOSButton>
            </div>
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">
                        {(lead.full_name || lead.email || 'L')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{lead.full_name || 'Lead'}</p>
                      <p className="text-xs text-gray-500">{lead.email || 'No email'}</p>
                    </div>
                  </div>
                  <iOSBadge variant={lead.status === 'active' ? 'green' : 'gray'}>
                    {lead.status}
                  </iOSBadge>
                </div>
              ))}
              {recentLeads.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No leads yet. Start adding contacts to your pipeline!
                </p>
              )}
            </div>
          </iOSCard>
        </div>

        {/* Quick Actions */}
        <iOSCard className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <iOSButton
              variant="secondary"
              icon={Building2}
              onClick={() => navigate('/landlords')}
              className="w-full justify-center"
            >
              Landlords
            </iOSButton>
            <iOSButton
              variant="secondary"
              icon={Users}
              onClick={() => navigate('/leads')}
              className="w-full justify-center"
            >
              Leads
            </iOSButton>
            <iOSButton
              variant="secondary"
              icon={Bell}
              onClick={() => navigate('/reminders')}
              className="w-full justify-center"
            >
              Reminders
            </iOSButton>
            <iOSButton
              variant="secondary"
              icon={MessageCircle}
              onClick={() => navigate('/whatsapp')}
              className="w-full justify-center"
            >
              WhatsApp
            </iOSButton>
          </div>
        </iOSCard>
      </div>
    </div>
  );
}