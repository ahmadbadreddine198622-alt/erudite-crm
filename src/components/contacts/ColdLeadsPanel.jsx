import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Snowflake, MessageSquare, Phone, Clock, Loader2, ChevronRight, Flame, RefreshCw, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const COLD_THRESHOLD_DAYS = 14;

const RE_ENGAGEMENT_TEMPLATES = [
  {
    id: 'check_in',
    label: '👋 Casual Check-in',
    message: (name) => `Hi ${name}! Hope you're doing well. Just checking in to see if you're still looking for a property in Dubai. I have some new listings that might interest you. Would you like me to share them?`,
  },
  {
    id: 'new_listing',
    label: '🏠 New Listing Alert',
    message: (name) => `Hi ${name}, I came across a new property listing that matches what you were looking for earlier. The price looks competitive for the current market. Would you like to schedule a quick call to discuss?`,
  },
  {
    id: 'market_update',
    label: '📊 Market Update',
    message: (name) => `Hi ${name}! Quick update on the Dubai property market — prices in some key areas have shifted recently. Given your criteria, this could be a good time to act. Would love to catch up and share what I'm seeing.`,
  },
  {
    id: 'price_drop',
    label: '💰 Price Drop',
    message: (name) => `Hi ${name}! Great news — a property I think you'd love just had a price reduction. It fits your budget and preferred area. Want me to send you the details?`,
  },
];

function DaysBadge({ days }) {
  const color = days > 30 ? 'bg-red-100 text-red-600' : days > 21 ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {days}d cold
    </span>
  );
}

function ColdLeadRow({ lead, onSelect, onSendMessage, sendingId }) {
  const primaryPhone = lead.phones?.find(p => p.is_primary)?.number || lead.phone;
  const daysSinceContact = lead.last_contact_date
    ? Math.floor((Date.now() - new Date(lead.last_contact_date)) / (1000 * 60 * 60 * 24))
    : Math.floor((Date.now() - new Date(lead.created_date)) / (1000 * 60 * 60 * 24));

  const initials = lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = lead.name ? (lead.name.charCodeAt(0) * 7) % 360 : 200;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-[#F3F4F6] last:border-0 transition-colors">
      {/* Avatar */}
      <button onClick={() => onSelect(lead.id)} className="shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[11px]"
          style={{ background: `hsl(${hue}, 60%, 55%)` }}>
          {initials}
        </div>
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => onSelect(lead.id)} className="text-sm font-semibold text-[#111827] hover:text-indigo-600 transition-colors truncate">
            {lead.name}
          </button>
          <DaysBadge days={daysSinceContact} />
          {lead.stage && (
            <span className="text-[9px] text-[#9CA3AF] capitalize hidden sm:inline">{lead.stage.replace(/_/g, ' ')}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-[#9CA3AF]">
          {primaryPhone && <span className="font-mono truncate">{primaryPhone}</span>}
          {lead.property_preferences?.preferred_areas?.[0] && (
            <span className="truncate hidden sm:inline">📍 {lead.property_preferences.preferred_areas[0]}</span>
          )}
          {lead.budget_aed && (
            <span className="hidden sm:inline">💰 AED {(lead.budget_aed / 1e6).toFixed(1)}M</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {primaryPhone && (
          <a
            href={`tel:${primaryPhone}`}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 transition-colors"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        <Button
          size="sm"
          onClick={() => onSendMessage(lead)}
          disabled={sendingId === lead.id}
          className="h-7 text-[10px] px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
        >
          {sendingId === lead.id
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <MessageSquare className="w-3 h-3" />
          }
          WhatsApp
        </Button>
      </div>
    </div>
  );
}

export default function ColdLeadsPanel({ onSelectContact, onClose }) {
  const [selectedTemplate, setSelectedTemplate] = useState('check_in');
  const [sendingId, setSendingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  // Filter cold leads: no contact in 14+ days, not closed
  const coldLeads = allLeads.filter(lead => {
    if (['closed_won', 'closed_lost'].includes(lead.stage)) return false;
    const lastDate = lead.last_contact_date || lead.created_date;
    const daysSince = Math.floor((Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    return daysSince >= COLD_THRESHOLD_DAYS;
  }).sort((a, b) => {
    const daysA = Math.floor((Date.now() - new Date(a.last_contact_date || a.created_date)) / (1000 * 60 * 60 * 24));
    const daysB = Math.floor((Date.now() - new Date(b.last_contact_date || b.created_date)) / (1000 * 60 * 60 * 24));
    return daysB - daysA;
  });

  const template = RE_ENGAGEMENT_TEMPLATES.find(t => t.id === selectedTemplate);

  const sendMessage = async (lead) => {
    const primaryPhone = lead.phones?.find(p => p.is_primary)?.number
      || lead.phones?.[0]?.number
      || lead.phone;

    if (!primaryPhone) {
      toast.error('No phone number for this contact');
      return;
    }

    setSendingId(lead.id);
    const messageText = template.message(lead.name?.split(' ')[0] || 'there');

    try {
      await base44.functions.invoke('sendWhatsAppMessage', {
        to: primaryPhone.replace(/[^0-9]/g, ''),
        message: messageText,
      });

      // Update last contact date
      await base44.entities.Lead.update(lead.id, {
        last_contact_date: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Re-engagement sent to ${lead.name}`);
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
            <Snowflake className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#111827]">Cold Leads</h2>
            <p className="text-[10px] text-[#6B7280]">
              {coldLeads.length} leads not contacted in {COLD_THRESHOLD_DAYS}+ days
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/70 text-[#9CA3AF] transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Template Selector */}
      <div className="px-4 py-3 border-b border-[#F3F4F6] flex-shrink-0">
        <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wider mb-2">Re-engagement Template</p>
        <div className="flex flex-wrap gap-1.5">
          {RE_ENGAGEMENT_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                selectedTemplate === t.id
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#D1D5DB]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {template && (
          <p className="text-[10px] text-[#9CA3AF] mt-2 italic line-clamp-2">
            "{template.message('[Name]')}"
          </p>
        )}
      </div>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          </div>
        ) : coldLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <Flame className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-[#374151]">No cold leads!</p>
            <p className="text-xs text-[#9CA3AF] mt-1">All your leads have been contacted recently. Great work!</p>
          </div>
        ) : (
          coldLeads.map(lead => (
            <ColdLeadRow
              key={lead.id}
              lead={lead}
              onSelect={onSelectContact}
              onSendMessage={sendMessage}
              sendingId={sendingId}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {coldLeads.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#F3F4F6] bg-[#FAFAFA] flex-shrink-0">
          <p className="text-[10px] text-[#9CA3AF] text-center">
            Sending updates last contact date automatically
          </p>
        </div>
      )}
    </div>
  );
}