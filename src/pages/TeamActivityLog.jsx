import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Filter, Search, Users, MessageCircle, Phone, Mail, Calendar, FileText, CheckCircle2, Clock, XCircle, TrendingUp, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckCircle2,
  follow_up: Clock,
  viewing: TrendingUp,
  offer: FileText,
  stage_change: TrendingUp,
  document_shared: FileText,
  system: Activity,
};

const ACTIVITY_COLORS = {
  call: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  whatsapp: 'bg-green-500/10 text-green-400 border-green-500/20',
  email: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  meeting: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  note: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  task: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  follow_up: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  viewing: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  offer: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  stage_change: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  document_shared: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  system: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const STATUS_ICONS = {
  completed: CheckCircle2,
  scheduled: Clock,
  in_progress: Clock,
  cancelled: XCircle,
  no_show: XCircle,
  rescheduled: Clock,
};

export default function TeamActivityLog() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('7d'); // today, 7d, 30d, all

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('', 500),
  });

  // Calculate date filter
  const getDateFilter = () => {
    const now = new Date();
    if (dateRange === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      return startOfDay;
    } else if (dateRange === '7d') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return null;
  };

  const filteredActivities = useMemo(() => {
    const dateFilter = getDateFilter();
    
    return activities.filter(activity => {
      // Date filter
      if (dateFilter && new Date(activity.created_date) < dateFilter) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = activity.title?.toLowerCase().includes(searchLower);
        const matchesDesc = activity.description?.toLowerCase().includes(searchLower);
        const matchesAgent = activity.agent_name?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDesc && !matchesAgent) return false;
      }
      
      // Type filter
      if (filterType !== 'all' && activity.type !== filterType) return false;
      
      // Agent filter
      if (filterAgent !== 'all' && activity.agent_email !== filterAgent) return false;
      
      // Status filter
      if (filterStatus !== 'all' && activity.status !== filterStatus) return false;
      
      return true;
    });
  }, [activities, search, filterType, filterAgent, filterStatus, dateRange]);

  // Get unique agents from activities
  const uniqueAgents = useMemo(() => {
    const agents = new Map();
    activities.forEach(a => {
      if (a.agent_email && !agents.has(a.agent_email)) {
        agents.set(a.agent_email, a.agent_name || a.agent_email);
      }
    });
    return Array.from(agents.entries());
  }, [activities]);

  // Stats
  const stats = useMemo(() => {
    const dateFilter = getDateFilter();
    const filtered = dateFilter 
      ? activities.filter(a => new Date(a.created_date) >= dateFilter)
      : activities;
    
    return {
      total: filtered.length,
      completed: filtered.filter(a => a.status === 'completed').length,
      scheduled: filtered.filter(a => a.status === 'scheduled' || a.status === 'in_progress').length,
      cancelled: filtered.filter(a => a.status === 'cancelled' || a.status === 'no_show').length,
    };
  }, [activities, dateRange]);

  const getLeadName = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    return lead?.full_name || 'Unknown Lead';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading Activity Log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Activity className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Team Activity Log</h1>
            <p className="text-sm text-muted-foreground">Track all team interactions and follow-ups</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-2 border-accent/20 bg-accent/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold text-accent">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduled</span>
            </div>
            <p className="text-2xl font-bold text-amber-500">{stats.scheduled}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cancelled</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                className="pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-sm rounded-md"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            >
              <option value="all">All Types</option>
              {Object.keys(ACTIVITY_ICONS).map(type => (
                <option key={type} value={type}>{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>

            {/* Agent Filter */}
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="px-3 py-2 text-sm rounded-md"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map(([email, name]) => (
                <option key={email} value={email}>{name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm rounded-md"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant={dateRange === 'today' ? 'default' : 'outline'}
              onClick={() => setDateRange('today')}
              className="text-xs"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={dateRange === '7d' ? 'default' : 'outline'}
              onClick={() => setDateRange('7d')}
              className="text-xs"
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant={dateRange === '30d' ? 'default' : 'outline'}
              onClick={() => setDateRange('30d')}
              className="text-xs"
            >
              Last 30 Days
            </Button>
            <Button
              size="sm"
              variant={dateRange === 'all' ? 'default' : 'outline'}
              onClick={() => setDateRange('all')}
              className="text-xs"
            >
              All Time
            </Button>
            {(search || filterType !== 'all' || filterAgent !== 'all' || filterStatus !== 'all' || dateRange !== '7d') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setFilterType('all');
                  setFilterAgent('all');
                  setFilterStatus('all');
                  setDateRange('7d');
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No activities found</p>
              <p className="text-xs mt-1 opacity-60">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type] || Activity;
            const colorClass = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.system;
            const StatusIcon = STATUS_ICONS[activity.status] || Clock;
            const timeAgo = formatDistanceToNow(new Date(activity.created_date), { addSuffix: true });
            const leadName = activity.lead_id ? getLeadName(activity.lead_id) : null;

            return (
              <Card key={activity.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold truncate">{activity.title}</h3>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${colorClass}`}>
                            {activity.type.replace('_', ' ')}
                          </Badge>
                          <StatusIcon className={`w-3.5 h-3.5 ${
                            activity.status === 'completed' ? 'text-emerald-500' :
                            activity.status === 'cancelled' || activity.status === 'no_show' ? 'text-red-500' :
                            'text-amber-500'
                          }`} />
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          <span>{activity.agent_name || activity.agent_email}</span>
                        </div>
                        {leadName && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3 h-3" />
                              <span>{leadName}</span>
                            </div>
                          </>
                        )}
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo}</span>
                        </div>
                        {activity.scheduled_at && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              <span>{format(new Date(activity.scheduled_at), 'MMM d, h:mm a')}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Results count */}
      {filteredActivities.length > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          Showing {filteredActivities.length} of {activities.length} activities
        </div>
      )}
    </div>
  );
}