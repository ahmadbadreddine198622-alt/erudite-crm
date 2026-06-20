import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import { base44 } from '@/api/base44Client';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';
import { X, Eye, MapPin, Phone, Mail, Sparkles, Zap, RefreshCw, Flame, MessageCircle, FileSignature, Loader2, Upload, FileCheck, ExternalLink, Download, FolderOpen, CheckCircle2, Send, ChevronDown, ChevronUp, Camera, Film, Image, Mic } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import AircallButton from '@/components/shared/AircallButton';
import CommentsThread from "@/components/photography/CommentsThread";
import ListingNotesThread from './ListingNotesThread';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import PricingPressureMeter from './PricingPressureMeter';
import PortfolioRadar from './PortfolioRadar';
import CoalitionMap from './CoalitionMap';
import WhisperPanel from './WhisperPanel';
import LandlordWhatsAppPanel from './LandlordWhatsAppPanel';
import LandlordSMSPanel from './LandlordSMSPanel';
import UnitPassport from './UnitPassport';
import PreShootForm from './PreShootForm';
import DocumentChecklist from './DocumentChecklist';
import ListingReadiness from './ListingReadiness';
import ListingCopyManager from './ListingCopyManager';
import GroupBlurbGenerator from './GroupBlurbGenerator';
import LandlordIntelligenceTab from './LandlordIntelligenceTab';
import FormAContractsList from './FormAContractsList';
import MarketIntelligencePanel from './MarketIntelligencePanel';
import CallQualificationTab from './CallQualificationTab';
import CallQualificationSummaryPanel from './CallQualificationSummaryPanel';
import OutreachChecklistPanel from './OutreachChecklistPanel';
import LandlordCallHistory from './LandlordCallHistory';
import VapiCallDialog from '@/components/vapi/VapiCallDialog';
import AICoachingCard from './AICoachingCard';
import ConversationTimeline from './ConversationTimeline';
import ActivityInputBar from './ActivityInputBar';

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

const STAGE_OPTIONS = Object.keys(STAGE_LABELS);

export default function LandlordDetailPanel({ landlord, open, onClose, onUpdate, fullScreenOnMobile = false }) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const useFullDrawer = fullScreenOnMobile && isMobile;
  const { getPhotoForPhone } = usePhotoByPhone();
  const photoUrl = getPhotoForPhone(landlord.phone || landlord.whatsapp);
  const [whisperOpen, setWhisperOpen] = useState(false);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
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
  const [mediaOpen, setMediaOpen] = useState(true);
  const [notesInternal, setNotesInternal] = useState(landlord.notes_internal || '');
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    setNotesInternal(landlord.notes_internal || '');
  }, [landlord.notes_internal]);

  const stageMutation = useMutation({
    mutationFn: (newStage) => base44.entities.Landlord.update(landlord.id, { stage: newStage }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landlords'] }); onUpdate?.(); toast.success('Stage updated'); },
    onError: (e) => toast.error('Failed to update stage: ' + e.message),
  });

  const sendCustomEmail = async () => {
    if (!emailTo) return toast.error('Please enter a recipient email.');
    if (!emailSubject) return toast.error('Please enter a subject.');
    setEmailSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
      toast.success('Email sent');
      setEmailOpen(false); setEmailTo(''); setEmailSubject(''); setEmailBody('');
    } catch (err) { toast.error('Failed to send: ' + err.message); }
    finally { setEmailSending(false); }
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
    } catch (err) { toast.error('Failed to send: ' + err.message); }
    finally { setAgreementEmailSending(false); }
  };

  const handleFormAUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') { toast.error('Please select a PDF file only.'); return; }
    setFormAUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Landlord.update(landlord.id, { form_a_pdf_url: file_url });
      queryClient.invalidateQueries({ queryKey: ['landlords'] }); onUpdate?.(); toast.success('Form A uploaded successfully');
    } catch (err) { toast.error('Upload failed: ' + err.message); }
    finally { setFormAUploading(false); if (formAInputRef.current) formAInputRef.current.value = ''; }
  };

  const handleFloorPlanUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFloorPlanUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.LandlordProperty.update(landlordPropertyId, { floor_plan_url: file_url, has_floor_plan: true });
      queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] }); toast.success('Floor plan uploaded');
    } catch (err) { toast.error('Upload failed: ' + err.message); }
    finally { setFloorPlanUploading(false); if (floorPlanInputRef.current) floorPlanInputRef.current.value = ''; }
  };

  const handleFloorPlanUrlSave = async () => {
    if (!floorPlanUrl.trim()) return;
    try {
      await base44.entities.LandlordProperty.update(landlordPropertyId, { floor_plan_url: floorPlanUrl.trim(), has_floor_plan: true });
      queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] });
      setFloorPlanUrlInput(false); setFloorPlanUrl(''); toast.success('Floor plan link saved');
    } catch (err) { toast.error('Save failed: ' + err.message); }
  };

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list() });
  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord-properties', landlord.id],
    queryFn: async () => { const props = await base44.entities.LandlordProperty.filter({ landlord_id: landlord.id }); return props || []; },
    enabled: !!landlord.id,
  });
  const landlordProperty = landlordProperties[0];
  const landlordPropertyId = landlordProperty?.id;

  const { data: linkedProperty } = useQuery({
    queryKey: ['property', landlordProperty?.property_id],
    queryFn: () => base44.entities.Property.filter({ id: landlordProperty.property_id }),
    enabled: !!landlordProperty?.property_id,
    staleTime: 5 * 60 * 1000,
    select: (rows) => rows?.[0] ?? null,
  });

  const unitTypeLabel = (() => {
    const pt = linkedProperty?.property_type;
    const beds = linkedProperty?.bedrooms;
    if (pt === 'studio' || beds === 0) return 'Studio';
    if (beds != null) {
      const bedroomStr = `${beds} Bedroom`;
      const appendType = ['villa', 'townhouse', 'penthouse'].includes(pt);
      return appendType ? `${bedroomStr} ${pt.charAt(0).toUpperCase() + pt.slice(1)}` : bedroomStr;
    }
    if (pt) return pt.charAt(0).toUpperCase() + pt.slice(1);
    return null;
  })();

  const { data: photographyTasks = [] } = useQuery({
    queryKey: ['photography-task', landlord.id],
    queryFn: async () => { if (!landlordPropertyId) return []; const tasks = await base44.entities.PhotographyTask.filter({ landlord_property_id: landlordPropertyId }); return tasks || []; },
    enabled: !!landlordPropertyId,
  });
  const existingTask = photographyTasks[0];

  const assignMutation = useMutation({
    mutationFn: (email) => base44.entities.Landlord.update(landlord.id, { assigned_agent_email: email }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landlords'] }); onUpdate?.(); },
    onError: (e) => toast.error('Assign failed: ' + e.message),
  });

  const photographerMutation = useMutation({
    mutationFn: async (photographerEmail) => {
      if (!landlordPropertyId) throw new Error('No property record found for this landlord');
      if (existingTask) {
        return await base44.entities.PhotographyTask.update(existingTask.id, { assigned_photographer_email: photographerEmail, assigned_at: new Date().toISOString() });
      } else {
        return await base44.entities.PhotographyTask.create({ landlord_id: landlord.id, landlord_property_id: landlordPropertyId, assigned_photographer_email: photographerEmail, assigned_at: new Date().toISOString(), task_stage: 'inquiry' });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['photography-task', landlord.id] }); queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] }); toast.success('Photographer assigned'); },
    onError: (e) => toast.error('Failed to assign: ' + e.message),
  });

  const PHOTOGRAPHER_OPTIONS = [
    { email: 'dari@erudite-estate.com', name: 'Dari' },
    { email: 'ahmad.badreddine198622@gmail.com', name: 'Ahmad Badreddine' },
  ];
  const LISTING_MANAGER_OPTIONS = [
    { email: 'ajwa@erudite-estate.com', name: 'Ajwa' },
    { email: 'ahmad.badreddine198622@gmail.com', name: 'Ahmad' },
  ];

  const listingManagerMutation = useMutation({
    mutationFn: async (email) => {
      await base44.entities.Landlord.update(landlord.id, { listing_manager_email: email || null });
      if (email && landlordPropertyId && !landlordProperty?.listing_production_stage) {
        await base44.entities.LandlordProperty.update(landlordPropertyId, { listing_production_stage: 'received' });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landlords'] }); queryClient.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] }); onUpdate?.(); toast.success('Listing manager updated'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const notesMutation = useMutation({
    mutationFn: (notes) => base44.entities.Landlord.update(landlord.id, { notes_internal: notes }),
    onMutate: () => setNotesSaving(true),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landlords'] }); onUpdate?.(); toast.success('Notes saved'); },
    onSettled: () => setNotesSaving(false),
    onError: (e) => toast.error('Failed to save notes: ' + e.message),
  });

  const editContactMutation = useMutation({
    mutationFn: (data) => base44.entities.Landlord.update(landlord.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landlords'] }); onUpdate?.(); setEditContactOpen(false); toast.success('Contact updated'); },
    onError: (e) => toast.error('Failed to save: ' + e.message),
  });

  const orchestrateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true }),
    onSuccess: () => { toast.success('Aurora updated this landlord'); onUpdate?.(); queryClient.invalidateQueries({ queryKey: ['landlord', landlord.id] }); },
    onError: (e) => toast.error(`Aurora failed: ${e.message}`)
  });

  const lbaMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateLeaseBrokerageAgreement', { landlord_id: landlord.id }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.skipped) { toast.info(data.reason || 'Lease Brokerage Agreement already sent for signature.'); }
      else { setLbaResult({ pdf_url: data.pdf_url, file_name: data.file_name }); toast.success('Lease Brokerage Agreement generated'); }
      onUpdate?.(); queryClient.invalidateQueries({ queryKey: ['landlord', landlord.id] }); queryClient.invalidateQueries({ queryKey: ['landlords'] });
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

  const initial = (landlord.full_name_en || landlord.full_name || '?')[0]?.toUpperCase();

  // Render the two-panel layout
  const renderContent = () => {
    return (
      <div className="flex flex-col h-full">
        {/* Header - sticky top */}
        <div className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between gap-4 shrink-0" style={{ background: 'hsl(222 47% 9%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {landlord.ai_strike_now && (
              <Badge className="bg-red-500 text-white border-0 animate-pulse shrink-0">
                <Flame className="w-3 h-3 mr-1" /> STRIKE NOW
              </Badge>
            )}
            {photoUrl ? (
              <>
                <button onClick={() => setPhotoLightboxOpen(true)} className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/20 hover:border-accent/60 transition-colors">
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                </button>
                <Dialog open={photoLightboxOpen} onOpenChange={setPhotoLightboxOpen}>
                  <DialogContent className="max-w-3xl p-0 overflow-hidden" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                    <div className="relative w-full h-[85vh] flex items-center justify-center bg-black/95 rounded-lg">
                      <img src={photoUrl} alt="" className="max-h-full max-w-full object-contain" />
                      <button onClick={() => setPhotoLightboxOpen(false)} className="absolute top-3 right-3 p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-base font-bold text-accent shrink-0 border border-accent/30">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold text-base truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {landlord.full_name_en || landlord.full_name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {(landlord.unit_reference || landlord.project_name) && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md shrink-0" style={{ background: 'rgba(250,180,40,0.12)', border: '1px solid rgba(250,180,40,0.3)' }}>
                    {landlord.unit_reference && <span className="text-[11px] font-bold tabular-nums" style={{ color: 'hsl(38 92% 60%)' }}>Unit {landlord.unit_reference}</span>}
                    {landlord.unit_reference && landlord.project_name && <span className="text-[10px]" style={{ color: 'rgba(250,180,40,0.45)' }}>·</span>}
                    {landlord.project_name && <span className="text-[11px] font-medium truncate max-w-[120px]" style={{ color: 'rgba(250,180,40,0.75)' }}>{landlord.project_name}</span>}
                    {unitTypeLabel && <><span className="text-[10px]" style={{ color: 'rgba(250,180,40,0.45)' }}>·</span><span className="text-[11px] font-bold" style={{ color: 'hsl(38 92% 70%)' }}>{unitTypeLabel}</span></>}
                    {linkedProperty?.area_sqft && <><span className="text-[10px]" style={{ color: 'rgba(250,180,40,0.45)' }}>·</span><span className="text-[11px] font-medium tabular-nums" style={{ color: 'rgba(250,180,40,0.8)' }}>{Math.round(linkedProperty.area_sqft).toLocaleString()} sqft</span></>}
                  </div>
                )}
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
                  {STAGE_LABELS[landlord.stage] || landlord.stage}
                </Badge>
              </div>
            </div>
            <div className="shrink-0">
              <Select value={landlord.stage} onValueChange={(value) => stageMutation.mutate(value)} disabled={stageMutation.isPending}>
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((stage) => (
                    <SelectItem key={stage} value={stage} className="text-xs">{STAGE_LABELS[stage] || stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TwilioCallDialog lead={{ id: landlord.id, phone: landlord.phone, full_name: landlord.full_name_en || landlord.full_name }} size="icon" iconOnly />
            <AircallButton phone={landlord.phone} name={landlord.full_name_en || landlord.full_name} iconOnly />
            <VapiCallDialog lead={{ id: landlord.id, phone: landlord.phone, full_name: landlord.full_name_en || landlord.full_name }} iconOnly />
            <Button variant="ghost" size="icon" title="Send Email" onClick={() => { setEmailOpen(!emailOpen); setEmailTo(landlord.email || ''); setEmailSubject(''); setEmailBody(''); }}>
              <Mail className={`w-4 h-4 ${emailOpen ? 'text-accent' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="icon" title="Run Aurora" onClick={() => orchestrateMutation.mutate()} disabled={orchestrateMutation.isPending}>
              <RefreshCw className={`w-4 h-4 ${orchestrateMutation.isPending ? 'animate-spin text-accent' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="icon" title="Whisper Mode" onClick={() => setWhisperOpen(!whisperOpen)}>
              <Sparkles className={`w-4 h-4 ${whisperOpen ? 'text-violet-400' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* TWO-PANEL LAYOUT */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* LEFT PANEL - Conversation & Activity (~45%) */}
          <div className="flex-1 lg:flex-[0.45] border-r border-white/5 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* AI Coaching Card */}
              <AICoachingCard landlord={landlord} onAnalyse={() => orchestrateMutation.mutate()} />
              
              {/* Conversation Timeline */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Conversation & Activity</p>
                <ConversationTimeline landlord={landlord} />
              </div>
            </div>
            
            {/* Activity Input Bar - sticky bottom */}
            <div className="p-4 border-t border-white/5 shrink-0" style={{ background: 'hsl(222 47% 9%)' }}>
              <ActivityInputBar landlord={landlord} />
            </div>
          </div>

          {/* RIGHT PANEL - Intelligence & Actions (~55%) */}
          <div className="flex-1 lg:flex-[0.55] flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Market Intelligence */}
              <MarketIntelligencePanel landlordProperty={landlordProperty} unitReference={landlord.unit_reference} projectName={landlord.project_name} />
              
              {/* AI Summary */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">AI Summary</p>
                      <p className="text-[10px] text-muted-foreground">At-a-glance understanding</p>
                    </div>
                  </div>
                  <button onClick={() => orchestrateMutation.mutate()} disabled={orchestrateMutation.isPending}
                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <RefreshCw className={`w-3 h-3 ${orchestrateMutation.isPending ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                {landlord.ai_rolling_summary ? (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{landlord.ai_rolling_summary}</p>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)' }}>
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">AI summary will appear after you log a qualification and notes.</p>
                  </div>
                )}
              </div>

              {/* Agent Notes */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Agent Notes</p>
                      <p className="text-[10px] text-muted-foreground">Ongoing notes</p>
                    </div>
                  </div>
                  {notesSaving && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
                </div>
                <textarea value={notesInternal} onChange={(e) => setNotesInternal(e.target.value)} onBlur={() => { if (notesInternal !== (landlord.notes_internal || '')) notesMutation.mutate(notesInternal); }}
                  placeholder="Type ongoing notes here… (auto-saves on blur)" rows={3} className="w-full px-3 py-2 text-xs rounded-lg resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }} />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="qualification" className="space-y-3">
                <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
                  <TabsTrigger value="outreach" className="text-xs">Outreach</TabsTrigger>
                  <TabsTrigger value="qualification" className="text-xs">Qualify</TabsTrigger>
                  <TabsTrigger value="calls" className="text-xs">📞 Calls</TabsTrigger>
                  <TabsTrigger value="unit" className="text-xs">Unit</TabsTrigger>
                  <TabsTrigger value="negotiation" className="text-xs">Negotiation</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="text-xs">WhatsApp</TabsTrigger>
                  <TabsTrigger value="sms" className="text-xs">SMS</TabsTrigger>
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
                </TabsList>

                <TabsContent value="outreach"><OutreachChecklistPanel landlord={landlord} /></TabsContent>
                <TabsContent value="qualification"><CallQualificationTab landlord={landlord} /></TabsContent>
                <TabsContent value="calls"><LandlordCallHistory landlord={landlord} /></TabsContent>
                <TabsContent value="unit" className="space-y-3">
                  <UnitPassport landlordId={landlord.id} />
                  <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <ListingCopyManager landlordId={landlord.id} landlordPropertyId={landlordPropertyId} landlordProperty={landlordProperty} />
                  </div>
                  <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <GroupBlurbGenerator landlordId={landlord.id} />
                  </div>
                </TabsContent>
                <TabsContent value="negotiation" className="space-y-3">
                  <PricingPressureMeter landlord={landlord} />
                  <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <CardHeader className="pb-2"><p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>Commission</p></CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 55%)' }}>{landlord.commission_pct_negotiated ? `${landlord.commission_pct_negotiated}%` : 'Not negotiated'}</p>
                      <p className="text-xs text-muted-foreground mt-1">Est. Revenue: AED {landlord.estimated_commission_aed?.toLocaleString() || '0'}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="documents"><DocumentChecklist landlordId={landlord.id} /></TabsContent>
                <TabsContent value="whatsapp"><LandlordWhatsAppPanel landlord={landlord} /></TabsContent>
                <TabsContent value="sms"><LandlordSMSPanel landlord={landlord} /></TabsContent>
                <TabsContent value="overview" className="space-y-3">
                  <FormAContractsList landlord={landlord} />
                  <CoalitionMap landlord={landlord} />
                  <PortfolioRadar landlord={landlord} />
                </TabsContent>
                <TabsContent value="ai"><LandlordIntelligenceTab landlord={landlord} /></TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mobile drawer or desktop sheet
  if (useFullDrawer) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent className="h-full max-h-full p-0">{renderContent()}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:max-w-[1400px] overflow-hidden p-0">
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}