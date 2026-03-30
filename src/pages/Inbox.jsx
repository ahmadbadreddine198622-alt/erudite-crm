import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Mail } from 'lucide-react';
import EmailListItem from '@/components/inbox/EmailListItem';
import EmailDetailPanel from '@/components/inbox/EmailDetailPanel';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'leads', label: 'Leads' },
  { id: 'tagged', label: 'Tagged' },
];

export default function Inbox() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: () => base44.entities.Email.list('-received_at', 100),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Email.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emails'] }),
  });

  const handleSelect = (email) => {
    setSelectedEmail(email);
    if (!email.is_read) markReadMutation.mutate(email.id);
  };

  const filtered = emails.filter(e => {
    const matchesSearch = !search ||
      e.subject?.toLowerCase().includes(search.toLowerCase()) ||
      e.from_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.from_email?.toLowerCase().includes(search.toLowerCase()) ||
      e.snippet?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'unread') return !e.is_read;
    if (filter === 'leads') return !!e.lead_id;
    if (filter === 'tagged') return e.auto_tags?.length > 0;
    return true;
  });

  const unreadCount = emails.filter(e => !e.is_read).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Left Panel - Email List */}
      <div className={`flex flex-col border-r border-border ${selectedEmail ? 'hidden md:flex w-[380px] shrink-0' : 'flex-1 md:w-[380px] md:shrink-0'}`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-semibold">Inbox</h1>
              {unreadCount > 0 && (
                <Badge className="bg-accent text-accent-foreground text-xs px-1.5 py-0">{unreadCount}</Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-8 w-8">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Mail className="w-8 h-8 opacity-30" />
              <p>No emails found</p>
            </div>
          ) : (
            filtered.map(email => (
              <EmailListItem
                key={email.id}
                email={email}
                isSelected={selectedEmail?.id === email.id}
                onClick={() => handleSelect(email)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Email Detail */}
      {selectedEmail ? (
        <EmailDetailPanel
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onLeadCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['emails'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground flex-col gap-3">
          <Mail className="w-12 h-12 opacity-20" />
          <p className="text-sm">Select an email to read</p>
        </div>
      )}
    </div>
  );
}