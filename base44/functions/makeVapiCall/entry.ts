import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { assistantId, phoneNumberId, phoneNumber, leadId, landlordId, leadName } = await req.json();

        if (!assistantId || !phoneNumber) {
            return Response.json({ error: 'assistantId and phoneNumber are required' }, { status: 400 });
        }

        const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
        if (!VAPI_API_KEY) return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });

        // Build the call payload
        const callPayload = {
            assistantId,
            customer: {
                number: phoneNumber,
                name: leadName || undefined,
            },
            metadata: {
                leadId: leadId || '',
                landlordId: landlordId || '',
                leadName: leadName || '',
                initiatedBy: user.email,
            },
        };

        // If a specific VAPI phone number ID is provided, use it
        // Otherwise VAPI will use the number assigned to the assistant
        if (phoneNumberId) {
            callPayload.phoneNumberId = phoneNumberId;
        }

        const response = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(callPayload),
        });

        const callData = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errMsg = Array.isArray(callData.message)
                ? callData.message.join(', ')
                : (callData.message || callData.error || 'Failed to create call');
            return Response.json({ error: errMsg, details: callData }, { status: response.status });
        }

        // Store call record
        await base44.asServiceRole.entities.AircallCall.create({
            aircall_id: callData.id || `vapi_${Date.now()}`,
            source: 'vapi',
            direction: 'outbound',
            status: callData.status || 'initiated',
            from_number: user.email,
            to_number: phoneNumber,
            agent_name: user.full_name || user.email,
            agent_email: user.email,
            started_at: new Date().toISOString(),
            lead_id: leadId || '',
            landlord_id: landlordId || '',
            lead_name: leadName || '',
            notes: `VAPI call to ${leadName || phoneNumber}`,
        }).catch(() => {});

        return Response.json({
            success: true,
            callId: callData.id,
            status: callData.status,
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});