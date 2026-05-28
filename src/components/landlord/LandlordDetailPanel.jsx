import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import { base44 } from '@/api/base44Client';
import { X, Eye, MapPin, Phone, Mail, Sparkles, Zap, RefreshCw, Flame, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';
import PricingPressureMeter from './PricingPressureMeter';
import PortfolioRadar from './PortfolioRadar';
import CoalitionMap from './CoalitionMap';
import WhisperPanel from './WhisperPanel';

export default function LandlordDetailPanel({ landlord, open, onClose, onUpdate }) {
  const queryClient = useQueryClient();
  const [whisperOpen, setWhisperOpen] = useState(false);

  const orchestrateMutation = useMutation({
    mutationFn: () => base44.functions.landlordOrchestrator({ landlord_id: landlord.id, force: true }),
    onSuccess: () => {
      toast.success('Aurora updated this landlord');
      onUpdate?.();
      queryClient.invalidateQueries({ queryKey: ['landlord', landlord.id] });
    },
    onError: (e) => toast.error(`Aurora failed: ${e.message}`)
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto p-0">
        {/* Header */}
        <div className="border-b border-border p-4 flex items-center justify-between sticky top-0 z-10 bg-card">
          <div className="flex items-center gap-2 min-w-0">
            {landlord.ai_strike_now && (
              <Badge className="bg-red-500 text-white border-0 animate-pulse">
                <Flame className="w-3 h-3 mr-1" /> STRIKE NOW
              </Badge>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{landlord.full_name_en || landlord.full_name}</h2>
              <p className="text-xs text-muted-foreground truncate">
                {landlord.landlord_archetype?.replace(/_/g, ' ')}
                {landlord.ai_momentum && ` · ${landlord.ai_momentum}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" title="Run Aurora" onClick={() => orchestrateMutation.mutate()} disabled={orchestrateMutation.isPending}>
              <RefreshCw className={`w-4 h-4 ${orchestrateMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" title="Whisper Mode" onClick={() => setWhisperOpen(!whisperOpen)}>
              <Sparkles className={`w-4 h-4 ${whisperOpen ? 'text-violet-600' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Whisper Panel (toggle) */}
        {whisperOpen && (
          <div className="p-3 border-b border-border">
            <WhisperPanel
              landlord={landlord}
              recentMessages={[]}
              onClose={() => setWhisperOpen(false)}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          {/* Quick Info */}
          <div className="p-4 space-y-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span>{landlord.phone || 'No phone'}</span>
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
          </div>

          {/* Metrics Grid */}
          <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-2">
                <p className="text-xs text-muted-foreground mb-1">Trust Score</p>
                <p className="text-lg font-bold text-accent">{landlord.trust_score || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-2">
                <p className="text-xs text-muted-foreground mb-1">Responsiveness</p>
                <p className="text-lg font-bold text-accent">{landlord.responsiveness_score || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-2">
                <p className="text-xs text-muted-foreground mb-1">Mandate Win %</p>
                <p className="text-lg font-bold text-accent">
                  {landlord.mandate_win_probability ? `${(landlord.mandate_win_probability * 100).toFixed(0)}%` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-2">
                <p className="text-xs text-muted-foreground mb-1">Urgency</p>
                <p className="text-lg font-bold text-accent">{landlord.urgency_score || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="p-4">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="negotiation" className="text-xs">Negotiation</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Mandate Status</CardTitle>
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

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Red Flags</CardTitle>
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

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rapport Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{landlord.rapport_level || 'cold'}</Badge>
                </CardContent>
              </Card>

              <CoalitionMap landlord={landlord} />
              <PortfolioRadar landlord={landlord} />
            </TabsContent>

            {/* Negotiation Tab */}
            <TabsContent value="negotiation" className="space-y-3">
              <PricingPressureMeter landlord={landlord} />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Commission</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">
                    {landlord.commission_pct_negotiated ? `${landlord.commission_pct_negotiated}%` : 'Not negotiated'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Est. Revenue: AED {landlord.estimated_commission_aed?.toLocaleString() || '0'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Asking Price</CardTitle>
                </CardHeader>
                <CardContent>
                  {landlord.asking_price_history && landlord.asking_price_history.length > 0 ? (
                    <>
                      <p className="text-lg font-bold">
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

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-2">
              <p className="text-xs text-muted-foreground">Document checklist will appear here once stage S8 is entered.</p>
            </TabsContent>

            {/* AI Tab */}
            <TabsContent value="ai" className="space-y-3">
              {landlord.ai_rolling_summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed">{landlord.ai_rolling_summary}</p>
                  </CardContent>
                </Card>
              )}

              {landlord.ai_next_best_action && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Next Best Action</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-semibold">{landlord.ai_next_best_action.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{landlord.ai_next_best_action.reasoning}</p>
                  </CardContent>
                </Card>
              )}

              {landlord.ai_coaching_for_agent && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Agent Coaching</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed">{landlord.ai_coaching_for_agent}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}