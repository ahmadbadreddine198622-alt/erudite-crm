import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { assistantId, phoneNumber, leadId, landlordId, leadName } = await req.json();

        if (!assistantId || !phoneNumber) {
            return Response.json({ error: 'assistantId and phoneNumber are required' }, { status: 400 });
        }

        const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
        if (!VAPI_API_KEY) {
            return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });
        }

        // Create a phone call using Vapi API
        // phoneNumber should be the destination number to call
        const response = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assistantId: assistantId,
                customer: {
                    number: phoneNumber, // Destination number to call
                    name: leadName || undefined,
                },
                metadata: {
                    leadId: leadId || '',
                    leadName: leadName || '',
                    initiatedBy: user.email
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to create call' }));
            
            // Provide helpful error messages based on common issues
            if (errorData.message) {
                const errorMsg = Array.isArray(errorData.message) ? errorData.message.join(', ') : errorData.message;
                if (errorMsg.includes('twilio') || errorMsg.includes('provider') || errorMsg.includes('phone') || errorMsg.includes('PhoneNumber') || errorMsg.includes('transport')) {
                    return Response.json({ 
                        error: 'Phone provider or transport not configured. Please complete the setup in Vapi Dashboard.',
                        details: 'Required steps: 1) Connect Twilio (Settings > Phone Providers), 2) Add phone number (Phone Numbers), 3) Assign number to assistant (Assistants > Edit > Transport). Make sure the assistant has a phone number assigned.',
                        setupRequired: true,
                        setupUrl: 'https://dashboard.vapi.ai/assistants',
                        assistantEditUrl: assistantId ? `https://dashboard.vapi.ai/assistant/${assistantId}` : 'https://dashboard.vapi.ai/assistants'
                    }, { status: response.status });
                }
            }
            
            return Response.json({ 
                error: 'Failed to create Vapi call', 
                details: errorData 
            }, { status: response.status });
        }

        const callData = await response.json();

        // Store call record in database
        await base44.entities.AircallCall.create({
            aircall_id: callData.id || `vapi_${Date.now()}`,
            source: 'vapi',
            direction: 'outbound',
            status: callData.status || 'initiated',
            from_number: user.email,
            to_number: phoneNumber,
            agent_name: user.full_name,
            agent_email: user.email,
            started_at: new Date().toISOString(),
            lead_id: leadId || '',
            landlord_id: landlordId || '',
            lead_name: leadName || '',
            notes: `Vapi AI call to ${leadName || phoneNumber}`
        }).catch(() => {});

        return Response.json({
            success: true,
            callId: callData.id,
            status: callData.status,
            message: 'AI voice call initiated successfully'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});