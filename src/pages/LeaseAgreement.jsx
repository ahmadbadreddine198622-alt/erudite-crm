import React from 'react';
import { FileText, Plus, Search, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LeaseAgreement() {
  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['landlords-lease'],
    queryFn: () => base44.entities.Landlord.list('-created_date', 100),
  });

  const leaseStatusColors = {
    drafted: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    sent_for_signature: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    signed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const landlordsWithLease = landlords.filter(l => l.lease_agreement_status || l.passport_no);

  return (
    <div className="page-root">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title text-3xl mb-1">Lease Brokerage Agreement</h1>
          <p className="page-subtitle">Manage and generate lease agreements for landlords</p>
        </div>
        <Button className="gap-2">
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
          ) : landlordsWithLease.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 text-white/20" />
              <p className="text-white/40 text-sm">No lease agreements yet</p>
              <p className="text-white/30 text-xs mt-1">Generate agreements for landlords to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {landlordsWithLease.map(landlord => (
                <div
                  key={landlord.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white/60" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{landlord.full_name_en}</p>
                      <p className="text-xs text-white/40">{landlord.passport_no || 'No passport on file'}</p>
                    </div>
                  </div>
                  <Badge className={leaseStatusColors[landlord.lease_agreement_status || 'drafted']}>
                    {(landlord.lease_agreement_status || 'drafted').replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}