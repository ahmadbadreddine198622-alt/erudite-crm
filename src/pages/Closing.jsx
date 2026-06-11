import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Handshake, Clock, CheckCircle, AlertCircle, FileText, Phone, MessageCircle, Building2, User, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STAGE_COLORS = {
  not_started: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  managers_cheques_arranged: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  trustee_appointment_booked: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  transfer_at_trustee: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  title_deed_issued: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  handover_keys_dewa: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  complete: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const STAGE_LABELS = {
  not_started: 'Not Started',
  managers_cheques_arranged: 'Manager\'s Cheques',
  trustee_appointment_booked: 'Trustee Booked',
  transfer_at_trustee: 'At Trustee',
  title_deed_issued: 'Title Deed Issued',
  handover_keys_dewa: 'Handover & DEWA',
  complete: 'Complete',
};

export default function Closing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState('all');

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals-closing'],
    queryFn: () => base44.entities.Deal.filter({ stage: 'closing' }, '-stage_entered_at', 500),
  });

  const updateDealMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Deal.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals-closing'] });
    },
  });

  const handleStageChange = (deal, newStage) => {
    updateDealMutation.mutate({
      id: deal.id,
      data: { closing_substep: newStage },
    });
  };

  const filteredDeals = selectedStage === 'all'
    ? deals
    : deals.filter(d => d.closing_substep === selectedStage);

  const stats = {
    total: deals.length,
    not_started: deals.filter(d => d.closing_substep === 'not_started').length,
    cheques: deals.filter(d => d.closing_substep === 'managers_cheques_arranged').length,
    trustee: deals.filter(d => d.closing_substep === 'trustee_appointment_booked').length,
    transfer: deals.filter(d => d.closing_substep === 'transfer_at_trustee').length,
    title: deals.filter(d => d.closing_substep === 'title_deed_issued').length,
    handover: deals.filter(d => d.closing_substep === 'handover_keys_dewa').length,
    complete: deals.filter(d => d.closing_substep === 'complete').length,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Handshake className="w-8 h-8 text-emerald-500" />
              Closing Deals
            </h1>
            <p className="text-muted-foreground mt-1">Track trustee appointments, cheques, and title deed issuance</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <Card className="bg-card/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-500/10 border-slate-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-slate-300">{stats.not_started}</p>
              <p className="text-xs text-slate-400">Not Started</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-300">{stats.cheques}</p>
              <p className="text-xs text-blue-400">Cheques</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-purple-300">{stats.trustee}</p>
              <p className="text-xs text-purple-400">Trustee</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-300">{stats.transfer}</p>
              <p className="text-xs text-amber-400">Transfer</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{stats.title}</p>
              <p className="text-xs text-emerald-400">Title</p>
            </CardContent>
          </Card>
          <Card className="bg-cyan-500/10 border-cyan-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-cyan-300">{stats.handover}</p>
              <p className="text-xs text-cyan-400">Handover</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-300">{stats.complete}</p>
              <p className="text-xs text-green-400">Complete</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={selectedStage} onValueChange={setSelectedStage} className="mb-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="not_started">Not Started</TabsTrigger>
            <TabsTrigger value="managers_cheques_arranged">Cheques</TabsTrigger>
            <TabsTrigger value="trustee_appointment_booked">Trustee</TabsTrigger>
            <TabsTrigger value="transfer_at_trustee">Transfer</TabsTrigger>
            <TabsTrigger value="title_deed_issued">Title</TabsTrigger>
            <TabsTrigger value="handover_keys_dewa">Handover</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Deals List */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-muted-foreground">Loading closing deals...</p>
          </div>
        ) : filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Handshake className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No deals in this stage</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredDeals.map((deal) => (
              <Card key={deal.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{deal.lead_name || 'Unknown'}</h3>
                        <Badge className={STAGE_COLORS[deal.closing_substep || 'not_started']}>
                          {STAGE_LABELS[deal.closing_substep || 'not_started']}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {deal.property_ref || 'No property'}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {deal.deal_reference || 'No reference'}
                        </span>
                        {deal.deal_value && (
                          <span className="font-semibold text-foreground">
                            AED {deal.deal_value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Agent</p>
                      <p className="text-sm font-medium">{deal.agent_name || deal.assigned_agent_email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Closing Checklist */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                    <button
                      onClick={() => handleStageChange(deal, 'managers_cheques_arranged')}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        deal.closing_substep === 'managers_cheques_arranged'
                          ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                          : 'bg-muted hover:bg-muted/80'
                      } border`}
                    >
                      ✓ Cheques Ready
                    </button>
                    <button
                      onClick={() => handleStageChange(deal, 'trustee_appointment_booked')}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        deal.closing_substep === 'trustee_appointment_booked'
                          ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                          : 'bg-muted hover:bg-muted/80'
                      } border`}
                    >
                      📅 Trustee Booked
                    </button>
                    <button
                      onClick={() => handleStageChange(deal, 'transfer_at_trustee')}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        deal.closing_substep === 'transfer_at_trustee'
                          ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                          : 'bg-muted hover:bg-muted/80'
                      } border`}
                    >
                      🏛️ At Trustee
                    </button>
                    <button
                      onClick={() => handleStageChange(deal, 'title_deed_issued')}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        deal.closing_substep === 'title_deed_issued'
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-muted hover:bg-muted/80'
                      } border`}
                    >
                      📜 Title Issued
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    {deal.landlord_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/landlords`)}
                        className="text-xs"
                      >
                        <Building2 className="w-3.5 h-3.5 mr-1" />
                        View Listing
                      </Button>
                    )}
                    {deal.lead_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/leads`)}
                        className="text-xs"
                      >
                        <User className="w-3.5 h-3.5 mr-1" />
                        View Lead
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-xs">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      <Phone className="w-3.5 h-3.5 mr-1" />
                      Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}