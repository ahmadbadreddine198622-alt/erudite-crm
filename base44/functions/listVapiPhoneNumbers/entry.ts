import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
        if (!VAPI_API_KEY) return Response.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 });

        const res = await fetch('https://api.vapi.ai/phone-number?limit=100', {
            headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return Response.json({ error: 'Failed to fetch phone numbers', details: err }, { status: res.status });
        }

        const data = await res.json();
        const numbers = Array.isArray(data) ? data : (data.results || []);

        return Response.json({
            success: true,
            phoneNumbers: numbers.map(p => ({
                id: p.id,
                number: p.number,
                name: p.name || p.number,
                provider: p.provider,
            })),
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});