import { useState } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Home, Phone, Mail, MessageCircle, Camera, Disc, Film, FileText, CheckCircle2,
  Loader2, ChevronLeft, ChevronRight, DollarSign, User
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from 'sonner';

const STAGE_COLUMNS = [
  'received',
  'permit_creation',
  'listing_drafting',
  'photos_upload',
  'publishing',
  'verification',
  'live',
];

const STAGE_LABELS = {
  received:         'Received',
  permit_creation:  'Permit Creation',
  listing_drafting: 'Listing Drafting',
  photos_upload:    'Photos Upload',
  publishing:       'Publishing',
  verification:     'Verification',
  live:             'Live',
};

const STAGE_COLORS = {
  received:         { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', text: 'rgba(148,163,184,0.9)' },
  permit_creation:  { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  text: '#fbbf24' },
  listing_drafting: { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  text: '#a5b4fc' },
  photos_upload:    { bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.25)',   text: '#67e8f9' },
  publishing:       { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)',  text: '#fdba74' },
  verification:     { bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.25)',  text: '#d8b4fe' },
  live:             { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',    text: '#4ade80' },
};

const MEDIA_FLAGS = [
  { label: '360°', key: 'has_360_tour',        icon: Disc },
  { label: 'Drone', key: 'has_drone_footage',   icon: Film },
  { label: 'Video', key: 'has_video_walkthrough', icon: Camera },
  { label: 'Floor Plan', key: 'has_floor_plan', icon: FileText },
];

function ListingCard({ item, onMove, isMoving }) {
  const stageIdx = STAGE_COLUMNS.indexOf(item.listing_production_stage);
  const canGoBack = stageIdx > 0;
  const canGoFwd  = stageIdx < STAGE_COLUMNS.length - 1;

  const handleMove = (dir) => {
    const nextStage = STAGE_COLUMNS[stageIdx + dir];
    if (!nextStage) return;
    onMove(item, nextStage);
  };

  return (
    <Card className="glass-card mb-3 last:mb-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-sm" style={{ color: 'hsl(38 92% 55%)' }}>
              {item.project || 'Unknown Project'}
            </h3>
            {item.unit_reference && (
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <Home className="w-2.5 h-2.5" />
                Unit {item.unit_reference}
              </p>
            )}
          </div>
          {/* Stage move controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleMove(-1)}
              disabled={!canGoBack || isMoving}
              className="w-6 h-6 rounded flex items-center justify-center transition hover:bg-white/10 disabled:opacity-25"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white/60" />
            </button>
            <button
              onClick={() => handleMove(1)}
              disabled={!canGoFwd || isMoving}
              className="w-6 h-6 rounded flex items-center justify-center transition hover:bg-white/10 disabled:opacity-25"
            >
              {isMoving ? <Loader2 className="w-3 h-3 animate-spin text-white/60" /> : <ChevronRight className="w-3.5 h-3.5 text-white/60" />}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Owner */}
        {item.owner_name && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px] shrink-0">
              {item.owner_name[0]?.toUpperCase()}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{item.owner_name}</p>
          </div>
        )}

        {/* Agent */}
        {item.assigned_agent_email && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <User className="w-2.5 h-2.5" />
            <span className="truncate">{item.assigned_agent_email}</span>
          </div>
        )}

        {/* Price + Permit */}
        <div className="flex flex-wrap gap-1.5">
          {item.asking_price_aed && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: 'hsl(38 92% 60%)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <DollarSign className="w-2 h-2" />
              {Number(item.asking_price_aed).toLocaleString()} AED
            </span>
          )}
          {item.permit_number && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
              # {item.permit_number}
            </span>
          )}
        </div>

        {/* Contact */}
        {(item.phone || item.whatsapp || item.email) && (
          <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground pt-1 border-t border-white/10">
            {item.phone && (
              <span className="flex items-center gap-0.5"><Phone className="w-2 h-2" />{item.phone}</span>
            )}
            {item.whatsapp && item.whatsapp !== item.phone && (
              <span className="flex items-center gap-0.5"><MessageCircle className="w-2 h-2" />{item.whatsapp}</span>
            )}
            {item.email && (
              <span className="flex items-center gap-0.5 truncate"><Mail className="w-2 h-2" />{item.email}</span>
            )}
          </div>
        )}

        {/* Media flags */}
        <div className="pt-1 border-t border-white/10">
          <p className="text-[9px] text-muted-foreground mb-1">Media</p>
          <div className="flex flex-wrap gap-1">
            {MEDIA_FLAGS.map(({ label, key, icon: Icon }) => {
              const done = item[key] === true;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold border ${
                    done
                      ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  {done ? <CheckCircle2 className="w-2 h-2" /> : <Icon className="w-2 h-2" />}
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ListingProduction() {
  const [movingId, setMovingId] = useState(null);

  const { data: feed = [], isLoading, refetch } = useQuery({
    queryKey: ['listing-production-feed'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getListingProductionFeed', {});
      return res.data?.feed || [];
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ item, newStage }) => {
      const updates = { listing_production_stage: newStage };
      await base44.entities.LandlordProperty.update(item.landlord_property_id, updates);

      // Special rule: reaching 'live' also advances the Landlord pipeline stage
      if (newStage === 'live' && item.landlord_id) {
        await base44.entities.Landlord.update(item.landlord_id, { stage: 'listing_publication' });
      }
    },
    onMutate: ({ item }) => setMovingId(item.landlord_id),
    onSuccess: () => {
      refetch();
      toast.success('Stage updated');
    },
    onError: (err) => toast.error('Failed: ' + err.message),
    onSettled: () => setMovingId(null),
  });

  // Group by stage
  const byStage = {};
  STAGE_COLUMNS.forEach(s => { byStage[s] = []; });
  feed.forEach(item => {
    const s = item.listing_production_stage || 'received';
    if (byStage[s]) byStage[s].push(item);
  });

  if (isLoading) {
    return (
      <div className="page-root flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading listing production board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title text-2xl font-semibold mb-1">Listing Production</h1>
        <p className="page-subtitle">
          {feed.length} unit{feed.length !== 1 ? 's' : ''} in queue — use arrows to advance through stages
        </p>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {STAGE_COLUMNS.map(stage => {
            const col = STAGE_COLORS[stage];
            const cards = byStage[stage];
            return (
              <div key={stage} className="w-72 shrink-0">
                {/* Column header */}
                <div className="mb-3 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.text }} />
                      <h2 className="font-semibold text-sm" style={{ color: col.text }}>
                        {STAGE_LABELS[stage]}
                      </h2>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}
                    >
                      {cards.length}
                    </Badge>
                  </div>
                </div>

                {/* Cards */}
                <div>
                  {cards.length === 0 ? (
                    <div
                      className="text-center py-8 text-[10px] text-muted-foreground"
                      style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.08)' }}
                    >
                      No units
                    </div>
                  ) : (
                    cards.map(item => (
                      <ListingCard
                        key={item.landlord_id}
                        item={item}
                        onMove={(it, newStage) => moveMutation.mutate({ item: it, newStage })}
                        isMoving={movingId === item.landlord_id && moveMutation.isPending}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}