import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Auto-ticks the "Called" / "Qualification logged" steps on today's OutreachChecklist when a
// CallLog or CallQualification record is created. Wired via two entity automations (create events).
// Mirrors the upsert + scoring logic in outreachTick.js / OutreachChecklistPanel so all paths agree.
//
// Payload (from entity automation): { event: { type, entity_name, entity_id }, data, payload_too_large }
// We resolve: which landlord, which step, and which agent, then upsert today's checklist row.

const STEP_KEYS = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called', 'qualification_logged'];
const SEQUENCE_KEYS = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called'];

function today() { return new Date().toISOString().slice(0, 10); }

// Last 9 digits of a phone — the proven match key used across the CRM (handles +/- and spacing).
function suffix9(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const entityName = body?.event?.entity_name;
    const entityId = body?.event?.entity_id;
    let data = body?.data;

    // Large payloads arrive without data — fetch the record directly.
    if ((!data || body.payload_too_large) && entityName && entityId) {
      data = await svc.entities[entityName].get(entityId).catch(() => null);
    }
    if (!data) return Response.json({ ok: false, reason: 'no_data' });

    let landlord = null;
    let stepKey = null;
    let agentEmail = null;
    let extra = {};

    if (entityName === 'CallQualification') {
      stepKey = 'qualification_logged';
      agentEmail = data.agent_email || null;
      if (data.landlord_id) landlord = await svc.entities.Landlord.get(data.landlord_id).catch(() => null);
    } else if (entityName === 'CallLog') {
      // Only completed calls count as "Called".
      if (data.status && data.status !== 'completed') return Response.json({ ok: false, reason: 'call_not_completed' });
      stepKey = 'called';
      agentEmail = data.agent_email || null;
      extra = { call_method: 'phone' };
      // CallLog rarely carries landlord_id — match the landlord by phone suffix (to/from).
      if (data.landlord_id) {
        landlord = await svc.entities.Landlord.get(data.landlord_id).catch(() => null);
      } else {
        const sTo = suffix9(data.to_number);
        const sFrom = suffix9(data.from_number);
        if (sTo || sFrom) {
          const all = await svc.entities.Landlord.list('-updated_date', 2000).catch(() => []);
          landlord = all.find(l => {
            const lp = suffix9(l.phone);
            return lp && (lp === sTo || lp === sFrom);
          }) || null;
        }
      }
    } else {
      return Response.json({ ok: false, reason: 'unhandled_entity' });
    }

    if (!landlord?.id) return Response.json({ ok: false, reason: 'no_landlord_match' });
    // Fall back to the landlord's assigned agent when the source record has no agent email.
    agentEmail = agentEmail || landlord.assigned_agent_email;
    if (!agentEmail) return Response.json({ ok: false, reason: 'no_agent' });

    const TODAY = today();
    const rows = await svc.entities.OutreachChecklist.filter({ landlord_id: landlord.id, outreach_date: TODAY });
    const checklist = rows?.[0] ?? null;

    // Idempotent: already ticked.
    if (checklist?.[stepKey]) return Response.json({ ok: true, already: true, step: stepKey });

    const now = new Date().toISOString();
    const patch = { [stepKey]: true, [stepKey + '_at']: now, ...extra };
    const merged = { ...(checklist || {}), ...patch };
    const steps_completed = STEP_KEYS.filter(k => merged[k]).length;
    const sequence_complete = SEQUENCE_KEYS.every(k => merged[k]);

    if (checklist) {
      await svc.entities.OutreachChecklist.update(checklist.id, { ...patch, steps_completed, sequence_complete });
    } else {
      await svc.entities.OutreachChecklist.create({
        landlord_id: landlord.id,
        landlord_name: landlord.full_name_en || landlord.full_name || '',
        agent_email: agentEmail,
        outreach_date: TODAY,
        ...patch,
        steps_completed,
        sequence_complete,
      });
    }

    // Keep the DailyLeadAllocation rollup in sync (same math as the panel + frontend helper).
    const allChecks = await svc.entities.OutreachChecklist.filter({ agent_email: agentEmail, outreach_date: TODAY });
    const leads_worked = allChecks.filter(r => r.sequence_complete).length;
    const qualifications_logged = allChecks.filter(r => r.qualification_logged).length;
    const base_allocation = 10;
    const completion_rate = Math.round((leads_worked / base_allocation) * 100);
    const earned_more_leads = leads_worked >= base_allocation;
    const bonus_earned = earned_more_leads ? 5 : 0;
    const total_available = base_allocation + bonus_earned;
    const status = earned_more_leads ? 'completed' : leads_worked === 0 ? 'active' : leads_worked < 5 ? 'underperforming' : 'active';
    const daily_score = leads_worked * 10 + qualifications_logged * 15 + bonus_earned * 5;

    const allocRows = await svc.entities.DailyLeadAllocation.filter({ agent_email: agentEmail, allocation_date: TODAY });
    const existingAlloc = allocRows[0];
    const allocPatch = { leads_worked, sequences_completed: leads_worked, qualifications_logged, completion_rate, earned_more_leads, bonus_earned, total_available, status, daily_score };

    if (sequence_complete && existingAlloc?.sequential_unlock_enabled && existingAlloc?.lead_queue?.length) {
      const queue = existingAlloc.lead_queue;
      const landlordIdx = queue.indexOf(landlord.id);
      const currentUnlocked = existingAlloc.leads_unlocked_count ?? 1;
      if (landlordIdx === currentUnlocked - 1 && currentUnlocked < queue.length) {
        allocPatch.leads_unlocked_count = currentUnlocked + 1;
        allocPatch.current_unlocked_index = currentUnlocked;
      }
    }

    if (existingAlloc) {
      await svc.entities.DailyLeadAllocation.update(existingAlloc.id, allocPatch);
    } else {
      await svc.entities.DailyLeadAllocation.create({
        agent_email: agentEmail,
        allocation_date: TODAY,
        base_allocation,
        leads_unlocked_count: 1,
        current_unlocked_index: 0,
        sequential_unlock_enabled: true,
        ...allocPatch,
      });
    }

    return Response.json({ ok: true, step: stepKey, landlord_id: landlord.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});