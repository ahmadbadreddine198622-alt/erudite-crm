import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
        const folderName = 'PropCRM PDFs';
        
        // Find or create the folder
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
        
        if (folderSearch.files && folderSearch.files.length > 0) {
            return Response.json({
                success: true,
                folderId: folderSearch.files[0].id,
                folderName,
                folderLink: `https://drive.google.com/drive/folders/${folderSearch.files[0].id}`
            });
        }
        
        // Create folder if it doesn't exist
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
        
        return Response.json({
            success: true,
            folderId: folderData.id,
            folderName,
            folderLink: `https://drive.google.com/drive/folders/${folderData.id}`,
            created: true
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});