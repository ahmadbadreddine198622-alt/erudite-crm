import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AddContactDialog from '@/components/contacts/AddContactDialog';
import ContactChatPanel from '@/components/contacts/ContactChatPanel';
import AIActionsPanel from '@/components/contacts/AIActionsPanel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, Plus, Phone, Mail, Calendar, ChevronDown, X, SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const SOURCE_OPTIONS = ['all', 'property_finder', 'bayut', 'whatsapp', 'referral', 'website', 'walk_in', 'social_media', 'email', 'other'];
const STAGE_OPTIONS = ['all', 'new_lead', 'contacted', 'viewing_scheduled', 'viewing_done', 'negotiation', 'offer_made', 'closed_won', 'closed_lost'];

const stageColors = {
  new_lead: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-600',
  viewing_scheduled: 'bg-indigo-100 text-indigo-600',
  viewing_done: 'bg-purple-100 text-purple-600',
  negotiation: 'bg-amber-100 text-amber-600',
  offer_made: 'bg-orange-100 text-orange-600',
  closed_won: 'bg-green-100 text-green-600',
  closed_lost: 'bg-red-100 text-red-600',
};

function ContactItem({ contact, isSelected, onClick }) {
  const initials = contact.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = contact.name ? (contact.name.charCodeAt(0) * 7) % 360 : 200;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-150 ${
        isSelected
          ? 'bg-indigo-50 border border-indigo-200 shadow-sm'
          : 'hover:bg-[#F9FAFB] border border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs"
          style={{ background: `hsl(${hue}, 60%, 55%)` }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-[#111827]'}`}>
              {contact.name}
            </p>
            {contact.stage && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${stageColors[contact.stage] || 'bg-slate-100 text-slate-500'}`}>
                {contact.stage.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {contact.phone && (
            <p className="text-xs text-[#9CA3AF] mt-0.5 flex items-center gap-1">
              <Phone className="w-2.5 h-2.5" /> {contact.phone}
            </p>
          )}
          {contact.email && (
            <p className="text-xs text-[#9CA3AF] truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-2.5 h-2.5" /> {contact.email}
            </p>
          )}
          {contact.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {contact.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">{tag}</span>
              ))}
              {contact.tags.length > 2 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#9CA3AF]">+{contact.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default function ContactsPage() {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === 'all' || c.source === sourceFilter;
    const matchStage = stageFilter === 'all' || c.stage === stageFilter;
    return matchSearch && matchSource && matchStage;
  });

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] -m-6 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E5E7EB] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Contacts</h1>
          <p className="text-xs text-[#6B7280]">AI-powered relationship workspace</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-4 h-8 rounded-lg gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </Button>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Contact List */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white border-r border-[#E5E7EB]">
          {/* Search + Filter */}
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${showFilters ? 'bg-indigo-50 text-indigo-600' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              <SlidersHorizontal className="w-3 h-3" /> Filters
              {(sourceFilter !== 'all' || stageFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
            {showFilters && (
              <div className="space-y-1.5">
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] focus:outline-none focus:border-indigo-400"
                >
                  {SOURCE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s === 'all' ? 'All Sources' : s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <select
                  value={stageFilter}
                  onChange={e => setStageFilter(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] focus:outline-none focus:border-indigo-400"
                >
                  {STAGE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s === 'all' ? 'All Stages' : s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="px-4 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-[#9CA3AF] font-medium">{filtered.length} contacts</span>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-xs text-[#9CA3AF]">No contacts found</p>
              </div>
            ) : (
              filtered.map(c => (
                <ContactItem
                  key={c.id}
                  contact={c}
                  isSelected={selectedContactId === c.id}
                  onClick={() => setSelectedContactId(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* CENTER: AI Chat */}
        <div className="flex-1 flex flex-col bg-white border-r border-[#E5E7EB] overflow-hidden">
          <ContactChatPanel contactId={selectedContactId} />
        </div>

        {/* RIGHT: AI Actions */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l border-[#E5E7EB]">
          <AIActionsPanel selectedContactId={selectedContactId} />
        </div>
      </div>

      <AddContactDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}