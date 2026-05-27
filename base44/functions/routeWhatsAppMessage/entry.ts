import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * The brain of WhatsApp → Pipeline integration.
 *
 * For every inbound WhatsApp message:
 *   1. Match sender phone against Lead, Landlord, Contact (in that priority)
 *   2. If MATCHED: log activity, update timestamps, trigger appropriate orchestrator
 *   3. If UNMATCHED: classify intent via Claude → create Lead OR Landlord in the right pipeline
 *   4. Auto-assign agent (round-robin by language match if possible)
 *   5. Trigger enrichment + Aurora orchestrator
 *   6. Return the routed entity so webhook can update the conversation record
 *
 * Body: {
 *   phone_e164: string,
 *   message_text: string,
 *   message_id: string,
 *   timestamp: ISO,
 *   conversation_id?: string,
 *   recent_thread?: string[]
 * }
 *
 * Returns: {
 *   routed_entity_type: "lead" | "landlord" | "contact" | "spam" | "unrouted",
 *   routed_entity_id: string,
 *   created: boolean,
 *   classification?: { intent, confidence, language, urgency, ... },
 *   assigned_agent_email?: string,
 *   action_taken: string
 * }
 */

function normalizePhone(raw: string): string {
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

async function findExistingEntity(base44: any, phoneE164: string) {
  const phoneAlt = phoneE164.replace(/^\+/, ''); // bare digits version

  // 1. Try Landlord first (higher commercial value if existing landlord messages)
  try {
    const landlords = await base44.asServiceRole.entities.Landlord.filter({});
    const matched = landlords.find((l: any) =>
      [l.phone, l.whatsapp].some((p: string) => p && (p === phoneE164 || p === phoneAlt || p.replace(/[^\d]/g, '') === phoneAlt))
    );
    if (matched) return { type: 'landlord', entity: matched };
  } catch {}

  // 2. Try Lead
  try {
    const leads = await base44.asServiceRole.entities.Lead.filter({});
    const matched = leads.find((l: any) =>
      [l.phone, l.whatsapp].some((p: string) => p && (p === phoneE164 || p === phoneAlt || p.replace(/[^\d]/g, '') === phoneAlt))
    );
    if (matched) return { type: 'lead', entity: matched };
  } catch {}

  return null;
}

async function pickAgent(base44: any, preferredLanguage: string): Promise<string | null> {
  // Round-robin assignment biased by language match
  try {
    const users = await base44.asServiceRole.entities.User.list();
    const agents = users.filter((u: any) => u.role === 'agent' || u.role === 'admin' || u.role === 'manager');
    if (agents.length === 0) return null;

    // Language match preference
    if (preferredLanguage && preferredLanguage !== 'en') {
      const langMatch = agents.filter((a: any) => (a.languages || []).includes(preferredLanguage));
      if (langMatch.length > 0) {
        // Pick least-busy among language matches
        const sorted = langMatch.sort((a: any, b: any) => (a.assigned_leads_count || 0) - (b.assigned_leads_count || 0));
        return sorted[0].email;
      }
    }

    // Default: least-busy across all agents
    const sorted = agents.sort((a: any, b: any) => (a.assigned_leads_count || 0) - (b.assigned_leads_count || 0));
    return sorted[0].email;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { phone_e164, message_text, message_id, timestamp, conversation_id, recent_thread = [] } = await req.json();
    if (!phone_e164 || !message_text) {
      return Response.json({ error: 'phone_e164 and message_text required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone_e164);

    // ------------------------------------------------------------------------
    // CASE A: Known sender — match against existing Lead or Landlord
    // ------------------------------------------------------------------------
    const existing = await findExistingEntity(base44, normalized);

    if (existing) {
      const e = existing.entity;
      const entityType = existing.type;

      // Update last contact + activity
      try {
        const updates: any = {
          last_activity_at: timestamp,
          last_activity_type: 'whatsapp',
          last_touch_at: timestamp
        };
        if (entityType === 'lead') {
          await base44.asServiceRole.entities.Lead.update(e.id, updates);
        } else if (entityType === 'landlord') {
          await base44.asServiceRole.entities.Landlord.update(e.id, updates);
        }
      } catch (err) {
        console.warn('update existing entity failed', err);
      }

      // Log activity (uses Activity.lead_id for both Lead and Landlord — both use the same field)
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

      // Fire orchestrator async — landlord uses landlordOrchestrator, lead uses calculateLeadScore + analyzeConversation
      if (entityType === 'landlord') {
        base44.asServiceRole.functions.invoke('landlordOrchestrator', { landlord_id: e.id }).catch((err: any) => console.warn('landlord orchestrator failed', err));
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

    // ------------------------------------------------------------------------
    // CASE B: Unknown sender — classify intent then create the right entity
    // ------------------------------------------------------------------------

    const classifyRes = await base44.functions.invoke('classifyInboundMessage', {
      message: message_text,
      sender_phone: normalized,
      recent_thread
    });
    const c = classifyRes?.data || classifyRes;

    // Spam handling — don't create any entity, just log
    if (c?.intent === 'spam') {
      return Response.json({
        routed_entity_type: 'spam',
        routed_entity_id: null,
        created: false,
        classification: c,
        action_taken: 'Marked as spam, no entity created'
      });
    }

    const agentEmail = await pickAgent(base44, c?.language);
    const name = c?.suggested_name || `WhatsApp lead ${normalized.slice(-4)}`;

    // ------------------------------------------------------------------------
    // CASE B1: Intent = landlord_sale or landlord_rent → create Landlord
    // ------------------------------------------------------------------------
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
        stage: 'first_contact',
        assigned_agent_email: agentEmail,
        urgency_score: c?.urgency === 'urgent' ? 90 : c?.urgency === 'high' ? 70 : 40,
        ai_rolling_summary: `New landlord inbound via WhatsApp. ${c?.reasoning || ''}`,
        tags: ['whatsapp_inbound', 'auto_routed'],
        stage_entered_at: timestamp,
        first_touch_at: timestamp,
        last_activity_at: timestamp,
        last_activity_type: 'whatsapp'
      });

      // Log activity
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id: landlord.id,
          type: 'whatsapp',
          direction: 'inbound',
          channel: 'whatsapp',
          title: `New landlord inquiry via WhatsApp`,
          description: message_text,
          status: 'completed',
          completed_at: timestamp,
          source: 'whatsapp_sync',
          metadata: { wa_message_id: message_id, conversation_id, classification: c, routed_entity_type: 'landlord' }
        });
      } catch {}

      // Trigger orchestrator + battle card
      base44.asServiceRole.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true }).catch(() => {});

      return Response.json({
        routed_entity_type: 'landlord',
        routed_entity_id: landlord.id,
        created: true,
        classification: c,
        assigned_agent_email: agentEmail,
        action_taken: `Created NEW landlord (${c.intent}) → routed to Landlord Pipeline at "first_contact"`
      });
    }

    // ------------------------------------------------------------------------
    // CASE B2: Intent = buyer/tenant/investor/general → create Lead
    // ------------------------------------------------------------------------
    const isInvestor = c?.intent === 'investor';
    const leadPayload: any = {
      full_name: name,
      name: name,
      phone: normalized,
      whatsapp: normalized,
      email: '',
      preferred_language: c?.language || 'en',
      preferred_contact_channel: 'whatsapp',
      source: 'whatsapp_campaign',
      stage: c?.first_message_strength === 'exceptional' || c?.first_message_strength === 'strong' ? 'qualified' : 'new',
      assigned_agent_email: agentEmail,
      type: c?.intent === 'tenant' ? 'rent' : (isInvestor ? 'invest' : 'buy'),
      first_touch_at: timestamp,
      last_touch_at: timestamp,
      last_activity_at: timestamp,
      last_activity_type: 'whatsapp',
      tags: ['whatsapp_inbound', 'auto_routed', ...(isInvestor ? ['investor'] : [])],
      notes: `Routed from WhatsApp. ${c?.reasoning || ''}\n\nFirst message:\n"${message_text}"\n\nAI-suggested reply:\n"${c?.suggested_first_reply || ''}"`
    };

    // Hydrate extracted entities
    if (c?.entities) {
      if (c.entities.budget_min) leadPayload.budget_min = c.entities.budget_min;
      if (c.entities.budget_max) leadPayload.budget_max = c.entities.budget_max;
      if (c.entities.currency) leadPayload.budget_currency = c.entities.currency;
      if (c.entities.preferred_locations?.length) leadPayload.preferred_locations = c.entities.preferred_locations;
      if (c.entities.bedrooms_min != null) leadPayload.bedrooms_min = c.entities.bedrooms_min;
      if (c.entities.bedrooms_max != null) leadPayload.bedrooms_max = c.entities.bedrooms_max;
      if (c.entities.property_types?.length) leadPayload.preferred_property_types = c.entities.property_types;
      if (c.entities.move_in_timeline) leadPayload.move_in_timeline = c.entities.move_in_timeline;
      if (c.entities.budget_min || c.entities.budget_max) leadPayload.budget_aed = c.entities.budget_max || c.entities.budget_min;
    }

    const lead = await base44.asServiceRole.entities.Lead.create(leadPayload);

    // Log activity
    try {
      await base44.asServiceRole.entities.Activity.create({
        lead_id: lead.id,
        type: 'whatsapp',
        direction: 'inbound',
        channel: 'whatsapp',
        title: `New ${c?.intent || 'lead'} inquiry via WhatsApp`,
        description: message_text,
        status: 'completed',
        completed_at: timestamp,
        source: 'whatsapp_sync',
        metadata: { wa_message_id: message_id, conversation_id, classification: c, routed_entity_type: 'lead' }
      });
    } catch {}

    // Trigger lead enrichment + score
    base44.asServiceRole.functions.invoke('calculateLeadScore', { lead_id: lead.id }).catch(() => {});
    base44.asServiceRole.functions.invoke('analyzeConversation', { conversation_id }).catch(() => {});
    base44.asServiceRole.functions.invoke('autoAssignLead', { lead_id: lead.id }).catch(() => {});

    return Response.json({
      routed_entity_type: 'lead',
      routed_entity_id: lead.id,
      created: true,
      classification: c,
      assigned_agent_email: agentEmail,
      action_taken: `Created NEW lead (${c?.intent}) → routed to Lead Pipeline at "${leadPayload.stage}"`
    });
  } catch (error: any) {
    console.error('routeWhatsAppMessage error:', error);
    return Response.json({ error: error.message, routed_entity_type: 'unrouted' }, { status: 500 });
  }
});
