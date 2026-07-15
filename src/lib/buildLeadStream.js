// buildLeadStream — adapts buildLandlordStream for the Lead entity.
// Same chronological merge of all channels, same ordering, same degrade-safe approach.
// The only difference: Lead uses `full_name` (no `full_name_en`), and Note uses `linked_lead_id`.

import { buildLandlordStream } from './buildLandlordStream';

export function buildLeadStream({
  emailMessages = [], waStreamMessages = [], iMessages = [], telegramMessages = [],
  callLogs = [], aircallCalls = [], aircallByPhone = [],
  notes = [], reminders = [], activityComments = [],
  leadEmail = '', L = {}, resolveUserName = () => '', resolveAgentByPhone = () => null,
  deriveWaChannel = () => 'business', tsOf = (v) => v ? new Date(v).getTime() : 0,
}) {
  // Map the Lead object to the shape buildLandlordStream expects:
  // full_name_en → full_name, so the sender-name fallbacks resolve correctly.
  const LShaped = {
    ...L,
    full_name_en: L.full_name || L.full_name_en || L.name || '',
    full_name: L.full_name || L.name || '',
  };

  // Reminders serve as both tasks and follow-ups for leads (they carry lead_id).
  // Split by type/kind so the stream labels them correctly.
  const tasks = reminders.filter((r) => r.type === 'task' || (!r.type && !r.scheduled_at));
  const followups = reminders.filter((r) => r.type === 'followup' || r.scheduled_at || r.kind === 'follow_up');

  // Map Note entities (linked_lead_id) to the shape buildLandlordStream expects (landlord_id).
  const notesShaped = notes.map((n) => ({
    ...n,
    body: n.body || n.text || n.note || '',
    created_from_ai: n.created_from_ai || n.ai_generated || false,
    author_email: n.author_email || n.created_by_email || '',
    author_name: n.author_name || '',
  }));

  return buildLandlordStream({
    emailMessages, waStreamMessages, iMessages, telegramMessages,
    callLogs, aircallCalls, aircallByPhone,
    notes: notesShaped, tasks, followups,
    directives: [], activityComments,
    landlordEmail: leadEmail, L: LShaped,
    resolveUserName, resolveAgentByPhone, deriveWaChannel, tsOf,
  });
}