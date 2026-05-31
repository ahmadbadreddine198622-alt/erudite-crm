// TenancyContractPDF.jsx — thin client wrappers that trigger the server-side
// `generateTenancyContractPDF` Deno function. The function overlays the
// TenancyContract data + Erudite stamp/signature onto the official DLD
// Ejari Unified Tenancy Contract template (3-page A4 PDF) using pdf-lib,
// uploads the result to Base44 file storage, and writes pdf_url back.
//
// The previous client-side jsPDF renderer (built from scratch in English only)
// has been removed — Term 13 of the DLD template states the Arabic text is
// legally controlling, so we must preserve the official bilingual template
// rather than re-typesetting it.
//
// Component exports kept stable so existing call sites (TenancyContracts.jsx,
// ContractPreviewDialog.jsx) need no changes beyond what's wired here:
//   - <GenerateTenancyPDFButton contract={...} />
//   - <ViewTenancyPDFLink       contract={...} />

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function GenerateTenancyPDFButton({ contract, size = 'sm', variant = 'outline' }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!contract?.id) {
      toast.error('Contract not yet saved');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('generateTenancyContractPDF', {
        tenancyContractId: contract.id,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      if (!data?.pdf_url) throw new Error('No pdf_url returned by function');

      toast.success('Ejari Tenancy Contract generated', {
        description: contract.tenant_name || contract.id,
      });
      // Match the query keys the tenancy pages/dialogs use, both spellings.
      queryClient.invalidateQueries({ queryKey: ['tenancy-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['tenancyContracts'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-contract', contract.id] });
      return data.pdf_url;
    } catch (err) {
      console.error('Tenancy PDF generation failed:', err);
      toast.error("Couldn't generate Tenancy Contract PDF", {
        description: err?.message || 'unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const alreadyGenerated = !!contract?.pdf_url;

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={loading}
      className="gap-1.5"
      title={
        alreadyGenerated
          ? 'Regenerate the Ejari Tenancy Contract PDF (overwrites the stored URL)'
          : 'Generate the Ejari Tenancy Contract PDF from the DLD template'
      }
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <FileText className="w-3.5 h-3.5" />}
      {alreadyGenerated ? 'Regenerate PDF' : 'Generate PDF'}
    </Button>
  );
}

export function ViewTenancyPDFLink({ contract }) {
  if (!contract?.pdf_url) return null;
  return (
    <a
      href={contract.pdf_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
      title="Open generated PDF in a new tab"
    >
      <ExternalLink className="w-3 h-3" />
      View
    </a>
  );
}
