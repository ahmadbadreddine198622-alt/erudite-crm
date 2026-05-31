import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { assistantId, phoneNumber, leadId, leadName } = await req.json();

        if (!assistantId || !phoneNumber) {
            return Response.json({ error: 'assistantId and phoneNumber are required' }, { status: 400 });
        }

        const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
        if (!VAPI_API_KEY) {
            return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });
        }

        // Create a phone call using Vapi API
        // Vapi requires phone numbers to be configured in their dashboard first
        // Users must add Twilio credentials and phone numbers via Vapi Dashboard > Phone Numbers
        const response = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assistantId: assistantId,
                phoneNumber: {
                    twilioPhoneNumber: phoneNumber,
                    twilioAccountSid: Deno.env.get("TWILIO_ACCOUNT_SID") || ""
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
                if (errorMsg.includes('twilio') || errorMsg.includes('provider') || errorMsg.includes('phone')) {
                    return Response.json({ 
                        error: 'Twilio not connected. Please configure Twilio in Vapi Dashboard first.',
                        details: 'You need to: 1) Connect Twilio in Vapi Settings > Phone Providers, 2) Add a phone number in Phone Numbers, 3) Assign it to your assistant.',
                        setupRequired: true,
                        setupUrl: 'https://dashboard.vapi.ai/phone-numbers'
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
            direction: 'outbound',
            status: 'initiated',
            from_number: 'Vapi AI',
            to_number: phoneNumber,
            agent_name: user.full_name,
            agent_email: user.email,
            started_at: new Date().toISOString(),
            lead_id: leadId || '',
            lead_name: leadName || '',
            notes: `Vapi AI call initiated to ${leadName || phoneNumber}`
        }).catch(() => {}); // Optional - don't fail if entity doesn't exist

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