import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const SYSTEM_PROMPT = `You are Claude — a powerful AI assistant with FULL ACCESS to Erudite Property CRM in Dubai.
You can READ and WRITE to the CRM database. You understand Dubai real estate deeply.

LEAD STAGES: new_lead → contacted → viewing_scheduled → viewing_done → negotiation → offer_made → closed_won / closed_lost
PROJECTS: peninsula-three, jumeirah-living, six-senses, peninsula-four
SOURCES: property_finder, bayut, whatsapp, referral, website, walk_in, social_media, email, import, other

== CRM ACTIONS ==
When the user asks you to DO something in the CRM (create reminder, update lead, add note, assign lead, etc.),
output ONE or MORE action blocks like this (they will be auto-executed):

<crm_action>{"type": "create_reminder", "data": {"title": "...", "notes": "...", "due_date": "ISO8601", "priority": "high|medium|low", "lead_id": "...", "lead_name": "..."}}</crm_action>
<crm_action>{"type": "update_lead", "data": {"lead_id": "...", "stage": "...", "notes": "...", "qualification_status": "hot|warm|cold", "assigned_agent": "email", "next_follow_up": "ISO8601"}}</crm_action>
<crm_action>{"type": "add_activity", "data": {"lead_id": "...", "lead_name": "...", "type": "note|call|viewing|meeting", "title": "...", "description": "...", "outcome": "completed"}}</crm_action>
<crm_action>{"type": "add_tag", "data": {"lead_id": "...", "tags": ["tag1", "tag2"]}}</crm_action>

Always confirm what you executed. Be proactive about suggesting CRM actions.
Respond in markdown. Be concise but insightful.`;

async function executeCRMAction(base44, action) {
  const { type, data } = action;
  try {
    if (type === 'create_reminder') {
      const record = await base44.asServiceRole.entities.Reminder.create({
        title: data.title,
        notes: data.notes || '',
        due_date: data.due_date || null,
        priority: data.priority || 'medium',
        status: 'pending',
        lead_id: data.lead_id || '',
        lead_name: data.lead_name || '',
        type: data.reminder_type || 'follow_up',
        source: 'ai_suggested',
      });
      return { ok: true, type, id: record.id, label: `Reminder created: "${data.title}"` };
    }
    if (type === 'update_lead') {
      const { lead_id, ...updates } = data;
      if (!lead_id) return { ok: false, error: 'No lead_id provided' };
      await base44.asServiceRole.entities.Lead.update(lead_id, updates);
      return { ok: true, type, label: `Lead updated: ${lead_id}` };
    }
    if (type === 'add_activity') {
      const record = await base44.asServiceRole.entities.Activity.create({
        lead_id: data.lead_id,
        type: data.type || 'note',
        title: data.title,
        description: data.description || '',
        agent_name: data.agent_name || 'Claude AI',
        outcome: data.outcome || 'completed',
      });
      return { ok: true, type, id: record.id, label: `Activity added: "${data.title}"` };
    }
    if (type === 'add_tag') {
      const lead = await base44.asServiceRole.entities.Lead.get(data.lead_id);
      const existing = lead.tags || [];
      const merged = [...new Set([...existing, ...(data.tags || [])])];
      await base44.asServiceRole.entities.Lead.update(data.lead_id, { tags: merged });
      return { ok: true, type, label: `Tags added to lead` };
    }
    return { ok: false, error: 'Unknown action type: ' + type };
  } catch (e) {
    return { ok: false, type, error: e.message };
  }
}

async function getFullCRMContext(base44) {
  // Paginate to get up to 500 leads
  const leads = [];
  for (let page = 0; page < 5; page++) {
    const batch = await base44.asServiceRole.entities.Lead.list('-updated_date', 100, page * 100);
    leads.push(...batch);
    if (batch.length < 100) break;
  }

  const [properties, reminders, commissions, offers, recentActivities, conversations] = await Promise.all([
    base44.asServiceRole.entities.Property.list('-updated_date', 50).catch(() => []),
    base44.asServiceRole.entities.Reminder.filter({ status: 'pending' }, '-due_date', 30).catch(() => []),
    base44.asServiceRole.entities.Commission.list('-created_date', 50).catch(() => []),
    base44.asServiceRole.entities.Offer.list('-created_date', 30).catch(() => []),
    base44.asServiceRole.entities.Activity.list('-created_date', 50).catch(() => []),
    base44.asServiceRole.entities.WhatsAppConversation.list('-last_message_at', 20).catch(() => []),
  ]);

  const stageMap = leads.reduce((a, l) => { a[l.stage] = (a[l.stage] || 0) + 1; return a; }, {});
  const sourceMap = leads.reduce((a, l) => { a[l.source] = (a[l.source] || 0) + 1; return a; }, {});
  const hotLeads = leads.filter(l => l.qualification_status === 'hot' || (l.lead_score || 0) >= 70);
  const staleLeads = leads.filter(l => (l.inactivity_days || 0) > 7);
  const totalRevenue = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const pendingCommission = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const activeOffers = offers.filter(o => ['submitted', 'countered'].includes(o.status));

  return {
    // Summary
    total_leads: leads.length,
    hot_leads_count: hotLeads.length,
    stale_leads_count: staleLeads.length,
    properties_count: properties.length,
    pending_reminders_count: reminders.length,
    total_paid_commission_aed: totalRevenue,
    pending_commission_aed: pendingCommission,
    active_offers_count: activeOffers.length,
    total_activities: recentActivities.length,
    open_whatsapp_conversations: conversations.filter(c => c.status === 'open').length,

    // Distributions
    stage_distribution: stageMap,
    source_distribution: sourceMap,

    // All leads (full)
    all_leads: leads.map(l => ({
      id: l.id, name: l.name, phone: l.phone, email: l.email,
      stage: l.stage, source: l.source, score: l.lead_score,
      qualification: l.qualification_status, budget_aed: l.budget_aed,
      assigned_agent: l.assigned_agent_name, inactivity_days: l.inactivity_days,
      next_follow_up: l.next_follow_up, tags: l.tags, notes: l.notes,
      project_layer: l.project_layer, nationality: l.nationality,
    })),

    // Properties
    properties: properties.map(p => ({
      id: p.id, title: p.title, type: p.property_type,
      price: p.price_aed, status: p.status, bedrooms: p.bedrooms,
      area: p.area_sqft, location: p.location,
    })),

    // Commissions
    commissions: commissions.map(c => ({
      id: c.id, agent: c.agent_name, deal_value: c.deal_value_aed,
      amount: c.commission_amount_aed, status: c.status, deal_type: c.deal_type, closing_date: c.closing_date,
    })),

    // Offers
    active_offers: offers.map(o => ({
      id: o.id, lead_name: o.lead_name, property_title: o.property_title,
      amount: o.offer_amount_aed, asking: o.asking_price_aed,
      status: o.status, agent: o.agent_name,
    })),

    // Recent activities
    recent_activities: recentActivities.slice(0, 30).map(a => ({
      lead_id: a.lead_id, type: a.type, title: a.title,
      outcome: a.outcome, agent: a.agent_name, created: a.created_date,
    })),

    // Reminders
    pending_reminders: reminders.map(r => ({
      id: r.id, title: r.title, due_date: r.due_date,
      lead_name: r.lead_name, priority: r.priority, type: r.type,
    })),

    // WhatsApp
    whatsapp_conversations: conversations.map(c => ({
      lead_id: c.lead_id, status: c.status, unread: c.unread_count,
      last_message: c.last_message, sentiment: c.ai_sentiment, urgency: c.ai_urgency,
    })),
  };
}

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
        crmContext = `\n\n## Current Lead\n${JSON.stringify(lead, null, 2)}\n\n## Recent Activities\n${JSON.stringify(activities, null, 2)}`;
      } else {
        // Full CRM context for general chat
        const fullCtx = await getFullCRMContext(base44);
        crmContext = `\n\n## Full CRM Snapshot\n${JSON.stringify(fullCtx, null, 2)}`;
      }

      const anthropicMessages = messages.map(m => ({ role: m.role, content: m.content }));
      if (crmContext && anthropicMessages.length > 0) {
        anthropicMessages[0] = { ...anthropicMessages[0], content: anthropicMessages[0].content + crmContext };
      }

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      });

      const text = response.content[0].text;

      // Parse and execute CRM actions
      const crmActions = [];
      const executedActions = [];
      const actionRegex = /<crm_action>([\s\S]*?)<\/crm_action>/g;
      let match;
      while ((match = actionRegex.exec(text)) !== null) {
        try {
          const action = JSON.parse(match[1]);
          crmActions.push(action);
          const result = await executeCRMAction(base44, action);
          executedActions.push(result);
        } catch (_) { /* skip malformed */ }
      }

      // Clean action tags from reply
      const cleanReply = text.replace(/<crm_action>[\s\S]*?<\/crm_action>/g, '').trim();

      return Response.json({ reply: cleanReply, crm_actions: crmActions, executed_actions: executedActions });
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
        model: 'claude-opus-4-7',
        max_tokens: 2048,
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

      for (const id of ids.slice(0, 10)) {
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
      const leads = await base44.entities.Lead.list('-updated_date', 200);
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
        model: 'claude-opus-4-7',
        max_tokens: 2048,
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