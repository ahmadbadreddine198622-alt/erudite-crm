import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    if (!leads.length) return Response.json({ error: 'Lead not found' }, { status: 404 });
    const lead = leads[0];

    const activities = await base44.asServiceRole.entities.LeadActivity.filter(
      { lead_id }, '-created_date', 100
    ).catch(() => []);

    const now = Date.now();

    // ─── 1. PROFILE COMPLETENESS (0–20) ───
    let profile_score = 0;
    const profile_factors = [];
    if (lead.phone || lead.whatsapp) { profile_score += 4; profile_factors.push({ label: 'Phone / WhatsApp present', points: 4 }); }
    if (lead.email) { profile_score += 3; profile_factors.push({ label: 'Email on file', points: 3 }); }
    if (lead.budget_min || lead.budget_max) { profile_score += 4; profile_factors.push({ label: 'Budget stated', points: 4 }); }
    if (lead.preferred_locations?.length) { profile_score += 3; profile_factors.push({ label: 'Location preference', points: 3 }); }
    if (lead.financing_method && lead.financing_method !== 'unknown') { profile_score += 3; profile_factors.push({ label: 'Financing method known', points: 3 }); }
    if (lead.bedrooms_min !== undefined || lead.preferred_property_types?.length) { profile_score += 3; profile_factors.push({ label: 'Property criteria defined', points: 3 }); }

    // ─── 2. QUALIFICATION (0–20) ───
    let qual_score = 0;
    const qual_factors = [];
    const q = lead.qualification || {};
    if (q.budget_confirmed)   { qual_score += 5;  qual_factors.push({ label: 'Budget confirmed', points: 5 }); }
    if (q.authority_confirmed){ qual_score += 5;  qual_factors.push({ label: 'Decision authority confirmed', points: 5 }); }
    if (q.need_confirmed)     { qual_score += 4;  qual_factors.push({ label: 'Need confirmed', points: 4 }); }
    if (q.timeline_confirmed) { qual_score += 4;  qual_factors.push({ label: 'Timeline confirmed', points: 4 }); }
    if (q.kyc_completed)      { qual_score += 2;  qual_factors.push({ label: 'KYC completed', points: 2 }); }

    // ─── 3. ACTIVITY RECENCY (0–25) ───
    let recency_score = 0;
    const recency_factors = [];
    const lastActivity = activities[0];
    const daysSinceLast = lastActivity
      ? (now - new Date(lastActivity.created_date).getTime()) / 86400000
      : 999;

    if (daysSinceLast <= 1)       { recency_score = 25; recency_factors.push({ label: 'Activity in last 24h', points: 25 }); }
    else if (daysSinceLast <= 3)  { recency_score = 20; recency_factors.push({ label: 'Activity in last 3 days', points: 20 }); }
    else if (daysSinceLast <= 7)  { recency_score = 14; recency_factors.push({ label: 'Activity in last week', points: 14 }); }
    else if (daysSinceLast <= 14) { recency_score = 8;  recency_factors.push({ label: 'Activity in last 2 weeks', points: 8 }); }
    else if (daysSinceLast <= 30) { recency_score = 3;  recency_factors.push({ label: 'Activity in last month', points: 3 }); }
    else                          { recency_score = 0;  recency_factors.push({ label: `No activity for ${Math.floor(daysSinceLast)} days`, points: 0 }); }

    // ─── 4. ACTIVITY VOLUME (0–15) ───
    const recentActivities = activities.filter(a =>
      (now - new Date(a.created_date).getTime()) / 86400000 <= 30
    );
    const volume_score = Math.min(15, recentActivities.length * 2);
    const volume_factors = [{ label: `${recentActivities.length} activities in last 30 days`, points: volume_score }];

    // ─── 5. PIPELINE STAGE (0–20) ───
    const stagePoints = {
      intake_clarify: 2,
      contact_identity: 4,
      financial_qualification: 7,
      intent_lock: 9,
      unit_matching: 11,
      viewing: 14,
      objection_offer: 16,
      negotiation_deal_lock: 18,
      closing_dld: 20,
      closed: 20,
      new_tenant_lead: 3,
      qualified_tenant: 8,
      viewing_decision: 13,
      contract_cheques: 17,
      ejari_movein: 20,
    };
    const stage_score = stagePoints[lead.stage] || 5;
    const stage_factors = [{ label: `Stage: ${lead.stage || 'unknown'}`, points: stage_score }];

    // ─── PENALTIES ───
    let penalty = 0;
    const risk_factors = [];
    if (lead.status === 'lost')    { penalty += 30; risk_factors.push('Lead marked lost'); }
    if (lead.status === 'on_hold') { penalty += 15; risk_factors.push('Lead on hold'); }
    if (lead.do_not_contact)       { penalty += 20; risk_factors.push('Do not contact flag'); }
    if (daysSinceLast > 30)        { penalty += 10; risk_factors.push('Dormant — no activity in 30+ days'); }
    if (!lead.phone && !lead.whatsapp && !lead.email) { penalty += 10; risk_factors.push('No contact info'); }

    const raw = profile_score + qual_score + recency_score + volume_score + stage_score;
    const overall_score = Math.max(1, Math.min(100, raw - penalty));

    // ─── TREND ───
    const prevScore = lead.ai_lead_score || 0;
    const trend = overall_score > prevScore + 3 ? 'rising'
                : overall_score < prevScore - 3 ? 'falling'
                : 'stable';

    const breakdown = {
      profile_score,
      qual_score,
      recency_score,
      volume_score,
      stage_score,
      penalty,
    };

    const factors = [
      { category: 'Profile', items: profile_factors },
      { category: 'Qualification', items: qual_factors },
      { category: 'Recency', items: recency_factors },
      { category: 'Activity Volume', items: volume_factors },
      { category: 'Pipeline Stage', items: stage_factors },
    ];

    // Persist score on lead
    await base44.asServiceRole.entities.Lead.update(lead_id, {
      ai_lead_score: overall_score,
      ai_score_trend: trend,
      ai_processed_at: new Date().toISOString(),
    });

    return Response.json({ overall_score, breakdown, factors, trend, risk_factors, days_since_activity: Math.floor(daysSinceLast) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});