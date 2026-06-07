import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function MarketReportUploadDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [projectName, setProjectName] = useState('');
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ pdfFile, project }) => {
      console.log('[Upload] Starting upload for project:', project);
      console.log('[Upload] File:', pdfFile.name, pdfFile.size, 'bytes');
      
      try {
        // Upload PDF
        console.log('[Upload] Step 1: Uploading file...');
        const uploadRes = await base44.integrations.Core.UploadFile({
          file: pdfFile,
        });
        console.log('[Upload] File uploaded:', uploadRes);
        console.log('[Upload] File URL:', uploadRes?.data?.file_url);

        if (!uploadRes?.data?.file_url) {
          console.error('[Upload] No file_url in response');
          throw new Error('File upload failed - no URL returned');
        }

        // Create MarketReport entity
        console.log('[Upload] Step 2: Creating MarketReport entity...');
        const reportRes = await base44.entities.MarketReport.create({
          project_name: project,
          report_file_url: uploadRes.data.file_url,
          report_date: new Date().toISOString().split('T')[0],
          source: 'dxb_interact',
          status: 'uploaded',
        });
        console.log('[Upload] MarketReport created:', reportRes);
        console.log('[Upload] Report ID:', reportRes?.id);

        if (!reportRes?.id) {
          console.error('[Upload] No ID in MarketReport response');
          throw new Error('MarketReport creation failed - no ID returned');
        }

        // Trigger analysis
        console.log('[Upload] Step 3: Invoking analyzeDXBReport...');
        const analysisRes = await base44.functions.invoke('analyzeDXBReport', {
          market_report_id: reportRes.id,
        });
        console.log('[Upload] Analysis response:', analysisRes);

        return { reportId: reportRes.id, fileName: pdfFile.name };
      } catch (err) {
        console.error('[Upload] Full error:', err);
        console.error('[Upload] Error stack:', err.stack);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log('[Upload] Success:', data);
      toast.success(`Report uploaded and analysis started for ${projectName}`);
      queryClient.invalidateQueries({ queryKey: ['market_reports'] });
      setFile(null);
      setProjectName('');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      console.error('[Upload] onError:', error);
      console.error('[Upload] Error details:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response?.data,
      });
      const msg = error?.message || error?.response?.data?.error || 'Upload failed. Check console for details.';
      toast.error(msg);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !projectName) {
      toast.error('Please select a file and enter project name');
      return;
    }
    uploadMutation.mutate({ pdfFile: file, project: projectName });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Market Report</DialogTitle>
          <DialogDescription>
            Upload a DXB Interact PDF report to extract transactions and auto-value landlord properties
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Project Name</label>
            <Input
              placeholder="e.g., Peninsula Two, Business Bay"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={uploadMutation.isPending}
            />
          </div>

          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={uploadMutation.isPending}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                {file ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Upload DXB Report PDF</p>
                    <p className="text-xs text-muted-foreground">Max 31 MB</p>
                  </>
                )}
              </div>
            </label>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Analysis will extract ~50-100 transactions and auto-value matching landlord properties based on bedroom type and area.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploadMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!file || !projectName || uploadMutation.isPending}
              className="flex-1 gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
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
      </DialogContent>
    </Dialog>
  );
}