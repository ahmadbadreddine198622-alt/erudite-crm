import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Phone, Mail, MapPin, Calendar, MessageSquare, Send, Clock, Pencil, Trash2, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import LeadScoreBadge from '@/components/shared/LeadScoreBadge';
import SourceBadge from '@/components/shared/SourceBadge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import { formatAED, LEAD_TYPE_LABELS } from '@/lib/constants';
import { getStagesForIntent } from '@/lib/pipeline';
import LeadWhatsAppTab from '@/components/whatsapp/LeadWhatsAppTab';
import ScheduleViewingDialog from '@/components/leads/ScheduleViewingDialog';

export default function LeadDetailSheet({ lead, open, onClose }) {
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', lead.id],
    queryFn: () => base44.entities.Activity.filter({ lead_id: lead.id }, '-created_date', 50),
    enabled: !!lead.id,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.update(lead.id, data),
    // Optimistic update: patch the cached leads array immediately so Select
    // inputs reflect the change before the server round-trip completes.
    onMutate: async (data) => {
      const keys = [['leads'], ['pipeline-leads']];
      await Promise.all(keys.map((k) => queryClient.cancelQueries({ queryKey: k })));
      const snapshots = keys.map((k) => [k, queryClient.getQueryData(k)]);
      for (const [key] of snapshots) {
        queryClient.setQueryData(key, (old) =>
          Array.isArray(old) ? old.map((l) => (l.id === lead.id ? { ...l, ...data } : l)) : old,
        );
      }
      return { snapshots };
    },
    onError: (err, vars, context) => {
      if (context && context.snapshots) {
        for (const [key, prev] of context.snapshots) {
          queryClient.setQueryData(key, prev);
        }
      }
      const detail = (err && (err.response?.data?.message || err.response?.data?.error || err.message)) || String(err);
      console.error('LeadDetailSheet update failed:', { error: err, attempted: vars, response: err?.response?.data });
      toast.error('Update failed: ' + detail);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    },
  });

  // Intent change resets the lead to the first stage of the new track,
  // refreshes stage_entered_at so it appears as a brand-new entry.
  const handleIntentChange = (newIntent) => {
    const resetStage =
      newIntent === 'buyer' ? 'new_buyer_lead'
      : newIntent === 'tenant' ? 'new_tenant_lead'
      : 'intake_clarify';
    updateMutation.mutate({
      intent: newIntent,
      stage: resetStage,
      stage_entered_at: new Date().toISOString(),
    });
  };

  // Stages available in the lead's current track. Used to drive the Stage select
  // AND to detect when the lead's persisted stage is outside the current track
  // (legacy pre-backfill leads), so we can render a defensive fallback label.
  const stagesForIntent = getStagesForIntent(lead.intent || 'unknown');
  const stageInTrack = stagesForIntent.find((s) => s.key === lead.stage);
  const stageLabel = stageInTrack ? stageInTrack.label : (lead.stage || 'Select stage');

  const addNoteMutation = useMutation({
    mutationFn: (data) => base44.entities.Activity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] });
      setNote('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Lead.delete(lead.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
  });

  const exportVCF = () => {
    const nameParts = (lead.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${lead.name || ''}`,
      `N:${lastName};${firstName};;;`,
      lead.phone ? `TEL;TYPE=CELL:${lead.phone}` : null,
      lead.email ? `EMAIL:${lead.email}` : null,
      lead.nationality ? `NOTE:Nationality: ${lead.nationality}\\nSource: ${lead.source || 'CRM'}\\nType: ${lead.type || ''}\\nBudget: ${lead.budget_aed ? 'AED ' + lead.budget_aed.toLocaleString() : ''}\\nStage: ${lead.stage || ''}` : null,
      'END:VCARD',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([lines], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lead.name || 'contact'}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNoteMutation.mutate({
      lead_id: lead.id,
      type: 'note',
      title: 'Note added',
      description: note,
    });
  };

  const activityIcons = {
    note: MessageSquare,
    call: Phone,
    email: Mail,
    viewing: MapPin,
    stage_change: Calendar,
    system: Clock,
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-lg font-bold text-accent">
              {lead.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <SheetTitle className="text-lg">{lead.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <SourceBadge source={lead.source} />
                <LeadScoreBadge score={lead.lead_score} />
                {lead.type && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {LEAD_TYPE_LABELS[lead.type] || lead.type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1">
          <TabsList className="w-full rounded-none border-b bg-transparent h-10 px-6 justify-start gap-4">
            <TabsTrigger value="details" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">Details</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">
              💬 WhatsApp
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="p-6 space-y-4 mt-0">
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-muted/50">
                  <Phone className="w-4 h-4 text-accent shrink-0" />
                  <WhatsAppPhone
                    phone={lead.phone}
                    name={lead.name}
                    leadId={lead.id}
                    size="sm"
                    disabled={lead.do_not_contact}
                    disabledReason={lead.do_not_contact ? 'Lead is opted out of contact' : undefined}
                  />
                </div>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Mail className="w-4 h-4 text-accent" />
                  <span className="truncate">{lead.email}</span>
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Intent</label>
                <Select value={lead.intent || 'unknown'} onValueChange={handleIntentChange}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                <Select value={lead.status || 'active'} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Stage</label>
                <Select
                  value={stageInTrack ? lead.stage : ''}
                  onValueChange={(v) =>
                    updateMutation.mutate({ stage: v, stage_entered_at: new Date().toISOString() })
                  }
                >
                  <SelectTrigger className="mt-1 h-9">
                    {/* Defensive fallback: render raw stage if it's not in the current track's stage list */}
                    <SelectValue placeholder={stageLabel}>{stageLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stagesForIntent.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Budget</label>
                <p className="text-sm font-semibold mt-2">{formatAED(lead.budget_aed)}</p>
              </div>
            </div>
            {lead.tags?.length > 0 && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tags</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {lead.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {lead.notes && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
                <p className="text-sm text-muted-foreground mt-1">{lead.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="whatsapp" className="p-4 mt-0">
            <LeadWhatsAppTab lead={lead} />
          </TabsContent>

          <TabsContent value="activity" className="p-6 mt-0">
            <div className="flex gap-2 mb-4">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                className="h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <Button size="sm" onClick={handleAddNote} disabled={!note.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90 h-9">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {activities.map(act => {
                const Icon = activityIcons[act.type] || MessageSquare;
                return (
                  <div key={act.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{act.title}</p>
                      {act.description && <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {act.created_date && format(new Date(act.created_date), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="border-t p-4 flex gap-2">
          <ScheduleViewingDialog 
            lead_id={lead.id} 
            lead_name={lead.name}
            property_title={lead.interested_properties?.[0] || 'Property'}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportVCF}
          >
            <Download className="w-4 h-4 mr-1" /> Export VCF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm('Delete this lead?')) deleteMutation.mutate(); }}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete Lead
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}