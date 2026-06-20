import React from 'react';
import { FileCheck, Eye, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function FormAContractsList({ landlord }) {
  const contracts = Array.isArray(landlord.form_a_contracts) && landlord.form_a_contracts.length > 0
    ? landlord.form_a_contracts
    : (landlord.form_a_contract_number ? [{
        contract_number: landlord.form_a_contract_number,
        unit: landlord.unit_reference || null,
        pdf_url: landlord.form_a_pdf_url || null,
        mandate_type: landlord.mandate_type || null,
        mandate_status: landlord.mandate_status || null,
        mandate_start_date: landlord.mandate_start_date || null,
        mandate_expires_at: landlord.mandate_expires_at || null,
        asking_price_aed: landlord.asking_price_aed || null,
      }] : []);
  
  if (contracts.length === 0) {
    return (
      <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <FileCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-display)' }}>Form A Contracts</span>
        </div>
        <p className="text-xs text-muted-foreground">No Form A contracts on record</p>
      </div>
    );
  }
  
  return (
    <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-3">
        <FileCheck className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-display)' }}>Form A Contracts</span>
      </div>
      <div className="space-y-2">
        {contracts.map((contract, idx) => (
          <div
            key={contract.contract_number || idx}
            className="p-2.5 rounded-lg border"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-accent truncate" style={{ color: 'hsl(38 92% 55%)' }}>
                  {contract.contract_number || 'Unknown'}
                </p>
                {contract.unit && (
                  <p className="text-xs text-muted-foreground mt-0.5">Unit: {contract.unit}</p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {contract.pdf_url && (
                  <>
                    <a
                      href={contract.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
                      title="View PDF"
                    >
                      <Eye className="w-3 h-3" /> View
                    </a>
                    <a
                      href={(() => {
                        const url = contract.pdf_url || '';
                        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
                        return url;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
              {contract.mandate_type && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs px-2 py-1 border-amber-500/30 text-amber-400 bg-amber-500/10">
                    {contract.mandate_type.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
              {contract.mandate_status && (
                <div className="text-xs text-muted-foreground">
                  Status: <span className={
                    contract.mandate_status === 'form_a_signed' ? 'text-emerald-500 font-semibold' :
                    contract.mandate_status === 'expired' ? 'text-red-500 font-semibold' :
                    contract.mandate_status === 'cancelled' ? 'text-slate-500 font-semibold' : 'text-amber-400 font-semibold'
                  }>{contract.mandate_status.replace(/_/g, ' ')}</span>
                </div>
              )}
              {contract.mandate_expires_at && (
                <div className="text-xs text-muted-foreground">
                  Expires: <span className="text-foreground font-medium">{new Date(contract.mandate_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              {contract.asking_price_aed && (
                <div className="text-xs text-accent font-semibold">
                  AED {(contract.asking_price_aed / 1000000).toFixed(2)}M
                </div>
              )}
              {(() => {
                const commissionPct = contract.commission_pct_negotiated || landlord.commission_pct_negotiated;
                if (!commissionPct || !contract.asking_price_aed) return null;
                const commissionAmount = contract.asking_price_aed * (commissionPct / 100);
                return (
                  <div className="text-xs" style={{ color: 'hsl(38 92% 55%)', fontWeight: 600 }}>
                    Commission: {commissionPct}% · AED {commissionAmount.toLocaleString('en-US')}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}