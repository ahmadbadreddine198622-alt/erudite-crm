import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Generates the next sequential ACK number (ACK-0001, ACK-0002, …).
 * Mirrors the generateInvoiceNumber pattern.
 * If the record already has an ack_number, returns it unchanged (idempotent).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ack_id } = body;

    const serviceRole = base44.asServiceRole;

    // If a specific record was requested, check for idempotency
    if (ack_id) {
      const records = await serviceRole.entities.Acknowledgement.filter({ id: ack_id });
      const record = records?.[0];
      if (record?.ack_number) {
        return Response.json({ ack_number: record.ack_number });
      }
    }

    // Count all existing acknowledgements to derive the next number
    const all = await serviceRole.entities.Acknowledgement.list('-created_date', 500);
    const usedNumbers = (all || [])
      .map(r => r.ack_number)
      .filter(n => n && /^ACK-\d+$/.test(n))
      .map(n => parseInt(n.replace('ACK-', ''), 10));

    const maxNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0;
    const nextNum = maxNum + 1;
    const ack_number = `ACK-${String(nextNum).padStart(4, '0')}`;

    // If ack_id provided, stamp it on the record
    if (ack_id) {
      await serviceRole.entities.Acknowledgement.update(ack_id, { ack_number });
    }

    console.log(`[generateAckNumber] issued ${ack_number}`);
    return Response.json({ ack_number });
  } catch (error) {
    console.error('[generateAckNumber] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});