// Retired maintenance endpoint (P3 phone fix, unit_reference restore, and the 2026-07-14
// type-pure valuation correction). Kept as a 410 stub so the route can never be abused.
Deno.serve(() => Response.json({ error: 'gone' }, { status: 410 }));
