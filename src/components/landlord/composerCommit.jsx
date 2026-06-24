// composerCommit — entity-write logic for the landlord composer's confirm step.
// Extracted from LandlordDetailPage to keep that file within the line limit.
// Each function creates the appropriate entity from a composerBrain draft and returns a
// timeline stream item to append. Throws on create failure so the caller can fall back.

import { base44 } from '@/api/base44Client';

// type: 'note' | 'task' | 'followup'. draft: the (edited) composerBrain draft. user: current user.
// landlord: the in-memory landlord VM (needs id + agentEmail). Returns the stream item to append.
export async function commitComposerDraft({ type, draft, user, landlord }) {
  const order = Date.now();
  if (type === 'note') {
    await base44.entities.LandlordNote.create({
      landlord_id: landlord.id,
      body: draft.body,
      author_email: user?.email || null,
      author_name: user?.full_name || user?.email?.split('@')[0] || null,
      created_from_ai: true,
      ai_source: 'composer_brain',
      was_edited_after_draft: !!draft._edited,
      pinned: false,
    });
    // Optionally create a task per action item the agent ticked (opt-in, never forced).
    const sel = Array.isArray(draft._selectedActionItems) ? draft._selectedActionItems : [];
    for (const i of sel) {
      const t = (draft.action_items || [])[i];
      if (t) {
        try {
          await base44.entities.LandlordTask.create({
            landlord_id: landlord.id, title: t, done: false,
            created_from_ai: true, ai_source: 'composer_brain', was_edited_after_draft: false,
          });
        } catch (_) { /* action-item tasks are best-effort */ }
      }
    }
    return { t: 'act', kind: 'note', title: 'Note · AI', body: draft.body, time: 'Just now', order };
  }

  if (type === 'task') {
    await base44.entities.LandlordTask.create({
      landlord_id: landlord.id,
      title: draft.title,
      due_date: draft.due_date || undefined,
      assignee_email: draft.assignee_email || landlord.agentEmail || undefined,
      done: false,
      created_from_ai: true,
      ai_source: 'composer_brain',
      was_edited_after_draft: !!draft._edited,
    });
    return { t: 'act', kind: 'task', title: 'Task · AI' + (draft.due_date ? ' · due ' + draft.due_date : ''), body: draft.title, time: 'Just now', order };
  }

  // followup
  await base44.entities.Followup.create({
    landlord_id: landlord.id,
    title: draft.title,
    notes: draft.notes || '',
    scheduled_at: draft.scheduled_at || undefined,
    priority: draft.priority || 'medium',
    kind: draft.kind || 'follow-up',
    status: 'open',
    agent_email: user?.email || landlord.agentEmail || undefined,
    created_from_ai: true,
  });
  return { t: 'act', kind: 'followup', title: 'Follow-up · AI' + (draft.kind ? ' · ' + draft.kind : ''), body: draft.title, time: 'Just now', order };
}