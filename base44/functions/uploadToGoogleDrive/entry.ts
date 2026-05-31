import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Google Drive connection
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
        
        const body = await req.json();
        
        // Support two calling conventions:
        // 1. Direct base64 upload: { fileName, base64Content, mimeType, folderName }
        // 2. File URL upload: { file_url, file_name, folder_name }
        let fileName = body.fileName || body.file_name;
        let base64Content = body.base64Content;
        let mimeType = body.mimeType || 'application/pdf';
        let folderName = body.folderName || body.folder_name || 'PropCRM PDFs';
        
        // If file_url is provided instead of base64Content, fetch it first
        if (!base64Content && body.file_url) {
            console.log('Fetching file from URL:', body.file_url);
            const fileUrl = body.file_url;
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) {
                console.error('Failed to fetch file, status:', fileRes.status);
                return Response.json({ error: 'Failed to fetch file from file_url' }, { status: 500 });
            }
            const blob = await fileRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            base64Content = btoa(String.fromCharCode(...bytes));
            console.log('Successfully converted file to base64, length:', base64Content.length);
            
            // Extract filename from URL if not provided
            if (!fileName) {
                fileName = fileUrl.split('/').pop() || 'file.pdf';
            }
        }
        
        if (!fileName || !base64Content) {
            return Response.json({ error: 'fileName and base64Content (or file_url) are required' }, { status: 400 });
        }

        // Step 1: Find or create the folder
        const folderSearchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const folderSearch = await folderSearchRes.json();
        let folderId;
        
        if (folderSearch.files && folderSearch.files.length > 0) {
            folderId = folderSearch.files[0].id;
        } else {
            // Create folder
            const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            });
            
            const folderData = await createFolderRes.json();
            folderId = folderData.id;
        }

        // Step 2: Upload the file to the folder
        console.log('Uploading to Google Drive, fileName:', fileName, 'folderId:', folderId);
        const decodedContent = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
        
        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream'
            },
            body: decodedContent
        });
        
        console.log('Google Drive upload response status:', uploadRes.status);
        const fileData = await uploadRes.json();
        console.log('Google Drive upload response:', JSON.stringify(fileData, null, 2));
        
        if (!uploadRes.ok) {
            return Response.json({ 
                error: 'Failed to upload file',
                details: fileData 
            }, { status: 500 });
        }

        // Step 3: Move file to folder (update parents)
        const moveRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileData.id}?addParents=${folderId}&removeParents=root`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const movedFile = await moveRes.json();

        return Response.json({
            success: true,
            fileId: movedFile.id,
            fileName: movedFile.name,
            folderId,
            folderName,
            file_url: movedFile.webContentLink || movedFile.webViewLink,
            webViewLink: movedFile.webViewLink,
            webContentLink: movedFile.webContentLink
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});