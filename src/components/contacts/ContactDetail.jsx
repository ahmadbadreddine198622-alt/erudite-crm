import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus, Save, Phone, Mail, MapPin, Building2, Calendar, Globe, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AIInsightsPanel from './AIInsightsPanel';

export default function ContactDetail({ contactId, onClose }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editedContact, setEditedContact] = useState(null);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => base44.entities.Lead.read(contactId),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['contact-history', contactId],
    queryFn: () => base44.entities.ContactHistory.filter({ lead_id: contactId }, '-created_date', 20),
  });

  const updateMutation = useMutation({
    mutationFn: (updates) => base44.entities.Lead.update(contactId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      setIsEditing(false);
      toast.success('Contact updated');
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async () => {
      if (!newTag.trim()) return;
      const updated = await base44.entities.Lead.update(contactId, {
        tags: [...(contact.tags || []), newTag.trim()],
      });
      await base44.functions.invoke('updateContactFolders', {
        lead_id: contactId,
        new_tags: [newTag.trim()],
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      setNewTag('');
      toast.success('Tag added');
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!contact) {
    return <div className="text-center py-8 text-muted-foreground">Contact not found</div>;
  }

  const displayContact = editedContact || contact;

  return (
    <div className="grid grid-cols-3 gap-4 p-4 max-h-[80vh] overflow-y-auto">
      {/* Left Column - Contact Details */}
      <div className="col-span-2 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{contact.name}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Core Contact Info */}
      <div className="space-y-3 border rounded-lg p-3 bg-card">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-foreground">{displayContact.phone}</span>
          </div>
          {displayContact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="break-all text-foreground">{displayContact.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Personal Details */}
      <div className="space-y-3 border rounded-lg p-3 bg-card">
        <h3 className="font-semibold text-sm">Personal Details</h3>
        {displayContact.nationality && (
          <div className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground">Nationality</label>
              <Input value={displayContact.nationality} disabled className="mt-1 h-8 text-sm" />
            </div>
          </div>
        )}
        {displayContact.type && (
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground">Type</label>
              <Input value={displayContact.type} disabled className="mt-1 h-8 text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Property & Source Info */}
      <div className="space-y-3 border rounded-lg p-3 bg-card">
        <h3 className="font-semibold text-sm">Property & Source</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Source</label>
            <Input value={displayContact.source?.replace(/_/g, ' ').toUpperCase()} disabled className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Stage</label>
            <Input value={displayContact.stage?.replace(/_/g, ' ').toUpperCase()} disabled className="mt-1 h-8 text-sm" />
          </div>
        </div>
        
        {contact.source_metadata?.project && (
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground">Project</label>
              <Input value={contact.source_metadata.project} disabled className="mt-1 h-8 text-sm" />
            </div>
          </div>
        )}
        
        {contact.source_metadata?.unit && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground">Unit / Tower</label>
              <Input value={contact.source_metadata.unit} disabled className="mt-1 h-8 text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2 border rounded-lg p-3 bg-card">
        <h3 className="font-semibold text-sm">Notes</h3>
        <Textarea
          value={displayContact.notes || ''}
          onChange={(e) => isEditing && setEditedContact({ ...displayContact, notes: e.target.value })}
          disabled={!isEditing}
          className="min-h-20 text-sm"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2 border rounded-lg p-3 bg-card">
        <h3 className="font-semibold text-sm">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {contact.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        {isEditing && (
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Add new tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              size="sm"
              onClick={() => addTagMutation.mutate()}
              disabled={!newTag.trim() || addTagMutation.isPending}
              className="gap-1"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Key Dates */}
      <div className="space-y-2 border rounded-lg p-3 bg-card text-xs">
        <h3 className="font-semibold text-sm">Timeline</h3>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Added:</span>
          <span>{format(new Date(contact.created_date), 'MMM dd, yyyy')}</span>
        </div>
        {contact.last_contact_date && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last Contact:</span>
            <span>{format(new Date(contact.last_contact_date), 'MMM dd, yyyy')}</span>
          </div>
        )}
      </div>

      {/* Activity History */}
      <div className="space-y-2 border rounded-lg p-3 bg-card">
        <h3 className="font-semibold text-sm">Activity</h3>
        <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs">
          {history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.id} className="p-2 bg-background rounded border border-border">
                <div className="font-medium capitalize">{entry.change_type}</div>
                <div className="text-muted-foreground text-[11px] mt-0.5">
                  {entry.changed_by} • {format(new Date(entry.created_date), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No activity yet</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" className="flex-1">
            Edit
          </Button>
        ) : (
          <>
            <Button
              onClick={() => {
                updateMutation.mutate(editedContact);
              }}
              disabled={updateMutation.isPending}
              className="flex-1 gap-2"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setEditedContact(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
      </div>

      {/* Right Column - AI Insights */}
      <div className="col-span-1 sticky top-0 h-fit">
        <AIInsightsPanel contactName={contact.name} />
      </div>
    </div>
  );
}