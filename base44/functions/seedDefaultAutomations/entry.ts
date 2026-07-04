// seedDefaultAutomations — seeds the default welcome sequence templates
// (3 WhatsApp messages + 1 welcome email) and the corresponding AutomationRule
// if they don't already exist. Called from the Automations Hub on first load.
//
// All content is editable from the Automations Hub — this just provides sensible defaults.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // ── Check if welcome templates already exist ───────────────────────
    const existing = await base44.entities.MessageTemplate.filter(
      { category: 'welcome_sequence' },
      'sort_order',
      20
    );

    const existingTitles = new Set((existing || []).map((t) => t.title));
    const created = [];

    const defaults = [
      {
        title: 'Welcome WhatsApp 1 — Property Finder Link',
        body: 'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264',
        channel: 'whatsapp',
        sort_order: 1,
      },
      {
        title: 'Welcome WhatsApp 2 — Introduction',
        body: 'Hi {{landlord_name}}, this is {{agent_name}}, right hand of Mr. Ahmad — CEO of Erudite Real Estate. We specialize in luxury, investment and off-plan. We want to help utilize your property and I would like to set a proper meeting to discuss things in detail. How\'s your schedule looking on Monday? Also, feel free to check us out to know why we\'re trusted by all investors: https://eruditeproperty.com/',
        channel: 'whatsapp',
        sort_order: 2,
      },
      {
        title: 'Welcome WhatsApp 3 — Founder Director',
        body: 'https://eruditeproperty.com/cms-folder/founder-director',
        channel: 'whatsapp',
        sort_order: 3,
      },
      {
        title: 'Welcome Email — New Landlord',
        subject: 'Welcome to Erudite Real Estate',
        body: 'Hi {{landlord_name}},\n\nThank you for connecting with Erudite Real Estate. I\'m {{agent_name}}, and I\'ll be your dedicated point of contact.\n\nWe specialize in luxury, investment, and off-plan properties across Dubai. Our team has closed over AED 100M+ in transactions, and we\'re committed to helping you get the best value for your property.\n\nI\'d love to schedule a meeting to discuss how we can help utilize your property. How does your schedule look this week?\n\nBest regards,\n{{agent_name}}\nErudite Real Estate',
        channel: 'email',
        sort_order: 4,
      },
    ];

    for (const d of defaults) {
      if (existingTitles.has(d.title)) continue;
      try {
        const tpl = await base44.entities.MessageTemplate.create({
          ...d,
          category: 'welcome_sequence',
          is_active: true,
          visibility: 'shared',
          variables: ['landlord_name', 'agent_name'],
          created_by_email: user.email,
          created_by_name: user.full_name || user.email,
        });
        created.push(tpl);
      } catch (_) { /* best-effort */ }
    }

    // ── Check if the welcome automation rule exists ────────────────────
    const rules = await base44.asServiceRole.entities.AutomationRule.filter(
      { trigger_type: 'landlord_created' },
      'priority',
      20
    );

    let ruleCreated = null;
    if (!rules || rules.length === 0) {
      try {
        ruleCreated = await base44.asServiceRole.entities.AutomationRule.create({
          name: 'New Landlord Welcome Sequence',
          description: 'Automatically sends 3 WhatsApp messages + welcome email when a new landlord is created',
          is_active: true,
          trigger_type: 'landlord_created',
          trigger_conditions: {},
          delay_hours: 0,
          actions: [{ type: 'send_template', payload: { channel: 'all' } }],
          recipient_type: 'new_landlord',
          priority: 1,
        });
      } catch (_) { /* best-effort */ }
    }

    return Response.json({
      ok: true,
      templates_created: created.length,
      rule_created: !!ruleCreated,
      total_welcome_templates: (existing?.length || 0) + created.length,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});