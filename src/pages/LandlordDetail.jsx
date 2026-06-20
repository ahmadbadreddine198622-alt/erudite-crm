import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Building2, Phone, MessageCircle, Mail, Calendar, FileText, Camera, Film, Box, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import LandlordDetailPanel from '@/components/landlord/LandlordDetailPanel';

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery & Negotiation',
  listing_commitment: 'Listing Commitment Validation',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing — Critical Gate',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Documentation / verification by admin',
  listing_creation: 'Listing Creation — Backend',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Landlord Confirmation',
  marketing_agents: 'Marketing — Agents',
  marketing_network: 'Marketing — Network',
  open_house: 'Open House',
  client_blast: 'Client Blast',
  deal_closed: 'Deal Closed',
};

const ARCHETYPE_LABELS = {
  professional_investor: 'Professional Investor',
  individual_end_user_relocating: 'Individual Relocating',
  first_time_seller: 'First Time Seller',
  portfolio_optimizer: 'Portfolio Optimizer',
  distressed_seller: 'Distressed Seller',
  inherited_owner: 'Inherited Owner',
  developer_resale: 'Developer Resale',
  overseas_owner: 'Overseas Owner',
  accidental_landlord: 'Accidental Landlord',
  speculator_flipping: 'Speculator',
};

export default function LandlordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getPhotoForPhone } = usePhotoByPhone();

  const { data: landlord, isLoading } = useQuery({
    queryKey: ['landlord', id],
    queryFn: () => base44.entities.Landlord.get(id),
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord_properties'],
    queryFn: () => base44.entities.LandlordProperty.list(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: photographyTasks = [] } = useQuery({
    queryKey: ['photography_tasks'],
    queryFn: () => base44.entities.PhotographyTask.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const [isPanelOpen, setIsPanelOpen] = useState(true);

  useEffect(() => {
    if (!isLoading && !landlord) {
      toast.error('Landlord not found');
      navigate('/landlords');
    }
  }, [landlord, isLoading]);

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['landlord', id] });
    queryClient.invalidateQueries({ queryKey: ['landlords'] });
    toast.success('Landlord updated');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading Landlord Details...</p>
        </div>
      </div>
    );
  }

  if (!landlord) {
    return null;
  }

  const stageLabel = STAGE_LABELS[landlord.stage] || landlord.stage;
  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype] || 'Landlord';
  const askingPrice = landlord.asking_price_history?.[0]?.price || landlord.asking_price_aed;
  const commission = landlord.estimated_commission_aed;

  const landlordTask = photographyTasks.find(task => task.landlord_id === landlord.id);

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/landlords')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pipeline
          </button>
        </div>

        {/* Main Info Card */}
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))', border: '2px solid rgba(245,158,11,0.3)', color: 'hsl(38 92% 50%)' }}>
              {landlord.full_name_en?.[0]?.toUpperCase() || landlord.full_name?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold page-title">{landlord.full_name_en || landlord.full_name || 'Unknown'}</h1>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs"
                      style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: 'hsl(38 92% 50%)' }}>
                      {archetypeLabel}
                    </Badge>
                    <Badge variant="outline" className="text-xs"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
                      {stageLabel}
                    </Badge>
                    {landlord.project_name && <ProjectBadge name={landlord.project_name} />}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsPanelOpen(!isPanelOpen)}>
                    {isPanelOpen ? 'Close Panel' : 'Open Panel'}
                  </Button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {landlord.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{landlord.phone}</span>
                  </div>
                )}
                {landlord.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{landlord.email}</span>
                  </div>
                )}
                {landlord.unit_reference && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{landlord.unit_reference}</span>
                  </div>
                )}
                {landlord.assigned_agent_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{landlord.assigned_agent_email}</span>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {askingPrice && (
                  <div className="glass-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Asking Price</p>
                    <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {(askingPrice / 1000000).toFixed(2)}M</p>
                  </div>
                )}
                {commission > 0 && (
                  <div className="glass-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Commission</p>
                    <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {commission >= 1000 ? `${(commission / 1000).toFixed(0)}K` : commission}</p>
                  </div>
                )}
                {landlord.trust_score && (
                  <div className="glass-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Trust Score</p>
                    <p className={`text-lg font-bold ${landlord.trust_score >= 80 ? 'text-emerald-500' : landlord.trust_score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>T{landlord.trust_score}</p>
                  </div>
                )}
                {landlord.urgency_score && (
                  <div className="glass-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Urgency</p>
                    <p className={`text-lg font-bold ${landlord.urgency_score >= 80 ? 'text-red-500' : landlord.urgency_score >= 60 ? 'text-amber-500' : 'text-emerald-500'}`}>{landlord.urgency_score}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Panel - embedded */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50">
          <LandlordDetailPanel
            landlord={landlord}
            open={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            onUpdate={handleUpdate}
            fullScreenOnMobile={true}
          />
        </div>
      )}
    </div>
  );
}