import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get VAPI API key from environment
        const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
        if (!VAPI_API_KEY) {
            return Response.json({ 
                error: 'VAPI_API_KEY not configured' 
            }, { status: 500 });
        }

        // Fetch all calls from Vapi API
        const response = await fetch('https://api.vapi.ai/call?limit=100', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch calls' }));
            return Response.json({ 
                error: 'Failed to fetch Vapi calls', 
                details: errorData 
            }, { status: response.status });
        }

        const vapiCalls = await response.json();
        
        // Sync calls to CRM
        let syncedCount = 0;
        for (const call of vapiCalls) {
            // Check if call already exists
            const existingCall = await base44.entities.AircallCall.filter({
                aircall_id: call.id
            }).then(calls => calls[0]);

            if (!existingCall) {
                // Create new call record with full details
                await base44.entities.AircallCall.create({
                    aircall_id: call.id,
                    direction: call.type?.includes('outbound') ? 'outbound' : 'inbound',
                    status: call.status === 'ended' ? 'done' : call.status,
                    duration: call.cost?.duration || 0,
                    started_at: call.startedAt,
                    ended_at: call.endedAt,
                    from_number: call.phoneNumber?.number || 'Vapi AI',
                    to_number: call.customer?.number || call.phoneNumber?.number || '',
                    agent_name: call.metadata?.initiatedBy || 'Vapi',
                    agent_email: call.metadata?.initiatedBy || '',
                    recording_url: call.artifact?.recordingUrl || null,
                    transcript: call.artifact?.transcript || null,
                    lead_id: call.metadata?.leadId || '',
                    lead_name: call.metadata?.leadName || '',
                    notes: `Vapi AI call - ${call.endedReason || call.status}`
                });
                syncedCount++;
            } else if (call.artifact?.recordingUrl && !existingCall.recording_url) {
                // Update existing call with recording if it wasn't synced before
                await base44.entities.AircallCall.update(existingCall.id, {
                    recording_url: call.artifact.recordingUrl,
                    transcript: call.artifact.transcript || existingCall.transcript
                });
                syncedCount++;
            }
        }

        return Response.json({
            success: true,
            syncedCount,
            totalCalls: vapiCalls.length,
            message: `Synced ${syncedCount} new calls from Vapi`
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});