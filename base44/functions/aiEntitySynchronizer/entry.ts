import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const CLAUDE_SYSTEM_PROMPT = `You are the AI Sync Hub for Erudite Property CRM in Dubai.
Your role is to analyze entity data, detect patterns, and recommend actions.

You have access to:
- Leads, Properties, Landlords, Deals, WhatsApp Conversations, Reminders

For each sync operation, analyze the data and provide:
1. Key insights about entity relationships
2. Recommended actions (create reminders, update stages, link entities)
3. Risk factors or opportunities
4. Priority recommendations

Respond in JSON format with:
{
  "insights": string[],
  "recommended_actions": [{"type": "create_reminder"|"update_lead"|"link_entities", "data": {...}}],
  "risk_factors": string[],
  "opportunities": string[]
}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity_name, mode = 'full_sync', detectConnections = true, generateInsights = true, useClaude = true } = body;

    console.log(`Starting AI synchronization for ${entity_name} in mode: ${mode}`);

    let totalSynced = 0;
    let totalConnections = 0;
    const results = {};

    // Fetch all entities
    const [leads, properties, landlords, deals, conversations, reminders] = await Promise.all([
      base44.asServiceRole.entities.Lead.list('-created_date', 500),
      base44.asServiceRole.entities.Property.list('-created_date', 500),
      base44.asServiceRole.entities.Landlord.list('-created_date', 500),
      base44.asServiceRole.entities.Deal.list('-created_date', 500),
      base44.asServiceRole.entities.WhatsAppConversation.list('-last_message_at', 500),
      base44.asServiceRole.entities.Reminder.list('-due_at', 500),
    ]);

    console.log(`Fetched: ${leads.length} leads, ${properties.length} properties, ${landlords.length} landlords, ${deals.length} deals, ${conversations.length} conversations, ${reminders.length} reminders`);

    // Phase 1: Entity-specific synchronization
    if (entity_name === 'all' || entity_name === 'Lead') {
      const leadResults = await syncLeads(leads, properties, deals, conversations, base44);
      results.Lead = leadResults;
      totalSynced += leadResults.syncedCount;
      totalConnections += leadResults.connectionsFound;
    }

    if (entity_name === 'all' || entity_name === 'Property') {
      const propertyResults = await syncProperties(properties, leads, deals, landlords, base44);
      results.Property = propertyResults;
      totalSynced += propertyResults.syncedCount;
      totalConnections += propertyResults.connectionsFound;
    }

    if (entity_name === 'all' || entity_name === 'Landlord') {
      const landlordResults = await syncLandlords(landlords, properties, leads, base44);
      results.Landlord = landlordResults;
      totalSynced += landlordResults.syncedCount;
      totalConnections += landlordResults.connectionsFound;
    }

    if (entity_name === 'all' || entity_name === 'Deal') {
      const dealResults = await syncDeals(deals, leads, properties, conversations, base44);
      results.Deal = dealResults;
      totalSynced += dealResults.syncedCount;
      totalConnections += dealResults.connectionsFound;
    }

    if (entity_name === 'all' || entity_name === 'WhatsAppConversation') {
      const conversationResults = await syncConversations(conversations, leads, deals, base44);
      results.WhatsAppConversation = conversationResults;
      totalSynced += conversationResults.syncedCount;
      totalConnections += conversationResults.connectionsFound;
    }

    if (entity_name === 'all' || entity_name === 'Reminder') {
      const reminderResults = await syncReminders(reminders, leads, properties, deals, base44);
      results.Reminder = reminderResults;
      totalSynced += reminderResults.syncedCount;
      totalConnections += reminderResults.connectionsFound;
    }

    // Phase 2: Cross-entity relationship detection
    if (detectConnections && entity_name === 'all') {
      const connectionResults = await detectCrossEntityConnections(leads, properties, landlords, deals, conversations, reminders, base44);
      results.connections = connectionResults;
      totalConnections += connectionResults.newConnections;
    }

    // Phase 3: Generate AI insights using Claude
    if (generateInsights && entity_name === 'all' && useClaude) {
      const claudeInsights = await generateClaudeInsights(leads, properties, landlords, deals, conversations, reminders, base44);
      results.claude_insights = claudeInsights;
      
      // Execute Claude's recommended actions
      if (claudeInsights.recommended_actions) {
        const executedActions = await executeClaudeActions(claudeInsights.recommended_actions, base44);
        results.executed_actions = executedActions;
      }
    } else if (generateInsights && entity_name === 'all') {
      const insightsResults = await generateAIInsights(leads, properties, landlords, deals, conversations, reminders, base44);
      results.insights = insightsResults;
    }

    console.log(`Synchronization complete: ${totalSynced} records processed, ${totalConnections} connections discovered`);

    return Response.json({
      success: true,
      totalSynced,
      totalConnections,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('AI synchronization failed:', error);
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});

// Sync Leads with AI enrichment
async function syncLeads(leads, properties, deals, conversations, base44) {
  console.log('Syncing leads...');
  let syncedCount = 0;
  let connectionsFound = 0;

  for (const lead of leads) {
    try {
      const updates = {};

      // Check if lead has matching WhatsApp conversation
      const matchingConvo = conversations.find(c =>
        c.wa_phone_e164 === lead.phone || c.wa_phone_e164 === lead.whatsapp
      );
      if (matchingConvo && !lead.ai_recommended_property_ids) {
        updates.ai_engagement_level = calculateEngagementLevel(matchingConvo);
        connectionsFound++;
      }

      // Check if lead has active deal
      const hasDeal = deals.some(d => d.lead_id === lead.id);
      if (!hasDeal && lead.stage === 'qualified' && lead.status === 'active') {
        // Flag for deal creation
        console.log(`Lead ${lead.id} qualified but no deal - flagging for action`);
        connectionsFound++;
      }

      // Match with properties based on preferences
      if (lead.preferred_locations && lead.preferred_locations.length > 0) {
        const matchingProperties = properties.filter(p =>
          lead.preferred_locations.some(loc =>
            p.location?.toLowerCase().includes(loc.toLowerCase()) ||
            p.building_name?.toLowerCase().includes(loc.toLowerCase())
          ) &&
          (!lead.budget_max || p.price_aed <= lead.budget_max * 1.1) &&
          (!lead.bedrooms_min || p.bedrooms >= lead.bedrooms_min)
        );

        if (matchingProperties.length > 0 && !lead.ai_recommended_property_ids) {
          updates.ai_recommended_property_ids = matchingProperties.slice(0, 5).map(p => p.id);
          connectionsFound += matchingProperties.length;
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Lead.update(lead.id, updates);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync lead ${lead.id}:`, error);
    }
  }

  console.log(`Lead sync complete: ${syncedCount} updated, ${connectionsFound} connections found`);
  return { syncedCount, connectionsFound };
}

// Sync Properties with AI matching
async function syncProperties(properties, leads, deals, landlords, base44) {
  console.log('Syncing properties...');
  let syncedCount = 0;
  let connectionsFound = 0;

  for (const property of properties) {
    try {
      const updates = {};

      // Check if property has interested leads
      const interestedDeals = deals.filter(d => d.property_id === property.id);
      if (interestedDeals.length > 0) {
        updates.views_count = (property.views_count || 0) + interestedDeals.length;
        connectionsFound += interestedDeals.length;
      }

      // Match with landlord if not already linked
      if (!landlords.some(l => l.project_name === property.building_name)) {
        // Potential landlord acquisition opportunity
        connectionsFound++;
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Property.update(property.id, updates);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync property ${property.id}:`, error);
    }
  }

  console.log(`Property sync complete: ${syncedCount} updated, ${connectionsFound} connections found`);
  return { syncedCount, connectionsFound };
}

// Sync Landlords with pipeline progression
async function syncLandlords(landlords, properties, leads, base44) {
  console.log('Syncing landlords...');
  let syncedCount = 0;
  let connectionsFound = 0;

  for (const landlord of landlords) {
    try {
      const updates = {};

      // Check if landlord has properties listed
      const landlordProperties = properties.filter(p =>
        p.building_name === landlord.project_name ||
        p.address?.includes(landlord.unit_reference)
      );

      if (landlordProperties.length > 0 && landlord.stage === 'listing_commitment') {
        updates.stage = 'listing_creation';
        updates.stage_entered_at = new Date().toISOString();
        connectionsFound += landlordProperties.length;
      }

      // Check if landlord was referred by a lead
      if (landlord.referrer_lead_id) {
        const referrerLead = leads.find(l => l.id === landlord.referrer_lead_id);
        if (referrerLead) {
          updates.ai_rolling_summary = `Referred by lead: ${referrerLead.full_name}`;
          connectionsFound++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Landlord.update(landlord.id, updates);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync landlord ${landlord.id}:`, error);
    }
  }

  console.log(`Landlord sync complete: ${syncedCount} updated, ${connectionsFound} connections found`);
  return { syncedCount, connectionsFound };
}

// Sync Deals with AI predictions
async function syncDeals(deals, leads, properties, conversations, base44) {
  console.log('Syncing deals...');
  let syncedCount = 0;
  let connectionsFound = 0;

  for (const deal of deals) {
    try {
      const updates = {};

      // Get associated lead
      const lead = leads.find(l => l.id === deal.lead_id);
      if (lead) {
        // Update deal value from lead
        if (lead.deal_value_aed && !deal.deal_value) {
          updates.deal_value = lead.deal_value_aed;
        }

        // Calculate Aurora score based on lead score
        if (lead.ai_lead_score) {
          updates.aurora_score = Math.min(100, lead.ai_lead_score + 10);
        }

        connectionsFound++;
      }

      // Get associated property
      const property = properties.find(p => p.id === deal.property_id);
      if (property) {
        updates.currency = 'AED';
        if (property.price_aed && !deal.deal_value) {
          updates.deal_value = property.price_aed;
          updates.commission_value = Math.round(property.price_aed * 0.02); // 2% commission
        }
        connectionsFound++;
      }

      // Check conversation activity
      const relatedConvo = conversations.find(c =>
        c.lead_id === deal.lead_id || c.deal_id === deal.id
      );
      if (relatedConvo) {
        if (relatedConvo.ai_sentiment === 'positive') {
          updates.aurora_temperature = 'hot';
        } else if (relatedConvo.ai_sentiment === 'negative') {
          updates.aurora_temperature = 'cold';
        }
        connectionsFound++;
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Deal.update(deal.id, updates);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync deal ${deal.id}:`, error);
    }
  }

  console.log(`Deal sync complete: ${syncedCount} updated, ${connectionsFound} connections found`);
  return { syncedCount, connectionsFound };
}

// Sync WhatsApp Conversations with entity linking
async function syncConversations(conversations, leads, deals, base44) {
  console.log('Syncing conversations...');
  let syncedCount = 0;
  let connectionsFound = 0;

  for (const convo of conversations) {
    try {
      const updates = {};

      // Link to lead if not already linked
      if (!convo.lead_id) {
        const matchingLead = leads.find(l =>
          l.phone === convo.wa_phone_e164 ||
          l.whatsapp === convo.wa_phone_e164
        );
        if (matchingLead) {
          updates.lead_id = matchingLead.id;
          updates.assigned_agent_email = matchingLead.assigned_agent_email;
          connectionsFound++;
        }
      }

      // Link to deal if lead is linked
      if (convo.lead_id && !convo.deal_id) {
        const matchingDeal = deals.find(d => d.lead_id === convo.lead_id);
        if (matchingDeal) {
          updates.deal_id = matchingDeal.id;
          connectionsFound++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.WhatsAppConversation.update(convo.id, updates);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync conversation ${convo.id}:`, error);
    }
  }

  console.log(`Conversation sync complete: ${syncedCount} updated, ${connectionsFound} connections found`);
  return { syncedCount, connectionsFound };
}

// Sync Reminders with AI suggestions
async function syncReminders(reminders, leads, properties, deals, base44) {
  console.log('Syncing reminders...');
  let syncedCount = 0;
  let connectionsFound = 0;

  for (const reminder of reminders) {
    try {
      const updates = {};

      // Link reminder to lead if title/description mentions lead name
      if (!reminder.lead_id && reminder.title) {
        const matchingLead = leads.find(l =>
          l.full_name?.toLowerCase().includes(reminder.title.toLowerCase()) ||
          reminder.title.toLowerCase().includes(l.full_name?.toLowerCase())
        );
        if (matchingLead) {
          updates.lead_id = matchingLead.id;
          updates.lead_name = matchingLead.full_name;
          connectionsFound++;
        }
      }

      // Link reminder to property if mentions property details
      if (!reminder.property_id && reminder.notes) {
        const matchingProperty = properties.find(p =>
          p.title?.toLowerCase().includes(reminder.notes.toLowerCase()) ||
          reminder.notes.toLowerCase().includes(p.building_name?.toLowerCase()) ||
          reminder.notes.toLowerCase().includes(p.address?.toLowerCase())
        );
        if (matchingProperty) {
          updates.property_id = matchingProperty.id;
          connectionsFound++;
        }
      }

      // Auto-suggest reminders from deal stages
      const relatedDeal = deals.find(d =>
        d.lead_id === reminder.lead_id ||
        (reminder.property_id && d.property_id === reminder.property_id)
      );
      if (relatedDeal && !reminder.tags?.includes('deal-related')) {
        updates.tags = [...(reminder.tags || []), 'deal-related'];
        connectionsFound++;
      }

      // Flag overdue high-priority reminders
      if (reminder.due_date &&
          new Date(reminder.due_date) < new Date() &&
          reminder.status === 'pending' &&
          reminder.priority === 'urgent' &&
          !reminder.tags?.includes('overdue')) {
        updates.tags = [...(reminder.tags || []), 'overdue'];
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Reminder.update(reminder.id, updates);
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync reminder ${reminder.id}:`, error);
    }
  }

  console.log(`Reminder sync complete: ${syncedCount} updated, ${connectionsFound} connections found`);
  return { syncedCount, connectionsFound };
}

// Detect cross-entity connections
async function detectCrossEntityConnections(leads, properties, landlords, deals, conversations, reminders, base44) {
  console.log('Detecting cross-entity connections...');
  let newConnections = 0;

  // Create connection records in a hypothetical EntityConnection entity
  // For now, we'll just count them and log

  // Lead ↔ Property matches
  leads.forEach(lead => {
    if (lead.ai_recommended_property_ids) {
      newConnections += lead.ai_recommended_property_ids.length;
    }
  });

  // Deal ↔ All entities
  deals.forEach(deal => {
    if (deal.lead_id && deal.property_id) {
      newConnections += 2; // Lead + Property
    }
  });

  // Landlord ↔ Property matches
  landlords.forEach(landlord => {
    const matchingProperties = properties.filter(p =>
      p.building_name === landlord.project_name
    );
    newConnections += matchingProperties.length;
  });

  // Reminder ↔ Lead/Property connections
  reminders.forEach(reminder => {
    if (reminder.lead_id) newConnections++;
    if (reminder.property_id) newConnections++;
  });

  console.log(`Detected ${newConnections} cross-entity connections`);
  return { newConnections };
}

// Generate AI insights
async function generateAIInsights(leads, properties, landlords, deals, conversations, reminders, base44) {
  console.log('Generating AI insights...');

  const insights = [];

  // Insight 1: Unmatched qualified leads
  const unmatchedLeads = leads.filter(l =>
    l.stage === 'qualified' &&
    l.status === 'active' &&
    !deals.some(d => d.lead_id === l.id)
  );
  if (unmatchedLeads.length > 0) {
    insights.push({
      type: 'opportunity',
      title: 'Unmatched Qualified Leads',
      count: unmatchedLeads.length,
      description: `${unmatchedLeads.length} qualified leads without active deals`,
    });
  }

  // Insight 2: Orphan properties
  const orphanProperties = properties.filter(p =>
    p.status === 'available' &&
    !deals.some(d => d.property_id === p.id)
  );
  if (orphanProperties.length > 0) {
    insights.push({
      type: 'recommendation',
      title: 'Properties Needing Promotion',
      count: orphanProperties.length,
      description: `${orphanProperties.length} available properties with no deals`,
    });
  }

  // Insight 3: Stale conversations
  const staleConversations = conversations.filter(c =>
    c.last_message_at &&
    new Date(c.last_message_at) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) &&
    (c.status === 'open' || c.status === 'new')
  );
  if (staleConversations.length > 0) {
    insights.push({
      type: 'critical',
      title: 'Stale Conversations',
      count: staleConversations.length,
      description: `${staleConversations.length} conversations inactive for 3+ days`,
    });
  }

  // Insight 4: Overdue reminders
  const overdueReminders = reminders.filter(r =>
    r.due_date &&
    new Date(r.due_date) < new Date() &&
    r.status === 'pending'
  );
  if (overdueReminders.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Overdue Reminders',
      count: overdueReminders.length,
      description: `${overdueReminders.length} reminders past due date`,
    });
  }

  // Insight 5: Reminders without lead associations
  const orphanReminders = reminders.filter(r =>
    !r.lead_id &&
    !r.property_id &&
    r.status === 'pending' &&
    (r.priority === 'high' || r.priority === 'urgent')
  );
  if (orphanReminders.length > 0) {
    insights.push({
      type: 'recommendation',
      title: 'Unlinked High-Priority Reminders',
      count: orphanReminders.length,
      description: `${orphanReminders.length} urgent reminders not linked to leads or properties`,
    });
  }

  console.log(`Generated ${insights.length} AI insights`);
  return { insights };
}

// Helper: Calculate engagement level from conversation
function calculateEngagementLevel(conversation) {
  const messageCount = conversation.unread_count || 0;
  const lastMessageAge = conversation.last_message_at ?
    Date.now() - new Date(conversation.last_message_at).getTime() : Infinity;

  if (messageCount > 10 && lastMessageAge < 24 * 60 * 60 * 1000) {
    return 'highly_engaged';
  } else if (messageCount > 5 && lastMessageAge < 3 * 24 * 60 * 60 * 1000) {
    return 'engaged';
  } else if (messageCount > 0 && lastMessageAge < 7 * 24 * 60 * 60 * 1000) {
    return 'lukewarm';
  }
  return 'disengaged';
}

// Claude AI-powered insights generation with auto-remediation
async function generateClaudeInsights(leads, properties, landlords, deals, conversations, reminders, base44) {
  console.log('Generating Claude AI insights...');
  
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  
  // Enhanced CRM context with metrics
  const stageDistribution = leads.reduce((acc, l) => { acc[l.stage] = (acc[l.stage] || 0) + 1; return acc; }, {});
  const contactIdentityCount = stageDistribution['contact_identity'] || 0;
  const conversionRate = leads.length > 0 ? (deals.filter(d => d.stage === 'closed_won').length / leads.length * 100).toFixed(2) : 0;
  const leadsPerProperty = properties.length > 0 ? Math.round(leads.length / properties.length) : 0;
  const whatsappEngagementRate = leads.length > 0 ? ((conversations.length / leads.length) * 100).toFixed(1) : 0;
  
  const crmSnapshot = {
    total_leads: leads.length,
    total_properties: properties.length,
    total_landlords: landlords.length,
    total_deals: deals.length,
    total_conversations: conversations.length,
    total_reminders: reminders.length,
    stage_distribution: stageDistribution,
    hot_leads: leads.filter(l => l.ai_lead_score >= 70).length,
    stale_leads: leads.filter(l => l.stage_entered_at && new Date(l.stage_entered_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    overdue_reminders: reminders.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status === 'pending').length,
    top_deals: deals.sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0)).slice(0, 5).map(d => ({ lead: d.lead_id, value: d.deal_value, stage: d.stage })),
    // Key metrics for bottleneck detection
    contact_identity_bottleneck: contactIdentityCount,
    contact_identity_percentage: leads.length > 0 ? ((contactIdentityCount / leads.length) * 100).toFixed(1) : 0,
    conversion_rate_percentage: conversionRate,
    leads_per_property_ratio: leadsPerProperty,
    whatsapp_engagement_rate: whatsappEngagementRate,
    landlord_listing_ratio: landlords.length > 0 ? (properties.length / landlords.length).toFixed(2) : 0,
  };

  const prompt = `Analyze this Dubai real estate CRM and provide HIGH-PRIORITY actionable insights:
${JSON.stringify(crmSnapshot, null, 2)}

Focus on:
1. Funnel bottlenecks (especially if >50% leads stuck at contact_identity)
2. Inventory shortages (leads_per_property > 20 is critical)
3. Low conversion rates (<2% is below market)
4. Communication gaps (WhatsApp engagement <10%)
5. Landlord supply issues

Return JSON with specific, executable actions.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { 
      insights: [text],
      recommended_actions: [],
      risk_factors: [],
      opportunities: []
    };

    // Auto-generate remediation actions for critical issues
    const autoActions = [];
    
    // Auto-action 1: Create follow-up reminders for stale leads at contact_identity
    if (contactIdentityCount > leads.length * 0.5) {
      const staleContactLeads = leads
        .filter(l => l.stage === 'contact_identity' && 
                     l.stage_entered_at && 
                     new Date(l.stage_entered_at) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
        .slice(0, 10);
      
      staleContactLeads.forEach(lead => {
        autoActions.push({
          type: 'create_reminder',
          data: {
            title: `Follow up: ${lead.full_name || lead.name}`,
            notes: `Lead stuck at contact_identity for 3+ days. Qualify budget, timeline, and needs.`,
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            priority: 'high',
            lead_id: lead.id,
            lead_name: lead.full_name || lead.name,
          }
        });
      });
    }

    // Auto-action 2: Flag hot leads without deals
    const hotLeadsWithoutDeals = leads
      .filter(l => l.ai_lead_score >= 70 && !deals.some(d => d.lead_id === l.id))
      .slice(0, 5);
    
    hotLeadsWithoutDeals.forEach(lead => {
      autoActions.push({
        type: 'create_reminder',
        data: {
          title: `Create deal for hot lead: ${lead.full_name || lead.name}`,
          notes: `Lead score: ${lead.ai_lead_score}. High priority - create deal and move to negotiation.`,
          due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          priority: 'urgent',
          lead_id: lead.id,
          lead_name: lead.full_name || lead.name,
        }
      });
    });

    // Merge auto-actions with Claude's recommendations
    insights.recommended_actions = [...(insights.recommended_actions || []), ...autoActions];

    // Calculate business metrics for dashboard
    insights.metrics = {
      contact_identity_percentage: parseFloat(stageDistribution['contact_identity'] ? (contactIdentityCount / leads.length * 100).toFixed(1) : 0),
      leads_per_property_ratio: leadsPerProperty,
      conversion_rate_percentage: parseFloat(conversionRate),
      whatsapp_engagement_rate: parseFloat(whatsappEngagementRate),
      landlord_listing_ratio: parseFloat((properties.length / landlords.length).toFixed(2)),
      hot_leads_count: leads.filter(l => l.ai_lead_score >= 70).length,
      stale_leads_count: leads.filter(l => l.stage_entered_at && new Date(l.stage_entered_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
      total_pipeline_value: deals.reduce((sum, d) => sum + (d.deal_value || 0), 0),
    };

    console.log('Claude insights generated:', insights);
    console.log(`Auto-generated ${autoActions.length} remediation actions`);
    return insights;
  } catch (error) {
    console.error('Claude insight generation failed:', error);
    return {
      insights: ['Claude analysis unavailable'],
      recommended_actions: [],
      risk_factors: [],
      opportunities: []
    };
  }
}

// Execute Claude's recommended CRM actions
async function executeClaudeActions(actions, base44) {
  console.log('Executing Claude recommended actions...');
  const executed = [];

  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    console.log('No Claude actions to execute');
    return [];
  }

  for (const action of actions.slice(0, 10)) { // Limit to 10 actions
    try {
      let result;
      
      if (action.type === 'create_reminder') {
        const reminder = await base44.asServiceRole.entities.Reminder.create({
          title: action.data.title || 'AI-suggested follow-up',
          notes: action.data.notes || 'Suggested by Claude AI',
          due_date: action.data.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          priority: action.data.priority || 'medium',
          status: 'pending',
          lead_id: action.data.lead_id || '',
          lead_name: action.data.lead_name || '',
          source: 'claude_ai_suggested',
        });
        result = { success: true, type: 'reminder_created', id: reminder.id };
      } 
      else if (action.type === 'update_lead') {
        if (action.data.lead_id) {
          await base44.asServiceRole.entities.Lead.update(action.data.lead_id, action.data.updates || {});
          result = { success: true, type: 'lead_updated', id: action.data.lead_id };
        } else {
          result = { success: false, error: 'No lead_id provided' };
        }
      }
      else if (action.type === 'link_entities') {
        if (action.data.entity_type === 'WhatsAppConversation' && action.data.lead_id && action.data.entity_id) {
          await base44.asServiceRole.entities.WhatsAppConversation.update(action.data.entity_id, {
            lead_id: action.data.lead_id,
          });
          result = { success: true, type: 'entities_linked' };
        } else {
          result = { success: false, error: 'Missing entity_id or lead_id' };
        }
      }
      else {
        result = { success: false, error: 'Unknown action type: ' + action.type };
      }
      
      executed.push(result);
    } catch (error) {
      console.error('Failed to execute action:', action, error);
      executed.push({ success: false, action: action.type, error: error.message });
    }
  }

  const successCount = executed.filter(e => e && e.success).length;
  console.log(`Executed ${successCount}/${executed.length} actions`);
  return executed;
}