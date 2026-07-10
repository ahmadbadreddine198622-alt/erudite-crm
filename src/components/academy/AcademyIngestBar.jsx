import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { UploadCloud, Loader2 } from 'lucide-react';
import { GOLD, GOLD_LITE, card, label } from '@/lib/academyStyles';

export default function AcademyIngestBar() {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      e.target.value = '';
      return;
    }

    setBusy(true);
    setProgress('Uploading PDF…');
    try {
      // 1. Upload the file
      const upRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = upRes.file_url;

      // 2. Ingest
      setProgress('AI is reading the PDF and extracting 17 principles…');
      const res = await base44.functions.invoke('academyPdfIngest', { file_url: fileUrl });
      const data = res.data || {};

      const created = data.principle_results?.filter(p => p.status === 'created').length || 0;
      const updated = data.principle_results?.filter(p => p.status === 'updated').length || 0;
      const errors = data.principle_results?.filter(p => p.status === 'error').length || 0;

      toast.success(`Ingested ${created + updated} principles (${created} new, ${updated} updated${errors ? `, ${errors} errors` : ''}). ${data.corpus_chunks_created || 0} corpus chunks stored.`);
      setProgress('');
    } catch (err) {
      toast.error(err?.message || 'Ingest failed.');
      setProgress('');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
      <UploadCloud size={18} style={{ color: GOLD, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...label, color: GOLD, fontSize: 10 }}>Curriculum Upload</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0', fontFamily: "'Inter',sans-serif" }}>
          {busy ? progress : 'Upload a PDF to extract & sync all 17 principles into the Academy.'}
        </p>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif",
          background: busy ? 'rgba(255,255,255,0.05)' : 'rgba(212,175,55,0.15)',
          border: busy ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(212,175,55,0.35)',
          color: busy ? 'rgba(255,255,255,0.4)' : GOLD_LITE,
          cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
        {busy ? 'Processing…' : 'Upload PDF'}
      </button>
    </div>
  );
}