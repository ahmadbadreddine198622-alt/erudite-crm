import React, { useState } from 'react';
import { Mail, Plus, Loader2, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function css(str) {
  const o = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  });
  return o;
}

function EmailRow({ addr, label }) {
  return (
    <div style={css("display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; background:rgba(201,162,75,0.08); border:1px solid rgba(201,162,75,0.2);")}>
      <span style={css("font-size:10.5px; font-weight:600; color:rgba(255,255,255,0.55); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;")}>{addr}</span>
      {label && <span style={css("font-size:8px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.35); flex:none;")}>{label}</span>}
      <a
        href={`mailto:${addr}`}
        title={`Email ${addr}`}
        style={css("display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; borderRadius:8px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); color:hsl(38 92% 62%); text-decoration:none; flex:none;")}
      >
        <Mail className="w-3 h-3" />
      </a>
    </div>
  );
}

export default function EmailPanel({ landlord, onAdded }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const allEmails = [
    ...(landlord?.email ? [{ addr: landlord.email, label: 'Primary' }] : []),
    ...(Array.isArray(landlord?.additionalEmails) ? landlord.additionalEmails.map((e, i) => ({ addr: e, label: `Additional ${i + 1}` })) : []),
  ];

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || !landlord?.id) return;
    setSaving(true);
    try {
      const next = [...(Array.isArray(landlord.additionalEmails) ? landlord.additionalEmails : []), trimmed];
      await base44.entities.Landlord.update(landlord.id, { additional_emails: next });
      toast.success('Email added');
      setValue('');
      setAdding(false);
      onAdded && onAdded();
    } catch (e) {
      toast.error('Failed to add email: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (!allEmails.length && !adding) return null;

  return (
    <div style={css("margin-top:8px; border-radius:13px; border:1px solid rgba(201,162,75,0.2); background:linear-gradient(135deg, rgba(201,162,75,0.06), rgba(255,255,255,0.02)); padding:10px 15px;")}>
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px;")}>
        <Mail className="w-3 h-3" style={css("color:hsl(38 92% 60%);")} />
        <span style={css("font-size:9px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:hsl(38 92% 55%);")}>Email</span>
        <button
          onClick={() => setAdding(a => !a)}
          style={css("display:inline-flex; align-items:center; gap:3px; margin-left:auto; padding:2px 8px; border-radius:99px; border:1px dashed hsl(38 92% 50% / 0.5); background:transparent; color:hsl(38 92% 55%); font-size:9px; font-weight:700; cursor:pointer;")}
        >
          <Plus className="w-2.5 h-2.5" /> Add Email
        </button>
      </div>
      {adding && (
        <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:8px;")}>
          <input
            autoFocus
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="name@email.com"
            style={css("flex:1; min-width:0; padding:6px 9px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.9); font-size:11px;")}
          />
          <button onClick={handleSave} disabled={saving || !value.trim()} style={css("display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:7px; background:rgba(52,211,153,0.15); border:1px solid rgba(52,211,153,0.4); color:#34d399; cursor:pointer;")}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={() => { setAdding(false); setValue(''); }} style={css("display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.5); cursor:pointer;")}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div style={css("display:flex; flex-direction:column; gap:5px;")}>
        {allEmails.map((entry, i) => (
          <EmailRow key={i} addr={entry.addr} label={entry.label} />
        ))}
      </div>
    </div>
  );
}