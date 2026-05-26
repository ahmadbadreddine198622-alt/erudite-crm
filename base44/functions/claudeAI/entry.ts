import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const SYSTEM_PROMPT = `You are an expert real estate CRM assistant for a Dubai property agency called Erudite Property. 
You have deep knowledge of UAE real estate market, lead management, and sales processes.
When given CRM data, you analyze it and provide actionable insights, recommendations, and can update records.
Always respond in a structured, professional manner. When asked to perform CRM actions, return a JSON block in your response like:
<crm_action>{"type": "update_lead"|"create_reminder"|"add_tag"|"update_stage", "data": {...}}</crm_action>
You understand lead stages: new_lead, contacted, viewing_scheduled, viewing_done, negotiation, offer_made, closed_won, closed_lost.
You understand project layers: peninsula-three, jumeirah-living, six-senses, peninsula-four.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { mode, messages, lead_id, lead_ids, context_data } = body;

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    // ── CHAT MODE ────────────────────────────────────────────────────────────
    if (mode === 'chat') {
      let crmContext = '';

      if (lead_id) {
        const lead = await base44.entities.Lead.get(lead_id);
        const activities = await base44.entities.Activity.filter({ lead_id }, '-created_date', 20);
        crmContext = `\n\nCurrent lead context:\n${JSON.stringify(lead, null, 2)}\n\nRecent activities:\n${JSON.stringify(activities, null, 2)}`;
      } else if (context_data) {
        crmContext = `\n\nCRM Context:\n${JSON.stringify(context_data, null, 2)}`;
      }

      const anthropicMessages = messages.map(m => ({ role: m.role, content: m.content }));
      if (crmContext && anthropicMessages.length > 0) {
        anthropicMessages[0] = { ...anthropicMessages[0], content: anthropicMessages[0].content + crmContext };
      }

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      });

      const text = response.content[0].text;

      // Parse CRM actions from response
      const crmActions = [];
      const actionRegex = /<crm_action>([\s\S]*?)<\/crm_action>/g;
      let match;
      while ((match = actionRegex.exec(text)) !== null) {
        try { crmActions.push(JSON.parse(match[1])); } catch (_) { /* skip */ }
      }

      return Response.json({ reply: text, crm_actions: crmActions });
    }

    // ── ANALYZE LEAD ─────────────────────────────────────────────────────────
    if (mode === 'analyze_lead') {
      const lead = await base44.entities.Lead.get(lead_id);
      const activities = await base44.entities.Activity.filter({ lead_id }, '-created_date', 30);

      const prompt = `Analyze this real estate lead and provide:
1. Lead quality score (0-100) with reasoning
2. Key insights about this lead
3. Recommended next action
4. Suggested WhatsApp/email message to send them
5. Risk factors if any

Lead data: ${JSON.stringify(lead, null, 2)}
Activities: ${JSON.stringify(activities, null, 2)}

Respond as JSON: {"score": number, "insights": string[], "next_action": string, "suggested_message": string, "risk_factors": string[], "recommended_stage": string}`;

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

      return Response.json({ analysis, lead_name: lead.name });
    }

    // ── BULK ANALYZE LEADS ───────────────────────────────────────────────────
    if (mode === 'bulk_analyze') {
      const ids = lead_ids || [];
      const results = [];

      for (const id of ids.slice(0, 10)) { // cap at 10 to avoid timeout
        const lead = await base44.entities.Lead.get(id);
        const prompt = `Quick analysis for real estate lead. Score 0-100, top insight, next action.
Lead: name=${lead.name}, stage=${lead.stage}, source=${lead.source}, score=${lead.lead_score}, budget=${lead.budget_aed}, last_contact=${lead.last_contact_date}
Respond as JSON: {"score": number, "insight": string, "next_action": string, "priority": "high"|"medium"|"low"}`;

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 256,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        results.push({ lead_id: id, lead_name: lead.name, ...result });
      }

      return Response.json({ results });
    }

    // ── GENERATE MESSAGE ─────────────────────────────────────────────────────
    if (mode === 'generate_message') {
      const lead = await base44.entities.Lead.get(lead_id);
      const { message_type, custom_instruction } = body;

      const prompt = `Generate a ${message_type || 'follow-up'} WhatsApp/SMS message for this real estate lead.
Lead: ${JSON.stringify(lead, null, 2)}
${custom_instruction ? `Special instruction: ${custom_instruction}` : ''}
Keep it professional, warm, and concise. Include their name. Make it feel personal, not templated.
Return JSON: {"message": string, "subject": string}`;

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: text };

      return Response.json(result);
    }

    // ── PIPELINE INSIGHTS ────────────────────────────────────────────────────
    if (mode === 'pipeline_insights') {
      const leads = await base44.entities.Lead.list('-updated_date', 100);
      const stageCounts = leads.reduce((acc, l) => { acc[l.stage] = (acc[l.stage] || 0) + 1; return acc; }, {});
      const sourceCounts = leads.reduce((acc, l) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {});
      const staleLeads = leads.filter(l => l.inactivity_days > 7).length;

      const prompt = `Analyze this real estate CRM pipeline and provide strategic insights.
Total leads: ${leads.length}
Stage distribution: ${JSON.stringify(stageCounts)}
Source distribution: ${JSON.stringify(sourceCounts)}
Stale leads (>7 days inactive): ${staleLeads}
Top leads by score: ${JSON.stringify(leads.sort((a, b) => (b.lead_score||0) - (a.lead_score||0)).slice(0, 5).map(l => ({ name: l.name, stage: l.stage, score: l.lead_score })))}

Provide: pipeline health score, top 3 priorities, conversion bottlenecks, recommended actions.
Return JSON: {"health_score": number, "priorities": string[], "bottlenecks": string[], "recommendations": string[], "summary": string}`;

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

      return Response.json({ insights, total_leads: leads.length });
    }

    return Response.json({ error: 'Unknown mode' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});