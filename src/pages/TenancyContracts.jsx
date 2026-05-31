import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, ExternalLink } from 'lucide-react';

const STATUS_COLORS = {
  draft:      'jewel-slate',
  generated:  'jewel-blue',
  signed:     'jewel-emerald',
  registered: 'jewel-gold',
};

export default function TenancyContracts() {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['tenancy-contracts'],
    queryFn: () => base44.entities.TenancyContract.list('-created_date', 50),
  });

  return (
    <div className="page-root">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title text-2xl">Tenancy Contracts</h1>
          <p className="page-subtitle mt-1">Ejari Unified Tenancy Contracts</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Contract
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
      ) : contracts.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-3">
          <FileText className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No tenancy contracts yet.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="glass-table w-full">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Lessor</th>
                <th>Property</th>
                <th>Period</th>
                <th>Annual Rent</th>
                <th>Status</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.tenant_name || '—'}</td>
                  <td>{c.lessor_name || '—'}</td>
                  <td>{[c.building_name, c.location].filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    {c.contract_period_from && c.contract_period_to
                      ? `${c.contract_period_from} → ${c.contract_period_to}`
                      : '—'}
                  </td>
                  <td className="tabular-nums">
                    {c.annual_rent_aed != null
                      ? `AED ${Number(c.annual_rent_aed).toLocaleString('en-AE')}`
                      : '—'}
                  </td>
                  <td>
                    <span className={`jewel-pill ${STATUS_COLORS[c.status] || 'jewel-slate'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.pdf_url ? (
                      <a href={c.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="gap-1 h-7">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </Button>
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}