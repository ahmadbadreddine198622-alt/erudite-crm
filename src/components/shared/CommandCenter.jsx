import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, LayoutDashboard, Users, Building2, KanbanSquare, DollarSign, Bell,
  MessageCircle, MessageSquare, BarChart3, UserCheck, FileSignature, Brain,
  Calculator, FileText, TrendingUp, Calendar, Key, Mail, Zap, Instagram, Sparkles,
  Link2, GitMerge, FolderOpen, Camera, CheckCircle, CheckCircle2, Crown, UserCircle,
  LineChart, Trophy, Shield, Palette, ReceiptText, PhoneCall, Mic, Repeat, Eye,
  NotebookPen, Handshake, Megaphone, FileBox, Building, UserSearch, RefreshCw, Inbox,
} from 'lucide-react';

// ── Full route index — one entry per live route ───────────────────────────────
const ALL_APPS = [
  // Sales
  { label: 'Pipeline', path: '/pipeline', icon: KanbanSquare, group: 'Sales', keywords: 'deals stages kanban board' },
  { label: 'Leads', path: '/leads', icon: Users, group: 'Sales', keywords: 'contacts prospects buyers tenants' },
  { label: 'Property Finder Leads', path: '/property-finder-leads', icon: Users, group: 'Sales', keywords: 'pf portal inbound' },
  { label: 'Meta & Google Ads Leads', path: '/meta-ads-leads', icon: Zap, group: 'Sales', keywords: 'facebook instagram google ads' },
  { label: 'Instagram Leads', path: '/instagram', icon: Instagram, group: 'Sales', keywords: 'social instagram dm' },
  { label: 'Buyer Match AI', path: '/buyer-match-ai', icon: UserSearch, group: 'Sales', keywords: 'match property recommend ai' },
  { label: 'Duplicate Detector', path: '/duplicates', icon: GitMerge, group: 'Sales', keywords: 'merge dedup clean' },
  { label: 'Contacts', path: '/contacts', icon: UserCheck, group: 'Sales', keywords: 'phonebook address book' },
  { label: 'Viewings', path: '/viewings', icon: Eye, group: 'Sales', keywords: 'showings appointments' },
  { label: 'Offers', path: '/offers', icon: FileSignature, group: 'Sales', keywords: 'bids proposals' },
  { label: 'Negotiations', path: '/negotiations', icon: Handshake, group: 'Sales', keywords: 'counter offer price' },
  { label: 'Follow Ups', path: '/follow-ups', icon: Repeat, group: 'Sales', keywords: 'reminders tasks call back' },

  // Listings
  { label: 'Landlords', path: '/landlords', icon: Building2, group: 'Listings', keywords: 'sellers owners mandate form a listing' },
  { label: 'Projects', path: '/projects', icon: FolderOpen, group: 'Listings', keywords: 'developments buildings communities' },
  { label: 'Property Finder Sync', path: '/property-finder', icon: Link2, group: 'Listings', keywords: 'pf portal listings sync' },
  { label: 'Listing Production', path: '/listing-production', icon: KanbanSquare, group: 'Listings', keywords: 'publish photos upload portal' },
  { label: 'Photography', path: '/photography', icon: Camera, group: 'Listings', keywords: 'photos shoot schedule' },
  { label: 'Property Intel', path: '/property-intel', icon: Building, group: 'Listings', keywords: 'market data valuation' },
  { label: 'Form A Inbox', path: '/form-a-inbox', icon: FileSignature, group: 'Listings', keywords: 'mandate form a dld' },
  { label: 'Form A Referral', path: '/form-a-referral', icon: FileSignature, group: 'Listings', keywords: 'referral commission mandate' },

  // Finance
  { label: 'Closing Hub', path: '/closing-hub', icon: CheckCircle2, group: 'Finance', keywords: 'trustee transfer title deed closing' },
  { label: 'Closing AI', path: '/closing-ai', icon: CheckCircle, group: 'Finance', keywords: 'deal close dld noc transfer' },
  { label: 'Finance', path: '/finance', icon: DollarSign, group: 'Finance', keywords: 'revenue income p&l money' },
  { label: 'Commissions', path: '/commissions', icon: DollarSign, group: 'Finance', keywords: 'commission payout agent split' },
  { label: 'Cheques', path: '/cheques', icon: ReceiptText, group: 'Finance', keywords: 'cheque payment bank deposit' },
  { label: 'Lease Agreement', path: '/lease-agreement', icon: FileText, group: 'Finance', keywords: 'lease noc brokerage agreement pdf docusign' },
  { label: 'Tenancy Contracts', path: '/tenancy-contracts', icon: FileText, group: 'Finance', keywords: 'rent ejari contract tenant' },
  { label: 'Acknowledgements', path: '/acknowledgements', icon: FileText, group: 'Finance', keywords: 'receipt payment received confirmation' },
  { label: 'Key Handover', path: '/key-handover', icon: Key, group: 'Finance', keywords: 'handover keys move in' },
  { label: 'Transfer Fee Calculator', path: '/transfer-calculator', icon: Calculator, group: 'Finance', keywords: 'dld fee stamp duty calculator' },
  { label: 'Form I Generator', path: '/form-i-generator', icon: FileSignature, group: 'Finance', keywords: 'form i agent commission cheque' },

  // Comms
  { label: 'WhatsApp Inbox', path: '/whatsapp', icon: MessageCircle, group: 'Comms', keywords: 'chat message send receive wa' },
  { label: 'WhatsApp Hub', path: '/whatsapp-hub', icon: Zap, group: 'Comms', keywords: 'whatsapp automation broadcast' },
  { label: 'WhatsApp Scheduler', path: '/whatsapp-scheduler', icon: Calendar, group: 'Comms', keywords: 'schedule send later message' },
  { label: 'Broadcasts', path: '/broadcasts', icon: Megaphone, group: 'Comms', keywords: 'bulk message campaign blast' },
  { label: 'Messages', path: '/messages', icon: MessageSquare, group: 'Comms', keywords: 'inbox sms email' },
  { label: 'Inbox', path: '/inbox', icon: Inbox, group: 'Comms', keywords: 'email gmail inbox' },
  { label: 'Email Automations', path: '/email-automations', icon: Mail, group: 'Comms', keywords: 'email drip campaign auto' },
  { label: 'Email Templates', path: '/email-templates', icon: FileBox, group: 'Comms', keywords: 'template email draft' },
  { label: 'AI Voice (Vapi)', path: '/vapi', icon: Mic, group: 'Comms', keywords: 'voice call vapi ai phone' },
  { label: 'Twilio Hub', path: '/twilio', icon: PhoneCall, group: 'Comms', keywords: 'twilio sms calls phone' },
  { label: 'Aircall Hub', path: '/aircall', icon: PhoneCall, group: 'Comms', keywords: 'aircall calls phone log' },
  { label: 'Reminders', path: '/reminders', icon: Bell, group: 'Comms', keywords: 'tasks follow up alerts' },

  // Intelligence
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'Intelligence', keywords: 'home overview summary' },
  { label: 'My Dashboard', path: '/my-dashboard', icon: UserCircle, group: 'Intelligence', keywords: 'personal stats performance' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, group: 'Intelligence', keywords: 'reports charts revenue kpi' },
  { label: 'Sales Analytics', path: '/sales-analytics', icon: TrendingUp, group: 'Intelligence', keywords: 'sales report conversion funnel' },
  { label: 'Market Intelligence', path: '/market-intelligence', icon: LineChart, group: 'Intelligence', keywords: 'market trends dubai property data' },
  { label: 'Dubai Intelligence', path: '/dubai-intelligence', icon: TrendingUp, group: 'Intelligence', keywords: 'dld transactions market data uae' },
  { label: 'Lead Scoring', path: '/lead-scoring', icon: BarChart3, group: 'Intelligence', keywords: 'score rank prioritize leads ai' },
  { label: 'Deal Risk Monitor', path: '/deal-risk', icon: Shield, group: 'Intelligence', keywords: 'risk score deal alert warning' },
  { label: 'Leaderboard', path: '/leaderboard', icon: Trophy, group: 'Intelligence', keywords: 'ranking performance agents' },
  { label: 'Claude AI', path: '/claude-ai', icon: Sparkles, group: 'Intelligence', keywords: 'ai assistant chat gpt claude' },
  { label: 'Elite Desk', path: '/elite-desk', icon: Crown, group: 'Intelligence', keywords: 'vip elite top tier clients' },
  { label: 'Notes', path: '/notes', icon: NotebookPen, group: 'Intelligence', keywords: 'note smart memo journal' },

  // Admin
  { label: 'Command Center', path: '/command-center', icon: LayoutDashboard, group: 'Admin', keywords: 'operations overview admin ceo' },
  { label: 'Company Settings', path: '/company-settings', icon: Building2, group: 'Admin', keywords: 'settings logo brand orn brn' },
  { label: 'Policies & HR', path: '/policies', icon: Shield, group: 'Admin', keywords: 'hr rules policy handbook' },
  { label: 'Design System', path: '/design-system', icon: Palette, group: 'Admin', keywords: 'ui components colors design' },
  { label: 'Team AI OS', path: '/team-os', icon: Brain, group: 'Admin', keywords: 'team ai automation routing' },
  { label: 'Team Performance', path: '/team-dashboard', icon: Trophy, group: 'Admin', keywords: 'team kpis goals targets' },
  { label: 'Team Management', path: '/team-management', icon: Users, group: 'Admin', keywords: 'agents manage users roles' },
  { label: 'Team Activity Log', path: '/team-activity', icon: RefreshCw, group: 'Admin', keywords: 'audit log activity history' },
  { label: 'Invite Agents', path: '/invite-agents', icon: UserCheck, group: 'Admin', keywords: 'invite onboard agent user' },
  { label: 'Brand Settings', path: '/brand-settings', icon: Palette, group: 'Admin', keywords: 'logo brand colors company' },
  { label: 'Task Center', path: '/task-center', icon: CheckCircle, group: 'Admin', keywords: 'tasks todos team tasks' },
  { label: 'Google Drive', path: '/google-drive', icon: FolderOpen, group: 'Admin', keywords: 'drive files documents storage' },
  { label: 'Calendar', path: '/calendar', icon: Calendar, group: 'Admin', keywords: 'schedule events meetings' },
];

const GROUPS = ['All', 'Sales', 'Listings', 'Finance', 'Comms', 'Intelligence', 'Admin'];

const GROUP_COLORS = {
  Sales: 'rgba(16,185,129,0.18)',
  Listings: 'rgba(245,158,11,0.18)',
  Finance: 'rgba(59,130,246,0.18)',
  Comms: 'rgba(37,211,102,0.18)',
  Intelligence: 'rgba(139,92,246,0.18)',
  Admin: 'rgba(244,63,94,0.18)',
};
const GROUP_TEXT = {
  Sales: '#6ee7b7',
  Listings: 'hsl(38 92% 60%)',
  Finance: '#93c5fd',
  Comms: '#4ade80',
  Intelligence: '#c4b5fd',
  Admin: '#fda4af',
};

function fuzzyMatch(item, query) {
  const q = query.toLowerCase();
  const haystack = `${item.label} ${item.group} ${item.keywords || ''}`.toLowerCase();
  return haystack.includes(q);
}

export default function CommandCenter({ onClose }) {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  const filtered = ALL_APPS.filter(app => {
    if (activeGroup !== 'All' && app.group !== activeGroup) return false;
    if (!query) return true;
    return fuzzyMatch(app, query);
  });

  // Group results for display
  const grouped = filtered.reduce((acc, app) => {
    if (!acc[app.group]) acc[app.group] = [];
    acc[app.group].push(app);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flatList = Object.values(grouped).flat();

  const handleSelect = useCallback((item) => {
    navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeGroup]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && flatList[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatList[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flatList, selectedIndex, handleSelect, onClose]);

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(8, 11, 20, 0.97)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(245,158,11,0.28)',
          borderTopColor: 'rgba(255,255,255,0.12)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Search className="w-4.5 h-4.5 shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search apps, pages, tools…"
            className="flex-1 bg-transparent text-white placeholder-white/35 text-sm focus:outline-none"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>⌘K</kbd>
            <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors ml-1">
              <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>
        </div>

        {/* Group filter chips */}
        <div className="flex gap-1.5 px-4 py-2.5 border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {GROUPS.map(g => {
            const active = activeGroup === g;
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={active
                  ? { background: GROUP_COLORS[g] || 'rgba(245,158,11,0.2)', color: GROUP_TEXT[g] || 'hsl(38 92% 60%)', border: '1px solid ' + (GROUP_TEXT[g] || 'hsl(38 92% 50%)') + '44' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {g}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {flatList.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No results for "{query}"</p>
            </div>
          )}

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              {/* Group label */}
              <div className="px-4 pt-2 pb-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: GROUP_TEXT[group] || 'rgba(255,255,255,0.35)' }}
                >
                  {group}
                </span>
              </div>

              {items.map(item => {
                const idx = flatIdx++;
                const isSelected = idx === selectedIndex;
                const Icon = item.icon || LayoutDashboard;

                return (
                  <button
                    key={item.path}
                    data-index={idx}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-all"
                    style={{
                      background: isSelected ? 'rgba(245,158,11,0.08)' : 'transparent',
                      borderLeft: isSelected ? '2px solid hsl(38 92% 50%)' : '2px solid transparent',
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: GROUP_COLORS[item.group] || 'rgba(255,255,255,0.08)' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: GROUP_TEXT[item.group] || 'rgba(255,255,255,0.7)' }} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium" style={{ color: isSelected ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.82)' }}>
                        {item.label}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {item.path}
                      </p>
                    </div>
                    {isSelected && (
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2.5 border-t flex items-center gap-4 text-[11px]"
          style={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
        >
          <span><kbd className="mx-0.5 px-1.5 py-0.5 rounded bg-white/8 border border-white/10">↑↓</kbd> navigate</span>
          <span><kbd className="mx-0.5 px-1.5 py-0.5 rounded bg-white/8 border border-white/10">↵</kbd> open</span>
          <span><kbd className="mx-0.5 px-1.5 py-0.5 rounded bg-white/8 border border-white/10">Esc</kbd> close</span>
          <span className="ml-auto">{flatList.length} results</span>
        </div>
      </div>
    </div>
  );
}