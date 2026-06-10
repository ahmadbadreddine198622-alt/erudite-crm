import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * The brain of WhatsApp → Pipeline integration.
 *
 * For every inbound WhatsApp message:
 *   1. Match sender phone against Lead or Landlord
 *   2. If MATCHED: log activity, update timestamps, trigger appropriate orchestrator
 *   3. If UNMATCHED: classify intent via Claude → determine department (Sales/Leasing/Listing Acquisition)
 *      → assign to next available agent by capacity (AgentWorkload) → create Lead or Landlord
 *   4. Tag WhatsApp conversation with department + assigned agent
 *   5. Create immediate follow-up reminder for the assigned agent
 *
 * Body: { phone_e164, message_text, message_id, timestamp, conversation_id?, recent_thread? }
 */

// Map Claude intent → brokerage department
const DEPT_MAP = {
  buyer: 'Sales',
  investor: 'Sales',
  general_inquiry: 'Sales',
  agent_other_brokerage: 'Sales',
  tenant: 'Leasing',
  landlord_sale: 'Listing Acquisition',
  landlord_rent: 'Listing Acquisition',
};

function normalizePhone(raw) {
  if (!raw) return '';
  let c = String(raw).replace(/[^\d+]/g, '');
  if (!c) return '';
  if (c.startsWith('+')) return c;
  if (c.startsWith('00')) return '+' + c.slice(2);
  if (c.startsWith('05') && c.length === 10) return '+971' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) return '+971' + c;
  if (c.length >= 10) return '+' + c;
  return c;
}

async function findExistingEntity(base44, phoneE164) {
  const phoneAlt = phoneE164.replace(/^\+/, '');

  try {
    const landlords = await base44.asServiceRole.entities.Landlord.filter({});
    const matched = landlords.find(l =>
      [l.phone, l.whatsapp].some(p => p && (p === phoneE164 || p === phoneAlt || p.replace(/[^\d]/g, '') === phoneAlt))
    );
    if (matched) return { type: 'landlord', entity: matched };
  } catch {}

  try {
    const leads = await base44.asServiceRole.entities.Lead.filter({});
    const matched = leads.find(l =>
      [l.phone, l.whatsapp].some(p => p && (p === phoneE164 || p === phoneAlt || p.replace(/[^\d]/g, '') === phoneAlt))
    );
    if (matched) return { type: 'lead', entity: matched };
  } catch {}

  return null;
}

/**
 * Capacity-aware agent picker.
 * 1. Reads AgentWorkload — picks the available agent with fewest active conversations.
 * 2. Optionally filters by department if any workload records declare one.
 * 3. Falls back to User list (biased by language match).
 */
async function pickAgent(base44, preferredLanguage, department) {
  try {
    let workloads = await base44.asServiceRole.entities.AgentWorkload
      .filter({ status: 'available' }, 'assigned_conversations', 50)
      .catch(() => []);

    // Department filter — only applies if any record has a department field set
    if (department && workloads.some(w => w.department)) {
      const deptFiltered = workloads.filter(w => !w.department || w.department === department);
      if (deptFiltered.length > 0) workloads = deptFiltered;
    }

    if (workloads.length > 0) {
      // Sort ascending by active conversation count → pick least busy
      workloads.sort((a, b) => (a.assigned_conversations || 0) - (b.assigned_conversations || 0));
      const chosen = workloads[0];
      // Increment their workload counter
      base44.asServiceRole.entities.AgentWorkload.update(chosen.id, {
        assigned_conversations: (chosen.assigned_conversations || 0) + 1,
        last_activity: new Date().toISOString(),
      }).catch(() => null);
      return chosen.agent_email;
    }

    // Fallback: User list
    const users = await base44.asServiceRole.entities.User.list();
    const agents = users.filter(u => ['agent', 'admin', 'manager'].includes(u.role));
    if (agents.length === 0) return null;

    if (preferredLanguage && preferredLanguage !== 'en') {
      const langMatch = agents.filter(a => (a.languages || []).includes(preferredLanguage));
      if (langMatch.length > 0) return langMatch[0].email;
    }
    return agents[0].email;
  } catch {
    return null;
  }
}

/** Tag the WhatsApp conversation with department + agent */
async function tagConversation(base44, conversation_id, agentEmail, department, timestamp) {
  if (!conversation_id) return;
  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
    assigned_agent_email: agentEmail,
    assigned_at: timestamp,
    manual_tags: [`dept:${department}`, 'auto_routed'],
  }).catch(() => null);
}

/** Create immediate reminder for assigned agent */
async function createAgentReminder(base44, agentEmail, leadId, leadName, urgency, department, intent, messageText, suggestedReply) {
  if (!agentEmail) return;
  const delayMinutes = urgency === 'urgent' ? 30 : urgency === 'high' ? 120 : 240;
  await base44.asServiceRole.entities.Reminder.create({
    title: `New ${department} inbound: ${leadName} via WhatsApp`,
    notes: `Intent: ${intent} | Urgency: ${urgency}\n\n"${messageText.slice(0, 300)}"\n\nSuggested reply:\n"${suggestedReply || ''}"`,
    due_date: new Date(Date.now() + delayMinutes * 60000).toISOString(),
    priority: urgency === 'urgent' ? 'urgent' : urgency === 'high' ? 'high' : 'medium',
    status: 'pending',
    type: 'follow_up',
    lead_id: leadId,
    lead_name: leadName,
    assigned_to: agentEmail,
    source: 'ai_suggested',
    tags: ['auto_routed', department.toLowerCase().replace(' ', '_'), intent],
  }).catch(() => null);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { phone_e164, message_text, message_id, timestamp, conversation_id, recent_thread = [], wa_display_name } = await req.json();
    if (!phone_e164 || !message_text) {
      return Response.json({ error: 'phone_e164 and message_text required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone_e164);

    // ─────────────────────────────────────────────────────────────
    // CASE A: Known sender — update activity timestamps + orchestrate
    // ─────────────────────────────────────────────────────────────
    const existing = await findExistingEntity(base44, normalized);

    if (existing) {
      const e = existing.entity;
      const entityType = existing.type;

      try {
        const updates = { last_activity_at: timestamp, last_activity_type: 'whatsapp', last_touch_at: timestamp };
        // If we now have a real WhatsApp display name and entity still has a fallback name, update it
        if (wa_display_name) {
          const currentName = e.full_name || e.full_name_en || e.name || '';
          if (!currentName || currentName.startsWith('WhatsApp lead')) {
            if (entityType === 'lead') updates.full_name = wa_display_name;
            else if (entityType === 'landlord') { updates.full_name = wa_display_name; updates.full_name_en = wa_display_name; }
          }
        }
        if (entityType === 'lead') {
          await base44.asServiceRole.entities.Lead.update(e.id, updates);
        } else if (entityType === 'landlord') {
          await base44.asServiceRole.entities.Landlord.update(e.id, updates);
        }
      } catch (err) {
        console.warn('update existing entity failed', err);
      }

      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id: e.id,
          type: 'whatsapp',
          direction: 'inbound',
          channel: 'whatsapp',
          title: `WhatsApp from ${e.full_name_en || e.full_name || e.name || normalized}`,
          description: message_text,
          status: 'completed',
          completed_at: timestamp,
          source: 'whatsapp_sync',
          metadata: { wa_message_id: message_id, conversation_id, routed_entity_type: entityType }
        });
      } catch (err) { console.warn('activity log failed', err); }

      if (entityType === 'landlord') {
        base44.asServiceRole.functions.invoke('landlordOrchestrator', { landlord_id: e.id }).catch(err => console.warn('landlord orchestrator failed', err));
      } else {
        base44.asServiceRole.functions.invoke('calculateLeadScore', { conversation_id }).catch(() => {});
        base44.asServiceRole.functions.invoke('analyzeConversation', { conversation_id }).catch(() => {});
      }

      return Response.json({
        routed_entity_type: entityType,
        routed_entity_id: e.id,
        created: false,
        assigned_agent_email: e.assigned_agent_email,
        action_taken: `Logged WhatsApp on existing ${entityType}: ${e.full_name_en || e.full_name || e.name || e.phone}`
      });
    }

    // ─────────────────────────────────────────────────────────────
    // CASE B: Unknown sender — classify intent via Claude
    // ─────────────────────────────────────────────────────────────
    const classifyRes = await base44.functions.invoke('classifyInboundMessage', {
      message: message_text,
      sender_phone: normalized,
      recent_thread
    });
    const c = classifyRes?.data || classifyRes;

    if (c?.intent === 'spam') {
      return Response.json({
        routed_entity_type: 'spam',
        routed_entity_id: null,
        created: false,
        classification: c,
        action_taken: 'Marked as spam, no entity created'
      });
    }

    // Determine department and pick the best available agent by capacity
    const department = DEPT_MAP[c?.intent] || 'Sales';
    const agentEmail = await pickAgent(base44, c?.language, department);
    // Priority: WhatsApp profile name > AI suggested name > phone fallback
    const name = wa_display_name || c?.suggested_name || `WhatsApp lead ${normalized.slice(-4)}`;

    // ─────────────────────────────────────────────────────────────
    // CASE B1: Landlord intents → create Landlord record
    // ─────────────────────────────────────────────────────────────
    if (c?.intent === 'landlord_sale' || c?.intent === 'landlord_rent') {
      const landlord = await base44.asServiceRole.entities.Landlord.create({
        full_name: name,
        full_name_en: name,
        first_name: name.split(' ')[0],
        phone: normalized,
        whatsapp: normalized,
        preferred_language: c?.language || 'en',
        lead_type: c.intent === 'landlord_sale' ? 'landlord_sale' : 'landlord_rent',
        source: 'whatsapp_campaign',
        stage: 'initial_contact',
        assigned_agent_email: agentEmail,
        urgency_score: c?.urgency === 'urgent' ? 90 : c?.urgency === 'high' ? 70 : 40,
        ai_rolling_summary: `New landlord inbound via WhatsApp. ${c?.reasoning || ''}`,
        tags: ['whatsapp_inbound', 'auto_routed', `dept:${department}`],
        stage_entered_at: timestamp,
        first_touch_at: timestamp,
        last_activity_at: timestamp,
        last_activity_type: 'whatsapp'
      });

      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id: landlord.id,
          type: 'whatsapp',
          direction: 'inbound',
          channel: 'whatsapp',
          title: `New ${department} inquiry via WhatsApp`,
          description: message_text,
          status: 'completed',
          completed_at: timestamp,
          source: 'whatsapp_sync',
          metadata: { wa_message_id: message_id, conversation_id, classification: c, department, routed_entity_type: 'landlord' }
        });
      } catch {}

      base44.asServiceRole.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true }).catch(() => {});

      await tagConversation(base44, conversation_id, agentEmail, department, timestamp);
      await createAgentReminder(base44, agentEmail, landlord.id, name, c?.urgency || 'medium', department, c?.intent, message_text, c?.suggested_first_reply);

      // Fire auto-reply (respects business hours, includes property link)
      base44.asServiceRole.functions.invoke('sendAutoWhatsAppReply', {
        lead_id: landlord.id,
        phone_e164: normalized,
        suggested_reply: c?.suggested_first_reply,
        language: c?.language || 'en',
        intent: c?.intent,
        lead_name: name,
      }).catch(() => null);

      return Response.json({
        routed_entity_type: 'landlord',
        routed_entity_id: landlord.id,
        created: true,
        classification: c,
        department,
        assigned_agent_email: agentEmail,
        action_taken: `[${department}] Created NEW landlord → ${c.intent} pipeline. Assigned to: ${agentEmail}`
      });
    }

    // ─────────────────────────────────────────────────────────────
    // CASE B2: Buyer / Tenant / Investor → create Lead record
    // ─────────────────────────────────────────────────────────────
    const isInvestor = c?.intent === 'investor';
    const isTenant = c?.intent === 'tenant';

    const leadPayload = {
      full_name: name,
      phone: normalized,
      whatsapp: normalized,
      preferred_language: c?.language || 'en',
      preferred_contact_channel: 'whatsapp',
      source: 'whatsapp_campaign',
      stage: ['exceptional', 'strong'].includes(c?.first_message_strength) ? 'financial_qualification' : 'intake_clarify',
      status: 'active',
      intent: isTenant ? 'tenant' : 'buyer',
      team: department,
      assigned_agent_email: agentEmail,
      first_touch_at: timestamp,
      last_touch_at: timestamp,
      last_activity_at: timestamp,
      last_activity_type: 'whatsapp',
      tags: ['whatsapp_inbound', 'auto_routed', `dept:${department}`, ...(isInvestor ? ['investor'] : [])],
      notes: `[Auto-routed to ${department}]\nIntent: ${c?.intent} | Urgency: ${c?.urgency}\n\n${c?.reasoning || ''}\n\nFirst message:\n"${message_text}"\n\nAI-suggested reply:\n"${c?.suggested_first_reply || ''}"`
    };

    // Hydrate extracted property criteria
    if (c?.entities) {
      const ent = c.entities;
      if (ent.budget_min) leadPayload.budget_min = ent.budget_min;
      if (ent.budget_max) leadPayload.budget_max = ent.budget_max;
      if (ent.currency) leadPayload.budget_currency = ent.currency;
      if (ent.preferred_locations?.length) leadPayload.preferred_locations = ent.preferred_locations;
      if (ent.bedrooms_min != null) leadPayload.bedrooms_min = ent.bedrooms_min;
      if (ent.bedrooms_max != null) leadPayload.bedrooms_max = ent.bedrooms_max;
      if (ent.property_types?.length) leadPayload.preferred_property_types = ent.property_types;
      if (ent.move_in_timeline) leadPayload.move_in_timeline = ent.move_in_timeline;
    }

    const lead = await base44.asServiceRole.entities.Lead.create(leadPayload);

    try {
      await base44.asServiceRole.entities.Activity.create({
        lead_id: lead.id,
        type: 'whatsapp',
        direction: 'inbound',
        channel: 'whatsapp',
        title: `New ${department} inquiry via WhatsApp — ${c?.intent || 'lead'}`,
        description: message_text,
        status: 'completed',
        completed_at: timestamp,
        source: 'whatsapp_sync',
        metadata: { wa_message_id: message_id, conversation_id, classification: c, department, routed_entity_type: 'lead' }
      });
    } catch {}

    // Trigger async enrichment
    base44.asServiceRole.functions.invoke('calculateLeadScore', { lead_id: lead.id }).catch(() => {});
    base44.asServiceRole.functions.invoke('analyzeConversation', { conversation_id }).catch(() => {});
    base44.asServiceRole.functions.invoke('autoAssignLead', { lead_id: lead.id }).catch(() => {});

    await tagConversation(base44, conversation_id, agentEmail, department, timestamp);
    await createAgentReminder(base44, agentEmail, lead.id, name, c?.urgency || 'medium', department, c?.intent, message_text, c?.suggested_first_reply);

    // Fire auto-reply (respects business hours, includes matching property link)
    base44.asServiceRole.functions.invoke('sendAutoWhatsAppReply', {
      lead_id: lead.id,
      phone_e164: normalized,
      suggested_reply: c?.suggested_first_reply,
      language: c?.language || 'en',
      budget_min: c?.entities?.budget_min,
      budget_max: c?.entities?.budget_max,
      preferred_locations: c?.entities?.preferred_locations || [],
      intent: c?.intent,
      lead_name: name,
    }).catch(() => null);

    return Response.json({
      routed_entity_type: 'lead',
      routed_entity_id: lead.id,
      created: true,
      classification: c,
      department,
      assigned_agent_email: agentEmail,
      action_taken: `[${department}] Created NEW lead (${c?.intent}) at stage "${leadPayload.stage}". Assigned to: ${agentEmail}`
    });

  } catch (error) {
    console.error('routeWhatsAppMessage error:', error);
    return Response.json({ error: error.message, routed_entity_type: 'unrouted' }, { status: 500 });
  }
});