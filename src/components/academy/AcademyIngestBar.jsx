import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { UploadCloud, Loader2, FileText } from 'lucide-react';
import { GOLD, GOLD_LITE, card, label } from '@/lib/academyStyles';

export default function AcademyIngestBar() {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [corpusOnly, setCorpusOnly] = useState(false);

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
      const mode = corpusOnly ? 'corpus' : 'full';
      setProgress(corpusOnly
        ? 'Reading full book text (multi-pass page extraction)…'
        : 'Pass 1: Extracting 17 principles… then Pass 2: full book text…'
      );
      const res = await base44.functions.invoke('academyPdfIngest', { file_url: fileUrl, mode });
      const data = res.data || {};

      const created = data.principle_results?.filter(p => p.status === 'created').length || 0;
      const updated = data.principle_results?.filter(p => p.status === 'updated').length || 0;
      const errors = data.principle_results?.filter(p => p.status === 'error').length || 0;

      const parts = [];
      if (created + updated > 0) parts.push(`${created + updated} principles (${created} new, ${updated} updated${errors ? `, ${errors} errors` : ''})`);
      if (data.corpus_chunks_created > 0) parts.push(`${data.corpus_chunks_created} corpus chunks stored (${data.text_passes || 0} text passes)`);
      if (data.corpus_chunks_deleted > 0) parts.push(`${data.corpus_chunks_deleted} old chunks cleared`);

      toast.success(parts.length ? `Ingest complete: ${parts.join(' · ')}` : 'Ingest complete.');
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
    <div style={{ ...card, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <UploadCloud size={18} style={{ color: GOLD, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...label, color: GOLD, fontSize: 10 }}>Curriculum Upload</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0', fontFamily: "'Inter',sans-serif" }}>
            {busy ? progress : 'Upload the curriculum PDF — extracts 17 principles + full book text for Mentor search.'}
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={corpusOnly}
          onChange={(e) => setCorpusOnly(e.target.checked)}
          disabled={busy}
          style={{ accentColor: GOLD }}
        />
        <FileText size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: "'Inter',sans-serif" }}>
          Corpus only (skip principles — just refresh full book text)
        </span>
      </label>
    </div>
  );
}