import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Loader2, Phone, Mail, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ContactList({ folderId, onSelectContact, onAddContact }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', folderId, sourceFilter, stageFilter],
    queryFn: async () => {
      let query = {};
      
      if (folderId) {
        query.folder_id = folderId;
      }
      if (sourceFilter !== 'all') {
        query.source = sourceFilter;
      }
      if (stageFilter !== 'all') {
        query.stage = stageFilter;
      }

      const results = await base44.entities.Lead.filter(query, '-last_contact_date', 100);
      
      // Client-side search
      if (searchQuery) {
        return results.filter(c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone.includes(searchQuery) ||
          (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      
      return results;
    },
  });

  const { data: folder } = useQuery({
    queryKey: ['folder', folderId],
    queryFn: () => base44.entities.ContactFolder.read(folderId),
    enabled: !!folderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={onAddContact} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      <div className="flex gap-2">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="import">Import</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="new_lead">New Lead</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="viewing_scheduled">Viewing</SelectItem>
            <SelectItem value="negotiation">Negotiation</SelectItem>
            <SelectItem value="closed_won">Closed Won</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No contacts found
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => onSelectContact(contact)}
              className={cn(
                'p-3 border rounded-lg cursor-pointer transition-all hover:bg-accent/50',
                contact.is_duplicate_of && 'opacity-50 bg-gray-50'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
                  <div className="space-y-1 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {contact.phone}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {contact.source}
                  </div>
                  {contact.last_contact_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(contact.last_contact_date), 'MMM d')}
                    </div>
                  )}
                </div>
              </div>

              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {contact.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                  {contact.tags.length > 2 && (
                    <span className="text-xs text-muted-foreground">+{contact.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}