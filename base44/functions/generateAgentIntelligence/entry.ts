import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TODAY = new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agent_email, force = false } = await req.json();

    if (!agent_email) {
      return Response.json({ error: 'agent_email is required' }, { status: 400 });
    }

    // Fetch today's allocation for this agent
    const allocations = await base44.entities.DailyLeadAllocation.filter({
      agent_email,
      allocation_date: TODAY,
    });

    if (!allocations || allocations.length === 0) {
      return Response.json({
        success: true,
        message: 'No allocation found for this agent today',
        data: null,
      });
    }

    const allocation = allocations[0];

    // Check if already processed today (unless force=true)
    if (!force && allocation.ai_processed_at) {
      const processedDate = new Date(allocation.ai_processed_at).toISOString().slice(0, 10);
      if (processedDate === TODAY) {
        return Response.json({
          success: true,
          message: 'Already processed today',
          data: {
            agent_email,
            agent_name: allocation.agent_name,
            ai_earned_more_leads_verdict: allocation.ai_earned_more_leads_verdict,
            ai_earned_reasoning: allocation.ai_earned_reasoning,
            ai_slacking_flag: allocation.ai_slacking_flag,
            ai_slacking_reason: allocation.ai_slacking_reason,
            ai_coaching_note: allocation.ai_coaching_note,
            ai_hit_target_prediction: allocation.ai_hit_target_prediction,
            ai_target_reasoning: allocation.ai_target_reasoning,
            ai_agent_rolling_summary: allocation.ai_agent_rolling_summary,
            ai_processed_at: allocation.ai_processed_at,
          },
        });
      }
    }

    // Gather performance data
    const checklists = await base44.entities.OutreachChecklist.filter({
      agent_email,
      outreach_date: TODAY,
    });

    const landlords = await base44.entities.Landlord.filter({
      assigned_agent_email: agent_email,
    });

    // Calculate metrics
    const leadsWorked = checklists?.length || 0;
    const sequencesCompleted = checklists?.filter(c => c.sequence_complete).length || 0;
    const qualificationsLogged = checklists?.filter(c => c.qualification_logged).length || 0;
    const totalSteps = leadsWorked * 6;
    const completedSteps = checklists?.reduce((sum, c) => sum + (c.steps_completed || 0), 0) || 0;
    const stepCompletionRate = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Stage advancements today
    let stageAdvancements = 0;
    (landlords || []).forEach(l => {
      if (l.stage_entered_at) {
        const stageDate = new Date(l.stage_entered_at).toISOString().slice(0, 10);
        if (stageDate === TODAY) stageAdvancements++;
      }
    });

    // Build prompt for AI analysis
    const prompt = `You are analyzing a real estate agent's daily performance. Generate concise, actionable intelligence.

AGENT: ${allocation.agent_name || agent_email}
DATE: ${TODAY}

PERFORMANCE DATA:
- Leads worked: ${leadsWorked}
- Total allocated: ${allocation.total_available || allocation.base_allocation || 10}
- Sequences completed: ${sequencesCompleted}
- Qualifications logged: ${qualificationsLogged}
- Step completion rate: ${stepCompletionRate}%
- Stage advancements: ${stageAdvancements}
- Current daily score: ${allocation.daily_score || 0}
- Status: ${allocation.status || 'active'}

Generate the following fields (return as JSON):
1. earned_more_leads_verdict (boolean): Does this agent genuinely deserve more leads based on QUALITY not just volume?
2. earned_reasoning (string): One-line reasoning for the verdict
3. slacking_flag (boolean): Is this agent underperforming or going through the motions?
4. slacking_reason (string): Specific reason WHY (e.g., "logged checklists but 0 qualifications")
5. coaching_note (string): One-sentence tactical coaching for today, grounded in what they actually did
6. hit_target_prediction ("on_track" | "at_risk" | "will_miss"): Prediction of whether they hit monthly target
7. target_reasoning (string): Reasoning for the prediction
8. agent_rolling_summary (string): Short narrative of this agent's performance pattern (2-3 sentences)

Be direct, specific, and actionable. No fluff.`;

    // Call LLM for analysis
    console.log('[generateAgentIntelligence] Calling InvokeLLM...');
    let llmResponse;
    try {
      llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            earned_more_leads_verdict: { type: 'boolean' },
            earned_reasoning: { type: 'string' },
            slacking_flag: { type: 'boolean' },
            slacking_reason: { type: 'string' },
            coaching_note: { type: 'string' },
            hit_target_prediction: { type: 'string', enum: ['on_track', 'at_risk', 'will_miss'] },
            target_reasoning: { type: 'string' },
            agent_rolling_summary: { type: 'string' },
          },
          required: [
            'earned_more_leads_verdict',
            'earned_reasoning',
            'slacking_flag',
            'slacking_reason',
            'coaching_note',
            'hit_target_prediction',
            'target_reasoning',
            'agent_rolling_summary',
          ],
        },
        model: 'claude_sonnet_4_6',
      });
      console.log('[generateAgentIntelligence] LLM raw response:', JSON.stringify(llmResponse).slice(0, 500));
    } catch (llmError) {
      console.error('[generateAgentIntelligence] LLM call failed:', llmError.message);
      throw llmError;
    }

    let analysis;
    try {
      analysis = typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;
      console.log('[generateAgentIntelligence] Parsed analysis:', JSON.stringify(analysis, null, 2));
    } catch (parseErr) {
      console.error('[generateAgentIntelligence] Parse error:', parseErr.message, 'llmResponse:', llmResponse);
      throw new Error('Failed to parse LLM response: ' + parseErr.message);
    }

    if (!analysis || typeof analysis !== 'object') {
      throw new Error('LLM returned invalid response format');
    }

    const completionRate = Math.round((leadsWorked / (allocation.total_available || 10)) * 100);

    // Update the allocation with AI intelligence (with fallback defaults)
    const updateData = {
      ai_earned_more_leads_verdict: analysis.earned_more_leads_verdict ?? (qualificationsLogged >= 2),
      ai_earned_reasoning: analysis.earned_reasoning || `Completed ${sequencesCompleted} sequences and ${qualificationsLogged} qualifications from ${leadsWorked} leads.`,
      ai_slacking_flag: analysis.slacking_flag ?? (completionRate < 30),
      ai_slacking_reason: analysis.slacking_reason || (completionRate < 30 ? `Low completion rate: only ${completionRate}% of allocated leads worked.` : 'Performing adequately.'),
      ai_coaching_note: analysis.coaching_note || `Focus on completing full 6-step sequences and logging qualifications to unlock more leads.`,
      ai_hit_target_prediction: analysis.hit_target_prediction || (completionRate > 70 ? 'on_track' : completionRate > 40 ? 'at_risk' : 'will_miss'),
      ai_target_reasoning: analysis.target_reasoning || `Current daily completion rate is ${completionRate}%. Maintain this pace to hit monthly targets.`,
      ai_agent_rolling_summary: analysis.agent_rolling_summary || `Agent worked ${leadsWorked} leads today. Completed ${sequencesCompleted} full sequences and logged ${qualificationsLogged} qualifications. Step completion rate: ${stepCompletionRate}%.`,
      ai_processed_at: new Date().toISOString(),
    };
    
    console.log('[generateAgentIntelligence] Final update data:', JSON.stringify(updateData, null, 2));

    await base44.entities.DailyLeadAllocation.update(allocation.id, updateData);

    return Response.json({
      success: true,
      data: {
        agent_email,
        agent_name: allocation.agent_name,
        ...updateData,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});