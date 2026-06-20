import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STAGES = {
  idle: null,
  uploading: 'Uploading PDF…',
  creating: 'Creating report record…',
  extracting: 'Extracting transactions (Claude AI)…',
  valuing: 'Valuing landlord properties…',
  done: 'Complete',
  failed: null,
};

export default function MarketReportUploadDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [stage, setStage] = useState('idle');
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ pdfFile, project }) => {
      // Step 1: upload file
      setStage('uploading');
      const uploadRes = await base44.integrations.Core.UploadFile({ file: pdfFile });
      const fileUrl = uploadRes?.file_url || uploadRes?.data?.file_url;
      if (!fileUrl) throw new Error('File upload failed — no URL returned');

      // Step 2: create MarketReport entity
      setStage('creating');
      const reportRec = await base44.entities.MarketReport.create({
        project_name: project.trim(),
        report_file_url: fileUrl,
        report_date: new Date().toISOString().split('T')[0],
        source: 'dxb_interact',
        status: 'uploaded',
      });
      if (!reportRec?.id) throw new Error('MarketReport creation failed — no ID returned');

      // Step 3: invoke analysis (extraction + valuation)
      setStage('extracting');
      const analysisRes = await base44.functions.invoke('analyzeDXBReport', {
        market_report_id: reportRec.id,
      });
      const data = analysisRes?.data || {};

      if (data.status === 'failed' || data.ok === false) {
        throw new Error(data.error || 'Analysis failed');
      }

      setStage('done');
      return {
        reportId: reportRec.id,
        transactions_extracted: data.transactions_extracted ?? data.transactions,
        outliers_excluded: data.outliers_excluded ?? 0,
        column_mismatch_skipped: data.column_mismatch_skipped ?? 0,
        clean_comps: data.clean_comps ?? 0,
        properties_valued: data.properties_valued ?? 0,
        median_price_sqft: data.median_price_sqft,
      };
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['market_reports'] });
      queryClient.invalidateQueries({ queryKey: ['landlord_properties'] });
      onSuccess?.();
    },
    onError: (error) => {
      setStage('failed');
      const msg = error?.message || error?.response?.data?.error || 'Upload failed';
      toast.error(msg);
      console.error('[MarketReportUpload] error:', error);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !projectName.trim()) {
      toast.error('Please select a file and enter a project name');
      return;
    }
    setResult(null);
    uploadMutation.mutate({ pdfFile: file, project: projectName });
  };

  const handleClose = () => {
    if (uploadMutation.isPending) return;
    setFile(null);
    setProjectName('');
    setStage('idle');
    setResult(null);
    onClose();
  };

  const isPending = uploadMutation.isPending;
  const stageLabel = STAGES[stage];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Market Report</DialogTitle>
          <DialogDescription>
            Upload a DXB Interact "Sales Performance Summary" PDF to extract transactions and auto-value landlord properties.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* ── Success state ── */
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Analysis complete
              </div>
              <div className="text-xs space-y-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                <p>✅ <strong>{result.clean_comps}</strong> clean transactions extracted</p>
                {result.outliers_excluded > 0 && (
                  <p>🚫 <strong>{result.outliers_excluded}</strong> outlier rows excluded (fractional transfers)</p>
                )}
                {result.column_mismatch_skipped > 0 && (
                  <p>⚠️ <strong>{result.column_mismatch_skipped}</strong> rows skipped (column-order mismatch)</p>
                )}
                {result.median_price_sqft && (
                  <p>📊 Building median: <strong>{result.median_price_sqft.toLocaleString()} AED/sqft</strong></p>
                )}
                {result.properties_valued > 0 && (
                  <p>🏠 <strong>{result.properties_valued}</strong> landlord {result.properties_valued === 1 ? 'property' : 'properties'} auto-valued</p>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          /* ── Upload form ── */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Project Name</label>
              <Input
                placeholder="e.g., Peninsula 2, Business Bay"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Use a consistent name — "Peninsula 2" and "Peninsula Two" match the same building.
              </p>
            </div>

            <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <label className={isPending ? 'cursor-default' : 'cursor-pointer'}>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isPending}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  {file ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Upload DXB Interact PDF</p>
                      <p className="text-xs text-muted-foreground">Max 31 MB</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* Live status during processing */}
            {isPending && stageLabel && (
              <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
                <p className="text-xs font-medium" style={{ color: 'hsl(38 92% 50%)' }}>{stageLabel}</p>
              </div>
            )}

            {/* Error state */}
            {stage === 'failed' && !isPending && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <p className="text-xs text-red-400">Analysis failed. Check the console for details and try again.</p>
              </div>
            )}

            {!isPending && stage === 'idle' && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <p className="text-xs text-amber-400">
                    Extracts all transactions, validates column order, excludes partial-transfer garbage rows, and auto-values matching landlord properties. Takes ~30–60 seconds.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!file || !projectName.trim() || isPending}
                className="flex-1 gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {stage === 'uploading' ? 'Uploading…' : stage === 'creating' ? 'Creating…' : 'Analyzing…'}
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}