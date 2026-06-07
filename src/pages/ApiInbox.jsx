import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Search, CheckCircle2, User, Phone, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ApiInbox() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['api_inbox_messages'],
    queryFn: () => base44.entities.ApiInboxMessage.list('-received_at', 200),
    refetchInterval: 10000,
  });

  const markHandledMutation = useMutation({
    mutationFn: (id) => base44.entities.ApiInboxMessage.update(id, { status: 'handled' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api_inbox_messages'] }),
  });

  const filtered = messages.filter(m => {
    const matchesSearch =
      !search ||
      m.sender_phone?.includes(search) ||
      m.message_text?.toLowerCase().includes(search.toLowerCase()) ||
      m.linked_landlord_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.linked_lead_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const newCount = messages.filter(m => m.status === 'new').length;

  return (
    <div className="page-root max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="page-title text-xl">API Inbox</h1>
            <p className="page-subtitle">Inbound messages from the erudite API channel (+971582806000)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">{newCount} new</Badge>
          )}
          <Button size="icon" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone, message, or contact..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {['all', 'new', 'handled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: statusFilter === s ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.05)',
                color: statusFilter === s ? 'hsl(222 47% 11%)' : 'rgba(255,255,255,0.7)',
                border: statusFilter === s ? '1px solid hsl(38 92% 50%)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Messages list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No messages yet</p>
          <p className="text-xs opacity-60 mt-1">Messages from the erudite instance will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => (
            <Card key={msg.id} className={`glass-card transition-all ${msg.status === 'new' ? 'border-blue-500/30' : 'opacity-70'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${msg.status === 'new' ? 'bg-blue-400' : 'bg-muted-foreground/30'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {/* Sender */}
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-mono font-medium">+{msg.sender_phone}</span>
                      </div>

                      {/* Matched contact */}
                      {(msg.linked_landlord_name || msg.linked_lead_name) && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium">
                            {msg.linked_landlord_name || msg.linked_lead_name}
                          </span>
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            {msg.linked_landlord_name ? 'Landlord' : 'Lead'}
                          </Badge>
                        </div>
                      )}

                      {/* No match */}
                      {!msg.linked_landlord_name && !msg.linked_lead_name && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-muted/40 text-muted-foreground border-border">
                          No match
                        </Badge>
                      )}

                      {/* Status badge */}
                      <Badge className={`text-[10px] px-1.5 py-0 ml-auto ${
                        msg.status === 'new'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/25'
                          : 'bg-muted/30 text-muted-foreground border-border'
                      }`}>
                        {msg.status}
                      </Badge>
                    </div>

                    {/* Message text */}
                    <p className="text-sm text-foreground/90 break-words">
                      {msg.message_text || <span className="italic text-muted-foreground">[{msg.message_type || 'media'}]</span>}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {msg.received_at
                          ? formatDistanceToNow(new Date(msg.received_at), { addSuffix: true })
                          : 'Unknown time'}
                      </div>
                      {msg.status === 'new' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 gap-1"
                          onClick={() => markHandledMutation.mutate(msg.id)}
                          disabled={markHandledMutation.isPending}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark handled
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}