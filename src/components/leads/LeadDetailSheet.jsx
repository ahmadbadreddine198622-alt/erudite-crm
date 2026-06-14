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
  Phone, Mail, MapPin, Calendar, MessageSquare, Send, Clock, Pencil, Trash2, Download, UserCheck, Briefcase, Link2
} from 'lucide-react';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import LinkToListingDialog from '@/components/leads/LinkToListingDialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import LeadScoreBadge from '@/components/shared/LeadScoreBadge';
import SourceBadge from '@/components/shared/SourceBadge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import { formatAED, LEAD_TYPE_LABELS } from '@/lib/constants';
import { getStagesForIntent } from '@/lib/pipeline';
import LeadWhatsAppTab from '@/components/whatsapp/LeadWhatsAppTab';
import LeadScorePanel from '@/components/leads/LeadScorePanel';
import LeadPropertyMatches from '@/components/leads/LeadPropertyMatches';
import ContractWorkflow from '@/components/leads/ContractWorkflow';
import ScheduleViewingDialog from '@/components/leads/ScheduleViewingDialog';
import LeadAISummary from '@/components/leads/LeadAISummary';
import VoiceMemoButton from '@/components/leads/VoiceMemoButton';
import UniversalWhatsAppAction from '@/components/shared/UniversalWhatsAppAction';
import WhatsAppPopup from '@/components/whatsapp/WhatsAppPopup';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import CallLogPanel from '@/components/twilio/CallLogPanel';
import LeadNotesTab from '@/components/leads/LeadNotesTab';
import FormFUpload from '@/components/leads/FormFUpload';
import FormFParsePanel from '@/components/leads/FormFParsePanel';
import LeadFinancePanel from '@/components/leads/LeadFinancePanel';
import IntentToggle from '@/components/leads/IntentToggle';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';

export default function LeadDetailSheet({ lead, open, onClose }) {
  const { getPhotoForPhone } = usePhotoByPhone();
  const leadPhotoUrl = getPhotoForPhone(lead.phone || lead.whatsapp);
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('details');
  const [leadFormFUrl, setLeadFormFUrl] = useState(lead.form_f_url || null);
  const queryClient = useQueryClient();

  const primaryPhone = lead.phone;

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    staleTime: 120_000,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', lead.id],
    queryFn: () => base44.entities.Activity.filter({ lead_id: lead.id }, '-created_date', 50),
    enabled: !!lead.id,
  });

  const [savedIndicator, setSavedIndicator] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.update(lead.id, data),
    onSuccess: () => {
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    },
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

  // Intent changes are handled by IntentToggle (sets both intent + stage correctly).

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
      <SheetContent side="left" className="w-full sm:max-w-4xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4" style={{ borderBottom: '2px solid rgba(245,159,10,0.2)' }}>
          <div className="flex items-center gap-3">
            {leadPhotoUrl ? (
              <img src={leadPhotoUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-white/20" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            ) : null}
            <div className={cn('w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-xl font-bold text-accent', leadPhotoUrl ? 'hidden' : 'flex')}>
              {lead.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={lead.full_name || ''}
                  placeholder="Full name"
                  className="text-lg font-semibold bg-transparent border-b border-transparent hover:border-accent/40 focus:border-accent focus:outline-none text-foreground w-full transition-colors"
                  onBlur={(e) => { if (e.target.value !== (lead.full_name || '')) updateMutation.mutate({ full_name: e.target.value }); }}
                />
                {savedIndicator && (
                  <span className="text-[10px] font-semibold text-emerald-400 shrink-0 animate-pulse">Saved ✓</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
              <SourceBadge source={lead.source} />
              <LeadScoreBadge score={lead.lead_score} />
              {lead.type && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {LEAD_TYPE_LABELS[lead.type] || lead.type}
                </Badge>
              )}
              <IntentToggle lead={lead} size="md" />
              </div>
              {/* Stage quick-change */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage:</span>
                <Select
                  value={stagesForIntent.find(s => s.key === lead.stage) ? lead.stage : ''}
                  onValueChange={(v) => updateMutation.mutate({ stage: v, stage_entered_at: new Date().toISOString() })}
                >
                  <SelectTrigger className="h-6 text-xs px-2 py-0 border-accent/40 text-accent bg-accent/10 rounded-full w-auto min-w-[140px]">
                    <SelectValue placeholder={lead.stage || 'Set stage'} />
                  </SelectTrigger>
                  <SelectContent>
                    {stagesForIntent.map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex-1">
          <TabsList className="w-full rounded-none border-b bg-transparent h-10 px-6 justify-start gap-4">
            <TabsTrigger value="details" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">Details</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">
              💬 WhatsApp
            </TabsTrigger>
            <TabsTrigger value="contract" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">
              📝 Contract
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">
              🏠 Matches
            </TabsTrigger>
            <TabsTrigger value="score" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">
              🎯 Score
            </TabsTrigger>
            <TabsTrigger value="calls" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">
              📞 Calls
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">📋 Notes</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-foreground bg-transparent shadow-none px-0">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="p-6 space-y-5 mt-0" key={lead.id}>

            {/* AI Summary */}
            <LeadAISummary lead={lead} />

            {/* Ownership & Value */}
            <section>
              <div className="flex items-center gap-1.5 mb-3">
                <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ownership {'&'} Value</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Assigned Agent</label>
                  <Select
                    value={lead.assigned_agent_email || ''}
                    onValueChange={(v) => {
                      const u = users.find(u => u.email === v);
                      updateMutation.mutate({ assigned_agent_email: v, assigned_agent_name: u?.full_name || v });
                    }}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="— Unassigned —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— Unassigned —</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Deal Value (AED)</label>
                    <Input
                      type="number"
                      defaultValue={lead.deal_value_aed || ''}
                      placeholder="0"
                      className="mt-1 h-9 text-sm"
                      onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== (lead.deal_value_aed || 0)) updateMutation.mutate({ deal_value_aed: v }); }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Next Appointment</label>
                    <input
                      type="datetime-local"
                      defaultValue={lead.next_appointment_at ? lead.next_appointment_at.slice(0, 16) : ''}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      onBlur={(e) => {
                        const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                        if (v !== (lead.next_appointment_at || null)) updateMutation.mutate({ next_appointment_at: v });
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Contact */}
            <section>
              <div className="flex items-center gap-1.5 mb-3">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</span>
              </div>
              <div className="space-y-3">
                {lead.phone && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-foreground">{lead.phone}</span>
                    </div>
                    <UniversalWhatsAppAction
                      phone={lead.phone}
                      name={lead.full_name}
                      leadId={lead.id}
                      size="sm"
                      disabled={lead.do_not_contact}
                      disabledReason={lead.do_not_contact ? 'Lead is opted out of contact' : undefined}
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Email</label>
                  <Input
                    defaultValue={lead.email || ''}
                    placeholder="email@example.com"
                    className="mt-1 h-9 text-sm"
                    onBlur={(e) => { if (e.target.value !== (lead.email || '')) updateMutation.mutate({ email: e.target.value }); }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Company</label>
                    <Input
                      defaultValue={lead.company || ''}
                      placeholder="Company name"
                      className="mt-1 h-9 text-sm"
                      onBlur={(e) => { if (e.target.value !== (lead.company || '')) updateMutation.mutate({ company: e.target.value }); }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Position</label>
                    <Input
                      defaultValue={lead.position || ''}
                      placeholder="Job title"
                      className="mt-1 h-9 text-sm"
                      onBlur={(e) => { if (e.target.value !== (lead.position || '')) updateMutation.mutate({ position: e.target.value }); }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Pipeline */}
            <section>
              <div className="flex items-center gap-1.5 mb-3">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</span>
              </div>
              {projects.length > 0 && (
                <div className="mb-3">
                  <label className="text-[10px] font-medium text-muted-foreground">Project</label>
                  <Select
                    value={lead.project_id || ''}
                    onValueChange={(v) => updateMutation.mutate({ project_id: v || null })}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="— No project —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— No project —</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
                <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Intent</label>
                  <Select value={lead.intent || 'unknown'} onValueChange={(v) => updateMutation.mutate({ intent: v })}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Status</label>
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
              <div className="mt-3">
                <label className="text-[10px] font-medium text-muted-foreground">Stage</label>
                <Select
                  value={stageInTrack ? lead.stage : ''}
                  onValueChange={(v) => updateMutation.mutate({ stage: v, stage_entered_at: new Date().toISOString() })}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder={stageLabel}>{stageLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stagesForIntent.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Tags */}
            <section>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(lead.tags || []).map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {tag}
                    <button
                      onClick={() => updateMutation.mutate({ tags: (lead.tags || []).filter((t) => t !== tag) })}
                      className="hover:text-destructive leading-none"
                    >{String.fromCharCode(215)}</button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim().replace(/,/g, '');
                      if (!lead.tags?.includes(newTag)) updateMutation.mutate({ tags: [...(lead.tags || []), newTag] });
                      setTagInput('');
                    }
                  }}
                  placeholder="+ Add tag"
                  className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-border bg-transparent focus:outline-none focus:border-accent w-20"
                />
              </div>
            </section>

            {/* Finance */}
            <LeadFinancePanel
              lead={lead}
              onUpdate={(data) => updateMutation.mutate(data)}
            />

            {/* Notes */}
            <section>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
              <Textarea
                defaultValue={lead.notes || ''}
                placeholder="Add notes about this lead..."
                className="mt-2 text-sm resize-none"
                rows={4}
                onBlur={(e) => { if (e.target.value !== (lead.notes || '')) updateMutation.mutate({ notes: e.target.value }); }}
              />
            </section>

          </TabsContent>

          <TabsContent value="contract" className="p-4 mt-0 space-y-4">
            <FormFUpload
              lead={{ ...lead, form_f_url: leadFormFUrl }}
              onUpdated={(url) => setLeadFormFUrl(url)}
            />
            {leadFormFUrl && (
              <FormFParsePanel
                lead={{ ...lead, form_f_url: leadFormFUrl }}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
              />
            )}
            <ContractWorkflow lead={lead} />
          </TabsContent>

          <TabsContent value="matches" className="p-4 mt-0">
            <LeadPropertyMatches lead={lead} />
          </TabsContent>

          <TabsContent value="score" className="p-4 mt-0">
            <LeadScorePanel lead={lead} />
          </TabsContent>

          <TabsContent value="whatsapp" className="p-4 mt-0">
            <LeadWhatsAppTab lead={lead} />
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <LeadNotesTab lead={lead} />
          </TabsContent>

          <TabsContent value="calls" className="p-4 mt-0">
            <div className="flex justify-end mb-3">
              <TwilioCallDialog lead={lead} />
            </div>
            <CallLogPanel leadId={lead.id} />
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
        <div className="border-t p-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveDetailTab('whatsapp')}
            disabled={!primaryPhone}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <MessageSquare className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <TwilioCallDialog lead={lead} />
          <VoiceMemoButton lead={lead} />
          <ScheduleViewingDialog 
            lead_id={lead.id} 
            lead_name={lead.full_name}
            property_title={lead.interested_properties?.[0] || 'Property'}
          />
          <LinkToListingDialog
            lead={lead}
            trigger={
              <Button variant="outline" size="sm" className="text-amber-500 hover:text-amber-600 hover:bg-amber-50/10">
                <Link2 className="w-4 h-4 mr-1" /> Link to Listing
              </Button>
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportVCF}
          >
            <Download className="w-4 h-4 mr-1" /> Export VCF
          </Button>
          {lead.stage === 'closing_dld' && (
            <SendToClosingButton
              leadId={lead.id}
              propertyRef={lead.closing_property_ref}
              projectId={lead.closing_project_id}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm('Delete this lead?')) deleteMutation.mutate(); }}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete Lead
          </Button>
        </div>

        {/* WhatsApp Popup */}
        <WhatsAppPopup
          isOpen={showWhatsAppPopup}
          onClose={() => setShowWhatsAppPopup(false)}
          phone={primaryPhone}
          leadId={lead.id}
          leadName={lead.full_name}
        />
      </SheetContent>
    </Sheet>
  );
}