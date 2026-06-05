import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Building2, Phone, Mail, MessageSquare, User, ExternalLink, Edit3, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import UnitPassport from '@/components/landlord/UnitPassport';
import ListingReadiness from '@/components/landlord/ListingReadiness';
import DocumentChecklist from '@/components/landlord/DocumentChecklist';
import ListingCopyManager from '@/components/landlord/ListingCopyManager';
import GroupBlurbGenerator from '@/components/landlord/GroupBlurbGenerator';
import CommentsThread from '@/components/photography/CommentsThread';

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery',
  listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Documentation',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
};

const RAPPORT_COLORS = {
  cold: 'text-slate-400',
  warming: 'text-blue-400',
  rapport_built: 'text-amber-400',
  trust_established: 'text-emerald-400',
  champion: 'text-purple-400',
};

export default function LandlordDetailPanel({ landlord, open, onClose, onUpdate }) {
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(landlord?.notes_internal || '');

  useEffect(() => {
    setNotes(landlord?.notes_internal || '');
    setEditingNotes(false);
  }, [landlord?.id]);

  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord_properties', landlord?.id],
    queryFn: () => base44.entities.LandlordProperty.filter({ landlord_id: landlord.id }),
    enabled: !!landlord?.id && open,
  });

  const { data: photographyTasks = [] } = useQuery({
    queryKey: ['photography_tasks_for_landlord', landlord?.id],
    queryFn: () => base44.entities.PhotographyTask.filter({ landlord_id: landlord.id }),
    enabled: !!landlord?.id && open,
  });

  const photographyTask = photographyTasks[0] || null;
  const landlordProperty = landlordProperties[0] || null;

  const saveNotes = async () => {
    await base44.entities.Landlord.update(landlord.id, { notes_internal: notes });
    toast.success('Notes saved');
    setEditingNotes(false);
    onUpdate?.();
    queryClient.invalidateQueries({ queryKey: ['landlords'] });
  };

  if (!open || !landlord) return null;

  const phone = landlord.whatsapp || landlord.phone || '';
  const whatsappUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;

  return (
    /* Full-screen backdrop, centers the modal */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/*
        MODAL SHELL
        Desktop: w-[90vw] max-w-7xl, tall (92vh), rounded, flex-col
        Mobile:  w-full h-full, no rounding
      */}
      <div
        style={{
          width: '90vw',
          maxWidth: '80rem',   /* = max-w-7xl */
          height: '92vh',
          background: 'hsl(222 47% 9%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          borderRadius: '1rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER (fixed height, never shrinks) ── */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User style={{ width: 16, height: 16, color: '#fbbf24' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {landlord.full_name_en || landlord.full_name_ar || 'Unnamed Landlord'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                <Badge variant="outline" className="text-[10px] px-2 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10">
                  {STAGE_LABELS[landlord.stage] || landlord.stage}
                </Badge>
                {landlord.project_name && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{landlord.project_name}</span>
                )}
                {landlord.unit_reference && (
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>#{landlord.unit_reference}</span>
                )}
                {landlord.rapport_level && (
                  <span className={`text-[10px] font-semibold capitalize ${RAPPORT_COLORS[landlord.rapport_level] || 'text-muted-foreground'}`}>
                    {landlord.rapport_level.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {phone && (
              <a href={`tel:${phone}`} title="Call">
                <Button size="icon" variant="ghost" className="w-8 h-8"><Phone className="w-3.5 h-3.5" /></Button>
              </a>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                <Button size="icon" variant="ghost" className="w-8 h-8"><MessageSquare className="w-3.5 h-3.5 text-emerald-400" /></Button>
              </a>
            )}
            {landlord.email && (
              <a href={`mailto:${landlord.email}`} title="Email">
                <Button size="icon" variant="ghost" className="w-8 h-8"><Mail className="w-3.5 h-3.5" /></Button>
              </a>
            )}
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/*
          ── BODY: THREE COLUMNS SIDE BY SIDE ──
          flex: 1 1 0  → takes all remaining height after header
          min-height: 0  → critical: lets flex children shrink below their content size
          flex-direction: row  → three columns horizontal
          overflow: hidden  → body itself doesn't scroll; each column scrolls independently
        */}
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          {/* ── COLUMN 1: Unit info + Media (~28%) ── */}
          <div
            style={{
              width: '28%',
              flexShrink: 0,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unit &amp; Property</p>
            <UnitPassport landlordId={landlord.id} />

            {photographyTask && (photographyTask.tour_3d_link || photographyTask.video_link || photographyTask.photos_link) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Media Assets</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {photographyTask.tour_3d_link && (
                    <a href={photographyTask.tour_3d_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
                    >
                      <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      3D Tour
                      <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                    </a>
                  )}
                  {photographyTask.video_link && (
                    <a href={photographyTask.video_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      Video Walkthrough
                      <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                    </a>
                  )}
                  {photographyTask.photos_link && (
                    <a href={photographyTask.photos_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
                    >
                      <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Photo Gallery
                      <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Notes</p>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                  onClick={() => editingNotes ? saveNotes() : setEditingNotes(true)}
                >
                  {editingNotes ? <><Save className="w-3 h-3" /> Save</> : <><Edit3 className="w-3 h-3" /> Edit</>}
                </Button>
              </div>
              {editingNotes ? (
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 text-xs rounded-lg resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', outline: 'none' }}
                />
              ) : (
                <p className="text-xs leading-relaxed" style={{ color: notes ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}>
                  {notes || 'No notes yet. Click Edit to add.'}
                </p>
              )}
            </div>
          </div>

          {/* ── COLUMN 2: Readiness + Documents (~28%) ── */}
          <div
            style={{
              width: '28%',
              flexShrink: 0,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Listing Readiness</p>
            <ListingReadiness
              landlord={landlord}
              landlordPropertyId={landlordProperty?.id}
              photographyTask={photographyTask}
            />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">Document Checklist</p>
            <DocumentChecklist
              landlordId={landlord.id}
              landlordPropertyId={landlordProperty?.id}
            />
          </div>

          {/* ── COLUMN 3: AI tools + Comments (flex-1, remaining width) ── */}
          <div
            style={{
              flex: '1 1 0',
              minWidth: 0,
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <Tabs defaultValue="listing-copy">
              <TabsList className="mb-4">
                <TabsTrigger value="listing-copy" className="text-xs">Listing Copy</TabsTrigger>
                <TabsTrigger value="blurb" className="text-xs">Group Blurb</TabsTrigger>
                <TabsTrigger value="comments" className="text-xs">Comments</TabsTrigger>
              </TabsList>

              <TabsContent value="listing-copy">
                <ListingCopyManager
                  landlordId={landlord.id}
                  landlordPropertyId={landlordProperty?.id}
                  landlordProperty={landlordProperty}
                />
              </TabsContent>

              <TabsContent value="blurb">
                <GroupBlurbGenerator landlordId={landlord.id} />
              </TabsContent>

              <TabsContent value="comments">
                {photographyTask ? (
                  <CommentsThread
                    photographyTaskId={photographyTask.id}
                    landlordPropertyId={landlordProperty?.id || photographyTask.landlord_property_id}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No photography task linked — comments will appear here once a task is created.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}