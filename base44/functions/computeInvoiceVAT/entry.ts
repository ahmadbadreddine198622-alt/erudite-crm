import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both direct call and entity automation payload
    const invoiceId = body?.invoice_id
      || body?.data?.id
      || body?.event?.entity_id;

    if (!invoiceId) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    const invoice = await base44.asServiceRole.entities.Invoice.get(invoiceId);

    const commission = parseFloat(invoice.commission_amount) || 0;
    const vat = Math.round(commission * 0.05 * 100) / 100;
    const total = Math.round((commission + vat) * 100) / 100;

    // Idempotent: only update if values differ
    if (invoice.vat_amount === vat && invoice.total_amount === total) {
      return Response.json({ success: true, skipped: true, vat_amount: vat, total_amount: total });
    }

    await base44.asServiceRole.entities.Invoice.update(invoiceId, {
      vat_amount: vat,
      total_amount: total,
    });

    return Response.json({ success: true, invoice_id: invoiceId, commission_amount: commission, vat_amount: vat, total_amount: total });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});