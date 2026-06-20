import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Building2, Phone, Mail, MessageCircle, Calendar,
  FileText, TrendingUp, DollarSign, Clock, CheckCircle2,
  AlertCircle, Star, Target, Users, Home, Key, FileCheck,
  Video, Camera, MapPin, Languages, Globe, Plus, Send,
  CheckSquare, Square, Zap, Sparkles, RefreshCw, Flame,
  MessageSquare, Smartphone, Briefcase, Headphones, FolderOpen,
  FileSignature, Shield, Database, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { MessagesTab } from '@/components/landlord/MessagesTab';
import { ActivityTab } from '@/components/landlord/ActivityTab';

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
  marketing_agents: 'Marketing — Agents',
  marketing_network: 'Marketing — Network',
  open_house: 'Open House',
  client_blast: 'Client Blast',
  deal_closed: 'Deal Closed',
};

function StatusPill({ status, type = 'default' }) {
  const styles = {
    default: { bg: 'rgba(148,163,184,0.15)', color: 'rgba(255,255,255,0.6)' },
    success: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    warning: { bg: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 55%)' },
    danger: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    info: { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
    purple: { bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd' },
  };
  const s = styles[type] || styles.default;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function GaugeCard({ score, label, rationale, max = 100, isPercent = false }) {
  const percentage = Math.max(0, Math.min(100, (score || 0) / max * 100));
  const displayValue = isPercent ? `${Math.round((score || 0) * 100)}%` : score != null ? score : '—';
  return (
    <Card className="p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      </div>
      <p className="text-3xl font-bold mb-2" style={{ color: 'hsl(38 92% 55%)' }}>{displayValue}</p>
      <Progress value={percentage} className="h-2 mb-2" style={{ background: 'rgba(255,255,255,0.1)' }} />
      {rationale && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{rationale}</p>}
    </Card>
  );
}

function SystemStatusCard({ icon: Icon, label, subStatus, color = '#34d399' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <Icon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</p>
        {subStatus && <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{subStatus}</p>}
      </div>
    </div>
  );
}

export default function LandlordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [newActivityText, setNewActivityText] = useState('');
  const [activityType, setActivityType] = useState('note');

  // Fetch landlord
  const { data: landlord, isLoading: l1 } = useQuery({
    queryKey: ['landlord', id],
    queryFn: () => base44.entities.Landlord.get(id),
    enabled: !!id,
  });

  // Fetch related data
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => base44.entities.Message.filter({ landlord_id: id }, '-timestamp', 100),
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', id],
    queryFn: () => base44.entities.Activity.filter({ landlord_id: id }, '-created_date', 100),
    enabled: !!id,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['conversation_insights', id],
    queryFn: () => base44.entities.ConversationInsight.filter({ landlord_id: id }, '-last_analyzed_at', 10),
    enabled: !!id,
  });

  const { data: coaches = [] } = useQuery({
    queryKey: ['conversation_coaches', id],
    queryFn: () => base44.entities.ConversationCoach.filter({ landlord_id: id }, '-created_date', 10),
    enabled: !!id,
  });

  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord_properties', id],
    queryFn: () => base44.entities.LandlordProperty.filter({ landlord_id: id }),
    enabled: !!id,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const property = useMemo(() => {
    const lp = landlordProperties[0];
    if (!lp) return null;
    const prop = properties.find(p => p.id === lp.property_id);
    return { ...lp, ...prop };
  }, [landlordProperties, properties]);

  const project = useMemo(() => projects.find(p => p.id === landlord?.project_id), [projects, landlord]);

  // Create activity mutation
  const createActivity = useMutation({
    mutationFn: (data) => base44.entities.Activity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', id] });
      setNewActivityText('');
      toast.success('Activity logged');
    },
    onError: (e) => toast.error('Failed to log activity: ' + e.message),
  });

  const handleLogActivity = () => {
    if (!newActivityText.trim()) return;
    createActivity.mutate({
      landlord_id: id,
      type: activityType,
      title: activityType === 'note' ? 'Note' : `Activity: ${activityType}`,
      description: newActivityText,
      agent_email: currentUser?.email,
      agent_name: currentUser?.full_name,
      status: 'completed',
    });
  };

  if (l1 || !landlord) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading landlord details...</p>
        </div>
      </div>
    );
  }

  const latestInsight = insights[0];
  const latestCoach = coaches[0];

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0a0e1a' }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-amber-500/20" style={{ background: 'linear-gradient(180deg, rgba(250,180,40,0.08) 0%, rgba(10,14,26,0) 100%)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/landlords')} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" style={{ color: 'hsl(38 92% 55%)' }} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{landlord.full_name_en}</h1>
              <StatusPill status={STAGE_LABELS[landlord.stage]} type="purple" />
              {landlord.ai_strike_now && (
                <Badge className="bg-red-500 text-white border-0 animate-pulse">
                  <Flame className="w-3 h-3 mr-1" /> STRIKE NOW
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <Phone className="w-3.5 h-3.5" /> {landlord.phone}
              </div>
              {landlord.email && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Mail className="w-3.5 h-3.5" /> {landlord.email}
                </div>
              )}
              {landlord.unit_reference && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(250,180,40,0.12)', border: '1px solid rgba(250,180,40,0.3)', color: 'hsl(38 92% 60%)' }}>
                  <Home className="w-3.5 h-3.5" /> Unit {landlord.unit_reference}
                </div>
              )}
              {project && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                  <Building2 className="w-3.5 h-3.5" /> {project.name}
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['landlord', id] })} className="gap-1.5">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* LEFT PANEL — Conversation & Activity */}
        <div className="w-[48%] border-r border-white/10 flex flex-col overflow-y-auto" style={{ background: 'rgba(255,255,255,0.01)' }}>
          {/* Channel chips */}
          <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">
              <Briefcase className="w-3 h-3 mr-1" /> Business
            </Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              <Smartphone className="w-3 h-3 mr-1" /> Personal
            </Badge>
          </div>

          {/* AI CONVERSATION INTELLIGENCE */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 55%)' }}>AI Conversation Intelligence</p>
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Real-time conversation analysis</p>
                </div>
              </div>
            </div>

            {/* Summary bullets */}
            {(latestInsight?.summary || landlord.ai_rolling_summary) && (
              <div className="mb-3">
                <p className="text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Summary</p>
                <div className="space-y-1">
                  {(latestInsight?.summary || landlord.ai_rolling_summary).split('. ').filter(s => s.trim()).slice(0, 3).map((sentence, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(38 92% 55%)' }} />
                      <span>{sentence}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outstanding questions */}
            {latestInsight?.outstanding_items && (
              <div className="mb-3">
                <p className="text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: '#f87171' }}>Outstanding · Unanswered Questions</p>
                <div className="space-y-1">
                  {latestInsight.outstanding_items.split('\n').filter(s => s.trim()).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                      <span style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Coach box */}
            {latestCoach && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: '#c4b5fd' }} />
                  <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: '#c4b5fd' }}>Conversation Coach</p>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Quality</p>
                  <p className="text-lg font-bold" style={{ color: '#c4b5fd' }}>{latestCoach.quality_score || 0}/100</p>
                </div>
                {latestCoach.single_best_line_to_use && (
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Best Line to Use Now</p>
                    <p className="text-xs italic px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)' }}>
                      "{latestCoach.single_best_line_to_use}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages/Activity tabs */}
          <Tabs defaultValue="messages" className="flex-1 flex flex-col">
            <TabsList className="shrink-0 rounded-none border-b border-white/10 bg-transparent px-4 pt-3">
              <TabsTrigger value="messages" className="data-[state=active]:bg-white/10">Messages</TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-white/10">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="flex-1 overflow-y-auto p-0 mt-0">
              <MessagesTab messages={messages} />
            </TabsContent>

            <TabsContent value="activity" className="flex-1 overflow-y-auto p-0 mt-0">
              <ActivityTab activities={activities} />
            </TabsContent>
          </Tabs>

          {/* Bottom action bar */}
          <div className="shrink-0 p-4 border-t border-amber-500/20" style={{ background: 'linear-gradient(180deg, rgba(250,180,40,0.05) 0%, rgba(0,0,0,0.4) 100%)' }}>
            <div className="flex items-center gap-2 mb-2">
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="task">Task</option>
                <option value="follow_up">Follow-up</option>
              </select>
              <Button size="sm" onClick={handleLogActivity} disabled={!newActivityText.trim() || createActivity.isPending}
                className="h-8 px-3 text-xs" style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}>
                {createActivity.isPending ? 'Logging…' : 'Log Activity'}
              </Button>
            </div>
            <Textarea
              value={newActivityText}
              onChange={(e) => setNewActivityText(e.target.value)}
              placeholder="Type your note or activity details…"
              className="text-xs resize-none"
              rows={2}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
        </div>

        {/* RIGHT PANEL — Landlord & Property Details */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* CONNECTED SYSTEMS */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2 px-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Connected Systems</p>
            <div className="grid grid-cols-2 gap-2">
              <SystemStatusCard icon={MessageCircle} label="WhatsApp Business" subStatus="Active" color="#34d399" />
              <SystemStatusCard icon={Smartphone} label="WhatsApp Personal" subStatus="Active" color="#34d399" />
              <SystemStatusCard icon={Headphones} label="Aircall" subStatus="Connected" color="#34d399" />
              <SystemStatusCard icon={Phone} label="Twilio Dialer" subStatus="Ready" color="#34d399" />
              <SystemStatusCard icon={MessageSquare} label="WhatsApp Call" subStatus="VAPI" color="#34d399" />
              <SystemStatusCard icon={FolderOpen} label="Google Drive" subStatus="Synced" color="#34d399" />
              <SystemStatusCard icon={FileSignature} label="DocuSign" subStatus="Active" color="#34d399" />
              <SystemStatusCard icon={Shield} label="DLD" subStatus="Connected" color="#34d399" />
            </div>
          </div>

          {/* STRIKE NOW banner */}
          {landlord.ai_strike_now && (
            <Card className="p-4 border-red-500/30" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                <p className="text-sm font-bold uppercase tracking-wider text-red-500">STRIKE NOW</p>
              </div>
              {landlord.ai_momentum && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{landlord.ai_momentum}</p>
              )}
            </Card>
          )}

          {/* NEXT BEST ACTION */}
          {landlord.ai_next_best_action && (
            <Card className="p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 55%)' }}>Next Best Action</p>
                {landlord.ai_next_best_action.priority === 'urgent' && (
                  <Badge className="bg-red-500 text-white border-0 text-[9px] px-1.5 py-0">URGENT</Badge>
                )}
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>{landlord.ai_next_best_action.action}</p>
              {landlord.ai_next_best_action.reasoning && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{landlord.ai_next_best_action.reasoning}</p>
              )}
            </Card>
          )}

          {/* Signal chips */}
          {(landlord.red_flags?.length > 0 || landlord.buying_signals?.length > 0) && (
            <div>
              <p className="text-[9px] uppercase tracking-wider font-semibold mb-2 px-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Signals</p>
              <div className="flex flex-wrap gap-1.5">
                {landlord.red_flags?.map((flag, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] border-red-500/30 text-red-400 bg-red-500/10">
                    <AlertCircle className="w-2.5 h-2.5 mr-1" /> {flag.replace(/_/g, ' ')}
                  </Badge>
                ))}
                {landlord.buying_signals?.map((signal, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> {signal}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI SUMMARY */}
          {landlord.ai_rolling_summary && (
            <Card className="p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c4b5fd' }}>AI Summary</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{landlord.ai_rolling_summary}</p>
            </Card>
          )}

          {/* Property Details */}
          {property && (
            <Card className="p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)' }}>Property Details</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Unit</p>
                  <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{landlord.unit_reference || '—'}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Asking Price</p>
                  <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
                    {landlord.asking_price_aed ? `AED ${landlord.asking_price_aed.toLocaleString()}` : '—'}
                  </p>
                </div>
                {property.ai_estimated_value_aed && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-3.5 h-3.5" style={{ color: '#c4b5fd' }} />
                      <p className="text-[9px] uppercase tracking-wider" style={{ color: '#c4b5fd' }}>AI Valuation</p>
                    </div>
                    <p className="text-lg font-bold" style={{ color: '#c4b5fd' }}>AED {property.ai_estimated_value_aed.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Mandate & Commission */}
          <Card className="p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-3">
              <FileCheck className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)' }}>Mandate & Commission</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Status</p>
                <StatusPill status={(landlord.mandate_status || 'none').replace(/_/g, ' ')} type={landlord.mandate_status === 'form_a_signed' ? 'success' : 'default'} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Type</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{(landlord.mandate_type || '—').replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Commission</p>
                <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{landlord.commission_pct_negotiated || 2}%</p>
              </div>
              {landlord.estimated_commission_aed && (
                <div className="mt-2 pt-2 border-t border-white/10 text-center">
                  <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'hsl(38 92% 55%)' }}>Est. Commission</p>
                  <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {landlord.estimated_commission_aed.toLocaleString()}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}