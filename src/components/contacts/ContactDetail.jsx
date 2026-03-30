import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

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
    <div className="space-y-6 p-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{contact.name}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contact Info */}
      <div className="space-y-3 border rounded-lg p-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Name</label>
          <Input
            value={displayContact.name}
            onChange={(e) => setEditedContact({ ...displayContact, name: e.target.value })}
            disabled={!isEditing}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Phone</label>
          <Input value={displayContact.phone} disabled className="mt-1 bg-gray-50" />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Email</label>
          <Input
            value={displayContact.email || ''}
            onChange={(e) => setEditedContact({ ...displayContact, email: e.target.value })}
            disabled={!isEditing}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Source</label>
            <Input value={displayContact.source} disabled className="mt-1 bg-gray-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Stage</label>
            <Input value={displayContact.stage} disabled className="mt-1 bg-gray-50" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Notes</label>
          <Textarea
            value={displayContact.notes || ''}
            onChange={(e) => setEditedContact({ ...displayContact, notes: e.target.value })}
            disabled={!isEditing}
            className="mt-1 min-h-24"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {contact.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add new tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="text-xs"
          />
          <Button
            size="sm"
            onClick={() => addTagMutation.mutate()}
            disabled={!newTag.trim() || addTagMutation.isPending}
            className="gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Activity</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className="text-xs p-2 bg-gray-50 rounded border">
              <div className="font-medium capitalize">{entry.change_type}</div>
              <div className="text-muted-foreground mt-0.5">
                by {entry.changed_by} on {new Date(entry.created_date).toLocaleDateString()}
              </div>
            </div>
          ))}
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
  );
}