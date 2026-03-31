import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AddContactDialog from '@/components/contacts/AddContactDialog';
import ContactChatPanel from '@/components/contacts/ContactChatPanel';
import AIActionsPanel from '@/components/contacts/AIActionsPanel';
import ContactDetailPanel from '@/components/contacts/ContactDetailPanel';
import RawDataIngestion from '@/components/leads/RawDataIngestion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Plus, Phone, Mail, SlidersHorizontal, MessageSquare, Zap, User, Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SOURCE_OPTIONS = ['all', 'property_finder', 'bayut', 'whatsapp', 'referral', 'website', 'walk_in', 'social_media', 'email', 'other'];
const STAGE_OPTIONS = ['all', 'new_lead', 'contacted', 'viewing_scheduled', 'viewing_done', 'negotiation', 'offer_made', 'closed_won', 'closed_lost'];

const STAGE_COLORS = {
  new_lead: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-600',
  viewing_scheduled: 'bg-indigo-100 text-indigo-600',
  viewing_done: 'bg-purple-100 text-purple-600',
  negotiation: 'bg-amber-100 text-amber-600',
  offer_made: 'bg-orange-100 text-orange-600',
  closed_won: 'bg-green-100 text-green-600',
  closed_lost: 'bg-red-100 text-red-600',
};

// RIGHT PANEL TABS: 'detail' | 'chat' | 'ai'
const TABS = [
  { id: 'detail', label: 'Profile', icon: User },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'ai', label: 'Actions', icon: Zap },
];

function ContactItem({ contact, isSelected, onClick }) {
  const initials = contact.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = contact.name ? (contact.name.charCodeAt(0) * 7) % 360 : 200;
  const primaryPhone = contact.phones?.find(p => p.is_primary)?.number || contact.phone;
  const primaryEmail = contact.emails?.find(e => e.is_primary)?.address || contact.email;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-150 ${
        isSelected
          ? 'bg-indigo-50 border border-indigo-200 shadow-sm'
          : 'hover:bg-[#F9FAFB] border border-transparent'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-[11px]"
          style={{ background: `hsl(${hue}, 60%, 55%)` }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-[#111827]'}`}>
              {contact.name}
            </p>
            {contact.stage && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STAGE_COLORS[contact.stage] || 'bg-slate-100 text-slate-500'}`}>
                {contact.stage.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {primaryPhone && (
            <p className="text-xs text-[#9CA3AF] mt-0.5 flex items-center gap-1 font-mono">
              <Phone className="w-2.5 h-2.5 shrink-0" /> {primaryPhone}
            </p>
          )}
          {primaryEmail && (
            <p className="text-xs text-[#9CA3AF] truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-2.5 h-2.5 shrink-0" /> {primaryEmail}
            </p>
          )}
          {contact.organization?.tower && (
            <p className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">{contact.organization.tower}{contact.organization.unit_number ? ` · ${contact.organization.unit_number}` : ''}</p>
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
  const [showRollImport, setShowRollImport] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const filtered = contacts.filter(c => {
    const matchSearch = !search
      || c.name?.toLowerCase().includes(search.toLowerCase())
      || c.phone?.includes(search)
      || c.email?.toLowerCase().includes(search.toLowerCase())
      || c.phones?.some(p => p.number?.includes(search))
      || c.organization?.tower?.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === 'all' || c.source === sourceFilter;
    const matchStage = stageFilter === 'all' || c.stage === stageFilter;
    return matchSearch && matchSource && matchStage;
  });

  const handleSelectContact = (id) => {
    setSelectedContactId(id);
    setActiveTab('detail');
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] -m-6 overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E5E7EB] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Contacts</h1>
          <p className="text-xs text-[#6B7280]">{contacts.length} total · click any contact to view & edit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowRollImport(true)}
            variant="outline"
            className="text-xs px-3 h-8 rounded-lg gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Wand2 className="w-3.5 h-3.5" /> Roll Import
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-4 h-8 rounded-lg gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Contact List */}
        <div className={`flex-shrink-0 flex flex-col bg-white border-r border-[#E5E7EB] transition-all duration-300 ${selectedContactId ? 'w-64' : 'w-80'}`}>
          {/* Search + Filter */}
          <div className="px-3 pt-3 pb-2 space-y-2">
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
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors ${showFilters ? 'bg-indigo-50 text-indigo-600' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              <SlidersHorizontal className="w-3 h-3" /> Filters
              {(sourceFilter !== 'all' || stageFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] focus:outline-none focus:border-indigo-400">
                    {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sources' : s.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] focus:outline-none focus:border-indigo-400">
                    {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Stages' : s.replace(/_/g, ' ')}</option>)}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-[10px] text-[#9CA3AF] font-medium">{filtered.length} contacts</span>
          </div>

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
                  onClick={() => handleSelectContact(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Detail / Chat / AI panel */}
        <AnimatePresence mode="wait">
          {selectedContactId ? (
            <motion.div
              key="detail-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Tab Bar */}
              <div className="flex-shrink-0 flex items-center bg-white border-b border-[#E5E7EB] px-4 gap-1">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-[#6B7280] hover:text-[#374151]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  {activeTab === 'detail' && (
                    <motion.div key="detail" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="h-full">
                      <ContactDetailPanel
                        contactId={selectedContactId}
                        onClose={() => setSelectedContactId(null)}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'chat' && (
                    <motion.div key="chat" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="h-full bg-white">
                      <ContactChatPanel contactId={selectedContactId} />
                    </motion.div>
                  )}
                  {activeTab === 'ai' && (
                    <motion.div key="ai" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="h-full bg-[#F9FAFB]">
                      <AIActionsPanel selectedContactId={selectedContactId} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto">
                  <User className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#374151]">Select a contact</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Click any contact to view & edit their full profile</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddContactDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} />
      <RawDataIngestion open={showRollImport} onClose={() => setShowRollImport(false)} />
    </div>
  );
}