import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { callId } = await req.json();
        if (!callId) return Response.json({ error: 'callId is required' }, { status: 400 });

        const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
        if (!VAPI_API_KEY) return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });

        const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return Response.json({ error: 'Failed to hang up call', details: err }, { status: response.status });
        }

        return Response.json({ success: true, message: 'Call ended' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});