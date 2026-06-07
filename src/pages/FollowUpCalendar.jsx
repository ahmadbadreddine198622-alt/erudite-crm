import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Ban, Phone, Users, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_COLORS = {
  pending: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  missed: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const TYPE_ICONS = {
  callback: <Phone className="w-2.5 h-2.5" />,
  appointment: <Users className="w-2.5 h-2.5" />,
  task: <ClipboardList className="w-2.5 h-2.5" />,
};

export default function FollowUpCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [selectedStatus, setSelectedStatus] = useState('all');

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ['followups'],
    queryFn: async () => {
      const all = await base44.entities.FollowUp.list('-scheduled_at', 500);
      // Filter to current user's assigned landlords if not admin
      if (currentUser?.role !== 'admin') {
        const landlords = await base44.entities.Landlord.list();
        const userLandlordIds = landlords.filter(l => l.assigned_agent_email === currentUser?.email).map(l => l.id);
        return all.filter(f => userLandlordIds.includes(f.landlord_id));
      }
      return all;
    },
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: () => base44.entities.Landlord.list(),
  });

  const landlordMap = useMemo(() => {
    const map = {};
    landlords.forEach(l => { map[l.id] = l; });
    return map;
  }, [landlords]);

  const filteredFollowups = useMemo(() => {
    let filtered = followups;
    if (selectedStatus === 'all') filtered = followups;
    else filtered = followups.filter(f => f.status === selectedStatus);
    
    // Sort by time
    return filtered.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [followups, selectedStatus]);

  const days = useMemo(() => {
    const start = viewMode === 'month' 
      ? startOfMonth(currentMonth)
      : new Date(currentMonth);
    const end = viewMode === 'month'
      ? endOfMonth(currentMonth)
      : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 6);
    
    return eachDayOfInterval({ start, end });
  }, [currentMonth, viewMode]);

  const getFollowupsForDay = (date) => {
    return filteredFollowups.filter(f => {
      const fDate = parseISO(f.scheduled_at);
      return isSameMonth(fDate, date) && fDate.getDate() === date.getDate() && 
             fDate.getMonth() === date.getMonth() && fDate.getFullYear() === date.getFullYear();
    });
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + (direction * 7));
      } else {
        newDate.setMonth(newDate.getMonth() + direction);
      }
      return newDate;
    });
  };

  const goToToday = () => setCurrentMonth(new Date());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Follow-up Calendar</h1>
              <p className="text-xs text-muted-foreground">Track and manage landlord follow-ups</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <div className="ml-4 text-lg font-semibold min-w-[200px] text-center">
              {format(currentMonth, viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy')}
            </div>

            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-24 ml-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32 ml-2">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {['pending', 'done', 'missed', 'cancelled'].map(status => {
            const count = followups.filter(f => f.status === status).length;
            return (
              <div key={status} className={`rounded-xl p-3 border ${STATUS_COLORS[status]}`}>
                <div className="flex items-center gap-2 mb-1">
                  {status === 'pending' && <Clock className="w-4 h-4" />}
                  {status === 'done' && <CheckCircle2 className="w-4 h-4" />}
                  {status === 'missed' && <AlertCircle className="w-4 h-4" />}
                  {status === 'cancelled' && <Ban className="w-4 h-4" />}
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{status}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            );
          })}
          <div className="rounded-xl p-3 border bg-accent/10 text-accent border-accent/30">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Today</span>
            </div>
            <p className="text-2xl font-bold">
              {followups.filter(f => {
                const fDate = parseISO(f.scheduled_at);
                return isToday(fDate);
              }).length}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((date, idx) => {
              const dayFollowups = getFollowupsForDay(date);
              const isCurrentMonth = isSameMonth(date, currentMonth);
              const isTodayDate = isToday(date);

              return (
                <div
                  key={idx}
                  className={`min-h-[120px] p-2 border-r border-b transition-colors ${
                    !isCurrentMonth ? 'opacity-30' : ''
                  } ${isTodayDate ? 'bg-accent/5' : ''}`}
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                      isTodayDate ? 'bg-accent text-accent-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {format(date, 'd')}
                    </span>
                    {dayFollowups.length > 0 && (
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5">
                        {dayFollowups.length}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayFollowups.slice(0, 4).map(f => {
                      const landlord = landlordMap[f.landlord_id];
                      return (
                        <a
                          key={f.id}
                          href={`/landlords?selected=${f.landlord_id}`}
                          className={`block text-[9px] p-1.5 rounded border transition-all hover:scale-[1.02] truncate ${STATUS_COLORS[f.status]}`}
                          title={`${landlord?.full_name_en || 'Unknown'} - ${f.notes || ''}`}
                        >
                          <div className="flex items-center gap-1 font-semibold truncate">
                            {TYPE_ICONS[f.type]}
                            <span className="truncate">{landlord?.full_name_en?.split(' ')[0] || 'Unknown'}</span>
                          </div>
                          <div className="text-[8px] opacity-70 truncate">
                            {format(parseISO(f.scheduled_at), 'HH:mm')} · {f.type}
                          </div>
                        </a>
                      );
                    })}
                    {dayFollowups.length > 4 && (
                      <div className="text-[8px] text-muted-foreground text-center">
                        +{dayFollowups.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}