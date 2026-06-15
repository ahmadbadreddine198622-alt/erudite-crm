// uploadFile — Simple file upload wrapper
// Accepts a file via multipart/form-data and returns the Base44 storage URL
// This wraps the Core.UploadFile integration to provide better error handling

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Auth check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'No file provided or invalid file type' }, { status: 400 });
    }

    // Use Core integration to upload
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    if (!file_url) {
      throw new Error('UploadFile integration returned no file_url');
    }

    return Response.json({ 
      success: true, 
      file_url,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
    });
    
  } catch (err) {
    console.error('[uploadFile] Error:', err);
    return Response.json({ 
      error: 'Upload failed', 
      message: err.message,
      type: err.name,
    }, { status: 500 });
  }
});