import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, GitMerge, Loader2, Phone, User, RefreshCw, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';

export default function DuplicateDetector() {
  const queryClient = useQueryClient();
  const [resolvedGroups, setResolvedGroups] = useState(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['duplicates'],
    queryFn: () => base44.functions.invoke('detectDuplicates', { action: 'find_all' }).then(r => r.data),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ masterId, duplicateIds }) =>
      base44.functions.invoke('mergeDuplicateContacts', { master_id: masterId, duplicate_ids: duplicateIds }),
    onSuccess: () => {
      toast.success('Leads merged successfully!');
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['duplicates']);
    },
    onError: () => toast.error('Merge failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      toast.success('Lead deleted');
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['duplicates']);
    },
  });

  const markResolved = (realIndex) => {
    setResolvedGroups(prev => new Set([...prev, realIndex]));
    toast.success('Marked as resolved');
  };

  const groups = data?.groups || [];
  const visibleGroups = groups.filter((_, i) => !resolvedGroups.has(i));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <GitMerge className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Duplicate Detector</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isLoading ? 'Scanning...' : `${data?.total_duplicates || 0} suspected duplicates in ${groups.length} groups`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Rescan
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{data.total_duplicates || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Duplicate Records</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{groups.filter(g => g.type === 'phone').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Phone Matches</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{groups.filter(g => g.type === 'name').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Name Matches</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Check className="w-10 h-10 mx-auto mb-3 text-green-500" />
          <p className="font-medium">No duplicates found!</p>
          <p className="text-sm mt-1">Your database is clean.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group, idx) => {
            const realIndex = groups.indexOf(group);
            const [master, ...rest] = group.leads;
            return (
              <Card key={idx} className="border-orange-200">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <CardTitle className="text-sm">
                        {group.type === 'phone' ? '📞 Same phone number' : '👤 Similar name'} — {group.leads.length} records
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      {group.type === 'phone' ? 'High confidence' : 'Medium confidence'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.leads.map((lead, i) => (
                      <div key={lead.id} className={`border rounded-lg p-3 ${i === 0 ? 'border-blue-300 bg-blue-50/50' : 'border-border'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="font-semibold text-sm">{lead.name}</p>
                              {i === 0 && <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-[10px] px-1.5 py-0">Master</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {lead.phone ? (
                                <WhatsAppPhone
                                  phone={lead.phone}
                                  name={lead.name}
                                  leadId={lead.id}
                                  size="xs"
                                  disabled={lead.do_not_contact}
                                />
                              ) : (
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> —</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{lead.email || '—'}</p>
                            <p className="text-xs text-muted-foreground capitalize">{lead.stage?.replace('_', ' ')}</p>
                            {lead.created_date && (
                              <p className="text-xs text-muted-foreground">{format(new Date(lead.created_date), 'MMM d, yyyy')}</p>
                            )}
                          </div>
                          {i > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                              onClick={() => deleteMutation.mutate(lead.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => mergeMutation.mutate({ masterId: master.id, duplicateIds: rest.map(l => l.id) })}
                      disabled={mergeMutation.isPending}
                    >
                      {mergeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                      Merge into Master
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => markResolved(realIndex)}>
                      <Check className="w-3 h-3" /> Keep Both
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}