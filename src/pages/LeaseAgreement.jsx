import React from 'react';
import { FileText, Plus, Search, Filter, FileSignature, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function LeaseAgreement() {
  const queryClient = useQueryClient();

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['landlords-lease'],
    queryFn: () => base44.entities.Landlord.list('-created_date', 100),
  });

  // Calls the Deno function shipped in 41cfd7f. The function itself is
  // idempotent (skips when already sent_for_signature/signed unless force).
  // Toast handles both the success and the skipped path.
  const generateMutation = useMutation({
    mutationFn: (landlord_id) =>
      base44.functions.generateLeaseBrokerageAgreement({ landlord_id }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.skipped) {
        toast.info(data.reason || 'Already sent for signature.');
      } else {
        toast.success('Lease Brokerage Agreement sent for signature');
      }
      queryClient.invalidateQueries({ queryKey: ['landlords-lease'] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const pendingId = generateMutation.variables;

  const leaseStatusColors = {
    drafted: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    sent_for_signature: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    signed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  // Show landlords that already have an agreement status set (the actual
  // "lease agreements" we manage from this page). If none exist yet, fall
  // back to the most-recent landlords so per-row Generate buttons remain
  // reachable — otherwise the page is permanently empty until somebody
  // generates one from a landlord detail panel first.
  const landlordsWithLease = landlords.filter(l => l.lease_agreement_status);
  const listingLandlords = landlordsWithLease.length > 0 ? landlordsWithLease : landlords;

  return (
    <div className="page-root">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title text-3xl mb-1">Lease Brokerage Agreement</h1>
          <p className="page-subtitle">Manage and generate lease agreements for landlords</p>
        </div>
        <Button
          className="gap-2"
          title="Use the per-row Generate button in the list below to create an agreement for a specific landlord."
        >
          <Plus className="w-4 h-4" />
          Generate Agreement
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Total Landlords</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{landlords.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Drafted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {landlords.filter(l => l.lease_agreement_status === 'drafted').length}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Sent for Signature</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
              {landlords.filter(l => l.lease_agreement_status === 'sent_for_signature').length}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white/50">Signed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: 'hsl(152 69% 40%)' }}>
              {landlords.filter(l => l.lease_agreement_status === 'signed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Landlord Agreements</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Search className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-white/40">Loading...</div>
          ) : listingLandlords.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 text-white/20" />
              <p className="text-white/40 text-sm">No landlords yet</p>
              <p className="text-white/30 text-xs mt-1">Add a landlord to generate an agreement</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listingLandlords.map(landlord => {
                const status = landlord.lease_agreement_status;
                // Idempotency guard mirrors the server side — disable the
                // button when we know the function will reject the call.
                const locked = status === 'sent_for_signature' || status === 'signed';
                const buttonLabel = !status ? 'Generate'
                  : status === 'sent_for_signature' ? 'Sent'
                  : status === 'signed' ? 'Signed'
                  : status === 'cancelled' ? 'Regenerate'
                  : 'Regenerate';
                const isThisPending = generateMutation.isPending && pendingId === landlord.id;
                return (
                  <div
                    key={landlord.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-white/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{landlord.full_name_en}</p>
                        <p className="text-xs text-white/40 truncate">{landlord.passport_no || 'No passport on file'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status && (
                        <Badge className={leaseStatusColors[status] || ''}>
                          {status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateMutation.mutate(landlord.id)}
                        disabled={isThisPending || locked || generateMutation.isPending}
                        className="gap-1.5"
                        title={
                          locked
                            ? `Already ${status.replace(/_/g, ' ')} — idempotency guard blocks regeneration`
                            : 'Generate Lease Brokerage Agreement and send to owner via DocuSign'
                        }
                      >
                        {isThisPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <FileSignature className="w-3.5 h-3.5" />}
                        {buttonLabel}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}