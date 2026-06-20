import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    const { agent_email, run_batch } = await req.json().catch(() => ({}));
    const results = { processed: [], errors: [] };

    // Get all active agents
    const users = await base44.entities.User.list();
    const agents = users.filter(u => u.role === 'user' || u.role === 'admin');

    const agentsToProcess = agent_email
      ? agents.filter(a => a.email === agent_email)
      : agents;

    for (const agent of agentsToProcess) {
      try {
        const agentResult = await processAgentDailyScoring(base44, agent);
        results.processed.push(agentResult);
      } catch (err) {
        results.errors.push({ agent: agent.email, error: err.message });
      }
    }

    return Response.json({
      success: true,
      processed_count: results.processed.length,
      error_count: results.errors.length,
      details: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processAgentDailyScoring(base44, agent) {
  const agentEmail = agent.email;
  const agentName = agent.full_name || agentEmail.split('@')[0];

  // 1. Get or create today's allocation
  let allocation = await getOrCreateDailyAllocation(base44, agent);

  // 2. Auto-unlock completed leads
  allocation = await autoUnlockLeads(base44, allocation);

  // 3. Calculate scoring metrics
  const scoring = await calculateDailyScoring(base44, agent, allocation);

  // 4. Check for bonus leads (completed full allocation)
  if (scoring.earned_more_leads) {
    allocation = await awardBonusLeads(base44, allocation);
  }

  // 5. Update allocation with all computed values
  const updateData = {
    leads_worked: scoring.leads_worked,
    sequences_completed: scoring.sequences_completed,
    qualifications_logged: scoring.qualifications_logged,
    completion_rate: scoring.completion_rate,
    daily_score: scoring.daily_score,
    earned_more_leads: scoring.earned_more_leads,
    status: scoring.status,
    leads_unlocked_count: allocation.leads_unlocked_count,
    current_unlocked_index: allocation.current_unlocked_index,
  };

  await base44.entities.DailyLeadAllocation.update(allocation.id, updateData);

  return {
    agent_email: agentEmail,
    agent_name: agentName,
    allocation_id: allocation.id,
    daily_score: scoring.daily_score,
    leads_unlocked: allocation.leads_unlocked_count,
    total_leads: allocation.total_available,
    status: scoring.status,
    sequences_completed: scoring.sequences_completed,
    qualifications_logged: scoring.qualifications_logged,
  };
}

async function getOrCreateDailyAllocation(base44, agent) {
  const existing = await base44.entities.DailyLeadAllocation.filter({
    agent_email: agent.email,
    allocation_date: TODAY,
  });

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // Create new allocation
  const landlords = await base44.entities.Landlord.filter({
    assigned_agent_email: agent.email,
  });

  // Prioritize active stages, limit to base_allocation
  const activeStages = [
    'initial_contact',
    'price_discovery',
    'listing_commitment',
    'form_a_initiation',
    'form_a_signing',
  ];

  const sortedLandlords = landlords.sort((a, b) => {
    const aActive = activeStages.includes(a.stage) ? 1 : 0;
    const bActive = activeStages.includes(b.stage) ? 1 : 0;
    return bActive - aActive || new Date(b.updated_date) - new Date(a.updated_date);
  });

  const leadQueue = sortedLandlords.slice(0, 10).map(l => l.id);

  const allocation = await base44.entities.DailyLeadAllocation.create({
    agent_email: agent.email,
    agent_name: agent.full_name || agent.email.split('@')[0],
    allocation_date: TODAY,
    base_allocation: 10,
    bonus_earned: 0,
    total_available: 10,
    leads_worked: 0,
    sequences_completed: 0,
    qualifications_logged: 0,
    completion_rate: 0,
    daily_score: 0,
    earned_more_leads: false,
    status: 'active',
    lead_queue: leadQueue,
    leads_unlocked_count: 1,
    current_unlocked_index: 0,
    sequential_unlock_enabled: true,
  });

  return allocation;
}

async function autoUnlockLeads(base44, allocation) {
  if (!allocation.sequential_unlock_enabled) {
    return allocation;
  }

  const leadQueue = allocation.lead_queue || [];
  let unlockedCount = allocation.leads_unlocked_count || 1;
  let currentIndex = allocation.current_unlocked_index || 0;

  // Walk through queue and unlock completed leads
  for (let i = currentIndex; i < leadQueue.length; i++) {
    const landlordId = leadQueue[i];
    const checklist = await getTodayChecklist(base44, landlordId);

    const isComplete = (checklist?.sequence_complete ?? false) && (checklist?.qualification_logged ?? false);

    if (isComplete) {
      unlockedCount++;
      currentIndex++;
    } else {
      break; // Stop at first incomplete lead
    }
  }

  if (unlockedCount !== allocation.leads_unlocked_count) {
    allocation.leads_unlocked_count = unlockedCount;
    allocation.current_unlocked_index = currentIndex;
  }

  return allocation;
}

async function getTodayChecklist(base44, landlordId) {
  const checklists = await base44.entities.OutreachChecklist.filter({
    landlord_id: landlordId,
    outreach_date: TODAY,
  });
  return checklists && checklists.length > 0 ? checklists[0] : null;
}

async function calculateDailyScoring(base44, agent, allocation) {
  const agentEmail = agent.email;
  let dailyScore = 0;
  let leadsWorked = 0;
  let sequencesCompleted = 0;
  let qualificationsLogged = 0;

  // Get all outreach checklists for this agent today
  const checklists = await base44.entities.OutreachChecklist.filter({
    agent_email: agentEmail,
    outreach_date: TODAY,
  });

  for (const checklist of (checklists || [])) {
    leadsWorked++;

    // +2 per completed step
    const stepsCompleted = checklist.steps_completed || 0;
    dailyScore += stepsCompleted * 2;

    // +10 bonus per sequence_complete
    if (checklist.sequence_complete) {
      dailyScore += 10;
      sequencesCompleted++;
    }

    // +15 per qualification_logged
    if (checklist.qualification_logged) {
      dailyScore += 15;
      qualificationsLogged++;
    }
  }

  // +25 per landlord that advanced stage today
  const landlords = await base44.entities.Landlord.filter({
    assigned_agent_email: agentEmail,
  });

  for (const landlord of (landlords || [])) {
    if (landlord.stage_entered_at) {
      const stageDate = new Date(landlord.stage_entered_at).toISOString().slice(0, 10);
      if (stageDate === TODAY) {
        dailyScore += 25;
      }
    }
  }

  // Calculate completion rate
  const totalAvailable = allocation.total_available || allocation.base_allocation || 10;
  const completionRate = totalAvailable > 0 ? Math.round((leadsWorked / totalAvailable) * 100) : 0;

  // Determine status
  let status = 'active';
  if (completionRate >= 100) {
    status = 'completed';
  } else if (completionRate < 30 && new Date().getHours() >= 14) {
    status = 'underperforming';
  }

  // Check if earned more leads (completed full base allocation with quality)
  const earnedMoreLeads = leadsWorked >= (allocation.base_allocation || 10) && 
                          sequencesCompleted >= (allocation.base_allocation || 10);

  return {
    daily_score: dailyScore,
    leads_worked: leadsWorked,
    sequences_completed: sequencesCompleted,
    qualifications_logged: qualificationsLogged,
    completion_rate: completionRate,
    status,
    earned_more_leads: earnedMoreLeads,
  };
}

async function awardBonusLeads(base44, allocation) {
  const agentEmail = allocation.agent_email;
  
  // Get additional landlords not in current queue
  const allLandlords = await base44.entities.Landlord.filter({
    assigned_agent_email: agentEmail,
  });

  const currentQueue = allocation.lead_queue || [];
  const additionalLandlords = allLandlords.filter(l => !currentQueue.includes(l.id));

  if (additionalLandlords.length === 0) {
    return allocation;
  }

  // Award 5 bonus leads
  const bonusLeads = additionalLandlords.slice(0, 5);
  const newQueue = [...currentQueue, ...bonusLeads.map(l => l.id)];

  const bonusEarned = (allocation.bonus_earned || 0) + bonusLeads.length;
  const totalAvailable = (allocation.total_available || 10) + bonusLeads.length;

  await base44.entities.DailyLeadAllocation.update(allocation.id, {
    lead_queue: newQueue,
    bonus_earned: bonusEarned,
    total_available: totalAvailable,
  });

  allocation.lead_queue = newQueue;
  allocation.bonus_earned = bonusEarned;
  allocation.total_available = totalAvailable;

  return allocation;
}