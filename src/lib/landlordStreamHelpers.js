// Pure helper functions extracted from LandlordDetailPage to keep it under the line limit.

// 12-hour AM/PM time formatter — used across all activity tabs.
export const fmtMsgTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

// Map a Twilio call status to the Calls tab's done/missed/voicemail taxonomy.
export const mapCallStatus = (s) => {
  if (s === 'completed') return 'done';
  if (s === 'no-answer' || s === 'busy' || s === 'failed') return 'missed';
  if (s === 'queued' || s === 'initiated' || s === 'ringing') return 'missed';
  return 'missed';
};

// Human-readable call duration.
export const fmtDuration = (sec, status) => {
  if (sec && sec > 0) { const m = Math.floor(sec / 60), s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
  if (status === 'no-answer') return 'No answer';
  if (status === 'busy') return 'Busy';
  if (status === 'failed') return 'Failed';
  if (status === 'queued') return 'Queued';
  return '—';
};