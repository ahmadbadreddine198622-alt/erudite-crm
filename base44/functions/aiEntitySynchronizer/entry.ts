import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity_name, mode = 'full_sync', detectConnections = true, generateInsights = true } = body;

    console.log(`Starting AI synchronization for ${entity_name} in mode: ${mode}`);

    let totalSynced = 0;
    let totalConnections = 0;
    const results = {};

    // Fetch all entities
    const [leads, properties, landlords, deals, conversations] = await Promise.all([
      base44.asServiceRole.entities.Lead.list('-created_date', 500),
      base44.asServiceRole.entities.Property.list('-created_date', 500),
      base44.asServiceRole.entities.Landlord.list('-created_date', 500),
      base44.asServiceRole.entities.Deal.list('-created_date', 500),
      base44.asServiceRole.entities.WhatsAppConversation.list('-last_message_at', 500),
    ]);

    console.log(`Fetched: ${leads.length} leads, ${properties.length} properties, ${landlords.length} landlords, ${deals.length} deals, ${conversations.length} conversations`);

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

    // Phase 2: Cross-entity relationship detection
    if (detectConnections && entity_name === 'all') {
      const connectionResults = await detectCrossEntityConnections(leads, properties, landlords, deals, conversations, base44);
      results.connections = connectionResults;
      totalConnections += connectionResults.newConnections;
    }

    // Phase 3: Generate AI insights
    if (generateInsights && entity_name === 'all') {
      const insightsResults = await generateAIInsights(leads, properties, landlords, deals, conversations, base44);
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

// Detect cross-entity connections
async function detectCrossEntityConnections(leads, properties, landlords, deals, conversations, base44) {
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

  console.log(`Detected ${newConnections} cross-entity connections`);
  return { newConnections };
}

// Generate AI insights
async function generateAIInsights(leads, properties, landlords, deals, conversations, base44) {
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