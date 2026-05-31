import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
        if (!VAPI_API_KEY) {
            return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });
        }

        // List all assistants from Vapi
        const response = await fetch('https://api.vapi.ai/assistant', {
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch assistants' }));
            return Response.json({ 
                error: 'Failed to fetch Vapi assistants', 
                details: errorData 
            }, { status: response.status });
        }

        const assistants = await response.json();

        return Response.json({
            success: true,
            assistants: assistants || []
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});