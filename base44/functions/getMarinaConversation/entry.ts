import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Try to find conversations with actual phone numbers
    let conversations = await base44.entities.WhatsAppConversation.filter(
      { wa_phone_e164: { $exists: true, $ne: null, $ne: "" } }, 
      undefined, 
      1
    );
    
    if (!conversations || conversations.length === 0) {
      // Fallback to any conversation
      conversations = await base44.entities.WhatsAppConversation.list(undefined, 1);
    }
    
    if (!conversations || conversations.length === 0) {
      return Response.json({ error: 'No conversations found' }, { status: 404 });
    }
    
    const record = conversations[0];
    const d = record.data || {};
    
    // Return ALL fields from the schema
    return Response.json({
      id: record.id,
      created_date: record.created_date,
      updated_date: record.updated_date,
      wa_phone_e164: d.wa_phone_e164,
      phone_number: d.phone_number,
      wa_display_name: d.wa_display_name,
      wa_saved_name: d.wa_saved_name,
      wa_profile_pic_url: d.wa_profile_pic_url,
      wa_about: d.wa_about,
      wa_last_seen_at: d.wa_last_seen_at,
      wa_business_account: d.wa_business_account,
      wa_verified: d.wa_verified,
      contact_id: d.contact_id,
      lead_id: d.lead_id,
      deal_id: d.deal_id,
      country_code: d.country_code,
      carrier: d.carrier,
      phone_type: d.phone_type,
      is_valid_whatsapp: d.is_valid_whatsapp,
      spam_score: d.spam_score,
      status: d.status,
      lead_stage: d.lead_stage,
      assigned_agent_email: d.assigned_agent_email,
      assigned_at: d.assigned_at,
      snoozed_until: d.snoozed_until,
      last_message: d.last_message,
      last_message_at: d.last_message_at,
      unread_count: d.unread_count,
      first_message_at: d.first_message_at,
      last_inbound_at: d.last_inbound_at,
      last_outbound_at: d.last_outbound_at,
      first_response_seconds: d.first_response_seconds,
      sla_due_at: d.sla_due_at,
      sla_breached: d.sla_breached,
      avg_response_seconds: d.avg_response_seconds,
      detected_language: d.detected_language,
      auto_translate_to: d.auto_translate_to,
      ai_priority: d.ai_priority,
      ai_urgency: d.ai_urgency,
      ai_sentiment: d.ai_sentiment,
      ai_sentiment_current: d.ai_sentiment_current,
      ai_sentiment_trend: d.ai_sentiment_trend,
      ai_buying_signal_count: d.ai_buying_signal_count,
      ai_red_flag_count: d.ai_red_flag_count,
      ai_topics: d.ai_topics,
      ai_mentioned_properties: d.ai_mentioned_properties,
      ai_mentioned_locations: d.ai_mentioned_locations,
      ai_mentioned_competitors: d.ai_mentioned_competitors,
      ai_rolling_summary: d.ai_rolling_summary,
      ai_summary: d.ai_summary,
      ai_intent: d.ai_intent,
      ai_next_action: d.ai_next_action,
      ai_next_message_suggestions: d.ai_next_message_suggestions,
      is_vip: d.is_vip,
      is_starred: d.is_starred,
      tags: d.tags,
      ai_tags: d.ai_tags,
      manual_tags: d.manual_tags,
      internal_notes: d.internal_notes,
      consent: d.consent,
      channel_links: d.channel_links,
      channel: d.channel,
      wa_labels: d.wa_labels,
      wa_label_ids: d.wa_label_ids,
      wa_label_colors: d.wa_label_colors,
      wa_labels_synced_at: d.wa_labels_synced_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});