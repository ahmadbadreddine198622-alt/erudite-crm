import React, { useState } from 'react';
import { FileText, Search, Filter, FileSignature, Loader2, PenLine } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// Property type values must match the enum the PDF renders as checkboxes.
const PROPERTY_TYPE_OPTIONS = [
  { value: '',           label: '— Use record —' },
  { value: 'apartment',  label: 'Apartment' },
  { value: 'villa',      label: 'Villa' },
  { value: 'townhouse',  label: 'Townhouse' },
  { value: 'office',     label: 'Office' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land',       label: 'Land' },
];

// All form fields — used both for state init and for the submit-payload sweep.
// Keep in sync with the function's override surface in entry.ts.
const MANUAL_FIELDS = [
  'owner_name', 'owner_email', 'owner_phone', 'passport_no',
  'agent_name', 'brn',
  'property_type', 'location', 'building_name', 'unit_no', 'view',
  'bedrooms', 'bathrooms', 'area_sqft', 'price_aed', 'rent_aed',
  'contract_start', 'contract_end',
];

export default function LeaseAgreement() {
  const queryClient = useQueryClient();

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['landlords-lease'],
    queryFn: () => base44.entities.Landlord.list('-created_date', 100),
  });

  // Calls the Deno function. Accepts either:
  //   - a landlord_id string (Auto path — function pulls every field from records)
  //   - a full payload object { landlord_id, ...overrides } (Manual path)
  // The function applies override > record > null precedence on every field,
  // and keeps its idempotency guard for both paths (skips if status is already
  // sent_for_signature/signed unless force=true).
  const generateMutation = useMutation({
    mutationFn: (arg) => {
      const payload = typeof arg === 'string' ? { landlord_id: arg } : arg;
      return base44.functions.generateLeaseBrokerageAgreement(payload);
    },
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.skipped) {
        toast.info(data.reason || 'Already sent for signature.');
      } else {
        toast.success('Lease Brokerage Agreement sent for signature');
      }
      queryClient.invalidateQueries({ queryKey: ['landlords-lease'] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      setManualForLandlord(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  // Pending-id check works for both call shapes.
  const pendingId = typeof generateMutation.variables === 'string'
    ? generateMutation.variables
    : generateMutation.variables?.landlord_id;

  // ── Manual form state ───────────────────────────────────────────────────
  const [manualForLandlord, setManualForLandlord] = useState(null);
  const [manualForm, setManualForm] = useState({});

  const openManual = (landlord) => {
    // Per spec: pre-fill only from the landlord record. Property / agent
    // fields stay blank so the function falls back to the linked records,
    // and the user only types what they want to override.
    const init = Object.fromEntries(MANUAL_FIELDS.map((k) => [k, '']));
    init.owner_name  = landlord.full_name_en || '';
    init.owner_email = landlord.email || '';
    init.owner_phone = landlord.phone || '';
    init.passport_no = landlord.passport_no || '';
    setManualForm(init);
    setManualForLandlord(landlord);
  };

  const updateManual = (k, v) => setManualForm((m) => ({ ...m, [k]: v }));

  const submitManual = () => {
    if (!manualForLandlord) return;
    // Only forward fields the user actually filled in. Empty strings fall
    // through to record on the server (override > record > null).
    const payload = { landlord_id: manualForLandlord.id };
    for (const k of MANUAL_FIELDS) {
      const v = manualForm[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        payload[k] = v;
      }
    }
    generateMutation.mutate(payload);
  };

  const leaseStatusColors = {
    drafted: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    sent_for_signature: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    signed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  // Show landlords that already have an agreement status set (the actual
  // "lease agreements" we manage from this page). If none exist yet, fall
  // back to the most-recent landlords so per-row Generate buttons remain
  // reachable — otherwise the page is permanently empty until somebody
  // generates one from a landlord detail panel first.
  const landlordsWithLease = landlords.filter(l => l.lease_agreement_status);
  const listingLandlords = landlordsWithLease.length > 0 ? landlordsWithLease : landlords;

  return (
    <div className="page-root">
      <div className="mb-8">
        <h1 className="page-title text-3xl mb-1">Lease Brokerage Agreement</h1>
        <p className="page-subtitle">Manage and generate lease agreements for landlords</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Total Landlords</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{landlords.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Drafted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {landlords.filter(l => l.lease_agreement_status === 'drafted').length}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Sent for Signature</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
              {landlords.filter(l => l.lease_agreement_status === 'sent_for_signature').length}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Signed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: 'hsl(152 69% 40%)' }}>
              {landlords.filter(l => l.lease_agreement_status === 'signed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Landlord Agreements</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Search className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-white/40">Loading...</div>
          ) : listingLandlords.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 text-white/20" />
              <p className="text-white/40 text-sm">No landlords yet</p>
              <p className="text-white/30 text-xs mt-1">Add a landlord to generate an agreement</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listingLandlords.map(landlord => {
                const status = landlord.lease_agreement_status;
                // Idempotency guard mirrors the server side — disable the
                // button when we know the function will reject the call.
                const locked = status === 'sent_for_signature' || status === 'signed';
                const buttonLabel = !status ? 'Generate'
                  : status === 'sent_for_signature' ? 'Sent'
                  : status === 'signed' ? 'Signed'
                  : status === 'cancelled' ? 'Regenerate'
                  : 'Regenerate';
                const isThisPending = generateMutation.isPending && pendingId === landlord.id;
                return (
                  <div
                    key={landlord.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-white/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{landlord.full_name_en}</p>
                        <p className="text-xs text-white/40 truncate">{landlord.passport_no || 'No passport on file'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status && (
                        <Badge className={leaseStatusColors[status] || ''}>
                          {status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openManual(landlord)}
                        disabled={locked || generateMutation.isPending}
                        className="gap-1.5"
                        title={
                          locked
                            ? `Already ${status.replace(/_/g, ' ')} — idempotency guard blocks regeneration`
                            : 'Edit fields before generating — overrides win over the landlord record.'
                        }
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Manual
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateMutation.mutate(landlord.id)}
                        disabled={isThisPending || locked || generateMutation.isPending}
                        className="gap-1.5"
                        title={
                          locked
                            ? `Already ${status.replace(/_/g, ' ')} — idempotency guard blocks regeneration`
                            : 'Generate Lease Brokerage Agreement and send to owner via DocuSign'
                        }
                      >
                        {isThisPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <FileSignature className="w-3.5 h-3.5" />}
                        {buttonLabel}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual override dialog — opens via per-row "Manual" button. Empty fields
          fall back to the linked record on the server. Submit calls the same
          generateLeaseBrokerageAgreement function as Auto, with overrides. */}
      <Dialog open={!!manualForLandlord} onOpenChange={(o) => !o && setManualForLandlord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate with manual overrides</DialogTitle>
            <DialogDescription>
              Edit any field below to override what the function would auto-pull.
              Leave fields blank to use the landlord / linked-property record. Owner fields
              pre-filled from the landlord; property + agent fields blank (use record on submit).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* OWNER */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Owner</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={manualForm.owner_name || ''} onChange={(e) => updateManual('owner_name', e.target.value)} placeholder="Owner name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Passport No.</Label>
                  <Input value={manualForm.passport_no || ''} onChange={(e) => updateManual('passport_no', e.target.value)} placeholder="Passport number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={manualForm.owner_email || ''} onChange={(e) => updateManual('owner_email', e.target.value)} placeholder="owner@example.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={manualForm.owner_phone || ''} onChange={(e) => updateManual('owner_phone', e.target.value)} placeholder="+971…" />
                </div>
              </div>
            </section>

            {/* AGENT (BROKER) */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Broker (Erudite Agent)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Agent Name</Label>
                  <Input value={manualForm.agent_name || ''} onChange={(e) => updateManual('agent_name', e.target.value)} placeholder="Blank = use User record" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">BRN</Label>
                  <Input value={manualForm.brn || ''} onChange={(e) => updateManual('brn', e.target.value)} placeholder="Broker Registration No." />
                </div>
              </div>
            </section>

            {/* PROPERTY */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Property</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Property Type</Label>
                  <select
                    value={manualForm.property_type || ''}
                    onChange={(e) => updateManual('property_type', e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {PROPERTY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit No.</Label>
                  <Input value={manualForm.unit_no || ''} onChange={(e) => updateManual('unit_no', e.target.value)} placeholder="Blank = use Property record" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Building / Community</Label>
                  <Input value={manualForm.building_name || ''} onChange={(e) => updateManual('building_name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <Input value={manualForm.location || ''} onChange={(e) => updateManual('location', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">View</Label>
                  <Input value={manualForm.view || ''} onChange={(e) => updateManual('view', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Area (sqft)</Label>
                  <Input type="number" value={manualForm.area_sqft || ''} onChange={(e) => updateManual('area_sqft', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bedrooms</Label>
                  <Input type="number" value={manualForm.bedrooms || ''} onChange={(e) => updateManual('bedrooms', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bathrooms</Label>
                  <Input type="number" value={manualForm.bathrooms || ''} onChange={(e) => updateManual('bathrooms', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (AED)</Label>
                  <Input type="number" value={manualForm.price_aed || ''} onChange={(e) => updateManual('price_aed', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rent (AED)</Label>
                  <Input type="number" value={manualForm.rent_aed || ''} onChange={(e) => updateManual('rent_aed', e.target.value)} />
                </div>
              </div>
            </section>

            {/* CONTRACT TERM */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Contract Term</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={manualForm.contract_start || ''} onChange={(e) => updateManual('contract_start', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={manualForm.contract_end || ''} onChange={(e) => updateManual('contract_end', e.target.value)} />
                </div>
              </div>
              <p className="text-[10px] text-white/40 mt-1.5">Both blank ⇒ default 12 months from today.</p>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualForLandlord(null)} disabled={generateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitManual} disabled={generateMutation.isPending} className="gap-1.5">
              {generateMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileSignature className="w-3.5 h-3.5" />}
              Generate Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}