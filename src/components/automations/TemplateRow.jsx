// TemplateRow — shared card for a single MessageTemplate, used by the
// Welcome Sequence and Templates Library sections of the Automations Hub.
import React from 'react';
import {
  Edit3, Trash2, ToggleLeft, ToggleRight, Mail, MessageCircle,
  MessageSquare, Send, Smartphone, Globe, Lock, Users,
} from 'lucide-react';

const CHANNEL_ICON = {
  email: Mail, whatsapp: MessageCircle, imessage: MessageSquare, telegram: Send, sms: Smartphone,
};
const CHANNEL_COLOR = {
  email: '#3b82f6', whatsapp: '#22c55e', imessage: '#0A84FF', telegram: '#38bdf8', sms: '#a78bfa',
};
const VIS_META = {
  private: { label: 'Private', icon: Lock, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  shared: { label: 'Everyone', icon: Globe, color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  specific_agents: { label: 'Specific', icon: Users, color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
};

export default function TemplateRow({ tpl, onEdit, onDelete, onToggle }) {
  const Icon = CHANNEL_ICON[tpl.channel] || Mail;
  const color = CHANNEL_COLOR[tpl.channel] || '#94a3b8';
  const vis = VIS_META[tpl.visibility] || VIS_META.private;
  const VisIcon = vis.icon;
  return (
    <div className="glass-card p-4 flex items-start gap-3">
      <div className="flex-none w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{tpl.title}</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide" style={{ background: `${color}15`, color }}>{tpl.channel}</span>
          {tpl.category === 'welcome_sequence' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>Welcome</span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1" style={{ background: vis.bg, color: vis.color }} title={`Access: ${vis.label}`}>
            <VisIcon className="w-2.5 h-2.5" /> {vis.label}
          </span>
          {tpl.sort_order != null && tpl.category === 'welcome_sequence' && (
            <span className="text-[10px] font-bold text-muted-foreground">#{tpl.sort_order}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.body?.substring(0, 120)}{tpl.body?.length > 120 ? '…' : ''}</p>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>by {tpl.created_by_name || tpl.created_by_email || 'Unknown'}</span>
          <span>·</span>
          <span>Used {tpl.usage_count || 0}×</span>
          {tpl.subject && <><span>·</span><span>{tpl.subject}</span></>}
        </div>
      </div>
      <div className="flex-none flex items-center gap-1">
        <button onClick={() => onToggle(tpl)} className="p-1.5 rounded-lg hover:bg-white/5" title={tpl.is_active ? 'Active' : 'Inactive'}>
          {tpl.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
        </button>
        <button onClick={() => onEdit(tpl)} className="p-1.5 rounded-lg hover:bg-white/5"><Edit3 className="w-4 h-4 text-muted-foreground" /></button>
        <button onClick={() => onDelete(tpl)} className="p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4 text-red-400" /></button>
      </div>
    </div>
  );
}