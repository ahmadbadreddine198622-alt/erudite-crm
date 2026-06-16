import React, { useState, useMemo } from 'react';
import { FileText, Search, Filter, FileSignature, Loader2, PenLine, ExternalLink, ChevronRight, ChevronLeft, Trash2, Info, X, Upload, AlertTriangle, Download } from 'lucide-react';
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
import { useCurrentUser } from '@/lib/useCurrentUser';

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

  const { data: checklistItems = [] } = useQuery({
    queryKey: ['checklist-lease-pdfs'],
    queryFn: () => base44.entities.DocumentChecklistItem.filter({ document_type: 'lease_brokerage_agreement' }),
  });

  const checklistUrlMap = useMemo(() => {
    const map = {};
    for (const item of checklistItems) {
      if (item.landlord_id && item.file_url) map[item.landlord_id] = item.file_url;
    }
    return map;
  }, [checklistItems]);

  // Calls the Deno function. Accepts either:
  //   - a landlord_id string (Auto path — function pulls every field from records)
  //   - a full payload object { landlord_id, ...overrides } (Manual path)
  // The function applies override > record > null precedence on every field,
  // and keeps its idempotency guard for both paths (skips if status is already
  // sent_for_signature/signed unless force=true).
  const generateMutation = useMutation({
    mutationFn: (arg) => {
      const payload = typeof arg === 'string' ? { landlord_id: arg } : arg;
      return base44.functions.invoke('generateLeaseBrokerageAgreement', payload);
    },
    onSuccess: (res) => {
      const data = res?.data ?? res;
      const pdfUrl = data?.pdf_url || data?.pdfUrl;
      const landlordId = typeof generateMutation.variables === 'string'
        ? generateMutation.variables
        : generateMutation.variables?.landlord_id;
      if (pdfUrl && landlordId) {
        setPdfUrls(prev => ({ ...prev, [landlordId]: pdfUrl }));
        // Show inline PDF viewer (avoids browser popup blocking)
        const landlordName = landlords.find(l => l.id === landlordId)?.full_name_en || 'Agreement';
        setPdfViewer({ url: pdfUrl, name: landlordName });
        toast.success('Agreement generated — PDF ready');
      } else if (data?.skipped) {
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
  const [formStep, setFormStep] = useState('form'); // 'form' | 'review'
  const [pdfUrls, setPdfUrls] = useState({}); // landlordId → pdfUrl
  const [pdfViewer, setPdfViewer] = useState(null); // { url, name }
  const [summaryLandlord, setSummaryLandlord] = useState(null);

  // ── Title Deed Import state ──────────────────────────────────────────────
  const { user: currentUser } = useCurrentUser();
  const [deedDragOver, setDeedDragOver] = useState(false);
  const [deedUploading, setDeedUploading] = useState(false);
  const [deedExtracted, setDeedExtracted] = useState(null);
  const [deedReviewOpen, setDeedReviewOpen] = useState(false);
  const [deedForm, setDeedForm] = useState({ owner_name: '', property_type: '', location: '', building_name: '', unit_no: '', area_sqft: '' });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Landlord.update(id, { lease_agreement_status: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords-lease'] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      toast.success('Agreement removed');
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  // ── Title Deed handlers ──────────────────────────────────────────────────
  const PROP_TYPE_MAP = { 'flat': 'apartment', 'apartment': 'apartment', 'villa': 'villa', 'townhouse': 'townhouse', 'office': 'office', 'commercial': 'commercial', 'land': 'land' };

  const processDeedFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted');
      return;
    }
    setDeedUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes?.file_url || uploadRes?.data?.file_url;
      if (!fileUrl) throw new Error('Upload failed — no file URL returned');
      const parseRes = await base44.functions.invoke('parseTitleDeed', { file_url: fileUrl });
      const data = parseRes?.data ?? parseRes;
      if (!data?.ok) {
        toast.error(data?.error || 'Title Deed parsing failed');
        return;
      }
      const p = data.property || {};
      const mappedType = PROP_TYPE_MAP[(p.propertyType || '').toLowerCase()] || '';

      setDeedForm({
        owner_name: p.ownerName || '',
        property_type: mappedType,
        location: p.community || '',
        building_name: p.buildingName || '',
        unit_no: p.propertyNo || '',
        area_sqft: p.areaSqft || '',
      });
      setDeedExtracted({ ...data, property: p });
      setDeedReviewOpen(true);
    } catch (err) {
      toast.error('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeedUploading(false);
    }
  };

  const handleDeedDrop = (e) => {
    e.preventDefault();
    setDeedDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processDeedFile(file);
  };

  const handleDeedBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) processDeedFile(file);
    };
    input.click();
  };

  const deedCreateMutation = useMutation({
    mutationFn: () => {
      const rp = deedExtracted?.property || {};
      const refNotes = [
        rp.floorNo && `Floor: ${rp.floorNo}`,
        rp.plotNo && `Plot: ${rp.plotNo}`,
        rp.municipalityNo && `Municipality: ${rp.municipalityNo}`,
        rp.parkings && `Parking: ${rp.parkings}`,
        rp.areaSqm && `Area SQM: ${rp.areaSqm}`,
        rp.mortgageStatus && `Mortgage: ${rp.mortgageStatus}`,
        rp.ownerIdNumber && `Owner ID: ${rp.ownerIdNumber}`,
        rp.purchasedFrom && `Purchased from: ${rp.purchasedFrom}`,
        rp.certificateNo && `Certificate: ${rp.certificateNo}`,
        rp.issueDate && `Issue Date: ${rp.issueDate}`,
      ].filter(Boolean);
      return base44.entities.Landlord.create({
        full_name_en: deedForm.owner_name,
        phone: '',
        source: 'other',
        stage: 'initial_contact',
        assigned_agent_email: currentUser?.email || '',
        lease_agreement_status: 'drafted',
        project_name: deedForm.building_name || rp.buildingName || '',
        unit_reference: deedForm.unit_no || rp.propertyNo || '',
        notes_internal: refNotes.length > 0 ? 'Imported from Title Deed.\n' + refNotes.join('\n') : 'Imported from Title Deed.',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords-lease'] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      toast.success('Draft agreement created from Title Deed');
      setDeedReviewOpen(false);
      setDeedExtracted(null);
    },
    onError: (e) => toast.error('Failed to create draft: ' + e.message),
  });

  const handleDownloadPdf = async (landlord) => {
    const pdfUrl = pdfUrls[landlord.id] || landlord.lease_pdf_url || checklistUrlMap[landlord.id];
    if (!pdfUrl) return;
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `LeaseAgreement-${(landlord.full_name_en || 'landlord').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error('Download failed: ' + e.message);
    }
  };

  const openManual = (landlord) => {
    const init = Object.fromEntries(MANUAL_FIELDS.map((k) => [k, '']));
    init.owner_name  = landlord.full_name_en || '';
    init.owner_email = landlord.email || '';
    init.owner_phone = landlord.phone || '';
    init.passport_no = landlord.passport_no || '';
    setManualForm(init);
    setFormStep('form');
    setManualForLandlord(landlord);
  };

  const updateManual = (k, v) => setManualForm((m) => ({ ...m, [k]: v }));

  const submitManual = () => {
    if (!manualForLandlord) return;
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

      {/* ── Title Deed Import Drop Zone ── */}
      <div
        className={`mb-4 p-6 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          deedDragOver
            ? 'border-accent bg-accent/10'
            : 'border-white/15 hover:border-white/30 bg-white/[0.03]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDeedDragOver(true); }}
        onDragLeave={() => setDeedDragOver(false)}
        onDrop={handleDeedDrop}
        onClick={handleDeedBrowse}
      >
        {deedUploading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <div>
              <p className="text-sm font-medium text-white/80">Extracting Title Deed data…</p>
              <p className="text-xs text-white/40 mt-0.5">AI is reading the DLD certificate</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/80">Import from Title Deed</p>
              <p className="text-xs text-white/40 mt-0.5">Drop a DLD Title Deed PDF here or click to browse</p>
            </div>
          </div>
        )}
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
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Summary"
                        onClick={() => setSummaryLandlord(landlord)}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </Button>
                      {(pdfUrls[landlord.id] || landlord.lease_pdf_url || checklistUrlMap[landlord.id]) && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-accent hover:text-accent" title="View PDF" onClick={() => setPdfViewer({ url: pdfUrls[landlord.id] || landlord.lease_pdf_url || checklistUrlMap[landlord.id], name: landlord.full_name_en })}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-white/60 hover:text-white"
                        title={pdfUrls[landlord.id] || landlord.lease_pdf_url || checklistUrlMap[landlord.id] ? 'Download PDF' : 'Generate first'}
                        onClick={() => handleDownloadPdf(landlord)}
                        disabled={!(pdfUrls[landlord.id] || landlord.lease_pdf_url || checklistUrlMap[landlord.id])}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Remove agreement status"
                        onClick={() => { if (confirm('Remove this landlord\'s agreement status?')) deleteMutation.mutate(landlord.id); }}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* ── PDF Viewer Dialog ── */}
      <Dialog open={!!pdfViewer} onOpenChange={(o) => !o && setPdfViewer(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b border-white/10 flex-row items-center justify-between">
            <DialogTitle className="text-sm font-medium">{pdfViewer?.name} — Lease Brokerage Agreement</DialogTitle>
            <div className="flex items-center gap-2">
              <a href={pdfViewer?.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                  <ExternalLink className="w-3 h-3" /> Open in tab
                </Button>
              </a>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPdfViewer(null)}><X className="w-3.5 h-3.5" /></Button>
            </div>
          </DialogHeader>
          {pdfViewer?.url && (
            <iframe
              src={pdfViewer.url.replace(/\/view(\?.*)?$/, '/preview')}
              className="flex-1 w-full border-0"
              title="Lease Agreement PDF"
              allow="autoplay"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Summary Dialog ── */}
      <Dialog open={!!summaryLandlord} onOpenChange={(o) => !o && setSummaryLandlord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agreement Summary</DialogTitle>
            <DialogDescription>{summaryLandlord?.full_name_en}</DialogDescription>
          </DialogHeader>
          {summaryLandlord && (
            <div className="space-y-1">
              {[
                ['Full Name', summaryLandlord.full_name_en],
                ['Email', summaryLandlord.email],
                ['Phone', summaryLandlord.phone],
                ['Passport No.', summaryLandlord.passport_no],
                ['Nationality', summaryLandlord.nationality],
                ['Source', summaryLandlord.source],
                ['Mandate', summaryLandlord.mandate_type],
                ['Agreement Status', summaryLandlord.lease_agreement_status?.replace(/_/g, ' ')],
                ['Stage', summaryLandlord.stage?.replace(/_/g, ' ')],
                ['Assigned Agent', summaryLandlord.assigned_agent_email],
              ].filter(([, v]) => v).map(([label, value], i) => (
                <div key={label} className={`flex justify-between px-3 py-2 rounded text-sm ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                  <span className="text-white/50">{label}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
              {(pdfUrls[summaryLandlord.id] || summaryLandlord.lease_pdf_url || checklistUrlMap[summaryLandlord.id]) && (
                <div className="pt-3">
                  <a href={pdfUrls[summaryLandlord.id] || summaryLandlord.lease_pdf_url || checklistUrlMap[summaryLandlord.id]} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="w-full gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> View Generated PDF
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual override dialog */}
      <Dialog open={!!manualForLandlord} onOpenChange={(o) => !o && setManualForLandlord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formStep === 'form' ? 'Generate with manual overrides' : 'Review & Confirm'}
            </DialogTitle>
            <DialogDescription>
              {formStep === 'form'
                ? 'Edit any field below. Leave blank to use the landlord / linked-property record.'
                : 'Review the data below before generating the agreement.'}
            </DialogDescription>
          </DialogHeader>

          {formStep === 'form' ? (
            <div className="space-y-5 py-2">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Owner</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Full Name</Label><Input value={manualForm.owner_name || ''} onChange={(e) => updateManual('owner_name', e.target.value)} placeholder="Owner name" /></div>
                  <div className="space-y-1"><Label className="text-xs">Passport No.</Label><Input value={manualForm.passport_no || ''} onChange={(e) => updateManual('passport_no', e.target.value)} placeholder="Passport number" /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={manualForm.owner_email || ''} onChange={(e) => updateManual('owner_email', e.target.value)} placeholder="owner@example.com" /></div>
                  <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={manualForm.owner_phone || ''} onChange={(e) => updateManual('owner_phone', e.target.value)} placeholder="+971…" /></div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Broker (Erudite Agent)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Agent Name</Label><Input value={manualForm.agent_name || ''} onChange={(e) => updateManual('agent_name', e.target.value)} placeholder="Blank = use User record" /></div>
                  <div className="space-y-1"><Label className="text-xs">BRN</Label><Input value={manualForm.brn || ''} onChange={(e) => updateManual('brn', e.target.value)} placeholder="Broker Registration No." /></div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Property</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Property Type</Label>
                    <select value={manualForm.property_type || ''} onChange={(e) => updateManual('property_type', e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      {PROPERTY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Unit No.</Label><Input value={manualForm.unit_no || ''} onChange={(e) => updateManual('unit_no', e.target.value)} placeholder="Blank = use Property record" /></div>
                  <div className="space-y-1"><Label className="text-xs">Building / Community</Label><Input value={manualForm.building_name || ''} onChange={(e) => updateManual('building_name', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={manualForm.location || ''} onChange={(e) => updateManual('location', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">View</Label><Input value={manualForm.view || ''} onChange={(e) => updateManual('view', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Area (sqft)</Label><Input type="number" value={manualForm.area_sqft || ''} onChange={(e) => updateManual('area_sqft', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Bedrooms</Label><Input type="number" value={manualForm.bedrooms || ''} onChange={(e) => updateManual('bedrooms', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Bathrooms</Label><Input type="number" value={manualForm.bathrooms || ''} onChange={(e) => updateManual('bathrooms', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Price (AED)</Label><Input type="number" value={manualForm.price_aed || ''} onChange={(e) => updateManual('price_aed', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Rent (AED)</Label><Input type="number" value={manualForm.rent_aed || ''} onChange={(e) => updateManual('rent_aed', e.target.value)} /></div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Contract Term</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="text" placeholder="2026-06-01" value={manualForm.contract_start || ''} onChange={(e) => updateManual('contract_start', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">End Date</Label><Input type="text" placeholder="2027-06-01" value={manualForm.contract_end || ''} onChange={(e) => updateManual('contract_end', e.target.value)} /></div>
                </div>
                <p className="text-[10px] text-white/40 mt-1.5">Both blank ⇒ default 12 months from today.</p>
              </section>
            </div>
          ) : (
            /* ── REVIEW STEP ─────────────────────────────────────── */
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-white/10 overflow-hidden">
                {[
                  { label: 'Owner', value: manualForm.owner_name },
                  { label: 'Passport No.', value: manualForm.passport_no },
                  { label: 'Email', value: manualForm.owner_email },
                  { label: 'Phone', value: manualForm.owner_phone },
                  { label: 'Agent', value: manualForm.agent_name },
                  { label: 'BRN', value: manualForm.brn },
                  { label: 'Property Type', value: manualForm.property_type },
                  { label: 'Unit No.', value: manualForm.unit_no },
                  { label: 'Building', value: manualForm.building_name },
                  { label: 'Location', value: manualForm.location },
                  { label: 'Area (sqft)', value: manualForm.area_sqft },
                  { label: 'Bedrooms', value: manualForm.bedrooms },
                  { label: 'Price (AED)', value: manualForm.price_aed },
                  { label: 'Rent (AED)', value: manualForm.rent_aed },
                  { label: 'Contract Start', value: manualForm.contract_start },
                  { label: 'Contract End', value: manualForm.contract_end },
                ].filter(r => r.value).map((row, i) => (
                  <div key={row.label} className={`flex justify-between px-4 py-2 text-sm ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                    <span className="text-white/50">{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40">Fields not shown above will be pulled automatically from the linked landlord / property records.</p>
              <p className="text-xs text-amber-400/80">📁 PDF will be saved to Google Drive → <strong>Lease Agreements/</strong></p>
            </div>
          )}

          <DialogFooter>
            {formStep === 'form' ? (
              <>
                <Button variant="outline" onClick={() => setManualForLandlord(null)}>Cancel</Button>
                <Button onClick={() => setFormStep('review')} className="gap-1.5">
                  Review <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setFormStep('form')} className="gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <Button onClick={submitManual} disabled={generateMutation.isPending} className="gap-1.5">
                  {generateMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <FileSignature className="w-3.5 h-3.5" />}
                  Generate Agreement
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Title Deed Review Modal ── */}
      <Dialog open={deedReviewOpen} onOpenChange={(o) => { if (!o) { setDeedReviewOpen(false); setDeedExtracted(null); } }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Review Extracted Title Deed
            </DialogTitle>
            <DialogDescription>
              Review and edit the extracted fields before creating a draft agreement.
            </DialogDescription>
          </DialogHeader>

          {deedExtracted && (
            <div className="space-y-5 py-2">
              {/* Warnings */}
              {deedExtracted.warnings?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {deedExtracted.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-300/80">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable OWNER */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Owner</h3>
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    value={deedForm.owner_name || ''}
                    onChange={(e) => setDeedForm(f => ({ ...f, owner_name: e.target.value }))}
                    placeholder="Owner name"
                  />
                </div>
              </section>

              {/* Editable PROPERTY */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Property</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Property Type</Label>
                    <select
                      value={deedForm.property_type || ''}
                      onChange={(e) => setDeedForm(f => ({ ...f, property_type: e.target.value }))}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {PROPERTY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit No.</Label>
                    <Input value={deedForm.unit_no || ''} onChange={(e) => setDeedForm(f => ({ ...f, unit_no: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Building / Community</Label>
                    <Input value={deedForm.building_name || ''} onChange={(e) => setDeedForm(f => ({ ...f, building_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Location</Label>
                    <Input value={deedForm.location || ''} onChange={(e) => setDeedForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Area (sqft)</Label>
                    <Input value={deedForm.area_sqft || ''} onChange={(e) => setDeedForm(f => ({ ...f, area_sqft: e.target.value }))} />
                  </div>
                </div>
              </section>

              {/* Read-only REFERENCE */}
              {deedExtracted.property && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Reference (read-only)</h3>
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    {[
                      ['Floor No.', deedExtracted.property.floorNo],
                      ['Plot No.', deedExtracted.property.plotNo],
                      ['Municipality No.', deedExtracted.property.municipalityNo],
                      ['Parkings', deedExtracted.property.parkings],
                      ['Area (sqm)', deedExtracted.property.areaSqm],
                      ['Mortgage Status', deedExtracted.property.mortgageStatus],
                      ['Owner ID Number', deedExtracted.property.ownerIdNumber],
                      ['Purchased From', deedExtracted.property.purchasedFrom],
                      ['Certificate No.', deedExtracted.property.certificateNo],
                      ['Issue Date', deedExtracted.property.issueDate],
                    ].filter(([, v]) => v).map(([label, value], i) => (
                      <div key={label} className={`flex justify-between px-3 py-2 text-sm ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                        <span className="text-white/40 text-xs">{label}</span>
                        <span className="text-white/70 text-xs font-medium text-right max-w-[60%] truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {deedExtracted.note && (
                <p className="text-xs text-white/40 italic">ℹ {deedExtracted.note}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeedReviewOpen(false); setDeedExtracted(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => deedCreateMutation.mutate()}
              disabled={deedCreateMutation.isPending || !deedForm.owner_name?.trim()}
              className="gap-1.5"
            >
              {deedCreateMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileSignature className="w-3.5 h-3.5" />}
              Create Draft Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}