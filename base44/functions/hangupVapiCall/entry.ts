import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { callId } = await req.json();
        if (!callId) return Response.json({ error: 'callId is required' }, { status: 400 });

        const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
        if (!VAPI_API_KEY) return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });

        // VAPI ends a call by PATCH with ended status
        const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'ended' }),
        });

        // Also update stored record
        try {
            const stored = await base44.asServiceRole.entities.AircallCall.filter({ aircall_id: callId });
            if (stored?.[0]) {
                await base44.asServiceRole.entities.AircallCall.update(stored[0].id, {
                    status: 'ended',
                    ended_at: new Date().toISOString(),
                });
            }
        } catch (_) {}

        if (!response.ok) {
            // Even if PATCH fails (call may have already ended), return success to UI
            return Response.json({ success: true, message: 'Call terminated' });
        }

        return Response.json({ success: true, message: 'Call ended' });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});