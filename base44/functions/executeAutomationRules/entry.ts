import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { conversation_id } = await req.json();

    if (!conversation_id) {
      return Response.json({ error: 'conversation_id required' }, { status: 400 });
    }

    // Get conversation
    const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
    if (!convs.length) return Response.json({ error: 'Conversation not found' }, { status: 404 });
    
    const conversation = convs[0];

    // Get all active rules
    const rules = await base44.asServiceRole.entities.AutomationRule.filter({ is_active: true }, '-priority', 50);

    const executedActions = [];

    for (const rule of rules) {
      let matches = false;

      // Check if rule matches conversation
      const conditions = rule.trigger_conditions || {};

      switch (rule.trigger_type) {
        case 'sentiment_change':
          if (conditions.sentiment && conversation.ai_sentiment === conditions.sentiment) {
            matches = true;
          }
          break;

        case 'urgency_change':
          if (conditions.urgency && conversation.ai_urgency === conditions.urgency) {
            matches = true;
          }
          break;

        case 'lead_score_change':
          const scores = await base44.asServiceRole.entities.LeadScore.filter({ conversation_id }, '-calculated_at', 1);
          if (scores.length > 0) {
            const score = scores[0].overall_score;
            if (conditions.min_score && score >= conditions.min_score) {
              matches = true;
            }
          }
          break;

        case 'message_received':
          matches = true; // Always trigger on message
          break;

        case 'days_no_activity':
          const lastMsg = new Date(conversation.last_message_at).getTime();
          const daysSinceMsg = (Date.now() - lastMsg) / (1000 * 60 * 60 * 24);
          if (daysSinceMsg >= conditions.days) {
            matches = true;
          }
          break;

        case 'tag_added':
          if (conditions.tag && (conversation.manual_tags || []).includes(conditions.tag)) {
            matches = true;
          }
          break;
      }

      if (matches) {
        // Execute actions
        for (const action of rule.actions || []) {
          try {
            switch (action.type) {
              case 'tag':
                const tags = conversation.manual_tags || [];
                if (!tags.includes(action.payload.tag)) {
                  tags.push(action.payload.tag);
                  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
                    manual_tags: tags,
                  });
                  executedActions.push({ type: 'tag', payload: action.payload });
                }
                break;

              case 'assign':
                await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
                  assigned_to: action.payload.agent_email,
                });
                executedActions.push({ type: 'assign', payload: action.payload });
                break;

              case 'escalate':
                const escalateTags = conversation.manual_tags || [];
                if (!escalateTags.includes('escalated')) {
                  escalateTags.push('escalated');
                }
                await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
                  manual_tags: escalateTags,
                  metadata: {
                    ...conversation.metadata,
                    escalated: true,
                    escalated_at: new Date().toISOString(),
                  },
                });
                executedActions.push({ type: 'escalate', payload: action.payload });
                break;

              case 'schedule_followup':
                // Create reminder
                await base44.asServiceRole.entities.Reminder.create({
                  lead_id: conversation.lead_id,
                  type: 'follow_up',
                  title: `Follow up on conversation with ${conversation.phone_number}`,
                  due_date: new Date(Date.now() + action.payload.hours * 60 * 60 * 1000).toISOString(),
                  status: 'pending',
                  assigned_to: action.payload.agent_email,
                  priority: action.payload.priority || 'medium',
                });
                executedActions.push({ type: 'schedule_followup', payload: action.payload });
                break;

              case 'notify':
                // Could integrate with email/push notification
                executedActions.push({ type: 'notify', payload: action.payload });
                break;
            }
          } catch (actionErr) {
            console.error(`Error executing action ${action.type}:`, actionErr);
          }
        }

        // Update rule execution count
        await base44.asServiceRole.entities.AutomationRule.update(rule.id, {
          execution_count: (rule.execution_count || 0) + 1,
          last_executed: new Date().toISOString(),
        });
      }
    }

    return Response.json({
      conversation_id,
      rules_checked: rules.length,
      actions_executed: executedActions.length,
      actions: executedActions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});