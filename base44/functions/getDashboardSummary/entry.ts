// getDashboardSummary — Returns aggregated dashboard data with proper joins
// Solves: PipelineStrip counts (ALL landlords), EvaluationPanel (with qualifications),
// FormA widget (with landlord context), activity stats

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Phase groupings (same as PipelineStrip component)
    const PHASE_STAGES = {
      New: ['initial_contact', 'price_discovery'],
      Mandate: ['listing_commitment', 'form_a_initiation', 'form_a_signing'],
      'Docs & Media': ['owner_documents', 'photos_videos', 'photographer_scheduling'],
      Listing: ['listing_creation', 'internal_verification', 'listing_publication', 'final_confirmation'],
      Marketing: ['marketing_agents', 'marketing_network', 'open_house', 'client_blast'],
    };

    // 1. Fetch ALL landlords (paginate if needed)
    const allLandlords = await base44.entities.Landlord.list('-created_date', 1000);
    
    // 2. Count by phase (accurate across ALL landlords)
    const phaseCounts = { New: 0, Mandate: 0, 'Docs & Media': 0, Listing: 0, Marketing: 0 };
    allLandlords.forEach(ll => {
      const stage = ll.stage;
      for (const [phase, stages] of Object.entries(PHASE_STAGES)) {
        if (stages.includes(stage)) {
          phaseCounts[phase]++;
          break;
        }
      }
    });

    // 3. Fetch latest CallQualification for each landlord
    const landlordIds = allLandlords.slice(0, 10).map(ll => ll.id);
    const qualifications = await base44.entities.CallQualification.filter(
      { landlord_id: { $in: landlordIds } },
      '-call_date',
      50
    );
    
    // Group by landlord_id and keep latest per landlord
    const latestQualByLandlord = {};
    qualifications.forEach(q => {
      if (!latestQualByLandlord[q.landlord_id]) {
        latestQualByLandlord[q.landlord_id] = q;
      }
    });

    // 4. Fetch recent Form A records with landlord names
    const recentFormA = await base44.entities.FormA.list('-created_date', 5);
    const formAWithLandlords = await Promise.all(
      recentFormA.map(async (form) => {
        const landlord = form.landlord_id ? await base44.entities.Landlord.get(form.landlord_id).catch(() => null) : null;
        return {
          ...form,
          landlord_name: landlord?.full_name_en || landlord?.full_name || 'Unknown',
          landlord_id: form.landlord_id,
        };
      })
    );

    // 5. Activity stats
    const [totalCalls, totalWhatsApp, totalTasks] = await Promise.all([
      base44.entities.AircallCall.list('', 1000).then(calls => calls.length).catch(() => 0),
      base44.entities.WhatsAppMessage.list('', 1000).then(msgs => msgs.length).catch(() => 0),
      base44.entities.LandlordTask.list('', 1000).then(tasks => tasks.length).catch(() => 0),
    ]);

    // 6. Build landlords with embedded qualification data
    const landlordsWithQualifications = allLandlords.slice(0, 10).map(ll => ({
      id: ll.id,
      full_name_en: ll.full_name_en || ll.full_name || 'Unnamed',
      stage: ll.stage,
      assigned_agent_email: ll.assigned_agent_email,
      phone: ll.phone,
      project_name: ll.project_name,
      unit_reference: ll.unit_reference,
      asking_price_aed: ll.asking_price_aed,
      mandate_status: ll.mandate_status,
      rapport_level: ll.rapport_level,
      latest_qualification: latestQualByLandlord[ll.id] ? {
        motivation: latestQualByLandlord[ll.id].motivation,
        timeline_urgency: latestQualByLandlord[ll.id].timeline_urgency,
        price_expectation_aed: latestQualByLandlord[ll.id].price_expectation_aed,
        price_vs_valuation: latestQualByLandlord[ll.id].price_vs_valuation,
        mandate_openness: latestQualByLandlord[ll.id].mandate_openness,
        is_decision_maker: latestQualByLandlord[ll.id].is_decision_maker,
        tenancy_status: latestQualByLandlord[ll.id].tenancy_status,
        mortgage_status: latestQualByLandlord[ll.id].mortgage_status,
        call_outcome: latestQualByLandlord[ll.id].call_outcome,
        next_step: latestQualByLandlord[ll.id].next_step,
        followup_date: latestQualByLandlord[ll.id].followup_date,
        call_date: latestQualByLandlord[ll.id].call_date,
      } : null,
    }));

    // 7. Hot leads count (from Lead entity)
    const leads = await base44.entities.Lead.list('', 500);
    const hotLeads = leads.filter(l => (l.ai_lead_score || 0) >= 75).length;
    const activeLeads = leads.filter(l => l.status === 'active').length;

    // 8. Pending reminders
    const reminders = await base44.entities.Reminder.filter({ status: 'pending' }, '', 500);

    // 9. Open WhatsApp conversations with unread
    const waConversations = await base44.entities.WhatsAppConversation.filter({ status: 'open' }, '', 500);
    const totalUnread = waConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    return Response.json({
      phaseCounts,
      landlordsWithQualifications,
      formAWithLandlords,
      activityStats: {
        totalCalls,
        totalWhatsApp,
        totalTasks,
      },
      quickStats: {
        hotLeads,
        activeLeads,
        pendingReminders: reminders.length,
        unreadWhatsApp: totalUnread,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});