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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AddAutomationDialog({ open, onOpenChange }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('sentiment_change');
  const [sentiment, setSentiment] = useState('negative');
  const [actionType, setActionType] = useState('tag');
  const [tagValue, setTagValue] = useState('escalated');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const trigger_conditions = {
        sentiment: triggerType === 'sentiment_change' ? sentiment : undefined,
      };

      const actions = [{
        type: actionType,
        payload: actionType === 'tag' ? { tag: tagValue } : {},
      }];

      return base44.entities.AutomationRule.create({
        name,
        description,
        trigger_type: triggerType,
        trigger_conditions,
        actions,
        is_active: true,
        priority: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules'] });
      setName('');
      setDescription('');
      setTriggerType('sentiment_change');
      setSentiment('negative');
      setActionType('tag');
      setTagValue('escalated');
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Automation Rule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Rule Name</label>
            <Input
              placeholder="e.g., Escalate Negative Sentiment"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="What does this rule do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-20"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Trigger Type</label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sentiment_change">When Sentiment Changes</SelectItem>
                <SelectItem value="urgency_change">When Urgency Changes</SelectItem>
                <SelectItem value="lead_score_change">When Lead Score Changes</SelectItem>
                <SelectItem value="message_received">On Every Message</SelectItem>
                <SelectItem value="days_no_activity">No Activity for X Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {triggerType === 'sentiment_change' && (
            <div>
              <label className="text-sm font-medium">If Sentiment Is</label>
              <Select value={sentiment} onValueChange={setSentiment}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Action</label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tag">Add Tag</SelectItem>
                <SelectItem value="escalate">Escalate</SelectItem>
                <SelectItem value="assign">Assign to Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {actionType === 'tag' && (
            <div>
              <label className="text-sm font-medium">Tag Name</label>
              <Input
                placeholder="e.g., escalated, follow-up"
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || !description}
            >
              Create Rule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}