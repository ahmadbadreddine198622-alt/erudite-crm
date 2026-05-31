// uploadToGoogleDrive — upload files to Google Drive with folder organization
// 
// Supports organizing files into specific folders based on document type.
// If the folder doesn't exist, it will be created automatically.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let { file_url, fileName, base64Content, mimeType, folderName, folderPath } = body;

    // Validate input
    if (!file_url && !base64Content) {
      return Response.json({ error: 'Either file_url or base64Content is required' }, { status: 400 });
    }

    // Get Google Drive connection
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    if (!accessToken) {
      return Response.json({ error: 'Google Drive not connected' }, { status: 500 });
    }

    // Handle file content
    let fileData: ArrayBuffer | null = null;
    
    if (base64Content) {
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes.buffer;
      mimeType = mimeType || 'application/pdf';
    } else if (file_url) {
      // Fetch from URL
      const response = await fetch(file_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from URL: ${response.status}`);
      }
      fileData = await response.arrayBuffer();
      mimeType = response.headers.get('content-type') || 'application/pdf';
    }

    if (!fileData) {
      throw new Error('No file data available');
    }

    // Determine target folder (ensure proper defaults)
    const targetFolderName = folderName || folderPath || 'PropCRM PDFs';
    const targetFolderPath = folderPath || folderName || targetFolderName;
    
    // Create/get target folder (supports nested paths like "Finance/Invoices")
    const folderParts = targetFolderPath.split('/').map(p => p.trim()).filter(p => p);
    let currentFolderId = 'root';
    
    for (const folderPart of folderParts) {
      // Search for folder in current parent
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderPart)}' and mimeType='application/vnd.google-apps.folder' and '${currentFolderId}' in parents and trashed=false`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchResponse.json();
      
      let folderId: string;
      
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        // Create folder
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

    // Upload file
    const metadata = {
      name: fileName || `file_${Date.now()}`,
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

    return Response.json({
      success: true,
      fileId,
      fileName: uploadData.name,
      webViewLink: uploadData.webViewLink,
      webContentLink: uploadData.webContentLink,
      file_url: uploadData.webViewLink || uploadData.webContentLink,
      folderId: targetFolderId,
      folderPath: targetFolderPath,
    });
  } catch (error) {
    console.error('uploadToGoogleDrive:', error);
    return Response.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 },
    );
  }
});