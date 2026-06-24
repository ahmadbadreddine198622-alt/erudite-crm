import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Cloud, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Pushes a single Form A contract PDF to the "Erudite Form A Contracts" Google Drive folder,
// exactly like the original upload-and-confirm flow. Shown for contracts that have a PDF but
// aren't yet a Google Drive link.
export default function FormADriveButton({ contract, landlord }) {
  const [status, setStatus] = useState('idle'); // idle | saving | saved

  const save = async () => {
    if (status === 'saving') return;
    setStatus('saving');
    try {
      const contractNo = contract.contract_number || 'UNKNOWN';
      const ownerName = landlord.full_name_en || landlord.full_name || 'UNKNOWN';
      const projectName = contract.project_name || landlord.project_name || null;
      const folderPath = projectName
        ? `Erudite Form A Contracts/${projectName}`
        : 'Erudite Form A Contracts';
      await base44.functions.invoke('uploadToGoogleDrive', {
        file_url: contract.pdf_url,
        fileName: `${contractNo} - ${ownerName}.pdf`,
        folderPath,
      });
      setStatus('saved');
      toast.success('Saved to Google Drive (Erudite Form A Contracts)');
    } catch (e) {
      setStatus('idle');
      toast.error('Google Drive save failed: ' + (e?.message || 'unknown error'));
    }
  };

  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
        <Check className="w-3 h-3" /> In Drive
      </span>
    );
  }

  return (
    <button
      onClick={save}
      disabled={status === 'saving'}
      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-60"
      title="Save to Google Drive"
    >
      {status === 'saving'
        ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving</>
        : <><Cloud className="w-3 h-3" /> Drive</>}
    </button>
  );
}