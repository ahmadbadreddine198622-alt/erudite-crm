import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'verify_config') {
      const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

      if (!phoneNumberId || !accessToken) {
        return Response.json({ 
          configured: false, 
          message: 'WhatsApp credentials not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in Base44 secrets.' 
        });
      }

      // Test the credentials
      const testRes = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating&access_token=${accessToken}`
      );
      const testData = await testRes.json();

      if (testData.error) {
        return Response.json({ 
          configured: false, 
          message: testData.error.message, 
          error: testData.error 
        });
      }

      return Response.json({
        configured: true,
        phone_number: testData.display_phone_number,
        display_name: testData.verified_name,
        quality_rating: testData.quality_rating
      });
    }

    if (action === 'execute_workflow') {
      const { workflow_id, conversation_id, message_body } = body;
      const workflow = await base44.asServiceRole.entities.WhatsAppWorkflow.get(workflow_id);
      if (!workflow || !workflow.is_active) {
        return Response.json({ skipped: true, reason: 'Workflow not active' });
      }

      // Simple sequential node executor
      let currentNodeId = workflow.nodes?.[0]?.id;
      let steps_executed = 0;

      while (currentNodeId && steps_executed < 20) {
        const node = workflow.nodes.find(n => n.id === currentNodeId);
        if (!node) break;

        if (node.type === 'send_message' && node.config?.message) {
          await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
            conversation_id,
            message: node.config.message
          });
        } else if (node.type === 'ai_reply') {
          const prompt = node.config?.prompt || `You are a helpful real estate assistant. Reply to: "${message_body}"`;
          const aiRes = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
          if (aiRes) {
            await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
              conversation_id,
              message: aiRes
            });
          }
        } else if (node.type === 'assign_agent' && node.config?.agent_email) {
          const conv = await base44.asServiceRole.entities.WhatsAppConversation.get(conversation_id);
          if (conv) {
            await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
              assigned_agent: node.config.agent_email
            });
          }
        } else if (node.type === 'add_tag' && node.config?.tag) {
          const conv = await base44.asServiceRole.entities.WhatsAppConversation.get(conversation_id);
          if (conv?.lead_id) {
            const lead = await base44.asServiceRole.entities.Lead.get(conv.lead_id);
            if (lead) {
              const tags = [...(lead.auto_tags || []), node.config.tag];
              await base44.asServiceRole.entities.Lead.update(conv.lead_id, { auto_tags: tags });
            }
          }
        }

        currentNodeId = node.next_node_id;
        steps_executed++;
      }

      await base44.asServiceRole.entities.WhatsAppWorkflow.update(workflow_id, {
        execution_count: (workflow.execution_count || 0) + 1,
        last_triggered: new Date().toISOString()
      });

      return Response.json({ success: true, steps_executed });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});