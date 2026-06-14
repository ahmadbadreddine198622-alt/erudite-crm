import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Form F upload / view / replace widget.
 * Props:
 *   lead         — the full lead object (needs lead.id and lead.form_f_url)
 *   onUpdated    — callback(newUrl) so the parent can optimistically update its state
 */
export default function FormFUpload({ lead, onUpdated }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Lead.update(lead.id, { form_f_url: file_url });
      onUpdated?.(file_url);
      toast.success('Form F uploaded');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      // reset input so the same file can be re-selected for replace
      e.target.value = '';
    }
  };

  const hasFile = !!lead.form_f_url;

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Form F</span>
      </div>

      {hasFile ? (
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={lead.form_f_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View / Download
          </a>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
            {uploading
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Replacing…</>
              : <><RefreshCw className="w-3 h-3" /> Replace</>}
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 p-4 rounded-lg cursor-pointer transition-all"
          style={{ border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)' }}>
          {uploading
            ? <><Loader2 className="w-5 h-5 animate-spin text-amber-400" /><span className="text-xs text-muted-foreground">Uploading…</span></>
            : <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Click to upload Form F</span><span className="text-[10px] text-muted-foreground/60">PDF, Word, or image</span></>}
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
    </div>
  );
}