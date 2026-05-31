/**
 * Shared app registry used by Dashboard grid and MobileDock picker.
 * Import ALL_APPS wherever you need the full catalogue.
 */
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature,
  Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2,
  GitMerge, Mail, FolderOpen, Brain, MapPin, Search, Handshake, Phone, Key,
  Calendar, TrendingUp, Activity, ShieldAlert, Globe
} from 'lucide-react';

export const ALL_APPS = [
  { label: 'My Dashboard',       icon: UserCircle,     path: '/my-dashboard',       gradient: 'from-blue-600 to-blue-800',        glowColor: 'rgba(59,130,246,0.40)' },
  { label: 'Pipeline',           icon: KanbanSquare,   path: '/pipeline',            gradient: 'from-violet-600 to-purple-800',    glowColor: 'rgba(139,92,246,0.40)' },
  { label: 'Leads',              icon: Users,          path: '/leads',               gradient: 'from-emerald-500 to-emerald-800',  glowColor: 'rgba(16,185,129,0.40)', badgeKey: 'leads' },
  { label: 'Contacts',           icon: UserCheck,      path: '/contacts',            gradient: 'from-sky-500 to-cyan-800',         glowColor: 'rgba(14,165,233,0.40)' },
  { label: 'Landlords',          icon: Building2,      path: '/landlords',           gradient: 'from-amber-500 to-orange-700',     glowColor: 'rgba(245,158,11,0.40)' },
  { label: 'Projects',           icon: FolderOpen,     path: '/projects',            gradient: 'from-teal-500 to-teal-800',        glowColor: 'rgba(20,184,166,0.40)' },
  { label: 'WhatsApp',           icon: MessageCircle,  path: '/whatsapp',            gradient: 'from-green-500 to-green-800',      glowColor: 'rgba(34,197,94,0.40)', badgeKey: 'whatsapp' },
  { label: 'Inbox',              icon: Inbox,          path: '/inbox',               gradient: 'from-blue-600 to-indigo-800',      glowColor: 'rgba(99,102,241,0.40)' },
  { label: 'Reminders',          icon: Bell,           path: '/reminders',           gradient: 'from-rose-500 to-red-700',         glowColor: 'rgba(244,63,94,0.40)', badgeKey: 'reminders' },
  { label: 'Analytics',          icon: BarChart3,      path: '/analytics',           gradient: 'from-purple-500 to-fuchsia-800',   glowColor: 'rgba(168,85,247,0.40)' },
  { label: 'Sales Analytics',    icon: BarChart3,      path: '/sales-analytics',     gradient: 'from-pink-500 to-rose-700',        glowColor: 'rgba(236,72,153,0.40)' },
  { label: 'Team',               icon: Users,          path: '/team',                gradient: 'from-slate-500 to-slate-700',      glowColor: 'rgba(148,163,184,0.40)' },
  { label: 'Team AI OS',         icon: Brain,          path: '/team-os',             gradient: 'from-indigo-500 to-violet-800',    glowColor: 'rgba(99,102,241,0.40)' },
  { label: 'Team Performance',   icon: Trophy,         path: '/team-dashboard',      gradient: 'from-yellow-500 to-amber-700',     glowColor: 'rgba(234,179,8,0.40)' },
  { label: 'Offers',             icon: FileSignature,  path: '/offers',              gradient: 'from-cyan-500 to-blue-800',        glowColor: 'rgba(6,182,212,0.40)' },
  { label: 'Finance',            icon: Calculator,     path: '/finance',             gradient: 'from-green-500 to-teal-800',       glowColor: 'rgba(20,184,166,0.40)' },
  { label: 'Key Handover',       icon: Key,            path: '/key-handover',        gradient: 'from-orange-500 to-red-700',       glowColor: 'rgba(249,115,22,0.40)' },
  { label: 'Commissions',        icon: DollarSign,     path: '/commissions',         gradient: 'from-amber-400 to-yellow-700',     glowColor: 'rgba(245,158,11,0.40)' },
  { label: 'Map View',           icon: MapPin,         path: '/map',                 gradient: 'from-teal-500 to-cyan-700',        glowColor: 'rgba(20,184,166,0.40)' },
  { label: 'WhatsApp Hub',       icon: Zap,            path: '/whatsapp-hub',        gradient: 'from-emerald-500 to-green-700',    glowColor: 'rgba(16,185,129,0.40)' },
  { label: 'Meta & Google',      icon: Zap,            path: '/meta-ads-leads',      gradient: 'from-blue-500 to-sky-700',         glowColor: 'rgba(59,130,246,0.40)' },
  { label: 'Instagram Leads',    icon: Instagram,      path: '/instagram',           gradient: 'from-fuchsia-500 to-pink-700',     glowColor: 'rgba(217,70,239,0.40)' },
  { label: 'Property Finder',    icon: Link2,          path: '/property-finder',     gradient: 'from-red-500 to-rose-700',         glowColor: 'rgba(239,68,68,0.40)' },
  { label: 'Duplicate Detector', icon: GitMerge,       path: '/duplicates',          gradient: 'from-orange-500 to-amber-700',     glowColor: 'rgba(249,115,22,0.40)' },
  { label: 'Email Automations',  icon: Mail,           path: '/email-automations',   gradient: 'from-indigo-500 to-blue-800',      glowColor: 'rgba(99,102,241,0.40)' },
  { label: 'Claude AI',          icon: Sparkles,       path: '/claude-ai',           gradient: 'from-violet-500 to-purple-800',    glowColor: 'rgba(139,92,246,0.40)' },
  { label: 'WhatsApp Setup',     icon: MessageCircle,  path: '/whatsapp-setup',      gradient: 'from-slate-500 to-slate-700',      glowColor: 'rgba(148,163,184,0.40)' },
  { label: 'Form A Referral',    icon: Handshake,      path: '/form-a-referral',     gradient: 'from-amber-500 to-orange-700',     glowColor: 'rgba(245,158,11,0.40)' },
  { label: 'Find Property',      icon: Search,         path: '/find-property',       gradient: 'from-cyan-500 to-teal-700',        glowColor: 'rgba(6,182,212,0.40)', href: 'https://aiboostmarketing.com/lookup/?token=971581806000-4e32601555d5aa4902807dfe6c1368&sheetId=1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE' },
  { label: 'DLD Lookup',         icon: Phone,          path: '/dld-lookup',          gradient: 'from-purple-500 to-fuchsia-800',   glowColor: 'rgba(168,85,247,0.40)', href: 'https://aiboostmarketing.com/smart-bot/?user=971581806000-4e32601555d5aa4902807dfe6c1368&sheetId=1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE' },
  { label: 'Transfer Numbers',   icon: Calculator,     path: '/transfer-breakdown',  gradient: 'from-green-500 to-emerald-700',    glowColor: 'rgba(34,197,94,0.40)', href: 'https://claude.ai/project/019e7460-ea5f-74e0-8efb-c3a58527c3bd' },
  { label: 'Transfer Calculator',icon: Calculator,     path: '/transfer-calculator', gradient: 'from-amber-500 to-yellow-700',     glowColor: 'rgba(245,158,11,0.40)' },
  { label: 'Form I Generator',   icon: FileSignature,  path: '/form-i-generator',    gradient: 'from-indigo-500 to-slate-700',     glowColor: 'rgba(99,102,241,0.40)' },
  { label: 'Deal Risk',          icon: ShieldAlert,    path: '/deal-risk',           gradient: 'from-red-600 to-rose-800',         glowColor: 'rgba(239,68,68,0.40)' },
  { label: 'Dubai Intelligence', icon: Globe,          path: '/dubai-intelligence',  gradient: 'from-amber-500 to-orange-800',      glowColor: 'rgba(245,158,11,0.45)' },
];

export const DEFAULT_NAV_LABELS = ['Pipeline', 'Leads', 'Contacts', 'Reminders'];
export const MIN_ITEMS = 3;
export const MAX_ITEMS = 5;

// Context-aware dock slots: when on a matching route, surface these apps.
// Key = pathname fragment to match (startsWith), value = ordered preferred app paths.
export const CONTEXT_DOCK_MAP = {
  '/landlords':        ['/landlords', '/property-finder', '/offers', '/pipeline'],
  '/pipeline':         ['/pipeline', '/leads', '/whatsapp', '/reminders'],
  '/aurora-pipeline':  ['/pipeline', '/leads', '/whatsapp', '/reminders'],
  '/finance':          ['/finance', '/commissions', '/leads', '/reminders'],
  '/commissions':      ['/finance', '/commissions', '/leads', '/invoices'],
  '/whatsapp':         ['/whatsapp', '/leads', '/pipeline', '/reminders'],
  '/leads':            ['/leads', '/pipeline', '/whatsapp', '/reminders'],
  '/analytics':        ['/analytics', '/sales-analytics', '/team-dashboard', '/leads'],
  '/team':             ['/team', '/team-dashboard', '/analytics', '/leads'],
};