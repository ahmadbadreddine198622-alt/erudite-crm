import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import AddContactDialog from '@/components/contacts/AddContactDialog';
import ContactChatPanel from '@/components/contacts/ContactChatPanel';
import AIActionsPanel from '@/components/contacts/AIActionsPanel';
import ContactDetailPanel from '@/components/contacts/ContactDetailPanel';
import RawDataIngestion from '@/components/leads/RawDataIngestion';
import { Button } from '@/components/ui/button';
import {
  Search, Plus, Phone, Mail, SlidersHorizontal, MessageSquare, Zap, User, Wand2, Snowflake
} from 'lucide-react';
import ColdLeadsPanel from '@/components/contacts/ColdLeadsPanel';
import ContactActions from '@/components/contacts/ContactActions';
import { motion, AnimatePresence } from 'framer-motion';

const SOURCE_OPTIONS = ['all', 'property_finder', 'bayut', 'whatsapp', 'referral', 'website', 'walk_in', 'social_media', 'email', 'other'];
const STAGE_OPTIONS = ['all', 'new_lead', 'contacted', 'viewing_scheduled', 'viewing_done', 'negotiation', 'offer_made', 'closed_won', 'closed_lost'];

const STAGE_COLORS = {
  new_lead: 'bg-slate-500/10 text-slate-400',
  contacted: 'bg-blue-500/10 text-blue-400',
  viewing_scheduled: 'bg-indigo-500/10 text-indigo-400',
  viewing_done: 'bg-purple-500/10 text-purple-400',
  negotiation: 'bg-accent/10 text-accent',
  offer_made: 'bg-accent/10 text-accent',
  closed_won: 'bg-emerald-500/10 text-emerald-400',
  closed_lost: 'bg-red-500/10 text-red-400',
};

const TABS = [
  { id: 'detail', label: 'Profile', icon: User },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'ai', label: 'Actions', icon: Zap },
];

function ContactItem({ contact, isSelected, onClick }) {
  const [showActions, setShowActions] = useState(false);
  const contactName = contact.full_name || contact.name || 'Unnamed';
  const initials = contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = contactName ? (contactName.charCodeAt(0) * 7) % 360 : 200;
  const primaryPhone = contact.phones?.find(p => p.is_primary)?.number || contact.phone;
  const primaryEmail = contact.emails?.find(e => e.is_primary)?.address || contact.email;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full px-3 py-3 rounded-xl transition-all duration-150 ${
        isSelected
          ? 'bg-accent/10 border border-accent/30 shadow-sm'
          : 'hover:bg-secondary border border-transparent'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-[11px]"
          style={{ background: `hsl(${hue}, 50%, 45%)` }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-accent' : 'text-foreground'}`}>
              {contactName}
            </p>
            {contact.stage && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STAGE_COLORS[contact.stage] || 'bg-muted text-muted-foreground'}`}>
                {contact.stage.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {primaryPhone && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 font-mono">
              <Phone className="w-2.5 h-2.5 shrink-0" /> {primaryPhone}
            </p>
          )}
          {primaryEmail && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-2.5 h-2.5 shrink-0" /> {primaryEmail}
            </p>
          )}
          {contact.organization?.tower && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{contact.organization.tower}{contact.organization.unit_number ? ` · ${contact.organization.unit_number}` : ''}</p>
          )}
          {contact.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {contact.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
              ))}
              {contact.tags.length > 2 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{contact.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
      </button>
      {showActions && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <ContactActions contact={contact} />
        </div>
      )}
    </motion.div>
  );
}

export default function ContactsPage() {
  const { user: currentUser, permissions } = useCurrentUser();
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRollImport, setShowRollImport] = useState(false);
  const [showColdLeads, setShowColdLeads] = useState(false);
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
    // Role-based filtering: non-admins see only their own assigned contacts
    if (currentUser && !permissions.view_all_leads) {
      if (c.assigned_agent_email !== currentUser.email) return false;
    }
    const matchSearch = !search
      || c.full_name?.toLowerCase().includes(search.toLowerCase())
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
    <div className="flex flex-col bg-background -m-6 overflow-hidden" style={{ height: '100dvh' }}>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Contacts</h1>
          <p className="text-xs text-muted-foreground">{contacts.length} total · click any contact to view and edit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowColdLeads(true)}
            variant="outline"
            className="text-xs px-3 h-8 rounded-lg gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            <Snowflake className="w-3.5 h-3.5" /> Cold Leads
          </Button>
          <Button
            onClick={() => setShowRollImport(true)}
            variant="outline"
            className="text-xs px-3 h-8 rounded-lg gap-1.5 border-accent/30 text-accent hover:bg-accent/5"
          >
            <Wand2 className="w-3.5 h-3.5" /> Roll Import
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs px-4 h-8 rounded-lg gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Contact List */}
        <div className={`flex-shrink-0 flex flex-col bg-card border-r border-border transition-all duration-300 ${selectedContactId ? 'w-64' : 'w-80'}`}>
          {/* Search + Filter */}
          <div className="px-3 pt-3 pb-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors ${showFilters ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <SlidersHorizontal className="w-3 h-3" /> Filters
              {(sourceFilter !== 'all' || stageFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
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
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-accent/50">
                    {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sources' : s.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-accent/50">
                    {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Stages' : s.replace(/_/g, ' ')}</option>)}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">{filtered.length} contacts</span>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-xs text-muted-foreground">No contacts found</p>
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
              <div className="flex-shrink-0 flex items-center bg-card border-b border-border px-4 gap-1">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
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
                    <motion.div key="chat" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="h-full bg-card">
                      <ContactChatPanel contactId={selectedContactId} />
                    </motion.div>
                  )}
                  {activeTab === 'ai' && (
                    <motion.div key="ai" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="h-full bg-background">
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
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                  <User className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Select a contact</p>
                  <p className="text-xs text-muted-foreground mt-1">Click any contact to view and edit their full profile</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddContactDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} />
      <RawDataIngestion open={showRollImport} onClose={() => setShowRollImport(false)} />

      {/* Cold Leads Slide-over */}
      <AnimatePresence>
        {showColdLeads && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowColdLeads(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 shadow-2xl"
            >
              <ColdLeadsPanel
                onSelectContact={(id) => { setSelectedContactId(id); setActiveTab('detail'); setShowColdLeads(false); }}
                onClose={() => setShowColdLeads(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}