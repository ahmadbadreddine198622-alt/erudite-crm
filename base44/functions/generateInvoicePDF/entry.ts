// generateInvoicePDF — persist the PDF URL for an invoice.
// Uploads invoice PDFs to Google Drive "Finance/Invoices" folder.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const invoice_id = body?.invoice_id;
    const file_url = body?.file_url;
    const file_name = body?.file_name || null;

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }
    if (!file_url || typeof file_url !== 'string' || !file_url.trim()) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Make sure the invoice actually exists before writing — return 404 if not.
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Upload to Google Drive "Finance/Invoices" folder
    let pdf_url = file_url;
    try {
      console.log('Attempting Google Drive upload for invoice:', invoice_id);
      
      // Get Google Drive connection
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
      if (!accessToken) {
        throw new Error('Google Drive not connected');
      }

      // Fetch the PDF file
      const fileResponse = await fetch(file_url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${fileResponse.status}`);
      }
      const fileData = await fileResponse.arrayBuffer();
      const mimeType = fileResponse.headers.get('content-type') || 'application/pdf';

      // Create/get "Finance/Invoices" folder
      const folderParts = ['Finance', 'Invoices'];
      let currentFolderId = 'root';
      
      for (const folderPart of folderParts) {
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderPart)}' and mimeType='application/vnd.google-apps.folder' and '${currentFolderId}' in parents and trashed=false`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const searchData = await searchResponse.json();
        
        let folderId;
        if (searchData.files && searchData.files.length > 0) {
          folderId = searchData.files[0].id;
        } else {
          const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: folderPart,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [currentFolderId],
            }),
          });
          const createData = await createResponse.json();
          folderId = createData.id;
        }
        currentFolderId = folderId;
      }

      const targetFolderId = currentFolderId;
      const fileName = file_name || `Invoice_${invoice_id}.pdf`;

      // Upload file
      const metadata = {
        name: fileName,
        parents: [targetFolderId],
      };

      const form = new FormData();
      form.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
      );
      form.append(
        'file',
        new Blob([fileData], { type: mimeType }),
      );

      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Google Drive upload failed: ${uploadResponse.status} ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.id;

      // Get shareable link
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: [{
            type: 'anyone',
            role: 'reader',
          }],
        }),
      });

      pdf_url = uploadData.webViewLink || uploadData.webContentLink;
      console.log('Successfully uploaded to Google Drive:', pdf_url);
    } catch (error) {
      console.error('Google Drive upload failed:', error.message);
      // Continue with Base44 storage URL as fallback
    }

    await base44.asServiceRole.entities.Invoice.update(invoice_id, { pdf_url });

    return Response.json({
      success: true,
      invoice_id,
      pdf_url,
      file_name,
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 },
    );
  }
});