import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Upload, ShieldCheck, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const DOC_LABELS = {
  passport: 'Passport',
  emirates_id: 'Emirates ID',
  noc: 'NOC from Developer',
  form_a: 'Form A',
};

const STATUS_CONFIG = {
  missing: {
    label: 'Missing',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: AlertCircle,
  },
  received: {
    label: 'Received',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  verified: {
    label: 'Verified',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
};

function DocRow({ doc, landlordId, onMutated }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.missing;
  const StatusIcon = statusCfg.icon;

  const updateMutation = useMutation({
    mutationFn: (payload) =>
      base44.functions.invoke('updateLandlordDocument', { landlord_id: landlordId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-docs', landlordId] });
      onMutated?.();
    },
    onError: (e) => toast.error('Update failed: ' + e.message),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateMutation.mutateAsync({
        document_type: doc.document_type,
        status: 'received',
        file_url,
      });
      toast.success(`${DOC_LABELS[doc.document_type]} uploaded`);
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const markVerified = () => {
    updateMutation.mutate({
      document_type: doc.document_type,
      status: 'verified',
      file_url: doc.file_url,
      notes: doc.notes,
    });
  };

  const isPending = uploading || updateMutation.isPending;

  return (
    <div
      className="p-3 rounded-lg border space-y-2"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${doc.status === 'verified' ? 'rgba(16,185,129,0.2)' : doc.status === 'received' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${doc.status === 'verified' ? 'text-emerald-400' : doc.status === 'received' ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {DOC_LABELS[doc.document_type]}
          </span>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 border ${statusCfg.className}`}>
          {statusCfg.label}
        </Badge>
      </div>

      {/* File link */}
      {doc.file_url && (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline pl-5"
        >
          <ExternalLink className="w-3 h-3" /> View document
        </a>
      )}

      {/* Verified meta */}
      {doc.status === 'verified' && doc.verified_by_email && (
        <p className="text-[10px] text-muted-foreground pl-5">
          Verified by {doc.verified_by_email.split('@')[0]}
          {doc.verified_at ? ` · ${new Date(doc.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
        </p>
      )}

      {/* Actions */}
      {doc.status !== 'verified' && (
        <div className="flex gap-2 pl-5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {doc.file_url ? 'Replace' : 'Upload'}
          </button>

          {doc.status === 'received' && (
            <button
              onClick={markVerified}
              disabled={isPending}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
              Mark Verified
            </button>
          )}
        </div>
      )}

      {doc.notes && (
        <p className="text-[10px] text-muted-foreground pl-5 italic">{doc.notes}</p>
      )}
    </div>
  );
}

export default function DocumentChecklist({ landlordId }) {
  const { data: docsResponse, isLoading } = useQuery({
    queryKey: ['landlord-docs', landlordId],
    queryFn: () => base44.functions.invoke('getLandlordDocuments', { landlord_id: landlordId }),
    enabled: !!landlordId,
  });

  const docs = docsResponse?.data?.documents || [];

  const verifiedCount = docs.filter((d) => d.status === 'verified').length;
  const receivedCount = docs.filter((d) => d.status === 'received').length;
  const allVerified = docs.length > 0 && verifiedCount === docs.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Owner Documents
        </p>
        <Badge
          variant="outline"
          className={`text-[10px] border ${
            allVerified
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {verifiedCount}/{docs.length} verified
          {receivedCount > 0 && !allVerified ? ` · ${receivedCount} received` : ''}
        </Badge>
      </div>

      {docs.map((doc) => (
        <DocRow key={doc.document_type} doc={doc} landlordId={landlordId} />
      ))}
    </div>
  );
}