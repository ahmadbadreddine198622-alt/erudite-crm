import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only trigger on new lead creation
    if (event.type !== 'create') {
      return Response.json({ skipped: true });
    }

    const lead = data;

    // Skip if already assigned
    if (lead.assigned_agent) {
      return Response.json({ skipped: true, reason: 'Already assigned' });
    }

    // Get all active agents with their workload
    const agents = await base44.asServiceRole.entities.AgentWorkload.list();
    const workloads = await base44.asServiceRole.entities.AgentWorkload.list();

    if (!workloads || workloads.length === 0) {
      return Response.json({ error: 'No agents available' }, { status: 400 });
    }

    // Find agent with lowest assigned conversations
    const bestAgent = workloads.reduce((best, agent) => {
      const agentConvs = agent.assigned_conversations || 0;
      const bestConvs = best.assigned_conversations || 0;
      return agentConvs < bestConvs ? agent : best;
    });

    // Update lead with assignment
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      assigned_agent: bestAgent.agent_email,
      assigned_agent_name: bestAgent.agent_name
    });

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      lead_id: lead.id,
      type: 'system',
      title: 'Auto-assigned to agent',
      description: `Automatically assigned to ${bestAgent.agent_name} (workload: ${bestAgent.assigned_conversations || 0} conversations)`,
      agent_email: bestAgent.agent_email,
      agent_name: bestAgent.agent_name
    });

    // Increment agent's assigned conversation count
    await base44.asServiceRole.entities.AgentWorkload.update(bestAgent.id, {
      assigned_conversations: (bestAgent.assigned_conversations || 0) + 1
    });

    return Response.json({ assigned_to: bestAgent.agent_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});