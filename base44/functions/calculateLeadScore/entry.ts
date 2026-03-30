import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { conversation_id } = await req.json();

    if (!conversation_id) {
      return Response.json({ error: 'conversation_id required' }, { status: 400 });
    }

    // Get conversation data
    const conv = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
    if (!conv.length) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const conversation = conv[0];
    const lead_id = conversation.lead_id;

    // Get all messages in conversation
    const messages = await base44.asServiceRole.entities.WhatsAppMessage.filter({
      conversation_id
    }, '-timestamp', 100);

    // Get lead data
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    const lead = leads[0] || {};

    // Calculate sub-scores
    let engagement_score = 0;
    let intent_score = 0;
    let sentiment_score = 0;
    let budget_alignment_score = 50; // Neutral default
    let property_fit_score = 50; // Neutral default

    // ENGAGEMENT SCORE (0-25)
    if (messages.length > 0) {
      const inbound = messages.filter(m => m.direction === 'inbound').length;
      const outbound = messages.filter(m => m.direction === 'outbound').length;
      
      // More messages = higher engagement
      engagement_score = Math.min(25, Math.floor((messages.length / 10) * 25));
      
      // Response rate bonus
      if (inbound > 0 && outbound > 0) {
        engagement_score += 5;
      }
    }

    // INTENT SCORE (0-25) - Based on AI detected intent
    const recentMessages = messages.slice(0, 5);
    const hasViewingIntent = recentMessages.some(m => m.ai_intent?.includes('viewing'));
    const hasOfferIntent = recentMessages.some(m => m.ai_intent?.includes('offer'));
    const hasNegotiationIntent = recentMessages.some(m => m.ai_intent?.includes('negotiation'));

    if (hasOfferIntent) intent_score = 25;
    else if (hasNegotiationIntent) intent_score = 20;
    else if (hasViewingIntent) intent_score = 15;
    else intent_score = 5;

    // Add urgency bonus
    if (conversation.ai_urgency === 'urgent') intent_score += 5;
    else if (conversation.ai_urgency === 'high') intent_score += 3;

    // SENTIMENT SCORE (0-20)
    const sentimentCounts = {
      positive: messages.filter(m => m.ai_sentiment === 'positive').length,
      negative: messages.filter(m => m.ai_sentiment === 'negative').length,
      neutral: messages.filter(m => m.ai_sentiment === 'neutral').length,
    };

    if (sentimentCounts.positive > sentimentCounts.negative) {
      sentiment_score = Math.min(20, 10 + (sentimentCounts.positive * 2));
    } else if (sentimentCounts.negative > sentimentCounts.positive) {
      sentiment_score = Math.max(0, 10 - (sentimentCounts.negative * 3));
    } else {
      sentiment_score = 10;
    }

    // BUDGET ALIGNMENT (0-15)
    const prefs = lead.property_preferences || {};
    if (prefs.min_budget || prefs.max_budget) {
      budget_alignment_score = 15; // Has stated budget
    } else {
      budget_alignment_score = 5; // No budget info
    }

    // PROPERTY FIT (0-15)
    if (lead.interested_properties && lead.interested_properties.length > 0) {
      property_fit_score = Math.min(15, lead.interested_properties.length * 3);
    } else {
      property_fit_score = 3;
    }

    // CALCULATE OVERALL SCORE
    const overall_score = Math.round(
      engagement_score + 
      intent_score + 
      sentiment_score + 
      budget_alignment_score + 
      property_fit_score
    );

    // DETECT TREND
    const existingScores = await base44.asServiceRole.entities.LeadScore.filter(
      { lead_id },
      '-calculated_at',
      3
    );

    let trend = 'stable';
    if (existingScores.length > 0) {
      const prevScore = existingScores[0].overall_score;
      if (overall_score > prevScore + 5) trend = 'increasing';
      else if (overall_score < prevScore - 5) trend = 'decreasing';
    }

    // RISK FACTORS
    const risk_factors = [];
    if (sentiment_score < 5) risk_factors.push('negative_sentiment');
    if (messages.length === 0) risk_factors.push('no_messages');
    if (conversation.ai_urgency === 'low' && engagement_score > 15) risk_factors.push('low_urgency_despite_activity');
    
    // Check for inactivity
    const lastMsg = messages[0];
    if (lastMsg) {
      const daysSinceLastMsg = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastMsg > 7) risk_factors.push(`inactive_${Math.floor(daysSinceLastMsg)}_days`);
    }

    // Store or update score
    const existingScore = await base44.asServiceRole.entities.LeadScore.filter(
      { conversation_id }
    );

    let scoreRecord;
    if (existingScore.length > 0) {
      scoreRecord = await base44.asServiceRole.entities.LeadScore.update(existingScore[0].id, {
        overall_score,
        breakdown: {
          engagement_score,
          intent_score,
          sentiment_score,
          budget_alignment_score,
          property_fit_score,
        },
        trend,
        risk_factors,
        calculated_at: new Date().toISOString(),
      });
    } else {
      scoreRecord = await base44.asServiceRole.entities.LeadScore.create({
        lead_id,
        conversation_id,
        overall_score,
        breakdown: {
          engagement_score,
          intent_score,
          sentiment_score,
          budget_alignment_score,
          property_fit_score,
        },
        trend,
        risk_factors,
        calculated_at: new Date().toISOString(),
      });
    }

    // Update lead with score
    await base44.asServiceRole.entities.Lead.update(lead_id, {
      lead_score: overall_score,
    });

    return Response.json({
      overall_score,
      breakdown: {
        engagement_score,
        intent_score,
        sentiment_score,
        budget_alignment_score,
        property_fit_score,
      },
      trend,
      risk_factors,
      score_id: scoreRecord.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});