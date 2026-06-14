import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';

const SOURCE_OPTIONS = [
  ['website', 'Website'],
  ['property_finder', 'Property Finder'],
  ['bayut', 'Bayut'],
  ['dubizzle', 'Dubizzle'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['google_ads', 'Google Ads'],
  ['referral', 'Referral'],
  ['walk_in', 'Walk-in'],
  ['cold_call', 'Cold Call'],
  ['event', 'Event'],
  ['whatsapp_campaign', 'WhatsApp Campaign'],
  ['other', 'Other'],
];

const LANG_OPTIONS = [
  ['en', 'English'],
  ['ar', 'Arabic'],
  ['fr', 'French'],
  ['ru', 'Russian'],
  ['zh', 'Chinese'],
  ['hi', 'Hindi'],
  ['ur', 'Urdu'],
  ['fa', 'Farsi'],
];

const INITIAL = {
  full_name: '',
  phone: '',
  whatsapp: '',
  email: '',
  preferred_language: 'en',
  intent: 'buyer',
  status: 'active',
  source: 'website',
  assigned_agent_email: '',
  deal_value_aed: '',
  project_id: '',
};

export default function AddLeadDialog({ open, onClose }) {
  const [form, setForm] = useState(INITIAL);
  const [dupWarning, setDupWarning] = useState(null); // { id, full_name, stage }
  const [validationErrors, setValidationErrors] = useState({});
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
    enabled: open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    staleTime: 120_000,
    enabled: open,
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setDupWarning(null);
      setValidationErrors({});
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      onClose();
    },
  });

  // Soft phone dedup check
  const checkDup = async (phone) => {
    if (!phone || phone.length < 7) { setDupWarning(null); return; }
    const existing = await base44.entities.Lead.filter({ phone }, '-created_date', 1).catch(() => []);
    if (existing.length > 0) {
      setDupWarning(existing[0]);
    } else {
      setDupWarning(null);
    }
  };

  const set = (field) => (valOrEvent) => {
    const value = valOrEvent?.target !== undefined ? valOrEvent.target.value : valOrEvent;
    setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    setForm(f => ({ ...f, [field]: value }));
  };

  const validate = () => {
    const errors = {};
    if (!form.phone && !form.email) errors.phone = 'Phone or email is required';
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }

    const payload = {
      full_name: form.full_name || 'Unknown',
      phone: form.phone || undefined,
      whatsapp: form.whatsapp || undefined,
      email: form.email || undefined,
      preferred_language: form.preferred_language,
      intent: form.intent,
      status: form.status,
      source: form.source,
      assigned_agent_email: form.assigned_agent_email || undefined,
      deal_value_aed: form.deal_value_aed ? Number(form.deal_value_aed) : undefined,
      project_id: form.project_id || undefined,
      stage: 'contact_identity',
      stage_entered_at: new Date().toISOString(),
    };
    // strip undefined
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          {/* Soft dedup warning */}
          {dupWarning && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'hsl(38 92% 60%)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                A lead with this number already exists: <strong>{dupWarning.full_name || 'Unknown'}</strong> ({dupWarning.stage}).
                {' '}You can still create a new one.
              </span>
            </div>
          )}

          {/* Full name */}
          <div>
            <Label className="text-xs">Full Name</Label>
            <Input
              value={form.full_name}
              onChange={set('full_name')}
              placeholder="e.g. John Smith (optional)"
              className="mt-1"
            />
          </div>

          {/* Phone + WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Phone *</Label>
              <Input
                value={form.phone}
                onChange={set('phone')}
                onBlur={e => checkDup(e.target.value)}
                placeholder="+971 50 123 4567"
                className={`mt-1 ${validationErrors.phone ? 'border-red-400' : ''}`}
              />
              {validationErrors.phone && <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>}
            </div>
            <div>
              <Label className="text-xs">WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={set('whatsapp')}
                placeholder="+971 50 123 4567"
                className="mt-1"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              value={form.email}
              onChange={set('email')}
              type="email"
              placeholder="john@email.com"
              className="mt-1"
            />
          </div>

          {/* Intent + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Intent</Label>
              <Select value={form.intent} onValueChange={set('intent')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={form.preferred_language} onValueChange={set('preferred_language')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANG_OPTIONS.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={form.source} onValueChange={set('source')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={set('status')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned agent */}
          <div>
            <Label className="text-xs">Assigned Agent</Label>
            <Select value={form.assigned_agent_email} onValueChange={set('assigned_agent_email')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>— Unassigned —</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Deal value + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Deal Value (AED)</Label>
              <Input
                type="number"
                value={form.deal_value_aed}
                onChange={set('deal_value_aed')}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Project</Label>
              <Select value={form.project_id} onValueChange={set('project_id')}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Creating…</>
                : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}