import { Check, X } from 'lucide-react';

// "Contact data" — vCard match mini-panel shown in the Initial Contact + Owner Documents
// column headers. Shows what we have vs. what's missing from the landlord's contact card.
// Read-only; aggregates across the stage's landlords (have = at least one filled? no — per the
// spec this surfaces completeness, so we show the count of landlords missing each field).
const has = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

// Field rows per stage. iMessage/Telegram availability come from the resolved status fields.
const FIELD_SETS = {
  initial_contact: [
    { key: 'phone', label: 'Phone', get: (l) => has(l.phone) },
    { key: 'whatsapp', label: 'WhatsApp', get: (l) => has(l.whatsapp) },
    { key: 'email', label: 'Email', get: (l) => has(l.email) || has(l.additional_emails) },
    { key: 'imessage', label: 'iMessage', get: (l) => l.imessage_status === 'available' },
    { key: 'telegram', label: 'Telegram', get: (l) => has(l.telegram_chat_id) },
  ],
  owner_documents: [
    { key: 'emirates_id', label: 'Emirates ID', get: (l) => has(l.emirates_id_file_url) },
    { key: 'passport', label: 'Passport', get: (l) => has(l.passport_file_url) || has(l.passport_no) },
    { key: 'phone', label: 'Phone', get: (l) => has(l.phone) },
    { key: 'email', label: 'Email', get: (l) => has(l.email) || has(l.additional_emails) },
  ],
};

export default function ContactDataMiniPanel({ stage, landlords = [] }) {
  const fields = FIELD_SETS[stage];
  if (!fields || landlords.length === 0) return null;

  const total = landlords.length;
  const rows = fields.map((f) => {
    const haveCount = landlords.reduce((n, l) => n + (f.get(l) ? 1 : 0), 0);
    return { ...f, haveCount, complete: haveCount === total };
  });

  return (
    <div className="mt-2 rounded-lg p-2 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(201,162,75,0.22)' }}>
      <p className="text-[8px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(201,162,75,0.85)' }}>
        Contact data
      </p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-1">
            {r.complete
              ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-400" />
              : <X className="w-2.5 h-2.5 shrink-0 text-amber-400" />}
            <span className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {r.label}
            </span>
            <span className="text-[8px] ml-auto tabular-nums" style={{ color: r.complete ? 'rgba(52,211,153,0.8)' : 'rgba(251,191,36,0.8)' }}>
              {r.haveCount.toLocaleString()}/{total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}