import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Target, TrendingUp, MessageCircle } from 'lucide-react';

export default function MobileDashboard() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 100),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 50),
  });

  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.stage !== 'closed_lost' && l.stage !== 'closed_won').length;
  const conversions = leads.filter(l => l.stage === 'closed_won').length;
  const unreadConvs = conversations.filter(c => c.unread_count > 0).length;

  return (
    <div className="space-y-4 pb-4">
      {/* Quick Stats */}
      <div className="space-y-2">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Leads</p>
                <p className="text-2xl font-bold text-blue-900">{totalLeads}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active</p>
                <p className="text-2xl font-bold text-green-900">{activeLeads}</p>
              </div>
              <Target className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100/50 border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Conversions</p>
                <p className="text-2xl font-bold text-purple-900">{conversions}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Unread Messages</p>
                <p className="text-2xl font-bold text-green-900">{unreadConvs}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold px-1">Recent Leads</h3>
        {leads.slice(0, 5).map(lead => (
          <Card key={lead.id} className="p-3">
            <p className="font-semibold text-sm truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{lead.phone}</p>
            <div className="flex items-center justify-between mt-2">
              <Badge variant="outline" className="text-xs">{lead.stage?.replace(/_/g, ' ')}</Badge>
              {lead.lead_score && (
                <span className="text-xs font-medium text-accent">{lead.lead_score}/100</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}