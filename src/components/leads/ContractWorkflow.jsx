import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Send, CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Lock } from 'lucide-react';

const CONTRACT_TYPES = ['MOU', 'LOI', 'SPA', 'Tenancy Agreement'];

const NEGOTIATION_STAGES = [
  'objection_offer', 'negotiation_deal_lock', 'closing_dld',
  'contract_cheques', 'ejari_movein',
];

export default function ContractWorkflow({ lead }) {
  const isNegotiationStage = NEGOTIATION_STAGES.includes(lead.stage);

  const [form, setForm] = useState({
    contract_type: lead.intent === 'tenant' ? 'Tenancy Agreement' : 'MOU',
    signer_name: lead.full_name || lead.name || '',
    signer_email: lead.email || '',
    agent_name: lead.assigned_agent_name || '',
    agent_email: lead.assigned_agent_email || '',
    agreed_price_aed: lead.deal_value_aed || '',
    property_id: (lead.ai_recommended_property_ids || [])[0] || '',
    notes: '',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-available'],
    queryFn: () => base44.entities.Property.filter({ status: 'available' }, 'title', 100),
  });

  const send = useMutation({
    mutationFn: () => base44.functions.invoke('generateAndSendContract', {
      lead_id: lead.id,
      property_id: form.property_id || null,
      contract_type: form.contract_type,
      signer_name: form.signer_name,
      signer_email: form.signer_email,
      agent_name: form.agent_name,
      agent_email: form.agent_email,
      agreed_price_aed: Number(form.agreed_price_aed) || null,
      notes: form.notes || null,
    }),
    onSuccess: (res) => { setError(null); setResult(res.data); },
    onError: (err) => setError(err?.response?.data?.error || err.message),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!isNegotiationStage) {
    return (
      <div className="glass-card p-6 text-center">
        <Lock className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm font-semibold text-white/60 mb-1">Not at negotiation stage</p>
        <p className="text-xs text-white/30">
          Contract generation is available once the lead reaches
          the <span className="text-amber-400/70">Objection / Offer</span> stage or later.
        </p>
        <div className="mt-3 jewel-pill jewel-amber inline-flex">
          Current: {lead.stage || 'unknown'}
        </div>
      </div>
    );
  }

  if (result && result.ok) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-5 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-base font-bold text-white/90 mb-1">Contract Sent!</p>
          <p className="text-xs text-white/40 mb-4">
            {result.contract_type} sent via DocuSign &middot; Ref: {result.ref}
          </p>
          <div className="grid grid-cols-2 gap-3 text-left mb-4">
            {[
              { label: 'Contract Type', value: result.contract_type },
              { label: 'Agreed Price', value: result.price },
              { label: 'Status', value: 'Sent for Signature' },
              { label: 'Signers', value: '2 recipients' },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card p-3">
                <p className="text-[10px] text-white/30">{label}</p>
                <p className="text-xs font-semibold text-white/80">{value}</p>
              </div>
            ))}
          </div>
          {result.pdf_url && (
            <a href={result.pdf_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-2 w-full">
                <ExternalLink className="w-3.5 h-3.5" /> View Contract PDF
              </Button>
            </a>
          )}
        </div>
        <Button
          variant="outline" size="sm" className="w-full gap-2"
          onClick={() => { setResult(null); setError(null); }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Send Another Contract
        </Button>
      </div>
    );
  }

  const selectedProp = properties.find(p => p.id === form.property_id);

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">Contract Generator</p>
          <p className="text-[11px] text-white/40">Generate PDF and send via DocuSign in one click</p>
        </div>
        <div className="ml-auto jewel-pill jewel-emerald">DocuSign</div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Contract Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-white/40 block mb-1">Contract Type</label>
            <Select value={form.contract_type} onValueChange={v => set('contract_type', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-white/40 block mb-1">Agreed Price (AED)</label>
            <Input
              type="number"
              value={form.agreed_price_aed}
              onChange={e => set('agreed_price_aed', e.target.value)}
              placeholder="e.g. 2500000"
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-white/40 block mb-1">Property</label>
          <Select value={form.property_id} onValueChange={v => set('property_id', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>No specific property</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}{p.location ? ` · ${p.location}` : ''}{p.price_aed ? ` · AED ${Number(p.price_aed).toLocaleString()}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProp && (
            <p className="text-[10px] text-white/30 mt-1">
              {selectedProp.bedrooms}BR &middot; {selectedProp.area_sqft?.toLocaleString()} sqft &middot; {selectedProp.furnishing}
            </p>
          )}
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Signer (Buyer / Tenant)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-white/40 block mb-1">Full Name *</label>
            <Input value={form.signer_name} onChange={e => set('signer_name', e.target.value)} className="h-9 text-sm" placeholder="Full legal name" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-white/40 block mb-1">Email *</label>
            <Input value={form.signer_email} onChange={e => set('signer_email', e.target.value)} className="h-9 text-sm" placeholder="email@example.com" type="email" />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Agent (Co-signer)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-white/40 block mb-1">Agent Name</label>
            <Input value={form.agent_name} onChange={e => set('agent_name', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-white/40 block mb-1">Agent Email</label>
            <Input value={form.agent_email} onChange={e => set('agent_email', e.target.value)} className="h-9 text-sm" type="email" />
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <label className="text-[10px] font-medium text-white/40 block mb-1">Additional Notes (optional)</label>
        <Textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Special conditions, payment terms, handover date..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <Button
        className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 gap-2"
        onClick={() => send.mutate()}
        disabled={send.isPending || !form.signer_name || !form.signer_email}
      >
        {send.isPending ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Generating and Sending...</>
        ) : (
          <><Send className="w-4 h-4" /> Generate and Send via DocuSign</>
        )}
      </Button>
      <p className="text-[10px] text-white/25 text-center">
        A branded PDF contract will be generated and dispatched to both signers via DocuSign.
      </p>
    </div>
  );
}