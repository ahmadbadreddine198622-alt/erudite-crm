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
      // Upload PDF
      const uploadRes = await base44.integrations.Core.UploadFile({
        file: pdfFile,
      });

      if (!uploadRes?.data?.file_url) {
        throw new Error('File upload failed');
      }

      // Create MarketReport entity
      const reportRes = await base44.entities.MarketReport.create({
        project_name: project,
        report_file_url: uploadRes.data.file_url,
        report_date: new Date().toISOString().split('T')[0],
        source: 'dxb_interact',
        status: 'uploaded',
      });

      // Trigger analysis
      await base44.functions.invoke('analyzeDXBReport', {
        market_report_id: reportRes.id,
      });

      return { reportId: reportRes.id, fileName: pdfFile.name };
    },
    onSuccess: (data) => {
      toast.success(`Report uploaded and analysis started for ${projectName}`);
      queryClient.invalidateQueries({ queryKey: ['market_reports'] });
      setFile(null);
      setProjectName('');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error?.message || 'Upload failed');
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