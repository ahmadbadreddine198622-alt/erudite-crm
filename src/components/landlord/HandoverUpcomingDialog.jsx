import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyRound, Calendar, Building2, User, Loader2, Inbox, ChevronRight } from 'lucide-react';

const GOLD = '#c9a24b';

const fmtAppt = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return String(dt);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const daysUntil = (dt) => {
  if (!dt) return null;
  const d = new Date(dt);
  if (isNaN(d)) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

export default function HandoverUpcomingDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['handover_upcoming'],
    queryFn: async () => {
      const list = await base44.entities.Landlord.filter({ handover_status: 'Handover Booked' }, 'handover_appointment_at', 500);
      return Array.isArray(list) ? list : [];
    },
    enabled: open,
    staleTime: 30000,
  });

  const sorted = useMemo(() => {
    return [...landlords]
      .filter(l => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (l.full_name_en || l.full_name || '').toLowerCase().includes(q)
          || (l.unit_reference || '').toLowerCase().includes(q)
          || (l.project_name || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const da = a.handover_appointment_at ? new Date(a.handover_appointment_at).getTime() : Infinity;
        const db = b.handover_appointment_at ? new Date(b.handover_appointment_at).getTime() : Infinity;
        return da - db;
      });
  }, [landlords, search]);

  const handleClick = (id) => {
    onOpenChange(false);
    navigate(`/landlord/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" style={{ background: 'rgba(15,16,22,0.98)', border: '1px solid rgba(201,162,75,0.25)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,0.95)' }}>
            <KeyRound size={18} style={{ color: GOLD }} />
            Upcoming Unit Handovers
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>
              ({sorted.length} booked)
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search owner, unit, project…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-3 h-9 text-xs rounded-md"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', outline: 'none' }}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 size={22} className="animate-spin" style={{ color: GOLD }} />
              <span className="text-xs">Loading upcoming handovers…</span>
            </div>
          )}

          {!isLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Inbox size={28} style={{ color: 'rgba(255,255,255,0.2)' }} />
              <span className="text-xs">No units with upcoming handover appointments.</span>
            </div>
          )}

          {!isLoading && sorted.map(l => {
            const days = daysUntil(l.handover_appointment_at);
            const overdue = days != null && days < 0;
            const soon = days != null && days >= 0 && days <= 7;
            const name = l.full_name_en || l.full_name || 'Unnamed landlord';
            return (
              <button
                key={l.id}
                onClick={() => handleClick(l.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left mb-1.5"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              >
                {/* Days badge */}
                <div
                  className="flex-none flex items-center justify-center rounded-lg text-xs font-bold"
                  style={{
                    width: 44, height: 44,
                    background: overdue ? 'rgba(239,68,68,0.15)' : soon ? 'rgba(201,162,75,0.15)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (overdue ? 'rgba(239,68,68,0.3)' : soon ? 'rgba(201,162,75,0.35)' : 'rgba(255,255,255,0.1)'),
                    color: overdue ? '#f87171' : soon ? GOLD : 'rgba(255,255,255,0.6)',
                    flexDirection: 'column', lineHeight: 1.1,
                  }}
                >
                  {days != null ? (
                    <>
                      <span style={{ fontSize: 14 }}>{Math.abs(days)}</span>
                      <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em' }}>{overdue ? 'OVERDUE' : 'DAYS'}</span>
                    </>
                  ) : (
                    <Calendar size={16} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    <User size={12} style={{ color: GOLD, flex: 'none' }} />
                    <span className="truncate">{name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <Building2 size={11} style={{ flex: 'none' }} />
                    <span className="truncate">{l.project_name || '—'}</span>
                    {l.unit_reference && <span>· {l.unit_reference}</span>}
                  </div>
                </div>

                {/* Appointment date */}
                <div className="flex-none text-right">
                  <div className="text-xs font-semibold" style={{ color: overdue ? '#f87171' : soon ? GOLD : 'rgba(255,255,255,0.7)' }}>
                    {fmtAppt(l.handover_appointment_at)}
                  </div>
                  {l.assigned_agent_email && (
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {l.assigned_agent_email.split('@')[0]}
                    </div>
                  )}
                </div>

                <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.25)', flex: 'none' }} />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}