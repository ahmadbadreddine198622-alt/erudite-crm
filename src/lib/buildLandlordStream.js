// buildLandlordStream — pure helper that merges all landlord activity sources into a
// single chronological stream array + a calls array. Extracted from LandlordDetailPage
// to keep it under the line limit.
//
// Each stream item gets _entityType + _entityId so the ActivityCommentThread can
// attach founder coaching comments to specific activities.

import { fmtMsgTime, mapCallStatus, fmtDuration } from './landlordStreamHelpers';

export function buildLandlordStream({
  emailMessages = [], waStreamMessages = [], iMessages = [], telegramMessages = [],
  callLogs = [], aircallCalls = [], aircallByPhone = [],
  notes = [], tasks = [], followups = [], directives = [], activityComments = [],
  landlordEmail = '', L = {}, resolveUserName = () => '', deriveWaChannel = () => 'business', tsOf = (v) => v ? new Date(v).getTime() : 0,
}) {
  const stream = [];

  // ── Email messages ──
  emailMessages.forEach(em => {
    const fromLandlord = em.from_email && landlordEmail && em.from_email.toLowerCase() === landlordEmail.toLowerCase();
    const isOut = !fromLandlord;
    stream.push({
      t: 'msg', dir: fromLandlord ? 'in' : 'out', mtype: 'text', channel: 'email',
      subject: em.subject || '', emailBody: em.body_text || em.snippet || '',
      text: (em.subject ? em.subject + '\n' : '') + (em.snippet || em.body_text || ''),
      time: fmtMsgTime(em.received_at || em.created_date),
      order: tsOf(em.received_at || em.created_date) || 0,
      fromEmail: em.from_email || '', fromName: em.from_name || '',
      senderEmail: isOut ? (em.from_email || '') : '',
      senderName: isOut ? (resolveUserName(em.from_email) || em.from_name || em.from_email || 'Agent') : (em.from_name || L.full_name_en || L.full_name || 'Owner'),
      _entityType: 'email', _entityId: em.id,
    });
  });

  // ── WhatsApp messages ──
  waStreamMessages.forEach(msg => {
    const hasImage = msg.media_type === 'image' && msg.media_url;
    const hasVoice = msg.media_type === 'audio' || msg.is_voice_note === true;
    const isOut = msg.direction === 'outbound';
    stream.push({
      t: 'msg', dir: isOut ? 'out' : 'in',
      mtype: hasImage ? 'media' : hasVoice ? 'voice' : 'text',
      text: msg.caption || msg.body || '',
      mediaUrl: hasImage ? msg.media_url : null, mediaLabel: msg.media_type || '',
      transcript: msg.transcription || '', transcriptLang: msg.detected_language || '',
      translation: msg.translations && typeof msg.translations === 'object' ? (msg.translations.en || '') : '',
      time: fmtMsgTime(msg.timestamp), order: tsOf(msg.timestamp) || 0,
      wa: deriveWaChannel(msg),
      senderEmail: isOut ? (msg.assigned_agent_email || '') : '',
      senderName: isOut ? (resolveUserName(msg.assigned_agent_email) || 'Agent') : (L.full_name_en || L.full_name || 'Owner'),
      _entityType: 'whatsapp', _entityId: msg.id,
    });
  });

  // ── iMessages ──
  iMessages.forEach(msg => {
    const isOut = msg.direction === 'outbound';
    stream.push({
      t: 'msg', dir: isOut ? 'out' : 'in', mtype: 'text', channel: 'imessage',
      text: msg.body || '', time: fmtMsgTime(msg.sent_at || msg.created_date),
      order: tsOf(msg.sent_at || msg.created_date) || 0,
      senderEmail: isOut ? (msg.agent_email || '') : '',
      senderName: isOut ? (resolveUserName(msg.agent_email) || 'Agent') : (L.full_name_en || L.full_name || 'Owner'),
      _entityType: 'imessage', _entityId: msg.id,
    });
  });

  // ── Telegram messages ──
  telegramMessages.forEach(msg => {
    const isOut = msg.direction === 'outbound';
    stream.push({
      t: 'msg', dir: isOut ? 'out' : 'in', mtype: 'text', channel: 'telegram',
      text: msg.body || '', time: fmtMsgTime(msg.sent_at || msg.created_date),
      order: tsOf(msg.sent_at || msg.created_date) || 0,
      senderEmail: isOut ? (msg.agent_email || '') : '',
      senderName: isOut ? (resolveUserName(msg.agent_email) || 'Agent') : (L.full_name_en || L.full_name || 'Owner'),
      _entityType: 'telegram', _entityId: msg.id,
    });
  });

  // ── Calls (for the Calls tab) ──
  const calls = callLogs.map(c => ({
    provider: 'twilio', dir: c.direction === 'outbound' ? 'out' : 'in', title: 'Call',
    who: (resolveUserName(c.agent_email) || '—') + ' · ' + fmtMsgTime(c.started_at || c.created_date),
    dur: fmtDuration(c.duration_seconds, c.status), status: mapCallStatus(c.status),
    recording: !!c.recording_url, recordingUrl: c.recording_url || null,
    _ts: tsOf(c.started_at || c.created_date),
  }));
  const seenCallIds = new Set();
  [...aircallCalls, ...aircallByPhone].forEach(c => {
    const uid = c.id || c.aircall_id;
    if (!uid || seenCallIds.has(uid)) return;
    seenCallIds.add(uid);
    const isVapi = c.source === 'vapi' || (c.notes && String(c.notes).startsWith('Vapi'));
    calls.push({
      provider: isVapi ? 'vapi' : 'aircall', dir: c.direction === 'inbound' ? 'in' : 'out', title: 'Call',
      who: (c.agent_name || resolveUserName(c.agent_email) || 'AI') + ' · ' + fmtMsgTime(c.started_at || c.created_date),
      dur: fmtDuration(c.duration, c.status),
      status: ['done', 'ended', 'completed'].includes(c.status) ? 'done' : mapCallStatus(c.status),
      recording: !!(c.recording_url || c.voicemail_url), recordingUrl: c.recording_url || c.voicemail_url || null,
      _ts: tsOf(c.started_at || c.created_date),
    });
  });
  calls.sort((a, b) => (b._ts || 0) - (a._ts || 0));

  // ── Call activities for the stream ──
  aircallCalls.forEach(call => {
    stream.push({ t: 'act', kind: 'call', title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · Aircall`, body: call.from_number || call.to_number || '', time: fmtMsgTime(call.started_at || call.created_date), order: tsOf(call.started_at || call.created_date) || 0, _entityType: 'call', _entityId: call.id });
  });
  callLogs.forEach(call => {
    stream.push({ t: 'act', kind: 'call', title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · Twilio`, body: call.to_number || call.from_number || '', time: fmtMsgTime(call.started_at || call.created_date), order: tsOf(call.started_at || call.created_date) || 0, _entityType: 'call', _entityId: call.id });
  });

  // ── Notes ──
  notes.forEach(n => {
    stream.push({
      t: 'act', kind: 'note', title: 'Note' + (n.created_from_ai ? ' · AI' : ''), body: n.body || '',
      time: fmtMsgTime(n.created_date), order: tsOf(n.created_date) || 0,
      author: n.author_name || resolveUserName(n.author_email) || n.author_email || '',
      _entityType: 'note', _entityId: n.id,
    });
  });

  // ── Tasks ──
  tasks.forEach(t => {
    stream.push({
      t: 'act', kind: 'task', title: 'Task' + (t.created_from_ai ? ' · AI' : '') + (t.due_date ? ' · due ' + t.due_date : ''),
      body: t.title || '', time: fmtMsgTime(t.created_date), order: tsOf(t.created_date) || 0,
      author: t.assignee_email || '', _entityType: 'task', _entityId: t.id,
    });
  });

  // ── Follow-ups ──
  followups.forEach(f => {
    stream.push({
      t: 'act', kind: 'followup', title: 'Follow-up' + (f.created_from_ai ? ' · AI' : '') + ' · ' + (f.channel || 'call') + ' · ' + fmtMsgTime(f.datetime),
      body: f.notes || '', time: fmtMsgTime(f.created_date || f.datetime), order: tsOf(f.created_date || f.datetime) || 0,
      author: resolveUserName(f.agent_email) || f.agent_email || '', _entityType: 'followup', _entityId: f.id,
    });
  });

  // ── Founder directives ──
  directives.forEach(d => {
    const prioLabel = d.priority ? ` · ${d.priority.toUpperCase()}` : '';
    stream.push({
      t: 'act', kind: 'founder_directive',
      title: 'Founder Directive' + prioLabel + (d.status && d.status !== 'active' ? ` · ${d.status}` : ''),
      body: d.directive_text || '',
      time: fmtMsgTime(d.created_date), order: tsOf(d.created_date) || 0,
      author: d.created_by_name || d.created_by_email || 'Founder',
      _entityType: 'founder_directive', _entityId: d.id,
    });
  });

  // ── Coaching comments (founder annotations on specific activities) ──
  activityComments.forEach(c => {
    stream.push({
      t: 'act', kind: 'coaching_comment',
      title: 'Coaching' + (c.priority ? ` · ${c.priority.toUpperCase()}` : ''),
      body: c.comment_text || '',
      time: fmtMsgTime(c.created_date), order: tsOf(c.created_date) || 0,
      author: c.author_name || c.author_email || 'Founder',
      _entityType: 'coaching_comment', _entityId: c.id,
    });
  });

  stream.sort((a, b) => (b.order || 0) - (a.order || 0));
  return { stream, calls };
}