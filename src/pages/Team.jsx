import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

export default function Team() {
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery({
    queryKey: ['agent_workload'],
    queryFn: () => base44.entities.AgentWorkload.list('-total_conversations', 100),
    refetchInterval: 30000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const assignMutation = useMutation({
    mutationFn: ({ conversationId, agentEmail }) =>
      base44.entities.WhatsAppConversation.update(conversationId, {
        assigned_agent: agentEmail,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['agent_workload'] });
    },
  });

  const statusColor = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
    away: 'bg-orange-500',
    offline: 'bg-gray-500',
  };

  const getAgentStatus = (agent) => {
    if (agent.assigned_conversations >= 5) return 'busy';
    if (agent.assigned_conversations >= 3) return 'busy';
    return 'available';
  };

  const unassignedConversations = conversations.filter(c => !c.assigned_agent);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title="Team Management" subtitle="Agent workload, SLAs, and performance" />

        {/* Team Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agents.length}</div>
              <p className="text-xs text-muted-foreground">{agents.filter(a => a.status === 'available').length} available</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversations.filter(c => c.status === 'open').length}</div>
              <p className="text-xs text-muted-foreground">{unassignedConversations.length} unassigned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents.length > 0
                  ? (agents.reduce((sum, a) => sum + (a.avg_response_time_minutes || 0), 0) / agents.length).toFixed(1)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">minutes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SLA Breaches</CardTitle>
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents.reduce((sum, a) => sum + (a.sla_breaches || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>
        </div>

        {/* Unassigned Conversations */}
        {unassignedConversations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unassigned Conversations ({unassignedConversations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {unassignedConversations.slice(0, 5).map(conv => {
                  const leastBusyAgent = agents.reduce((prev, current) =>
                    (prev.assigned_conversations || 0) < (current.assigned_conversations || 0) ? prev : current
                  );

                  return (
                    <div key={conv.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{conv.phone_number}</p>
                        <p className="text-xs text-muted-foreground">{conv.last_message?.substring(0, 50)}</p>
                      </div>
                      {leastBusyAgent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => assignMutation.mutate({ conversationId: conv.id, agentEmail: leastBusyAgent.agent_email })}
                          disabled={assignMutation.isPending}
                        >
                          Assign to {leastBusyAgent.agent_name?.split('@')[0]}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.map(agent => {
                const status = getAgentStatus(agent);
                const conversionRate = agent.conversion_rate || 0;
                const isOverloaded = (agent.assigned_conversations || 0) >= 5;

                return (
                  <div key={agent.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`${statusColor[status]} w-3 h-3 rounded-full`} />
                        <div>
                          <p className="font-semibold text-sm">{agent.agent_name}</p>
                          <p className="text-xs text-muted-foreground">{agent.agent_email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={isOverloaded ? 'destructive' : 'outline'}>
                          {agent.assigned_conversations || 0} active
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Response Time</p>
                        <p className="font-semibold">{agent.avg_response_time_minutes || 0} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Conversion</p>
                        <p className="font-semibold">{conversionRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Closed</p>
                        <p className="font-semibold">{agent.closed_deals || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="font-semibold">{(agent.total_revenue_aed || 0).toLocaleString()} AED</p>
                      </div>
                    </div>

                    {(agent.sla_breaches || 0) > 0 && (
                      <div className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {agent.sla_breaches} SLA breaches
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}