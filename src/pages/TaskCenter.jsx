import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Eye, FileSignature, AlertCircle, CheckCircle, Clock, Phone, MessageCircle, Mail, ChevronRight, Filter, Bot, Check, X } from 'lucide-react';
import { isToday, isTomorrow, isPast, isFuture, format, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Task card component
function TaskCard({ task, type, onMarkComplete }) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const dueLabel = task.due_date
    ? isToday(new Date(task.due_date)) ? 'Today'
    : isTomorrow(new Date(task.due_date)) ? 'Tomorrow'
    : format(new Date(task.due_date), 'MMM d')
    : 'No date';

  const typeConfig = {
    follow_up: { icon: Phone, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    viewing: { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    contract: { icon: FileSignature, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  };

  const config = typeConfig[type] || { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-500/10' };
  const Icon = config.icon;

  // AI Agent status badge
  const aiAgentBadge = task.ai_agent_assigned && task.ai_agent_assigned !== 'none' ? (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
      task.ai_agent_status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' :
      task.ai_agent_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
      task.ai_agent_status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
      'bg-white/10 text-white/60'
    }`}>
      <Bot className="w-3 h-3" />
      <span className="capitalize">{task.ai_agent_assigned}</span>
      {task.ai_agent_status === 'accepted' && <Check className="w-3 h-3" />}
      {task.ai_agent_status === 'rejected' && <X className="w-3 h-3" />}
      {task.ai_agent_status === 'in_progress' && <Clock className="w-3 h-3" />}
    </div>
  ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4 mb-3"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground truncate">{task.title}</h3>
              {task.lead_name && (
                <p className="text-xs text-muted-foreground mt-0.5">{task.lead_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {aiAgentBadge}
              <button
                onClick={() => onMarkComplete(task.id)}
                className="w-6 h-6 rounded-full border-2 border-white/20 flex items-center justify-center hover:border-accent hover:bg-accent/20 transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-accent opacity-0 hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium flex items-center gap-1 ${
              isOverdue ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              <Clock className="w-3 h-3" />
              {dueLabel}
            </span>
            {task.priority && task.priority !== 'none' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                task.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                'bg-white/10 text-white/70'
              }`}>
                {task.priority}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Section header component
function SectionHeader({ icon: Icon, title, count, color }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-white/80">
        {count}
      </span>
    </div>
  );
}

// Summary stat card
function StatCard({ icon: Icon, label, value, color, gradient }) {
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className="rounded-2xl p-4 text-center"
      style={{ background: gradient }}
    >
      <Icon className="w-6 h-6 mx-auto mb-2" style={{ color }} />
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</p>
    </motion.div>
  );
}

export default function TaskCenter() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all'); // all, overdue, today, upcoming
  const [user, setUser] = useState(null);

  // Get current user
  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch reminders assigned to current user
  const { data: reminders = [], isLoading: remindersLoading } = useQuery({
    queryKey: ['reminders-user', user?.email],
    queryFn: () => base44.entities.Reminder.filter({ 
      assigned_to: user?.email, 
      status: 'pending' 
    }, '-due_date', 200),
    enabled: !!user?.email,
  });

  // Fetch lead activities (tasks/bookings) assigned to user
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities-user', user?.email],
    queryFn: async () => {
      const allActivities = await base44.entities.LeadActivity.filter({}, '-due_at', 500);
      return allActivities.filter(a => 
        a.assigned_to === user?.email && 
        (a.activity_type === 'task' || a.activity_type === 'booking') &&
        !a.completed
      );
    },
    enabled: !!user?.email,
  });

  // Fetch leads for lead_name lookup
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-minimal'],
    queryFn: () => base44.entities.Lead.list('', 1000),
  });

  const getLeadName = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    return lead?.full_name;
  };

  // Normalize and categorize tasks
  const tasks = useMemo(() => {
    const normalized = [];

    // Process reminders
    reminders.forEach(r => {
      normalized.push({
        id: r.id,
        title: r.title,
        due_date: r.due_date,
        priority: r.priority,
        lead_id: r.lead_id,
        lead_name: r.lead_name || getLeadName(r.lead_id),
        type: r.type === 'viewing' ? 'viewing' : 
              r.type === 'follow_up' ? 'follow_up' : 
              r.type === 'contract_renewal' ? 'contract' : 'follow_up',
        source: 'reminder',
      });
    });

    // Process activities
    activities.forEach(a => {
      normalized.push({
        id: a.id,
        title: a.title,
        due_date: a.due_at,
        priority: 'none',
        lead_id: a.lead_id,
        lead_name: getLeadName(a.lead_id),
        type: a.activity_type === 'booking' ? 'viewing' : 'follow_up',
        source: 'activity',
      });
    });

    return normalized;
  }, [reminders, activities, leads]);

  // Categorize by type
  const followUps = tasks.filter(t => t.type === 'follow_up');
  const viewings = tasks.filter(t => t.type === 'viewing');
  const contracts = tasks.filter(t => t.type === 'contract');

  // Filter by urgency
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (filter === 'overdue') {
      filtered = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    } else if (filter === 'today') {
      filtered = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
    } else if (filter === 'upcoming') {
      filtered = tasks.filter(t => t.due_date && isFuture(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    }
    return filtered.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [tasks, filter]);

  // Mark task complete
  const completeMutation = useMutation({
    mutationFn: async ({ id, source }) => {
      if (source === 'reminder') {
        return base44.entities.Reminder.update(id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
      } else {
        return base44.entities.LeadActivity.update(id, {
          completed: true,
          completed_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders-user'] });
      queryClient.invalidateQueries({ queryKey: ['activities-user'] });
      toast.success('Task completed');
    },
  });

  const handleMarkComplete = (id, source) => {
    completeMutation.mutate({ id, source });
  };

  if (!user) {
    return (
      <div className="min-h-screen page-root flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground font-medium">Loading tasks...</p>
        </div>
      </div>
    );
  }

  const overdueCount = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;
  const todayCount = tasks.filter(t => t.due_date && isToday(new Date(t.due_date))).length;
  const upcomingCount = tasks.filter(t => t.due_date && isFuture(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;

  return (
    <div className="min-h-screen page-root pb-24">
      <div className="max-w-[800px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-3xl">Task Center</h1>
            <p className="page-subtitle mt-1">
              {user?.full_name?.split(' ')[0] || 'Agent'}'s urgent follow-ups
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={AlertCircle}
            label="Overdue"
            value={overdueCount}
            color="#f87171"
            gradient="linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(180,40,40,0.2) 100%)"
          />
          <StatCard
            icon={Calendar}
            label="Today"
            value={todayCount}
            color="#fbbf24"
            gradient="linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(180,100,0,0.2) 100%)"
          />
          <StatCard
            icon={Clock}
            label="Upcoming"
            value={upcomingCount}
            color="#60a5fa"
            gradient="linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(30,60,120,0.2) 100%)"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All', count: tasks.length },
            { id: 'overdue', label: 'Overdue', count: overdueCount },
            { id: 'today', label: 'Today', count: todayCount },
            { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Follow-ups Section */}
        {followUps.length > 0 && (
          <div>
            <SectionHeader
              icon={Phone}
              title="Follow-ups"
              count={followUps.length}
              color="bg-amber-500"
            />
            <div className="space-y-1">
              {followUps.slice(0, filter === 'all' ? 5 : undefined).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  type="follow_up"
                  onMarkComplete={() => handleMarkComplete(task.id, task.source)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Viewings Section */}
        {viewings.length > 0 && (
          <div>
            <SectionHeader
              icon={Eye}
              title="Property Viewings"
              count={viewings.length}
              color="bg-blue-500"
            />
            <div className="space-y-1">
              {viewings.slice(0, filter === 'all' ? 5 : undefined).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  type="viewing"
                  onMarkComplete={() => handleMarkComplete(task.id, task.source)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Contracts Section */}
        {contracts.length > 0 && (
          <div>
            <SectionHeader
              icon={FileSignature}
              title="Contract Signatures"
              count={contracts.length}
              color="bg-purple-500"
            />
            <div className="space-y-1">
              {contracts.slice(0, filter === 'all' ? 5 : undefined).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  type="contract"
                  onMarkComplete={() => handleMarkComplete(task.id, task.source)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending tasks at the moment</p>
          </div>
        )}

        {/* Full List */}
        {filteredTasks.length > 0 && filter !== 'all' && (
          <div className="mt-6">
            <SectionHeader
              icon={Filter}
              title={filter === 'overdue' ? 'Overdue Tasks' : filter === 'today' ? "Today's Tasks" : 'Upcoming Tasks'}
              count={filteredTasks.length}
              color="bg-white/20"
            />
            <div className="space-y-1">
              {filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  type={task.type}
                  onMarkComplete={() => handleMarkComplete(task.id, task.source)}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}