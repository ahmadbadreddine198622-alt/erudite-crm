import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

// Vite bundles src/assets/* — import as a URL so fetch() can load it at runtime
import ejariTemplateUrl from '@/assets/ejari_unified_tenancy_contract.pdf?url';

export default function SetupEjariAssets() {
  const queryClient = useQueryClient();
  const [lastTemplateUrl, setLastTemplateUrl] = useState(null);

  const { data: setups = [] } = useQuery({
    queryKey: ['ejari-setup'],
    queryFn: () => base44.entities.EjariSetup.list(),
  });
  const setup = setups[0];
  const isReady = setup?.stamp_url && setup?.sig_url && setup?.template_url;

  const setupMutation = useMutation({
    mutationFn: async () => {
      // Fetch all three assets from the frontend (same-origin requests)
      const [templateBlob, stampBlob, sigBlob] = await Promise.all([
        fetch(ejariTemplateUrl).then(r => { if (!r.ok) throw new Error('Template not found'); return r.blob(); }),
        fetch('/erudite-stamp.png').then(r => { if (!r.ok) throw new Error('Stamp PNG not found in /public'); return r.blob(); }),
        fetch('/erudite-signature.png').then(r => { if (!r.ok) throw new Error('Signature PNG not found in /public'); return r.blob(); }),
      ]);

      // Upload all three to Base44 public file storage
      const [templateRes, stampRes, sigRes] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: templateBlob }),
        base44.integrations.Core.UploadFile({ file: stampBlob }),
        base44.integrations.Core.UploadFile({ file: sigBlob }),
      ]);

      const data = {
        template_url: templateRes.file_url,
        stamp_url:    stampRes.file_url,
        sig_url:      sigRes.file_url,
      };

      // Save to EjariSetup entity (upsert)
      if (setup?.id) {
        await base44.entities.EjariSetup.update(setup.id, data);
      } else {
        await base44.entities.EjariSetup.create(data);
      }

      return data;
    },
    onSuccess: (data) => {
      setLastTemplateUrl(data.template_url);
      queryClient.invalidateQueries({ queryKey: ['ejari-setup'] });
      toast.success('Assets uploaded! Copy the template URL below into the EJARI_TEMPLATE_FILE_URL secret.');
    },
    onError: (e) => toast.error('Setup failed: ' + e.message),
  });

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied to clipboard');
  };

  const displayUrl = lastTemplateUrl || setup?.template_url;

  return (
    <div className="glass-card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        {isReady
          ? <CheckCircle className="w-4 h-4 text-emerald-400" />
          : <AlertCircle className="w-4 h-4 text-amber-400" />}
        <span className="text-sm font-medium">
          {isReady ? 'Ejari PDF Assets Configured' : 'Ejari PDF Setup Required'}
        </span>
      </div>

      {!isReady && (
        <p className="text-xs text-white/60 mb-3">
          Click the button below to upload the DLD Ejari template and Erudite brand assets to Base44
          storage. This is a one-time setup. Afterwards, copy the template URL into the{' '}
          <strong className="text-white/80">EJARI_TEMPLATE_FILE_URL</strong> secret in your app settings.
        </p>
      )}

      <Button
        size="sm"
        variant={isReady ? 'ghost' : 'outline'}
        onClick={() => setupMutation.mutate()}
        disabled={setupMutation.isPending}
        className="gap-1.5"
      >
        {setupMutation.isPending ? (
          'Uploading…'
        ) : (
          <><Upload className="w-3.5 h-3.5" /> {isReady ? 'Re-upload Assets' : 'Upload & Configure Assets'}</>
        )}
      </Button>

      {displayUrl && (
        <div className="mt-3 p-3 rounded bg-amber-500/10 border border-amber-500/30">
          <p className="text-xs font-semibold text-amber-400 mb-1">
            Set this as <code className="bg-amber-500/20 px-1 rounded">EJARI_TEMPLATE_FILE_URL</code> in app secrets:
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-mono text-white/70 break-all flex-1">{displayUrl}</p>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copyUrl(displayUrl)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}