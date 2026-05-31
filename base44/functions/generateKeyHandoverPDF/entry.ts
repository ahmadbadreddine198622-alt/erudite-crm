// generateKeyHandoverPDF — upload key handover PDF directly to Google Drive
// 
// This function receives the PDF data from the client and uploads it directly
// to Google Drive "Key Handover" folder.
// Returns the Drive URL for storage/reference.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { pdf_base64, file_name, landlord_first_name } = body;

    if (!pdf_base64) {
      return Response.json({ error: 'pdf_base64 is required' }, { status: 400 });
    }

    // Extract base64 data (remove data URI prefix if present)
    const base64Data = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
    
    // Generate filename with landlord's first name if provided
    const safeFirstName = landlord_first_name 
      ? landlord_first_name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
      : 'KeyHandover';
    const timestamp = new Date().toISOString().split('T')[0];
    const generatedFileName = `${safeFirstName}_${timestamp}.pdf`;
    
    // Upload directly to Google Drive "Key Handover" folder
    const driveUpload = await base44.functions.invoke('uploadToGoogleDrive', {
      fileName: file_name || generatedFileName,
      base64Content: base64Data,
      mimeType: 'application/pdf',
      folderPath: 'Key Handover'
    });
    
    if (!driveUpload?.success) {
      throw new Error('Failed to upload to Google Drive');
    }

    return Response.json({
      success: true,
      pdf_url: driveUpload.webViewLink || driveUpload.webContentLink,
      file_name: file_name || 'KeyHandover.pdf',
      drive_file_id: driveUpload.fileId,
    });
  } catch (error) {
    console.error('generateKeyHandoverPDF:', error);
    return Response.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 },
    );
  }
});