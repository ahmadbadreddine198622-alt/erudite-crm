import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Building2, TrendingUp, Users, Bell, MessageCircle, 
  Brain, Activity, DollarSign, FileSignature, Eye,
  Repeat, Handshake, Calendar, MapPin, RefreshCw,
  AlertCircle, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeButton from '@/components/erudite/EruditeButton';
import PFListingsGrid from '@/components/properties/PFListingsGrid';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState(null);

  // Load user
  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) setUserEmail(u.email);
      if (u?.full_name) setUserName(u.full_name);
      if (u?.role) setUserRole(u.role);
    }).catch(() => {});
  }, []);

  // Fetch data
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

  // Calculate stats
  const stats = {
    activeLeads: leads.filter(l => l.status === 'active').length,
    hotLeads: leads.filter(l => (l.ai_lead_score || 0) >= 75).length,
    pendingReminders: reminders.length,
    unreadWhatsApp: conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
    activeOffers: offers.length,
    upcomingViewings: viewings.length,
  };

  // Recent activity
  const recentLeads = leads.slice(0, 5);
  const overdueReminders = reminders.filter(r => {
    const dueDate = new Date(r.due_date);
    return dueDate < new Date() && r.status === 'pending';
  }).slice(0, 3);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {userName || userEmail?.split('@')[0]}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your real estate business today
            </p>
          </div>
          <EruditeButton
            variant="primary"
            icon={Building2}
            onClick={() => navigate('/landlords')}
          >
            Landlord Pipeline
          </EruditeButton>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <EruditeCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Active Leads</span>
              </div>
              <EruditeBadge variant="blue">{stats.activeLeads}</EruditeBadge>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.activeLeads}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
              <ArrowUpRight className="w-3 h-3" />
              <span>+12% from last week</span>
            </div>
          </EruditeCard>

          <EruditeCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Brain className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-sm text-muted-foreground">Hot Leads</span>
              </div>
              <EruditeBadge variant="gold">{stats.hotLeads}</EruditeBadge>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.hotLeads}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-500">
              <TrendingUp className="w-3 h-3" />
              <span>Score ≥75</span>
            </div>
          </EruditeCard>

          <EruditeCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <Bell className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-sm text-muted-foreground">Pending Tasks</span>
              </div>
              <EruditeBadge variant="rose">{stats.pendingReminders}</EruditeBadge>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.pendingReminders}</p>
            {overdueReminders.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-rose-500">
                <AlertCircle className="w-3 h-3" />
                <span>{overdueReminders.length} overdue</span>
              </div>
            )}
          </EruditeCard>

          <EruditeCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">WhatsApp</span>
              </div>
              <EruditeBadge variant="emerald">{stats.unreadWhatsApp}</EruditeBadge>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.unreadWhatsApp}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <span>Unread messages</span>
            </div>
          </EruditeCard>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EruditeCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Handshake className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Offers</p>
                <p className="text-2xl font-bold text-foreground">{stats.activeOffers}</p>
              </div>
            </div>
          </EruditeCard>

          <EruditeCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <Eye className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Viewings</p>
                <p className="text-2xl font-bold text-foreground">{stats.upcomingViewings}</p>
              </div>
            </div>
          </EruditeCard>

          <EruditeCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals This Month</p>
                <p className="text-2xl font-bold text-foreground">
                  {leads.filter(l => l.stage === 'closing_dld' || l.stage === 'negotiation_deal_lock').length}
                </p>
              </div>
            </div>
          </EruditeCard>
        </div>

        {/* Property Finder Listings */}
        <EruditeCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Property Finder Listings</h2>
                <p className="text-sm text-muted-foreground">Your active listings from Property Finder</p>
              </div>
            </div>
          </div>
          <PFListingsGrid />
        </EruditeCard>

        {/* AI Insights + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Insights */}
          <EruditeCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Brain className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">AI Insights</h2>
                <p className="text-sm text-muted-foreground">Your intelligence hub</p>
              </div>
            </div>
            <div className="space-y-3">
              {stats.hotLeads > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{stats.hotLeads} Hot Leads</p>
                      <p className="text-xs text-muted-foreground">High conversion probability</p>
                    </div>
                  </div>
                  <EruditeButton variant="ghost" onClick={() => navigate('/leads')}>
                    View
                  </EruditeButton>
                </div>
              )}
              {overdueReminders.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{overdueReminders.length} Overdue Tasks</p>
                      <p className="text-xs text-muted-foreground">Need immediate attention</p>
                    </div>
                  </div>
                  <EruditeButton variant="ghost" onClick={() => navigate('/reminders')}>
                    View
                  </EruditeButton>
                </div>
              )}
              {stats.activeOffers > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <Handshake className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{stats.activeOffers} Active Offers</p>
                      <p className="text-xs text-muted-foreground">In negotiation</p>
                    </div>
                  </div>
                  <EruditeButton variant="ghost" onClick={() => navigate('/offers')}>
                    View
                  </EruditeButton>
                </div>
              )}
              {stats.hotLeads === 0 && overdueReminders.length === 0 && stats.activeOffers === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Everything looks good! No urgent actions needed.
                </p>
              )}
            </div>
          </EruditeCard>

          {/* Recent Leads */}
          <EruditeCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recent Leads</h2>
                  <p className="text-sm text-muted-foreground">Latest additions to your pipeline</p>
                </div>
              </div>
              <EruditeButton variant="ghost" onClick={() => navigate('/leads')}>
                View All
              </EruditeButton>
            </div>
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-400">
                        {(lead.full_name || lead.email || 'L')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{lead.full_name || 'Lead'}</p>
                      <p className="text-xs text-muted-foreground">{lead.email || 'No email'}</p>
                    </div>
                  </div>
                  <EruditeBadge variant={lead.status === 'active' ? 'emerald' : 'default'}>
                    {lead.status}
                  </EruditeBadge>
                </div>
              ))}
              {recentLeads.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No leads yet. Start adding contacts to your pipeline!
                </p>
              )}
            </div>
          </EruditeCard>
        </div>

        {/* Quick Actions */}
        <EruditeCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EruditeButton
              variant="secondary"
              icon={Building2}
              onClick={() => navigate('/landlords')}
              className="w-full justify-center"
            >
              Landlords
            </EruditeButton>
            <EruditeButton
              variant="secondary"
              icon={Users}
              onClick={() => navigate('/leads')}
              className="w-full justify-center"
            >
              Leads
            </EruditeButton>
            <EruditeButton
              variant="secondary"
              icon={Bell}
              onClick={() => navigate('/reminders')}
              className="w-full justify-center"
            >
              Reminders
            </EruditeButton>
            <EruditeButton
              variant="secondary"
              icon={MessageCircle}
              onClick={() => navigate('/whatsapp')}
              className="w-full justify-center"
            >
              WhatsApp
            </EruditeButton>
          </div>
        </EruditeCard>
      </div>
    </div>
  );
}