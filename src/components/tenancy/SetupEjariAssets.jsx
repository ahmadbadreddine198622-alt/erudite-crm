import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function SetupEjariAssets() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [lastTemplateUrl, setLastTemplateUrl] = useState(null);

  const { data: setups = [] } = useQuery({
    queryKey: ['ejari-setup'],
    queryFn: () => base44.entities.EjariSetup.list(),
  });
  const setup = setups[0];
  const stampOk = !!setup?.stamp_url;
  const sigOk   = !!setup?.sig_url;
  const isReady = !!setup?.template_url; // Only template required; stamp/sig optional

  // Upload stamp + sig from /public (same-origin fetch)
  const uploadBrandMutation = useMutation({
    mutationFn: async () => {
      const [stampBlob, sigBlob] = await Promise.all([
        fetch('/erudite-stamp.png').then(r => { if (!r.ok) throw new Error('erudite-stamp.png not found in /public'); return r.blob(); }),
        fetch('/erudite-signature.png').then(r => { if (!r.ok) throw new Error('erudite-signature.png not found in /public'); return r.blob(); }),
      ]);
      const [stampRes, sigRes] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: stampBlob }),
        base44.integrations.Core.UploadFile({ file: sigBlob }),
      ]);
      const data = { stamp_url: stampRes.file_url, sig_url: sigRes.file_url };
      if (setup?.id) {
        await base44.entities.EjariSetup.update(setup.id, data);
      } else {
        await base44.entities.EjariSetup.create(data);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ejari-setup'] });
      toast.success('Stamp & signature uploaded!');
    },
    onError: (e) => toast.error('Brand upload failed: ' + e.message),
  });

  // Upload template from a user-selected file
  const uploadTemplateMutation = useMutation({
    mutationFn: async (file) => {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res.file_url;
      const record = setups[0]; // re-read latest
      if (record?.id) {
        await base44.entities.EjariSetup.update(record.id, { template_url: url });
      } else {
        await base44.entities.EjariSetup.create({ template_url: url });
      }
      return url;
    },
    onSuccess: (url) => {
      setLastTemplateUrl(url);
      queryClient.invalidateQueries({ queryKey: ['ejari-setup'] });
      toast.success('Template uploaded! Copy the URL into the EJARI_TEMPLATE_FILE_URL secret.');
    },
    onError: (e) => toast.error('Template upload failed: ' + e.message),
  });

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied!');
  };

  const displayUrl = lastTemplateUrl || setup?.template_url;

  return (
    <div className="glass-card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        {isReady
          ? <CheckCircle className="w-4 h-4 text-emerald-400" />
          : <AlertCircle className="w-4 h-4 text-amber-400" />}
        <span className="text-sm font-medium">
          {isReady ? 'Ejari PDF Ready (stamp/signature optional)' : 'Ejari PDF Setup: Template Required'}
        </span>
      </div>

      <div className="space-y-3">
        {/* Step 1: Brand assets (optional) */}
        <div className="flex items-center justify-between text-xs">
          <span className={stampOk && sigOk ? 'text-emerald-400' : 'text-white/60'}>
            {stampOk && sigOk ? '✓ Stamp & signature uploaded (optional)' : 'Optional — Upload stamp & signature for branding'}
          </span>
          {(!stampOk || !sigOk) && (
            <Button
              size="sm" variant="outline"
              onClick={() => uploadBrandMutation.mutate()}
              disabled={uploadBrandMutation.isPending}
              className="gap-1.5 h-7 text-xs"
            >
              {uploadBrandMutation.isPending ? 'Uploading…' : <><Upload className="w-3 h-3" /> Upload Brand</>}
            </Button>
          )}
        </div>

        {/* Step 2: Template PDF */}
        <div className="flex items-center justify-between text-xs">
          <span className={setup?.template_url ? 'text-emerald-400' : 'text-white/60'}>
            {setup?.template_url ? '✓ Template uploaded' : 'Step 2 — Upload the DLD Ejari template PDF'}
          </span>
          <Button
            size="sm" variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadTemplateMutation.isPending}
            className="gap-1.5 h-7 text-xs"
          >
            {uploadTemplateMutation.isPending ? 'Uploading…' : <><FileText className="w-3 h-3" /> {setup?.template_url ? 'Re-upload' : 'Choose PDF'}</>}
          </Button>
          <input
            ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplateMutation.mutate(f); e.target.value = ''; }}
          />
        </div>

        {/* Show template URL to copy into secret */}
        {displayUrl && (
          <div className="mt-1 p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <p className="text-[10px] font-semibold text-amber-400 mb-1">
              Also set <code className="bg-amber-500/20 px-1 rounded">EJARI_TEMPLATE_FILE_URL</code> secret to:
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-mono text-white/70 break-all flex-1">{displayUrl}</p>
              <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => copyUrl(displayUrl)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}