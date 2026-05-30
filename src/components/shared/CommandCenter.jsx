import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Users, UserPlus, Building2, KanbanSquare, Bell, MessageCircle, Calculator, FileText, TrendingUp, Target, Calendar, Key, Mail, Brain, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const QUICK_ACTIONS = [
  { label: 'Add Lead', icon: UserPlus, path: '/leads', category: 'Create', shortcut: 'L' },
  { label: 'New Deal', icon: Target, path: '/pipeline', category: 'Create', shortcut: 'D' },
  { label: 'Add Landlord', icon: Building2, path: '/landlords', category: 'Create', shortcut: 'O' },
  { label: 'Create Reminder', icon: Bell, path: '/reminders', category: 'Create', shortcut: 'R' },
  { label: 'Send Message', icon: MessageCircle, path: '/whatsapp', category: 'Create', shortcut: 'M' },
  { label: 'View Pipeline', icon: KanbanSquare, path: '/pipeline', category: 'Navigate', shortcut: 'P' },
  { label: 'View Leads', icon: Users, path: '/leads', category: 'Navigate', shortcut: 'L' },
  { label: 'View Landlords', icon: Building2, path: '/landlords', category: 'Navigate', shortcut: 'O' },
  { label: 'WhatsApp Inbox', icon: MessageCircle, path: '/whatsapp', category: 'Navigate', shortcut: 'W' },
  { label: 'Finance', icon: Calculator, path: '/finance', category: 'Navigate', shortcut: 'F' },
  { label: 'Analytics', icon: TrendingUp, path: '/analytics', category: 'Navigate', shortcut: 'A' },
  { label: 'Team Performance', icon: Target, path: '/team-dashboard', category: 'Navigate', shortcut: 'T' },
  { label: 'Calendar', icon: Calendar, path: '/calendar', category: 'Navigate', shortcut: 'C' },
  { label: 'Key Handover', icon: Key, path: '/key-handover', category: 'Navigate', shortcut: 'K' },
  { label: 'Email Automations', icon: Mail, path: '/email-automations', category: 'Navigate', shortcut: 'E' },
  { label: 'Claude AI', icon: Brain, path: '/claude-ai', category: 'AI', shortcut: 'B' },
  { label: 'WhatsApp Hub', icon: Zap, path: '/whatsapp-hub', category: 'AI', shortcut: 'H' },
];

export default function CommandCenter({ onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-search'],
    queryFn: () => base44.entities.Lead.list('-created_date', 50),
  });

  const filteredActions = QUICK_ACTIONS.filter(action =>
    action.label.toLowerCase().includes(query.toLowerCase()) ||
    action.category.toLowerCase().includes(query.toLowerCase())
  );

  const recentLeads = leads
    .filter(l => l.full_name?.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);

  const allResults = [
    ...filteredActions.map(a => ({ ...a, type: 'action' })),
    ...recentLeads.map(l => ({ ...l, type: 'lead', label: l.full_name, path: `/leads` })),
  ];

  const handleSelect = useCallback((item) => {
    if (item.path) navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % allResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + allResults.length) % allResults.length);
      } else if (e.key === 'Enter' && allResults[selectedIndex]) {
        e.preventDefault();
        handleSelect(allResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allResults, selectedIndex, handleSelect, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Command Box */}
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(8, 11, 18, 0.95)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(245,159,10,0.3)',
          boxShadow: '0 32px 96px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search actions, leads, or navigate..."
            className="flex-1 bg-transparent text-white placeholder-white/40 text-sm focus:outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {allResults.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No results found</p>
            </div>
          )}

          {allResults.map((item, i) => {
            const Icon = item.icon || Users;
            const isSelected = i === selectedIndex;

            return (
              <button
                key={`${item.type}-${item.label}-${i}`}
                onClick={() => handleSelect(item)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all',
                  isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                )}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: item.type === 'lead' ? 'rgba(16,185,129,0.15)' : 'rgba(245,159,10,0.15)',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: item.type === 'lead' ? 'rgba(16,185,129,0.95)' : 'hsl(38 92% 50%)' }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.95)' }}>{item.label}</p>
                  {item.category && (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.category}</p>
                  )}
                </div>
                {item.shortcut && (
                  <kbd
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 text-xs border-t flex items-center justify-between gap-4"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
        >
          <span>Press <kbd className="mx-1 px-1.5 py-0.5 rounded bg-white/10">↑</kbd> <kbd className="mx-1 px-1.5 py-0.5 rounded bg-white/10">↓</kbd> to navigate</span>
          <span><kbd className="mx-1 px-1.5 py-0.5 rounded bg-white/10">Enter</kbd> to select</span>
          <span><kbd className="mx-1 px-1.5 py-0.5 rounded bg-white/10">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}