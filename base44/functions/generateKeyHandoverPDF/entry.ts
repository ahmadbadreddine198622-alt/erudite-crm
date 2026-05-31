// generateKeyHandoverPDF — upload key handover PDF to Google Drive
// 
// This function receives the PDF data from the client, uploads it to
// Base44 storage, then syncs to Google Drive "PropCRM PDFs" folder.
// Returns the Drive URL for storage/reference.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { pdf_base64, file_name } = body;

    if (!pdf_base64) {
      return Response.json({ error: 'pdf_base64 is required' }, { status: 400 });
    }

    // Convert base64 to blob and upload to Base44 storage
    const base64Data = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
    const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const uploadRes = await base44.integrations.Core.UploadFile({
      file: new Blob([pdfBytes], { type: 'application/pdf' }),
    });
    
    let pdf_url = uploadRes?.file_url;
    if (!pdf_url) throw new Error('Failed to upload PDF to Base44 storage');

    // Upload to Google Drive "PropCRM PDFs" folder
    try {
      const driveUpload = await base44.functions.invoke('uploadToGoogleDrive', {
        file_url: pdf_url,
        file_name: file_name || `KeyHandover_${new Date().toISOString().split('T')[0]}.pdf`,
        folder_name: 'PropCRM PDFs'
      });
      
      if (driveUpload?.success) {
        pdf_url = driveUpload.file_url;
      }
    } catch (error) {
      console.error('Google Drive upload failed:', error.message);
      // Continue with Base44 storage URL as fallback
    }

    return Response.json({
      success: true,
      pdf_url,
      file_name: file_name || 'KeyHandover.pdf',
    });
  } catch (error) {
    console.error('generateKeyHandoverPDF:', error);
    return Response.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 },
    );
  }
});