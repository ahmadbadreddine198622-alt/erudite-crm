import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote } from 'lucide-react';
import { toast } from 'sonner';

export default function AddNotePanel({ leadId, agentName }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body) =>
      base44.entities.LeadActivity.create({
        lead_id: leadId,
        activity_type: 'note',
        title: 'Note',
        body,
        created_by: agentName || 'Agent',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      setText('');
      toast.success('Note saved');
    },
  });

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a note..."
        rows={3}
        className="text-sm resize-none"
      />
      <Button
        size="sm"
        disabled={!text.trim() || mutation.isPending}
        onClick={() => mutation.mutate(text.trim())}
        className="bg-accent text-accent-foreground hover:bg-accent/90 h-8 text-xs"
      >
        <StickyNote className="w-3.5 h-3.5 mr-1.5" />
        Save Note
      </Button>
    </div>
  );
}