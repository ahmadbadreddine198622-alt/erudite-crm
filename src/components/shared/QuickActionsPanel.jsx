import React, { useState } from 'react';
import { Plus, X, UserPlus, FileText, Bell, Target, MessageSquare, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function QuickActionsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { label: 'Add Lead', icon: UserPlus, color: 'from-emerald-800 to-emerald-950', action: () => navigate('/leads') },
    { label: 'New Deal', icon: Target, color: 'from-violet-900 to-purple-950', action: () => navigate('/pipeline') },
    { label: 'Reminder', icon: Bell, color: 'from-rose-900 to-red-950', action: () => navigate('/reminders') },
    { label: 'Message', icon: MessageSquare, color: 'from-green-900 to-green-950', action: () => navigate('/whatsapp') },
    { label: 'Task', icon: Calendar, color: 'from-blue-900 to-indigo-950', action: () => navigate('/calendar') },
    { label: 'Invoice', icon: FileText, color: 'from-amber-900 to-orange-950', action: () => navigate('/finance') },
  ];

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-28 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 md:hidden',
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        )}
        style={{
          width: 56,
          height: 56,
          borderRadius: '28px',
          background: 'hsl(38 92% 50%)',
          boxShadow: '0 8px 32px rgba(245,159,10,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        <Plus className="w-6 h-6" style={{ color: 'hsl(222 47% 11%)' }} />
      </button>

      {/* Expanded Panel */}
      <div
        className={cn(
          'fixed bottom-28 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 md:hidden',
          isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'
        )}
        style={{
          background: 'rgba(8, 11, 18, 0.95)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderRadius: '24px',
          border: '1px solid rgba(245,159,10,0.2)',
          borderTopColor: 'rgba(245,159,10,0.35)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          maxWidth: '320px',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: 'hsl(38 92% 50%)',
            boxShadow: '0 4px 16px rgba(245,159,10,0.4)',
          }}
        >
          <X className="w-4 h-4" style={{ color: 'hsl(222 47% 11%)' }} />
        </button>

        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => {
                action.action();
                setIsOpen(false);
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                }}
              >
                <div className={`w-full h-full rounded-xl bg-gradient-to-br ${action.color} opacity-80 flex items-center justify-center`}>
                  <Icon className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.95)' }} />
                </div>
              </div>
              <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          style={{ background: 'rgba(0,0,0,0.4)' }}
        />
      )}
    </>
  );
}