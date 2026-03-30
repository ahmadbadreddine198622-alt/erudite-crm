import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AddTemplateDialog({ open, onOpenChange }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom');
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      base44.entities.ReplyTemplate.create({
        name,
        category,
        body,
        placeholders: extractPlaceholders(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reply_templates'] });
      setName('');
      setCategory('custom');
      setBody('');
      onOpenChange(false);
    },
  });

  const extractPlaceholders = (text) => {
    const regex = /\{(\w+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) matches.push(match[1]);
    }
    return matches;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Reply Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Template Name</label>
            <Input
              placeholder="e.g., Viewing Confirmation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="greeting">Greeting</SelectItem>
                <SelectItem value="viewing">Viewing Request</SelectItem>
                <SelectItem value="pricing">Pricing</SelectItem>
                <SelectItem value="property_info">Property Info</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="closing">Closing</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Message Body</label>
            <Textarea
              placeholder="Type your template. Use {name}, {property}, {date}, {time}, {price} as placeholders"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 min-h-24"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {extractPlaceholders(body).length > 0 && (
                <>Variables: {extractPlaceholders(body).join(', ')}</>
              )}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || !body}
            >
              Create Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}