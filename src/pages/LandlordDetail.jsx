import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Building2, Phone, Mail, MessageCircle, Calendar,
  FileText, TrendingUp, DollarSign, Clock, CheckCircle2,
  AlertCircle, Star, Target, Users, Home, Key, FileCheck,
  Video, Camera, MapPin, Languages, Globe, Plus, Send,
  CheckSquare, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

function ScoreGauge({ score, label, color = 'hsl(38 92% 50%)' }) {
  const percentage = Math.max(0, Math.min(100, score || 0));
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="relative w-16 h-16 mx-auto mb-2">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle
            cx="18" cy="18" r="15.9155" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${percentage} ${100 - percentage}`} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{percentage}</span>
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
    </div>
  );
}

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
    <div className="flex flex-col h-screen" style={{ background: '#0d1120' }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/landlords')} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{landlord.full_name_en}</h1>
              <StatusPill status={STAGE_LABELS[landlord.stage]} type="purple" />
              {landlord.rapport_level && (
                <StatusPill status={`Rapport: ${landlord.rapport_level.replace('_', ' ')}`} type="info" />
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
              {landlord.preferred_language && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Languages className="w-3.5 h-3.5" /> {landlord.preferred_language.toUpperCase()}
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
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* LEFT PANEL — Communications & Insights */}
        <div className="w-[45%] border-r border-white/10 flex flex-col" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <Tabs defaultValue="messages" className="flex-1 flex flex-col">
            <TabsList className="shrink-0 rounded-none border-b border-white/10 bg-transparent px-4 pt-3">
              <TabsTrigger value="messages" className="data-[state=active]:bg-white/10">Messages</TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-white/10">Activity</TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-white/10">AI Insights</TabsTrigger>
              <TabsTrigger value="coach" className="data-[state=active]:bg-white/10">Coach</TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="flex-1 overflow-y-auto p-4 mt-0">
              <MessagesTab messages={messages} />
            </TabsContent>

            <TabsContent value="activity" className="flex-1 overflow-y-auto p-4 mt-0">
              <ActivityTab activities={activities} />
            </TabsContent>

            <TabsContent value="insights" className="flex-1 overflow-y-auto p-4 mt-0">
              {/* Inline insights content */}
              {!latestInsight ? (
                <div className="text-center py-10">
                  <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No AI insights yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                      <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>Conversation Summary</p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{latestInsight.summary}</p>
                    {latestInsight.key_facts && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Key Facts</p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{latestInsight.key_facts}</p>
                      </div>
                    )}
                  </div>
                  {latestInsight.suggestions?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Suggestions</p>
                      <div className="space-y-2">
                        {latestInsight.suggestions.map((s, i) => (
                          <div key={i} className="rounded-lg p-3 text-sm"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.title}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="coach" className="flex-1 overflow-y-auto p-4 mt-0">
              {/* Inline coach content */}
              {!latestCoach ? (
                <div className="text-center py-10">
                  <Target className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No coaching insights yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
                        <p className="text-sm font-semibold" style={{ color: '#34d399' }}>Quality Score</p>
                      </div>
                      <span className="text-2xl font-bold" style={{ color: '#34d399' }}>{latestCoach.quality_score || 0}/100</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {latestCoach.rapport_built ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      Rapport {latestCoach.rapport_built ? 'built' : 'not yet established'}
                    </div>
                  </div>
                  {latestCoach.things_done_well?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Done Well</p>
                      <div className="space-y-1.5">
                        {latestCoach.things_done_well.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#34d399' }} />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {latestCoach.next_move_recommended && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(38 92% 55%)' }}>Next Move</p>
                      <p className="text-sm font-medium" style={{ color: 'hsl(38 92% 55%)' }}>{latestCoach.next_move_recommended}</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Bottom action bar */}
          <div className="shrink-0 p-4 border-t border-white/10" style={{ background: 'rgba(0,0,0,0.3)' }}>
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
                className="h-8 px-3 text-xs">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Scores Row */}
          <div className="grid grid-cols-4 gap-3">
            <ScoreGauge score={landlord.trust_score} label="Trust" color="#34d399" />
            <ScoreGauge score={landlord.urgency_score} label="Urgency" color="#fbbf24" />
            <ScoreGauge score={landlord.responsiveness_score} label="Responsiveness" color="#60a5fa" />
            <ScoreGauge score={Math.round((landlord.mandate_win_probability || 0) * 100)} label="Win Prob." color="#c4b5fd" />
          </div>

          {/* AI Rolling Summary */}
          {landlord.ai_rolling_summary && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>AI Summary</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{landlord.ai_rolling_summary}</p>
            </div>
          )}

          {/* Next Best Action */}
          {landlord.ai_next_best_action && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                <p className="text-sm font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>Next Best Action</p>
              </div>
              <p className="text-base font-bold mb-1" style={{ color: 'hsl(38 92% 55%)' }}>{landlord.ai_next_best_action.action}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Priority: {landlord.ai_next_best_action.priority}</p>
              {landlord.ai_next_best_action.reasoning && (
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.75)' }}>{landlord.ai_next_best_action.reasoning}</p>
              )}
            </div>
          )}

          {/* Property Details */}
          {property && (
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
                <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Property Details</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Unit Reference</p>
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{landlord.unit_reference || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Asking Price</p>
                  <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
                    {landlord.asking_price_aed ? `AED ${landlord.asking_price_aed.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Tenancy Status</p>
                  <StatusPill status={property.tenancy_status || 'Unknown'} type={property.tenancy_status === 'vacant' ? 'success' : 'info'} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Mortgage</p>
                  <StatusPill status={(property.mortgage_status || 'unknown').replace(/_/g, ' ')} type="default" />
                </div>
              </div>
              {property.ai_estimated_value_aed && (
                <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                    <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>AI Valuation</p>
                  </div>
                  <p className="text-xl font-bold" style={{ color: '#c4b5fd' }}>AED {property.ai_estimated_value_aed.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {property.ai_estimated_price_sqft && `AED ${property.ai_estimated_price_sqft.toLocaleString()}/sqft`}
                    {property.ai_valuation_confidence && `· ${property.ai_valuation_confidence} confidence`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Landlord Information */}
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
              <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Landlord Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Archetype</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{(landlord.landlord_archetype || 'unknown').replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Nationality</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{landlord.nationality || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Residence</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {landlord.is_resident_uae ? 'UAE Resident' : 'Overseas'} · {landlord.residence_country || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Source</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{(landlord.source || 'unknown').replace(/_/g, ' ')}</p>
              </div>
            </div>
            {(landlord.red_flags?.length > 0 || landlord.buying_signals?.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {landlord.red_flags?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(239,68,68,0.6)' }}>Red Flags</p>
                    <div className="space-y-1">
                      {landlord.red_flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: '#f87171' }}>
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{flag.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {landlord.buying_signals?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(16,185,129,0.6)' }}>Buying Signals</p>
                    <div className="space-y-1">
                      {landlord.buying_signals.map((signal, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: '#34d399' }}>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{signal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mandate & Commission */}
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
              <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Mandate & Commission</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Mandate Status</p>
                <StatusPill status={(landlord.mandate_status || 'none').replace(/_/g, ' ')} type={landlord.mandate_status === 'form_a_signed' ? 'success' : 'default'} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Mandate Type</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{(landlord.mandate_type || '—').replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Commission %</p>
                <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{landlord.commission_pct_negotiated || 2}%</p>
              </div>
            </div>
            {landlord.estimated_commission_aed && (
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(38 92% 55%)' }}>Estimated Commission</p>
                <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {landlord.estimated_commission_aed.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}