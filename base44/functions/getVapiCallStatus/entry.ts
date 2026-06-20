import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { callId } = await req.json();
        if (!callId) return Response.json({ error: 'callId required' }, { status: 400 });

        const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
        if (!VAPI_API_KEY) return Response.json({ error: 'VAPI_API_KEY not set' }, { status: 500 });

        const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
            headers: { Authorization: `Bearer ${VAPI_API_KEY}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return Response.json({ error: 'Failed to fetch call', details: err }, { status: res.status });
        }

        const call = await res.json();

        // Also update stored record if status changed
        if (call.status === 'ended' || call.status === 'failed') {
            const stored = await base44.asServiceRole.entities.AircallCall.filter({ aircall_id: callId });
            if (stored?.[0]) {
                await base44.asServiceRole.entities.AircallCall.update(stored[0].id, {
                    status: call.status,
                    ended_at: call.endedAt || new Date().toISOString(),
                    duration: call.cost?.duration || stored[0].duration || 0,
                    recording_url: call.artifact?.recordingUrl || stored[0].recording_url || null,
                    transcript: call.artifact?.transcript || stored[0].transcript || null,
                });
            }
        }

        return Response.json({
            callId: call.id,
            status: call.status,
            endedReason: call.endedReason,
            duration: call.cost?.duration,
            recordingUrl: call.artifact?.recordingUrl,
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});