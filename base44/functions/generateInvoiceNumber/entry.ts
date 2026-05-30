import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const invoiceId = body?.event?.entity_id || body?.invoice_id;

    if (!invoiceId) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    // Fetch the invoice to check if it already has a number
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoiceId);

    if (invoice.invoice_number && invoice.invoice_number.startsWith('INV-')) {
      return Response.json({ message: 'Invoice already numbered', invoice_number: invoice.invoice_number });
    }

    // List all invoices that have a number to find the max
    const allInvoices = await base44.asServiceRole.entities.Invoice.filter(
      { invoice_number: { $exists: true } },
      '-created_date',
      1000
    );

    let maxNum = 0;
    for (const inv of allInvoices) {
      if (inv.invoice_number && inv.invoice_number.startsWith('INV-')) {
        const num = parseInt(inv.invoice_number.replace('INV-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const invoice_number = `INV-${String(nextNum).padStart(4, '0')}`;

    await base44.asServiceRole.entities.Invoice.update(invoiceId, { invoice_number });

    return Response.json({ success: true, invoice_number });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});