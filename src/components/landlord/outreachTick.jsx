// Shared helper to auto-tick a step on today's OutreachChecklist for a landlord.
// Called from the LandlordDetailPage composer success handlers (Email/WhatsApp/iMessage/SMS)
// so the outreach sequence ticks the moment the agent actually sends — no manual checkbox.
//
// Mirrors the create/update + scoring logic in OutreachChecklistPanel so both stay consistent:
// it upserts today's row, recomputes steps_completed + sequence_complete, and keeps the
// DailyLeadAllocation rollup in sync (leads_worked / sequences / score / sequential unlock).
//
// Idempotent: ticking an already-true step is a no-op (avoids redundant writes from re-sends).

import { base44 } from '@/api/base44Client';

const STEP_KEYS = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called', 'qualification_logged'];
const SEQUENCE_KEYS = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

const STEP_LABELS = [
  ['email_sent', 'Email'],
  ['whatsapp_sent', 'WhatsApp'],
  ['imessage_sent', 'iMessage'],
  ['sms_sent', 'SMS'],
  ['called', 'Called'],
  ['qualification_logged', 'Qualification logged'],
];

// Build the Outreach-tab view object from today's checklist row (or null → all steps unticked).
export function buildOutreachVM(checklist) {
  const c = checklist || {};
  const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
  const steps = STEP_LABELS.map(([key, label]) => ({ key, label, done: !!c[key], at: fmt(c[key + '_at']) }));
  return {
    date: 'Today',
    stepsCompleted: typeof c.steps_completed === 'number' ? c.steps_completed : steps.filter(s => s.done).length,
    dailyScore: typeof c.daily_score === 'number' ? c.daily_score : 0,
    steps,
  };
}

// stepKey: one of STEP_KEYS. landlord: the live landlord object (needs id + a name).
// Returns silently on any failure — auto-ticking must never break the send it follows.
export async function tickOutreachStep(stepKey, landlord, extra = {}) {
  if (!STEP_KEYS.includes(stepKey) || !landlord?.id) return;
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) return;
    const TODAY = today();

    const rows = await base44.entities.OutreachChecklist.filter({
      landlord_id: landlord.id,
      outreach_date: TODAY,
    });
    const checklist = rows?.[0] ?? null;

    // Idempotent: already ticked → nothing to do.
    if (checklist?.[stepKey]) return;

    const now = new Date().toISOString();
    const patch = { [stepKey]: true, [stepKey + '_at']: now, ...extra };
    const merged = { ...(checklist || {}), ...patch };
    const steps_completed = STEP_KEYS.filter(k => merged[k]).length;
    const sequence_complete = SEQUENCE_KEYS.every(k => merged[k]);

    if (checklist) {
      await base44.entities.OutreachChecklist.update(checklist.id, { ...patch, steps_completed, sequence_complete });
    } else {
      await base44.entities.OutreachChecklist.create({
        landlord_id: landlord.id,
        landlord_name: landlord.full_name_en || landlord.full_name || landlord.name || '',
        agent_email: user.email,
        outreach_date: TODAY,
        ...patch,
        steps_completed,
        sequence_complete,
      });
    }

    // Keep the DailyLeadAllocation rollup in sync (same math as OutreachChecklistPanel).
    const allChecks = await base44.entities.OutreachChecklist.filter({ agent_email: user.email, outreach_date: TODAY });
    const leads_worked = allChecks.filter(r => r.sequence_complete).length;
    const qualifications_logged = allChecks.filter(r => r.qualification_logged).length;
    const base_allocation = 10;
    const completion_rate = Math.round((leads_worked / base_allocation) * 100);
    const earned_more_leads = leads_worked >= base_allocation;
    const bonus_earned = earned_more_leads ? 5 : 0;
    const total_available = base_allocation + bonus_earned;
    const status = earned_more_leads ? 'completed' : leads_worked === 0 ? 'active' : leads_worked < 5 ? 'underperforming' : 'active';
    const daily_score = leads_worked * 10 + qualifications_logged * 15 + bonus_earned * 5;

    const allocRows = await base44.entities.DailyLeadAllocation.filter({ agent_email: user.email, allocation_date: TODAY });
    const existingAlloc = allocRows[0];
    const allocPatch = { leads_worked, sequences_completed: leads_worked, qualifications_logged, completion_rate, earned_more_leads, bonus_earned, total_available, status, daily_score };

    // Sequential unlock: if this landlord just completed the full sequence, advance the pointer.
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
      await base44.entities.DailyLeadAllocation.update(existingAlloc.id, allocPatch);
    } else {
      await base44.entities.DailyLeadAllocation.create({
        agent_email: user.email,
        agent_name: user.full_name,
        allocation_date: TODAY,
        base_allocation,
        leads_unlocked_count: 1,
        current_unlocked_index: 0,
        sequential_unlock_enabled: true,
        ...allocPatch,
      });
    }
  } catch (e) {
    // Never throw — this is a best-effort side effect of an already-successful send.
    console.error('tickOutreachStep failed (non-fatal):', e?.message);
  }
}