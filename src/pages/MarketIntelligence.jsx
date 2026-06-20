import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeButton from '@/components/erudite/EruditeButton';
import { LineChart, MapPin, Building2, CheckCircle2, AlertCircle, Loader2, TrendingUp, BarChart2, FileText } from 'lucide-react';
import MarketReportUploadDialog from '@/components/landlord/MarketReportUploadDialog';

const STATUS_STYLE = {
  analyzed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  extracting: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  uploaded: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function fmt(n, decimals = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
}
function fmtM(n) {
  if (n == null) return '—';
  return `AED ${(n / 1e6).toFixed(2)}M`;
}

export default function MarketIntelligence() {
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['market_reports'],
    queryFn: () => base44.entities.MarketReport.list('-report_date', 100),
  });

  // Aggregate stats across all analyzed reports
  const analyzedReports = reports.filter(r => r.status === 'analyzed');
  const totalTransactions = analyzedReports.reduce((s, r) => s + (r.transactions_count || 0), 0);
  const allPsf = analyzedReports.map(r => r.median_price_sqft).filter(Boolean);
  const avgPsf = allPsf.length ? Math.round(allPsf.reduce((a, b) => a + b, 0) / allPsf.length) : null;

  return (
    <EruditePage
      title="Market Intelligence"
      subtitle="DXB Interact reports — real extracted transaction data"
      actions={
        <EruditeButton icon={LineChart} onClick={() => setUploadOpen(true)}>
          Upload Report
        </EruditeButton>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat
              label="Reports Analyzed"
              value={isLoading ? '…' : analyzedReports.length.toString()}
              trend={analyzedReports.length > 0 ? 'up' : undefined}
            />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat
              label="Total Transactions"
              value={isLoading ? '…' : totalTransactions.toLocaleString()}
              trend={totalTransactions > 0 ? 'up' : undefined}
            />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat
              label="Avg Median Price/sqft"
              value={isLoading ? '…' : avgPsf ? `AED ${fmt(avgPsf)}` : '—'}
            />
          </div>
        </EruditeCard>
      </div>

      {/* Reports list */}
      <EruditeSection title="Market Reports" subtitle="DXB Interact" icon={LineChart}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <EruditeEmptyState
            icon={Building2}
            title="No reports uploaded yet"
            description="Upload a DXB Interact Sales Performance Summary PDF to extract transaction data"
            action={
              <EruditeButton variant="primary" onClick={() => setUploadOpen(true)}>
                Upload Report
              </EruditeButton>
            }
          />
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <EruditeCard key={report.id}>
                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {report.project_name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[report.status] || STATUS_STYLE.uploaded}`}>
                          {report.status === 'analyzed' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
                          {report.status === 'failed' && <AlertCircle className="w-2.5 h-2.5 mr-1" />}
                          {report.status === 'extracting' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                          {report.status}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {report.source?.replace(/_/g, ' ')} · {report.report_date}
                      </p>
                    </div>
                    {report.report_file_url && (
                      <a
                        href={report.report_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/10 transition-colors shrink-0"
                        style={{ color: 'rgba(255,255,255,0.5)' }}
                      >
                        <FileText className="w-3 h-3" /> PDF
                      </a>
                    )}
                  </div>

                  {/* Key stats grid */}
                  {report.status === 'analyzed' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Transactions</p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{fmt(report.transactions_count)}</p>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Median Price/sqft</p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>
                          {report.median_price_sqft ? `AED ${fmt(report.median_price_sqft)}` : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Median Price</p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>
                          {fmtM(report.median_price_aed)}
                        </p>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Pre/Post Event</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {report.median_price_sqft_pre_event && (
                            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                              {fmt(report.median_price_sqft_pre_event)}
                            </span>
                          )}
                          {report.median_price_sqft_pre_event && report.median_price_sqft_post_event && (
                            <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                          )}
                          {report.median_price_sqft_post_event && (
                            <span className="text-[10px] font-bold text-emerald-400">
                              {fmt(report.median_price_sqft_post_event)}
                            </span>
                          )}
                          {!report.median_price_sqft_pre_event && !report.median_price_sqft_post_event && (
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analysis summary */}
                  {report.analysis_summary && (
                    <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {report.analysis_summary}
                      </p>
                    </div>
                  )}
                </div>
              </EruditeCard>
            ))}
          </div>
        )}
      </EruditeSection>

      <MarketReportUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => refetch()}
      />
    </EruditePage>
  );
}