import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * One-time seed: creates 3 deliberately-different sample landlords so the
 * Landlord Pipeline + Aurora can be tested against realistic Dubai scenarios.
 *
 * Each landlord covers a different archetype, stage, and AI signal pattern
 * so you can see how the pipeline behaves under varied conditions.
 *
 * Idempotent — safe to run multiple times. Won't duplicate if landlords with
 * the same seed_id tag already exist.
 *
 * Invoke from Base44 Functions UI, OR from browser console:
 *   await base44.functions.seedSampleLandlords()
 */

interface SeedBundle {
  landlord: any;
  property: any;
  stakeholders: any[];
  activities: any[];
  negotiation?: any;
  documents?: any[];
}

const SEEDS: SeedBundle[] = [
  // ============================================================================
  // SEED 1 — Professional Investor with Portfolio Opportunity
  // Hot mandate, high trust, multiple properties detected → Portfolio Radar test
  // ============================================================================
  {
    landlord: {
      tags: ['seed_sample'],
      lead_type: 'landlord_sale',
      first_name: 'Hassan',
      last_name: 'Al Marri',
      full_name: 'Hassan Al Marri',
      full_name_en: 'Hassan Al Marri',
      full_name_ar: 'حسن المري',
      phone: '+971501234001',
      whatsapp: '+971501234001',
      email: 'hassan.almarri@example.ae',
      preferred_language: 'ar',
      nationality: 'United Arab Emirates',
      residence_country: 'UAE',
      is_resident_uae: true,
      landlord_archetype: 'professional_investor',
      source: 'referral',
      assigned_agent_email: 'ahmad@erudite-estate.com',
      stage: 'mandate_negotiation',
      sub_stage: 'commission_alignment',
      stage_entered_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      mandate_type: 'exclusive',
      mandate_status: 'verbal',
      commission_pct_negotiated: 2,
      prior_brokerage_count: 4,
      competing_brokers_count: 2,
      is_currently_listed_with_others: false,
      trust_score: 78,
      responsiveness_score: 92,
      mandate_win_probability: 0.72,
      urgency_score: 65,
      estimated_commission_aed: 84000,
      rapport_level: 'trust_established',
      red_flags: [],
      buying_signals: [
        'asked about exclusive marketing budget',
        'shared title deed proactively',
        'mentioned referral commission for next deal'
      ],
      ai_rolling_summary: 'Hassan is a sophisticated Emirati investor with a portfolio of 4-6 units across Marina and JLT. Currently selling his 3BR Marina apartment due to portfolio rebalancing. He has been spoken to by 2 other brokers but prefers us due to referral from his cousin. Conversations show he is detail-oriented, prefers WhatsApp in Arabic, and responds within 30 minutes during business hours. Trust is high.',
      ai_coaching_for_agent: 'Hassan is data-driven and ROI-focused — open every conversation with market numbers, not pleasantries. He values exclusivity for marketing reach; lock in 90-day exclusive at 2% with a strong digital marketing pitch. Mention his cousin (Khalid) periodically to reinforce the referral chain.',
      ai_competitive_intel: 'Allsopp & Allsopp pitched him 1.5% commission with 60-day exclusive last week. Espace offered cash advance against commission.',
      ai_next_best_action: {
        action: 'send_listings',
        priority: 'high',
        scheduled_for: new Date(Date.now() + 4 * 3600000).toISOString(),
        draft_message: 'مرحباً حسن، إليك ملخص حملة التسويق المقترحة لشقتك في المارينا: 3 منصات رئيسية، تصوير احترافي بطائرة، فيديو 360، وعرض حصري لقاعدة عملائنا. الإيجار المتوقع 30 يوماً. هل نوقع الإتفاقية الأسبوع المقبل؟',
        draft_language: 'ar',
        reasoning: 'Hassan is in mandate_negotiation 3 days. Competitor just pitched lower commission. Strike now with concrete marketing plan + 30-day prediction to justify our 2%.',
        confidence: 0.88
      },
      ai_momentum: 'accelerating',
      ai_strike_now: true,
      activity_count: 8,
      last_activity_at: new Date(Date.now() - 8 * 3600000).toISOString(),
      last_activity_type: 'whatsapp',
      days_since_last_contact: 0,
      ai_processing_status: 'completed',
      ai_processed_at: new Date(Date.now() - 6 * 3600000).toISOString(),
      ai_model_used: 'claude-opus-4-7'
    },
    property: {
      title_deed_number: 'DLD-2019-MR3-1847',
      role: 'sole_owner',
      ownership_pct: 100,
      title_deed_verified: true,
      title_deed_verified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      is_off_plan: false,
      mortgage_status: 'free_hold_no_mortgage',
      service_charge_status: 'clear',
      currently_occupied: false,
      tenancy_status: 'vacant',
      keys_location: 'with_landlord',
      photography_status: 'professional_done',
      has_360_tour: true,
      has_drone_footage: true,
      has_floor_plan: true,
      asking_price_aed: 4200000
    },
    stakeholders: [
      {
        name: 'Fatima Al Marri',
        name_ar: 'فاطمة المري',
        role: 'spouse',
        decision_power: 35,
        sentiment: 'supportive',
        sentiment_score: 0.6,
        motivations: ['family relocating to UK', 'wants quick clean sale'],
        preferred_channel: 'whatsapp',
        language: 'ar',
        claude_strategy: 'Fatima is supportive but timeline-anxious. Loop her in via Hassan with reassurance on closing timeline. Avoid pricing complexity in her presence.',
        influence_priority: 2,
        detected_from: 'ai_detected_from_conversation'
      }
    ],
    activities: [
      {
        type: 'call',
        outcome: 'completed',
        duration_minutes: 18,
        title: 'Initial mandate discussion',
        description: 'Hassan picked up immediately. Confirmed asking 4.2M for Marina 3BR. Mentioned 2 other brokers but prefers us due to cousin referral. Asked about marketing plan + commission. Agreed to verbal mandate pending Form A draft.',
        ai_summary: 'Strong qualifying call. Hassan engaged, data-driven, ready to move forward. Two competitors known. Verbal commit on 2% exclusive 90-day.',
        ai_sentiment: 'positive',
        ai_quality_score: 87,
        source: 'manual',
        agent_email: 'ahmad@erudite-estate.com',
        agent_name: 'Ahmad'
      },
      {
        type: 'whatsapp',
        direction: 'outbound',
        channel: 'whatsapp',
        title: 'Sent CMA + marketing proposal',
        description: 'Shared 3-page PDF with comparable sales (3 closed in same building last 60 days at 4.0-4.4M) + proposed marketing plan (Bayut featured, PF premium, IG/TikTok video reels).',
        ai_summary: 'Sent comprehensive proposal. No reply yet — typical 24h response pattern.',
        ai_sentiment: 'neutral',
        source: 'manual',
        agent_email: 'ahmad@erudite-estate.com'
      },
      {
        type: 'whatsapp',
        direction: 'inbound',
        channel: 'whatsapp',
        title: 'Hassan: agreed to send Form A',
        description: 'Hassan: "Looks good. Send Form A. I want 2% but want to lock exclusivity at 90 days max."',
        ai_summary: 'Buying signal: explicit commit to Form A. Counter on exclusivity to 90d (was 120d).',
        ai_sentiment: 'very_positive',
        ai_intent: 'ready_to_buy',
        source: 'manual'
      }
    ],
    negotiation: {
      asking_price_initial: 4500000,
      asking_price_current: 4200000,
      cma_value_aed: 4180000,
      cma_evidence: [
        { comp_address: 'Marina Tower 5 #1804', sold_price_aed: 4400000, sold_date: '2026-03-15', size_sqft: 1850, bedrooms: 3, similarity_pct: 92 },
        { comp_address: 'Marina Heights #2210', sold_price_aed: 4050000, sold_date: '2026-04-02', size_sqft: 1780, bedrooms: 3, similarity_pct: 88 },
        { comp_address: 'Marina Quays #1502', sold_price_aed: 4250000, sold_date: '2026-02-20', size_sqft: 1900, bedrooms: 3, similarity_pct: 90 }
      ],
      pricing_gap_pct: 0.5,
      pricing_pressure: 'green',
      commission_offered_pct: 2,
      commission_floor_pct: 1.75,
      commission_ceiling_pct: 2.5,
      exclusivity_offered_days: 90,
      marketing_budget_offered_aed: 8000,
      competitor_offers: [
        { broker_name: 'Allsopp & Allsopp', commission_pct: 1.5, exclusivity: true, notes: 'Offered 1.5% with 60-day exclusive' },
        { broker_name: 'Espace', commission_pct: 2, exclusivity: false, notes: 'Offered cash advance against commission' }
      ]
    },
    documents: [
      { document_type: 'title_deed', status: 'received', received_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { document_type: 'emirates_id_front', status: 'received', received_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { document_type: 'emirates_id_back', status: 'received', received_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { document_type: 'service_charge_clearance', status: 'requested', requested_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { document_type: 'form_a', status: 'pending_request' }
    ]
  },

  // ============================================================================
  // SEED 2 — Distressed Overseas Seller (Urgency High, Trust Low, Red Flags)
  // ============================================================================
  {
    landlord: {
      tags: ['seed_sample'],
      lead_type: 'landlord_sale',
      first_name: 'Olga',
      last_name: 'Petrov',
      full_name: 'Olga Petrov',
      full_name_en: 'Olga Petrov',
      phone: '+71234567890',
      whatsapp: '+71234567890',
      email: 'olga.petrov.invest@example.ru',
      preferred_language: 'ru',
      nationality: 'Russia',
      residence_country: 'Russia',
      is_resident_uae: false,
      landlord_archetype: 'distressed_seller',
      source: 'fsbo_portal',
      assigned_agent_email: 'ahmad@erudite-estate.com',
      stage: 'pricing_alignment',
      sub_stage: 'price_reduction_resistance',
      stage_entered_at: new Date(Date.now() - 12 * 86400000).toISOString(),
      mandate_type: 'non_exclusive',
      mandate_status: 'none',
      prior_brokerage_count: 3,
      competing_brokers_count: 5,
      is_currently_listed_with_others: true,
      trust_score: 28,
      responsiveness_score: 41,
      mandate_win_probability: 0.18,
      urgency_score: 88,
      estimated_commission_aed: 36000,
      rapport_level: 'warming',
      red_flags: ['unrealistic_pricing', 'shopping_brokers', 'ghost_pattern'],
      buying_signals: ['mentioned divorce as reason for sale', 'asked about cash buyers only'],
      ai_rolling_summary: 'Olga is selling her Downtown studio from overseas (Moscow). Divorce-motivated, needs cash within 6 weeks. Currently listed with 5 brokers at 20% above market — and refusing price drops despite 65 days on market with zero offers. Response times are erratic (avg 36h). Has hung up on 2 of our calls. Trust low, win probability low, but urgency is extreme — opportunity exists if we can convince her on pricing.',
      ai_coaching_for_agent: 'Olga is emotional and overwhelmed. Stop pitching marketing — she has 5 brokers already. Lead with COMPS evidence in writing (PDF) in Russian. Frame price drop as "matching reality, not failing." Aim for 1 quick win (price reduction agreement) before asking for exclusivity. Patience over pressure.',
      ai_competitive_intel: 'Listed with Provident, Driven, Better Homes, Dacha, and one unknown. All at 1.8M asking. Average DOM in this building at this price: 90+ days.',
      ai_next_best_action: {
        action: 'send_email',
        priority: 'urgent',
        scheduled_for: new Date(Date.now() + 2 * 3600000).toISOString(),
        draft_message: 'Olga, я понимаю что ситуация срочная. Прикладываю отчет о 4 продажах в вашем здании за последние 60 дней — все закрылись в диапазоне 1.45-1.55M AED. Ваша цена 1.8M значит что покупатели даже не смотрят. Если снизим до 1.55M на этой неделе, я гарантирую первое предложение в течение 14 дней. Это план?',
        draft_language: 'ru',
        reasoning: 'High urgency but stuck on price. Send formal CMA in Russian with closing comp evidence. Concrete 14-day promise tied to specific price gives her a face-saving way to drop.',
        confidence: 0.62
      },
      ai_momentum: 'stalled',
      ai_strike_now: false,
      needs_human_review: true,
      review_reason: 'Listed with 5 competing brokers + has been at pricing_alignment >7 days with no progress. Consider walking away or escalating to manager.',
      activity_count: 11,
      last_activity_at: new Date(Date.now() - 36 * 3600000).toISOString(),
      last_activity_type: 'call',
      days_since_last_contact: 2,
      ai_processing_status: 'completed',
      ai_processed_at: new Date(Date.now() - 6 * 3600000).toISOString(),
      ai_model_used: 'claude-opus-4-7'
    },
    property: {
      title_deed_number: 'DLD-2017-DT-8821',
      role: 'sole_owner',
      ownership_pct: 100,
      title_deed_verified: false,
      is_off_plan: false,
      mortgage_status: 'mortgaged_overseas',
      mortgage_balance_aed: 950000,
      mortgage_bank: 'VTB Bank (Russia)',
      service_charge_status: 'in_arrears',
      service_charge_arrears_aed: 12000,
      currently_occupied: true,
      tenancy_status: 'tenanted_ejari_valid',
      lease_end_date: '2026-09-15',
      current_rent_aed: 95000,
      keys_location: 'with_tenant',
      photography_status: 'phone_quality',
      asking_price_aed: 1800000
    },
    stakeholders: [
      {
        name: 'Dmitri Petrov',
        role: 'lawyer',
        decision_power: 60,
        sentiment: 'skeptical',
        sentiment_score: -0.3,
        objections: ['wants higher price', 'distrusts UAE brokers'],
        preferred_channel: 'email',
        language: 'ru',
        claude_strategy: 'Dmitri is Olga\'s ex-husband and joint title holder. Adversarial. Send all communication via email cc\'d to him. Frame everything legally. NEVER discuss price without him in the loop.',
        influence_priority: 1,
        detected_from: 'ai_detected_from_conversation'
      }
    ],
    activities: [
      {
        type: 'whatsapp',
        direction: 'outbound',
        title: 'Initial outreach',
        description: 'Reached out via FSBO listing. Introduced our brokerage.',
        ai_summary: 'Cold outreach. Olga replied after 48h.',
        ai_sentiment: 'neutral',
        source: 'manual'
      },
      {
        type: 'call',
        outcome: 'no_answer',
        duration_minutes: 0,
        title: 'Attempted callback',
        description: 'No answer. Voicemail left in Russian.',
        ai_sentiment: 'neutral',
        ai_quality_score: 45,
        source: 'manual'
      },
      {
        type: 'call',
        outcome: 'completed',
        duration_minutes: 8,
        title: 'Price reduction discussion',
        description: 'Called Olga. She was hostile when CMA was mentioned. Insisted 1.8M is "her bottom line." Hung up after 8 minutes.',
        ai_summary: 'Defensive response to pricing pressure. Lawyer ex-husband mentioned. Trust low.',
        ai_sentiment: 'negative',
        ai_quality_score: 52,
        ai_coaching_notes: 'You went too hard on the CMA in minute 2. Build rapport first. Next call: open with empathy ("I know this is hard timing"), don\'t mention numbers for first 5 min.',
        source: 'manual'
      }
    ],
    negotiation: {
      asking_price_initial: 1950000,
      asking_price_current: 1800000,
      cma_value_aed: 1500000,
      pricing_gap_pct: 20,
      pricing_pressure: 'red',
      commission_offered_pct: 2,
      competitor_offers: [
        { broker_name: 'Provident', commission_pct: 2, exclusivity: false },
        { broker_name: 'Driven', commission_pct: 1.5, exclusivity: false },
        { broker_name: 'Better Homes', commission_pct: 2, exclusivity: false },
        { broker_name: 'Dacha', commission_pct: 2.5, exclusivity: true, notes: 'Tried to get exclusivity but Olga refused' }
      ]
    },
    documents: [
      { document_type: 'title_deed', status: 'requested', requested_at: new Date(Date.now() - 10 * 86400000).toISOString(), reminder_count: 2, last_reminder_at: new Date(Date.now() - 3 * 86400000).toISOString() },
      { document_type: 'passport', status: 'requested', requested_at: new Date(Date.now() - 8 * 86400000).toISOString(), reminder_count: 1 },
      { document_type: 'mortgage_clearance', status: 'pending_request' }
    ]
  },

  // ============================================================================
  // SEED 3 — First-Time Seller (Emotional, Slow, Needs Handholding)
  // ============================================================================
  {
    landlord: {
      tags: ['seed_sample'],
      lead_type: 'landlord_sale',
      first_name: 'Priya',
      last_name: 'Sharma',
      full_name: 'Priya Sharma',
      full_name_en: 'Priya Sharma',
      phone: '+971502345678',
      whatsapp: '+971502345678',
      email: 'priya.sharma@example.com',
      preferred_language: 'en',
      nationality: 'India',
      residence_country: 'UAE',
      is_resident_uae: true,
      landlord_archetype: 'first_time_seller',
      source: 'website',
      assigned_agent_email: 'ahmad@erudite-estate.com',
      stage: 'first_contact',
      sub_stage: 'rapport_building',
      stage_entered_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      mandate_type: 'non_exclusive',
      mandate_status: 'none',
      prior_brokerage_count: 0,
      competing_brokers_count: 0,
      is_currently_listed_with_others: false,
      trust_score: 55,
      responsiveness_score: 68,
      mandate_win_probability: 0.45,
      urgency_score: 35,
      estimated_commission_aed: 24000,
      rapport_level: 'warming',
      red_flags: [],
      buying_signals: [
        'asked detailed questions about the process',
        'shared photos of the apartment proactively',
        'mentioned wanting an "honest agent who explains things"'
      ],
      ai_rolling_summary: 'Priya is a first-time seller — has owned her JVC 1BR for 7 years, moving back to India with her husband next year. Emotionally attached to the apartment, asks many questions, slow to commit. No other brokers involved yet — we are her first call after the website inquiry. Trust building slowly. She values education over pressure, English with occasional Hindi pleasantries.',
      ai_coaching_for_agent: 'Priya is the ideal "guided journey" client — give her an educational handout (PDF) explaining the 14 steps of selling in Dubai. Avoid sales language entirely. She will sign exclusive eventually IF you become her trusted advisor first. Patience pays here. Schedule a video call (not just WhatsApp) to build the relationship.',
      ai_competitive_intel: 'None detected. We are first.',
      ai_next_best_action: {
        action: 'schedule_viewing',
        priority: 'medium',
        scheduled_for: new Date(Date.now() + 24 * 3600000).toISOString(),
        draft_message: 'Hi Priya, thanks for sharing those photos — the apartment looks well-maintained! I\'d love to do a 15-minute video call to walk you through how selling in Dubai works (no pressure, just so you understand the process before deciding anything). Would tomorrow 6pm work? I\'ll send you a PDF guide afterwards. — Ahmad',
        draft_language: 'en',
        reasoning: 'Priya is high-trust-need, low-urgency. Educational video call builds rapport. Promise a PDF guide creates a commitment hook.',
        confidence: 0.75
      },
      ai_momentum: 'steady',
      ai_strike_now: false,
      activity_count: 4,
      last_activity_at: new Date(Date.now() - 18 * 3600000).toISOString(),
      last_activity_type: 'whatsapp',
      days_since_last_contact: 1,
      ai_processing_status: 'completed',
      ai_processed_at: new Date(Date.now() - 6 * 3600000).toISOString(),
      ai_model_used: 'claude-opus-4-7'
    },
    property: {
      title_deed_number: 'DLD-2018-JVC-3412',
      role: 'joint_owner',
      ownership_pct: 50,
      title_deed_verified: false,
      is_off_plan: false,
      mortgage_status: 'mortgaged_local_bank',
      mortgage_balance_aed: 420000,
      mortgage_bank: 'Emirates NBD',
      service_charge_status: 'clear',
      currently_occupied: true,
      tenancy_status: 'owner_occupied',
      vacant_possession_available_on: '2027-03-15',
      keys_location: 'with_landlord',
      photography_status: 'phone_quality',
      asking_price_aed: 1200000
    },
    stakeholders: [
      {
        name: 'Rohan Sharma',
        role: 'spouse',
        decision_power: 50,
        sentiment: 'neutral',
        sentiment_score: 0,
        motivations: ['wants to repatriate funds to India', 'cautious about timing market'],
        preferred_channel: 'email',
        language: 'en',
        claude_strategy: 'Rohan is the joint owner and final decision-maker on price. Loop him into all written communication. He is more analytical than Priya — give him spreadsheets, not stories.',
        influence_priority: 1,
        detected_from: 'agent_added'
      }
    ],
    activities: [
      {
        type: 'whatsapp',
        direction: 'inbound',
        title: 'Website inquiry',
        description: 'Submitted contact form via website. "Looking to sell my JVC 1BR sometime in the next year, not sure where to start."',
        ai_summary: 'Cold inbound. Soft timeline. Asked for guidance, not aggressive sale.',
        ai_sentiment: 'positive',
        source: 'website'
      },
      {
        type: 'call',
        outcome: 'completed',
        duration_minutes: 12,
        title: 'Initial discovery call',
        description: 'Friendly first conversation. Learned: bought 7 years ago for 950K, mortgage 420K remaining, husband Rohan is joint owner, planning to move to India in 12-18 months. Asked many process questions.',
        ai_summary: 'Excellent rapport call. No selling — pure discovery. Priya is exploring, not committing. Spouse is joint owner.',
        ai_sentiment: 'very_positive',
        ai_quality_score: 88,
        source: 'manual',
        agent_email: 'ahmad@erudite-estate.com'
      },
      {
        type: 'whatsapp',
        direction: 'inbound',
        title: 'Shared apartment photos',
        description: 'Priya sent 8 photos of her apartment (bedroom, kitchen, living room, view).',
        ai_summary: 'Buying signal: proactive engagement. Photos are phone-quality but bright/clean apartment.',
        ai_sentiment: 'positive',
        source: 'manual'
      }
    ],
    documents: [
      { document_type: 'title_deed', status: 'pending_request' },
      { document_type: 'emirates_id_front', status: 'pending_request' },
      { document_type: 'spouse_consent', status: 'pending_request' }
    ]
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const force = (await req.json().catch(() => ({}))).force === true;

    // Idempotency check — find existing seeded landlords by tag
    const existing = await base44.asServiceRole.entities.Landlord.filter({});
    const existingSeeds = (existing || []).filter((l: any) => l.tags?.includes('seed_sample'));

    if (existingSeeds.length > 0 && !force) {
      return Response.json({
        skipped: true,
        message: `${existingSeeds.length} seed landlords already exist. Pass { force: true } to reseed.`,
        existing_ids: existingSeeds.map((l: any) => l.id)
      });
    }

    if (force && existingSeeds.length > 0) {
      // Delete prior seeds
      for (const s of existingSeeds) {
        try { await base44.asServiceRole.entities.Landlord.delete(s.id); } catch {}
      }
    }

    const created: any[] = [];

    for (const seed of SEEDS) {
      // 1. Create the landlord
      const landlord = await base44.asServiceRole.entities.Landlord.create(seed.landlord);

      // 2. Create the property link
      if (seed.property) {
        await base44.asServiceRole.entities.LandlordProperty.create({
          landlord_id: landlord.id,
          ...seed.property
        });
      }

      // 3. Create stakeholders
      for (const s of (seed.stakeholders || [])) {
        await base44.asServiceRole.entities.LandlordStakeholder.create({
          landlord_id: landlord.id,
          ...s
        });
      }

      // 4. Create mandate negotiation
      if (seed.negotiation) {
        await base44.asServiceRole.entities.MandateNegotiation.create({
          landlord_id: landlord.id,
          ...seed.negotiation
        });
      }

      // 5. Create activities (in chronological order, oldest first)
      for (let i = 0; i < (seed.activities || []).length; i++) {
        const a = seed.activities[i];
        await base44.asServiceRole.entities.Activity.create({
          lead_id: landlord.id,
          ...a,
          // Stagger created_at so timeline displays correctly
          created_date: new Date(Date.now() - (seed.activities.length - i) * 86400000).toISOString()
        });
      }

      // 6. Create document checklist
      for (const d of (seed.documents || [])) {
        await base44.asServiceRole.entities.DocumentChecklistItem.create({
          landlord_id: landlord.id,
          ...d
        });
      }

      created.push({
        landlord_id: landlord.id,
        name: landlord.full_name_en,
        archetype: landlord.landlord_archetype,
        stage: landlord.stage
      });
    }

    return Response.json({
      ok: true,
      created: created.length,
      landlords: created,
      message: `Created ${created.length} seed landlords. Open /landlords to see them.`
    });
  } catch (error: any) {
    console.error('seedSampleLandlords error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});
