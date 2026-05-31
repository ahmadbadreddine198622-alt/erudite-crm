import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
        const body = await req.json();
        const { query = '', folderId } = body;

        // Build search query
        let searchQuery = `mimeType='application/pdf' and trashed=false`;
        if (folderId) {
            searchQuery += ` and '${folderId}' in parents`;
        }
        if (query) {
            searchQuery += ` and name contains '${query}'`;
        }

        // Fetch files from Google Drive
        const filesRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType,webViewLink,webContentLink,createdTime,size)&orderBy=createdTime desc&pageSize=100`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const filesData = await filesRes.json();

        return Response.json({
            success: true,
            files: filesData.files || [],
            total: filesData.files?.length || 0
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});