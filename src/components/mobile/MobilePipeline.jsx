import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import { primeWhatsAppCache } from '@/hooks/useHasWhatsApp';

export default function MobilePipeline() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  useEffect(() => {
    const phones = leads.map(l => l.phone).filter(Boolean);
    if (phones.length > 0) primeWhatsAppCache(phones);
  }, [leads]);

  const stages = [
    'new_lead',
    'contacted',
    'viewing_scheduled',
    'viewing_done',
    'negotiation',
    'offer_made',
    'closed_won',
    'closed_lost',
  ];

  const stageLabels = {
    new_lead: '🆕 New',
    contacted: '📞 Contacted',
    viewing_scheduled: '📅 Viewing',
    viewing_done: '👀 Viewed',
    negotiation: '💬 Negotiating',
    offer_made: '💰 Offer',
    closed_won: '✅ Won',
    closed_lost: '❌ Lost',
  };

  return (
    <div className="space-y-3 pb-4">
      {stages.map(stage => {
        const stageLeads = leads.filter(l => l.stage === stage);
        return (
          <div key={stage}>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-sm font-semibold">{stageLabels[stage]}</h3>
              <Badge variant="outline" className="text-xs">{stageLeads.length}</Badge>
            </div>
            <div className="space-y-2">
              {stageLeads.slice(0, 3).map(lead => (
                <Card key={lead.id} className="p-3">
                  <p className="font-semibold text-sm truncate">{lead.name}</p>
                  {lead.phone && (
                    <WhatsAppPhone
                      phone={lead.phone}
                      name={lead.name}
                      leadId={lead.id}
                      size="xs"
                      disabled={lead.do_not_contact}
                    />
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {lead.assigned_agent_name && (
                      <span className="text-xs bg-muted px-2 py-1 rounded">{lead.assigned_agent_name.split('@')[0]}</span>
                    )}
                    {lead.lead_score && (
                      <span className="text-xs font-bold text-accent">{lead.lead_score}/100</span>
                    )}
                  </div>
                </Card>
              ))}
              {stageLeads.length > 3 && (
                <p className="text-xs text-muted-foreground px-1 py-2">+{stageLeads.length - 3} more</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}