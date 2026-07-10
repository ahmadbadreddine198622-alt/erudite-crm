import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Cloud, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Pushes a single landlord document (Emirates ID, passport, title deed, etc.) to the
// "Erudite Landlord Documents" Google Drive folder. Reuses the same uploadToGoogleDrive flow
// as Form A contracts. Shown for any document that has a file URL not already on Drive.
export default function DocumentDriveButton({ url, label, landlordName }) {
  const [status, setStatus] = useState('idle'); // idle | saving | saved

  const save = async () => {
    if (status === 'saving') return;
    setStatus('saving');
    try {
      const owner = landlordName || 'UNKNOWN';
      const safeLabel = (label || 'Document').replace(/[\\/:*?"<>|]/g, '-');
      await base44.functions.invoke('uploadToGoogleDrive', {
        file_url: url,
        fileName: `${owner} - ${safeLabel}.pdf`,
        folderPath: `Erudite Landlord Documents/${owner}`,
      });
      setStatus('saved');
      toast.success('Saved to Google Drive (Erudite Landlord Documents)');
    } catch (e) {
      setStatus('idle');
      toast.error('Google Drive save failed: ' + (e?.message || 'unknown error'));
    }
  };

  if (status === 'saved') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 6, color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
        <Check style={{ width: 12, height: 12 }} /> In Drive
      </span>
    );
  }

  return (
    <button
      onClick={save}
      disabled={status === 'saving'}
      title="Save to Google Drive"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.18)', opacity: status === 'saving' ? 0.6 : 1 }}
    >
      {status === 'saving'
        ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> Saving</>
        : <><Cloud style={{ width: 12, height: 12 }} /> Drive</>}
    </button>
  );
}