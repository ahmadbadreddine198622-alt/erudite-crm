import { useState, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import { base44 } from '@/api/base44Client';
import { X, Eye, MapPin, Phone, Mail, Sparkles, Zap, RefreshCw, Flame, MessageCircle, FileSignature, Loader2, Upload, FileCheck, ExternalLink, Download, FolderOpen, CheckCircle2, Send, ChevronDown, ChevronUp, Camera, Film, Image, MessageSquare, LayoutTemplate, Pencil } from 'lucide-react';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import CommentsThread from "@/components/photography/CommentsThread";

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery',
  listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Photographer Scheduling',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
};
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import PricingPressureMeter from './PricingPressureMeter';
import PortfolioRadar from './PortfolioRadar';
import CoalitionMap from './CoalitionMap';
import WhisperPanel from './WhisperPanel';
import LandlordWhatsAppThread from './LandlordWhatsAppThread';
import UnitPassport from './UnitPassport';
import PreShootForm from './PreShootForm';
import DocumentChecklist from './DocumentChecklist';
import ListingReadiness from './ListingReadiness';
import ListingCopyManager from './ListingCopyManager';
import GroupBlurbGenerator from './GroupBlurbGenerator';
import LandlordIntelligenceTab from './LandlordIntelligenceTab';
import LandlordConversationPanel from './LandlordConversationPanel';

export default function LandlordDetailPanel({ landlord, open, onClose, onUpdate, fullScreenOnMobile = false }) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const useFullDrawer = fullScreenOnMobile && isMobile;
  const [whisperOpen, setWhisperOpen] = useState(false);
  const [formAUploading, setFormAUploading] = useState(false);
  const [floorPlanUploading, setFloorPlanUploading] = useState(false);
  const [floorPlanUrl, setFloorPlanUrl] = useState('');
  const [floorPlanUrlInput, setFloorPlanUrlInput] = useState(false);
  const floorPlanInputRef = useRef(null);
  const [lbaResult, setLbaResult] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [agreementEmailSending, setAgreementEmailSending] = useState(false);
  const formAInputRef = useRef(null);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({});

  const STAGE_OPTIONS = [
    'initial_contact',
    'price_discovery',
    'listing_commitment',
    'form_a_initiation',
    'form_a_signing',
    'owner_documents',
    'photos_videos',
    'photographer_scheduling',
    'listing_creation',
    'internal_verification',
    'listing_publication',
    'final_confirmation',
  ];

  const stageMutation = useMutation({
    mutationFn: (newStage) => base44.entities.Landlord.update(landlord.id, { stage: newStage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      onUpdate?.();
      toast.success('Stage updated');
    },
    onError: (e) => toast.error('Failed to update stage: ' + e.message),
  });

  const sendCustomEmail = async () => {
    if (!emailTo) return toast.error('Please enter a recipient email.');
    if (!emailSubject) return toast.error('Please enter a subject.');
    setEmailSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: emailTo,
        subject: emailSubject,
        body: emailBody,
      });
      toast.success('Email sent');
      setEmailOpen(false);
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
    } catch (err) {
      toast.error('Failed to send: ' + err.message);
    } finally {
      setEmailSending(false);
    }
  };

  const sendAgreementByEmail = async (pdfUrl) => {
    const recipient = landlord.email;
    if (!recipient) return toast.error('Landlord has no email address on record.');
    setAgreementEmailSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: recipient,
        subject: `Lease Brokerage Agreement — ${landlord.full_name_en || landlord.full_name}`,
        body: `Dear ${landlord.full_name_en || landlord.full_name},\n\nPlease find your Lease Brokerage Agreement at the link below:\n\n${pdfUrl}\n\nKind regards,\nErudite Estate`,
      });
      toast.success(`Agreement emailed to ${recipient}`);
    } catch (err) {
      toast.error('Failed to send: ' + err.message);
    } finally {
      setAgreementEmailSending(false);
    }
  };

  const handleFormAUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file only.');
      return;
    }
    setFormAUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Landlord.update(landlord.id, { form_a_pdf_url: file_url });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      onUpdate?.();
      toast.success('Form A uploaded successfully');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setFormAUploading(false);
      if (formAInputRef.current) formAInputRef.current.value = '';
    }
  };

  const handleFloorPlanUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFloorPlanUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.LandlordProperty.update(landlordPropertyId, { floor_plan_url: file_url, has_floor_plan: true });
      queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] });
      toast.success('Floor plan uploaded');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setFloorPlanUploading(false);
      if (floorPlanInputRef.current) floorPlanInputRef.current.value = '';
    }
  };

  const handleFloorPlanUrlSave = async () => {
    if (!floorPlanUrl.trim()) return;
    try {
      await base44.entities.LandlordProperty.update(landlordPropertyId, { floor_plan_url: floorPlanUrl.trim(), has_floor_plan: true });
      queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] });
      setFloorPlanUrlInput(false);
      setFloorPlanUrl('');
      toast.success('Floor plan link saved');
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    }
  };

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord-properties', landlord.id],
    queryFn: async () => {
      const props = await base44.entities.LandlordProperty.filter({ landlord_id: landlord.id });
      return props || [];
    },
    enabled: !!landlord.id,
  });

  const landlordProperty = landlordProperties[0];
  const landlordPropertyId = landlordProperty?.id;

  const { data: photographyTasks = [] } = useQuery({
    queryKey: ['photography-task', landlord.id],
    queryFn: async () => {
      if (!landlordPropertyId) return [];
      const tasks = await base44.entities.PhotographyTask.filter({ landlord_property_id: landlordPropertyId });
      return tasks || [];
    },
    enabled: !!landlordPropertyId,
  });

  const existingTask = photographyTasks[0];

  const assignMutation = useMutation({
    mutationFn: (email) => base44.entities.Landlord.update(landlord.id, { assigned_agent_email: email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      onUpdate?.();
    },
    onError: (e) => toast.error('Assign failed: ' + e.message),
  });

  const photographerMutation = useMutation({
    mutationFn: async (photographerEmail) => {
      if (!landlordPropertyId) {
        throw new Error('No property record found for this landlord');
      }
      if (existingTask) {
        return await base44.entities.PhotographyTask.update(existingTask.id, {
          assigned_photographer_email: photographerEmail,
          assigned_at: new Date().toISOString(),
        });
      } else {
        return await base44.entities.PhotographyTask.create({
          landlord_id: landlord.id,
          landlord_property_id: landlordPropertyId,
          assigned_photographer_email: photographerEmail,
          assigned_at: new Date().toISOString(),
          task_stage: 'inquiry',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photography-task', landlord.id] });
      queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] });
      toast.success('Photographer assigned');
    },
    onError: (e) => toast.error('Failed to assign: ' + e.message),
  });

  const PHOTOGRAPHER_OPTIONS = [
    { email: 'dari@erudite-estate.com', name: 'Dari' },
    { email: 'ahmad.badreddine198622@gmail.com', name: 'Ahmad Badreddine' },
  ];

  const editContactMutation = useMutation({
    mutationFn: (data) => base44.entities.Landlord.update(landlord.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      onUpdate?.();
      setEditContactOpen(false);
      toast.success('Contact updated');
    },
    onError: (e) => toast.error('Failed to save: ' + e.message),
  });

  const orchestrateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true }),
    onSuccess: () => {
      toast.success('Aurora updated this landlord');
      onUpdate?.();
      queryClient.invalidateQueries({ queryKey: ['landlord', landlord.id] });
    },
    onError: (e) => toast.error(`Aurora failed: ${e.message}`)
  });

  const lbaMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateLeaseBrokerageAgreement', { landlord_id: landlord.id }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.skipped) {
        toast.info(data.reason || 'Lease Brokerage Agreement already sent for signature.');
      } else {
        setLbaResult({ pdf_url: data.pdf_url, file_name: data.file_name });
        toast.success('Lease Brokerage Agreement generated');
      }
      onUpdate?.();
      queryClient.invalidateQueries({ queryKey: ['landlord', landlord.id] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
    },
    onError: (e) => toast.error(`Lease Brokerage Agreement failed: ${e.message}`),
  });

  const LBA_STATUS_STYLE = {
    drafted: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
    sent_for_signature: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    signed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    cancelled: 'bg-red-500/10 text-red-600 border-red-500/30',
  };
  const lbaStatus = landlord.lease_agreement_status;

  const renderContent = () => {
    return (
      <>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between gap-4" style={{ background: 'hsl(222 47% 9%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {landlord.ai_strike_now && (
              <Badge className="bg-red-500 text-white border-0 animate-pulse shrink-0">
                <Flame className="w-3 h-3 mr-1" /> STRIKE NOW
              </Badge>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold text-lg truncate" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>
                {landlord.full_name_en || landlord.full_name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {landlord.landlord_archetype?.replace(/_/g, ' ')}
                  {landlord.ai_momentum && ` · ${landlord.ai_momentum}`}
                </p>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
                  {STAGE_LABELS[landlord.stage] || landlord.stage}
                </Badge>
              </div>
            </div>
            <div className="shrink-0">
              <Select value={landlord.stage} onValueChange={(value) => stageMutation.mutate(value)} disabled={stageMutation.isPending}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((stage) => (
                    <SelectItem key={stage} value={stage} className="text-xs">
                      {STAGE_LABELS[stage] || stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <TwilioCallDialog
              lead={{ id: landlord.id, phone: landlord.phone, full_name: landlord.full_name_en || landlord.full_name }}
              size="icon"
              iconOnly
            />
            <Button variant="ghost" size="icon" title="Send Email" onClick={() => { setEmailOpen(!emailOpen); setEmailTo(landlord.email || ''); setEmailSubject(''); setEmailBody(''); }}>
              <Mail className={`w-4 h-4 ${emailOpen ? 'text-accent' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="icon" title="Run Aurora" onClick={() => orchestrateMutation.mutate()} disabled={orchestrateMutation.isPending}>
              <RefreshCw className={`w-4 h-4 ${orchestrateMutation.isPending ? 'animate-spin text-accent' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="icon" title="Whisper Mode" onClick={() => setWhisperOpen(!whisperOpen)}>
              <Sparkles className={`w-4 h-4 ${whisperOpen ? 'text-violet-400' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </div>

        {/* Lease Brokerage Agreement */}
        <div className="px-6 py-3 flex items-center justify-between gap-2 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: '0.68rem' }}>Lease Brokerage Agreement</span>
            {lbaStatus && (
              <Badge variant="outline" className={`text-xs border ${LBA_STATUS_STYLE[lbaStatus] || ''}`}>
                {lbaStatus.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {landlord.lease_pdf_url && (
              <button
                onClick={() => sendAgreementByEmail(landlord.lease_pdf_url)}
                disabled={agreementEmailSending}
                title="Email the agreement PDF to the owner"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {agreementEmailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-blue-400" />}
                Email
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => lbaMutation.mutate()}
              disabled={lbaMutation.isPending}
              className="gap-1.5"
              title={
                lbaStatus === 'sent_for_signature' || lbaStatus === 'signed'
                  ? 'Already sent — regeneration is blocked by the idempotency guard'
                  : 'Generate the Lease Brokerage Agreement and send to the owner via DocuSign'
              }
            >
              {lbaMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileSignature className="w-3.5 h-3.5" />}
              {lbaStatus === 'signed' ? 'Signed' : lbaStatus === 'sent_for_signature' ? 'Sent for signature' : 'Generate Agreement'}
            </Button>
          </div>
        </div>

        {/* Custom Email Compose Panel */}
        {emailOpen && (
          <div className="px-6 py-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-accent" /> Send Email</p>
            <input
              type="email"
              placeholder="To (email)"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-md glass-input"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
            <input
              type="text"
              placeholder="Subject"
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-md"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
            <textarea
              placeholder="Message body…"
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              rows={4}
              className="w-full px-2 py-1.5 text-xs rounded-md resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEmailOpen(false)} className="text-xs">Cancel</Button>
              <Button size="sm" variant="outline" onClick={sendCustomEmail} disabled={emailSending} className="gap-1.5 text-xs">
                {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send
              </Button>
            </div>
          </div>
        )}

        {/* Form A Contracts List */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <FileCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-display)' }}>Form A Contracts</span>
          </div>
          {(() => {
            const contracts = Array.isArray(landlord.form_a_contracts) && landlord.form_a_contracts.length > 0
              ? landlord.form_a_contracts
              : (landlord.form_a_contract_number ? [{
                  contract_number: landlord.form_a_contract_number,
                  unit: landlord.unit_reference || null,
                  pdf_url: landlord.form_a_pdf_url || null,
                  mandate_type: landlord.mandate_type || null,
                  mandate_status: landlord.mandate_status || null,
                  mandate_start_date: landlord.mandate_start_date || null,
                  mandate_expires_at: landlord.mandate_expires_at || null,
                  asking_price_aed: landlord.asking_price_aed || null,
                }] : []);
            
            if (contracts.length === 0) {
              return <p className="text-xs text-muted-foreground">No Form A contracts on record</p>;
            }
            
            return (
              <div className="space-y-2">
                {contracts.map((contract, idx) => (
                  <div
                    key={contract.contract_number || idx}
                    className="p-2.5 rounded-lg border"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-accent truncate" style={{ color: 'hsl(38 92% 55%)' }}>
                          {contract.contract_number || 'Unknown'}
                        </p>
                        {contract.unit && (
                          <p className="text-xs text-muted-foreground mt-0.5">Unit: {contract.unit}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {contract.pdf_url && (
                          <>
                            <a
                              href={contract.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
                              title="View PDF"
                            >
                              <Eye className="w-3 h-3" /> View
                            </a>
                            <a
                              href={(() => {
                                const url = contract.pdf_url || '';
                                const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                                if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
                                return url;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                      {contract.mandate_type && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs px-2 py-1 border-amber-500/30 text-amber-400 bg-amber-500/10">
                            {contract.mandate_type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      )}
                      {contract.mandate_status && (
                        <div className="text-xs text-muted-foreground">
                          Status: <span className={
                            contract.mandate_status === 'form_a_signed' ? 'text-emerald-500 font-semibold' :
                            contract.mandate_status === 'expired' ? 'text-red-500 font-semibold' :
                            contract.mandate_status === 'cancelled' ? 'text-slate-500 font-semibold' : 'text-amber-400 font-semibold'
                          }>{contract.mandate_status.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {contract.mandate_expires_at && (
                        <div className="text-xs text-muted-foreground">
                          Expires: <span className="text-foreground font-medium">{new Date(contract.mandate_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                      {contract.asking_price_aed && (
                        <div className="text-xs text-accent font-semibold">
                          AED {(contract.asking_price_aed / 1000000).toFixed(2)}M
                        </div>
                      )}
                      {(() => {
                        const commissionPct = contract.commission_pct_negotiated || landlord.commission_pct_negotiated;
                        if (!commissionPct || !contract.asking_price_aed) return null;
                        const commissionAmount = contract.asking_price_aed * (commissionPct / 100);
                        return (
                          <div className="text-xs" style={{ color: 'hsl(38 92% 55%)', fontWeight: 600 }}>
                            Commission: {commissionPct}% · AED {commissionAmount.toLocaleString('en-US')}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* LBA result card */}
        {lbaResult?.pdf_url && (
          <div className="px-6 py-4 space-y-2" style={{ background: 'rgba(16,185,129,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-emerald-400">Agreement generated</span>
              <button onClick={() => setLbaResult(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            {lbaResult.file_name && (
              <p className="text-xs text-muted-foreground truncate pl-6">{lbaResult.file_name}</p>
            )}
            <div className="flex flex-wrap gap-2 pl-6">
              <a
                href={lbaResult.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> View in Drive
              </a>
              <a
                href={(() => {
                  const url = lbaResult.pdf_url || '';
                  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
                  return url;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-accent" /> Download PDF
              </a>
              <button
                onClick={() => sendAgreementByEmail(lbaResult.pdf_url)}
                disabled={agreementEmailSending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {agreementEmailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-blue-400" />}
                Email to Owner
              </button>
            </div>
          </div>
        )}

        {/* Whisper Panel */}
        {whisperOpen && (
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(139,92,246,0.04)' }}>
            <WhisperPanel
              landlord={landlord}
              recentMessages={[]}
              onClose={() => setWhisperOpen(false)}
            />
          </div>
        )}

        {/* Listing Readiness */}
        <ListingReadiness
          landlord={landlord}
          landlordPropertyId={landlordPropertyId}
          photographyTask={existingTask}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick Info */}
          <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Edit Contact */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>Contact Info</p>
              <button
                onClick={() => {
                  setContactForm({
                    full_name_en: landlord.full_name_en || '',
                    phone: landlord.phone || '',
                    whatsapp: landlord.whatsapp || '',
                    email: landlord.email || '',
                  });
                  setEditContactOpen(!editContactOpen);
                }}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
                style={{ color: editContactOpen ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.55)' }}
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>

            {editContactOpen && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {[
                  { key: 'full_name_en', label: 'Name', type: 'text', placeholder: 'Full name (EN)' },
                  { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+971…' },
                  { key: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '+971… (if different)' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'email@example.com' },
                ].map(({ key, label, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={contactForm[key] || ''}
                      onChange={(e) => setContactForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs rounded-md"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setEditContactOpen(false)} className="text-xs px-2.5 py-1 rounded-md border border-white/15 hover:bg-white/8 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                  <button
                    onClick={() => editContactMutation.mutate(contactForm)}
                    disabled={editContactMutation.isPending}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                    style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)', fontWeight: 600 }}
                  >
                    {editContactMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span>{landlord.phone || 'No phone'}</span>
              {landlord.phone && (
                <TwilioCallDialog
                  lead={{ id: landlord.id, phone: landlord.phone, full_name: landlord.full_name_en || landlord.full_name }}
                  size="sm"
                  iconOnly={false}
                />
              )}
            </div>
            {landlord.additional_phones && landlord.additional_phones.length > 0 && (
              <div className="space-y-2 pl-6">
                {landlord.additional_phones.map((altPhone, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <a
                      href={`tel:${altPhone}`}
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {altPhone}
                    </a>
                    <a
                      href={`https://wa.me/${altPhone.startsWith('+') ? altPhone.slice(1) : altPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline"
                      title="Open WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span>{landlord.email || 'No email'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span>{landlord.residence_country || 'Unknown'}</span>
            </div>
            {landlord.project_name && (
              <div className="flex items-center gap-2">
                <ProjectBadge name={landlord.project_name} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Assigned Agent</p>
                <select
                  value={landlord.assigned_agent_email || ''}
                  onChange={(e) => assignMutation.mutate(e.target.value)}
                  disabled={assignMutation.isPending}
                  className="w-full px-2 py-1 text-xs rounded-md"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Photographer Assignment */}
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Photographer</p>
                {landlordProperty ? (
                  <>
                    <select
                      value={existingTask?.assigned_photographer_email || ''}
                      onChange={(e) => photographerMutation.mutate(e.target.value)}
                      disabled={photographerMutation.isPending}
                      className="w-full px-2 py-1 text-xs rounded-md"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
                    >
                      <option value="">Unassigned</option>
                      {PHOTOGRAPHER_OPTIONS.map(p => (
                        <option key={p.email} value={p.email}>{p.name}</option>
                      ))}
                    </select>
                    {existingTask && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {photographerMutation.isPending ? 'Saving...' : `Assigned to ${existingTask.assigned_photographer_email?.split('@')[0]}`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">No property linked</p>
                )}
              </div>
            </div>

            {/* Pre-shoot Form */}
            {existingTask && landlordProperty && (
              <div className="pt-2">
                <PreShootForm
                  photographyTask={existingTask}
                  landlordProperty={landlordProperty}
                />
              </div>
            )}

            {/* Floor Plan Upload (agent) */}
            {landlordProperty && (
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <LayoutTemplate className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>Floor Plan</p>
                    {landlordProperty.floor_plan_url && (
                      <a
                        href={landlordProperty.floor_plan_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <input ref={floorPlanInputRef} type="file" className="hidden" onChange={handleFloorPlanUpload} />
                    <button
                      onClick={() => floorPlanInputRef.current?.click()}
                      disabled={floorPlanUploading || !landlordPropertyId}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      {floorPlanUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {landlordProperty.floor_plan_url ? 'Replace' : 'Upload'}
                    </button>
                    <button
                      onClick={() => setFloorPlanUrlInput(!floorPlanUrlInput)}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
                    >
                      Link
                    </button>
                  </div>
                </div>
                {floorPlanUrlInput && (
                  <div className="flex gap-1.5 mt-1">
                    <input
                      type="url"
                      placeholder="Paste floor plan URL…"
                      value={floorPlanUrl}
                      onChange={(e) => setFloorPlanUrl(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs rounded-md"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                    />
                    <button
                      onClick={handleFloorPlanUrlSave}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Media for listing */}
            {existingTask && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>Media for listing</p>
                  {(() => {
                    const isHandedToListing = existingTask.task_stage === 'handed_to_listing';
                    const hasAllLinks = existingTask.tour_3d_link && existingTask.video_link && existingTask.photos_link;
                    const isComplete = isHandedToListing && hasAllLinks;
                    
                    return (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0.5 ${
                          isComplete
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {isComplete ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                            Media complete
                          </>
                        ) : (
                          <>
                            <Camera className="w-2.5 h-2.5 mr-1" />
                            Media incomplete
                          </>
                        )}
                      </Badge>
                    );
                  })()}
                </div>
                
                <div className="space-y-1.5 pl-1">
                  {existingTask?.tour_3d_link && (
                    <a
                      href={existingTask.tour_3d_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <ExternalLink className="w-3 h-3" />
                      3D Tour
                    </a>
                  )}
                  {existingTask?.video_link && (
                    <a
                      href={existingTask.video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <Film className="w-3 h-3" />
                      <ExternalLink className="w-3 h-3" />
                      Video
                    </a>
                  )}
                  {existingTask?.photos_link && (
                    <a
                      href={existingTask.photos_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <Image className="w-3 h-3" />
                      <ExternalLink className="w-3 h-3" />
                      Photos
                    </a>
                  )}
                  {landlordProperty?.floor_plan_url && (
                    <a
                      href={landlordProperty.floor_plan_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <LayoutTemplate className="w-3 h-3" />
                      <ExternalLink className="w-3 h-3" />
                      Floor Plan
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Comments thread */}
            {existingTask && landlordProperty && (
              <div className="pt-2 border-t border-white/10">
                <CommentsThread
                  photographyTaskId={existingTask.id}
                  landlordPropertyId={landlordProperty.id}
                />
              </div>
            )}
          </div>

          {/* Conversation + AI Insights */}
          <LandlordConversationPanel landlord={landlord} />

          {/* Metrics Grid */}
          <div className="px-6 py-5 grid grid-cols-4 gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Trust Score', value: landlord.trust_score || 0 },
              { label: 'Responsiveness', value: landlord.responsiveness_score || 0 },
              { label: 'Mandate Win', value: landlord.mandate_win_probability ? `${(landlord.mandate_win_probability * 100).toFixed(0)}%` : '—' },
              { label: 'Urgency', value: landlord.urgency_score || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.38)', letterSpacing: '0.07em' }}>{label}</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="px-6 py-5">
            <TabsList className="grid w-full grid-cols-5 mb-5">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="unit" className="text-xs">Unit</TabsTrigger>
              <TabsTrigger value="negotiation" className="text-xs">Negotiation</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Mandate Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{landlord.mandate_status || 'none'}</Badge>
                  {landlord.mandate_expires_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Expires: {new Date(landlord.mandate_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display font-semibold flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.82)' }}>
                    Form A / Mandate PDF
                    {landlord.form_a_pdf_url && (
                      <Badge variant="outline" className="text-xs border bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1">
                        <FileCheck className="w-3 h-3" /> Attached
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {landlord.form_a_pdf_url && (
                    <a
                      href={landlord.form_a_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View uploaded Form A
                    </a>
                  )}
                  <input
                    ref={formAInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFormAUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => formAInputRef.current?.click()}
                    disabled={formAUploading}
                    className="gap-1.5 w-full"
                  >
                    {formAUploading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Upload className="w-3.5 h-3.5" />}
                    {formAUploading ? 'Uploading…' : landlord.form_a_pdf_url ? 'Replace Form A PDF' : 'Upload Form A (PDF)'}
                  </Button>
                </CardContent>
              </Card>

              <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Red Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  {landlord.red_flags && landlord.red_flags.length > 0 ? (
                    <div className="space-y-1">
                      {landlord.red_flags.map((flag, i) => (
                        <Badge key={i} variant="destructive" className="text-xs block w-fit">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No red flags</p>
                  )}
                </CardContent>
              </Card>

              <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Rapport Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{landlord.rapport_level || 'cold'}</Badge>
                </CardContent>
              </Card>

              <CoalitionMap landlord={landlord} />
              <PortfolioRadar landlord={landlord} />
            </TabsContent>

            <TabsContent value="unit" className="space-y-3">
              <UnitPassport landlordId={landlord.id} />
              <div
                className="rounded-xl p-4 border"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <ListingCopyManager
                  landlordId={landlord.id}
                  landlordPropertyId={landlordPropertyId}
                  landlordProperty={landlordProperty}
                />
              </div>
              <div
                className="rounded-xl p-4 border"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <GroupBlurbGenerator landlordId={landlord.id} />
              </div>
            </TabsContent>

            <TabsContent value="negotiation" className="space-y-4">
              <PricingPressureMeter landlord={landlord} />

              <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Commission</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 55%)' }}>
                    {landlord.commission_pct_negotiated ? `${landlord.commission_pct_negotiated}%` : 'Not negotiated'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Est. Revenue: AED {landlord.estimated_commission_aed?.toLocaleString() || '0'}
                  </p>
                </CardContent>
              </Card>

              <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Asking Price</CardTitle>
                </CardHeader>
                <CardContent>
                  {landlord.asking_price_history && landlord.asking_price_history.length > 0 ? (
                    <>
                      <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 55%)' }}>
                        AED {landlord.asking_price_history[0].price?.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {landlord.asking_price_history.length} price update(s)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No price set</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-2">
              <DocumentChecklist landlordId={landlord.id} />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              {landlord.ai_rolling_summary && (
                <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.7' }}>{landlord.ai_rolling_summary}</p>
                  </CardContent>
                </Card>
              )}

              {landlord.ai_next_best_action && (
                <Card style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display font-semibold" style={{ color: 'hsl(38 92% 60%)' }}>Next Best Action</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{landlord.ai_next_best_action.action}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{landlord.ai_next_best_action.reasoning}</p>
                  </CardContent>
                </Card>
              )}

              {landlord.ai_coaching_for_agent && (
                <Card style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display font-semibold" style={{ color: 'rgb(167,139,250)' }}>Agent Coaching</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.7' }}>{landlord.ai_coaching_for_agent}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>


          </Tabs>
        </div>
      </>
    );
  };

  // Render mobile drawer or desktop sheet
  if (useFullDrawer) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent className="h-full max-h-full">
          {renderContent()}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:max-w-[1100px] overflow-y-auto p-0">
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}