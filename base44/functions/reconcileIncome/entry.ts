import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    // Accept either automation payload or direct call with invoice_id
    const invoiceId = body?.invoice_id || body?.data?.invoice_id || body?.event?.entity_id
      ? (body.invoice_id || body?.data?.invoice_id)
      : null;

    // If triggered by a Payment entity automation, get invoice_id from payment data
    let targetInvoiceId = invoiceId;
    if (!targetInvoiceId && body?.data?.invoice_id) {
      targetInvoiceId = body.data.invoice_id;
    }
    if (!targetInvoiceId && body?.event?.entity_id && body?.event?.entity_name === 'Payment') {
      const payment = await base44.asServiceRole.entities.Payment.get(body.event.entity_id);
      targetInvoiceId = payment.invoice_id;
    }

    if (!targetInvoiceId) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    // Fetch invoice
    const invoice = await base44.asServiceRole.entities.Invoice.get(targetInvoiceId);

    // Sum all payments for this invoice
    const payments = await base44.asServiceRole.entities.Payment.filter(
      { invoice_id: targetInvoiceId },
      '-date_received',
      1000
    );

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = invoice.total_amount || 0;

    // Determine new status
    let newStatus = invoice.status;
    if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
      if (totalPaid <= 0) {
        newStatus = 'issued';
      } else if (totalPaid < totalAmount) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'paid';
      }
    }

    // Update invoice status if changed
    if (newStatus !== invoice.status) {
      await base44.asServiceRole.entities.Invoice.update(targetInvoiceId, { status: newStatus });
    }

    // Determine period from latest payment or today
    const latestPayment = payments[0];
    let period;
    if (latestPayment?.date_received) {
      period = latestPayment.date_received.substring(0, 7); // YYYY-MM
    } else {
      const now = new Date();
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const agentId = invoice.agent_id;

    if (!agentId) {
      return Response.json({
        success: true,
        invoice_status: newStatus,
        total_paid: totalPaid,
        note: 'No agent_id on invoice — IncomeRecord skipped'
      });
    }

    // Find existing IncomeRecord for this agent + invoice + period
    const existingRecords = await base44.asServiceRole.entities.IncomeRecord.filter(
      { invoice_id: targetInvoiceId, agent_id: agentId, period },
      '-created_date',
      10
    );

    const incomeStatus = newStatus === 'paid' ? 'recognized' : 'pending';

    if (existingRecords.length > 0) {
      await base44.asServiceRole.entities.IncomeRecord.update(existingRecords[0].id, {
        recognized_amount: totalPaid,
        status: incomeStatus,
        period
      });
    } else {
      await base44.asServiceRole.entities.IncomeRecord.create({
        invoice_id: targetInvoiceId,
        agent_id: agentId,
        recognized_amount: totalPaid,
        period,
        status: incomeStatus
      });
    }

    return Response.json({
      success: true,
      invoice_id: targetInvoiceId,
      invoice_status: newStatus,
      total_paid: totalPaid,
      agent_id: agentId,
      period,
      income_status: incomeStatus
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});