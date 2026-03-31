import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only trigger on lead stage change to closed_won
    if (event.type !== 'update') {
      return Response.json({ skipped: true });
    }

    const lead = data;

    // Only process if stage changed to closed_won
    if (lead.stage !== 'closed_won') {
      return Response.json({ skipped: true });
    }

    // Check if commission already exists for this lead
    const existingCommission = await base44.asServiceRole.entities.Commission.filter(
      { lead_id: lead.id, status: { $ne: 'cancelled' } },
      '-created_date',
      1
    );

    if (existingCommission && existingCommission.length > 0) {
      return Response.json({ skipped: true, reason: 'Commission already exists' });
    }

    // Default: 2% commission on deal value
    const commissionRate = 2;
    const dealValue = lead.budget_aed || 0;
    const commissionAmount = Math.round((dealValue * commissionRate) / 100);

    if (dealValue === 0) {
      return Response.json({ error: 'No deal value recorded' }, { status: 400 });
    }

    // Create commission record
    const commission = await base44.asServiceRole.entities.Commission.create({
      lead_id: lead.id,
      agent_email: lead.assigned_agent,
      agent_name: lead.assigned_agent_name,
      deal_value_aed: dealValue,
      commission_rate: commissionRate,
      commission_amount_aed: commissionAmount,
      status: 'pending',
      deal_type: 'sale', // Default to sale, can be overridden
      closing_date: new Date().toISOString().split('T')[0]
    });

    // Create activity log
    await base44.asServiceRole.entities.Activity.create({
      lead_id: lead.id,
      type: 'system',
      title: 'Commission created',
      description: `Auto-created commission: AED ${commissionAmount} (${commissionRate}% of AED ${dealValue})`,
      agent_email: lead.assigned_agent
    });

    return Response.json({ 
      created: true, 
      commission_id: commission.id,
      amount: commissionAmount 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});