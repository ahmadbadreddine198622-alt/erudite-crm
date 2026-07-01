import React, { useState } from 'react';
import { Phone, Plus, Loader2, Check, X } from 'lucide-react';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import AircallButton from '@/components/shared/AircallButton';
import VapiCallDialog from '@/components/vapi/VapiCallDialog';
import StraightDivider from '@/components/landlord/StraightDivider';
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

function IconBtn({ href, title, bg, border, color, children }) {
  return (
    <a
      href={href}
      target={href && href.startsWith('http') ? '_blank' : undefined}
      rel="noopener noreferrer"
      title={title}
      style={css(`display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; borderRadius:8px; background:${bg}; border:1px solid ${border}; color:${color}; text-decoration:none;`)}
    >
      {children}
    </a>
  );
}

function PhoneRow({ phone, label, landlord }) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return (
    <div style={css("display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; background:rgba(201,162,75,0.08); border:1px solid rgba(201,162,75,0.2);")}>
      <span style={css("font-size:10.5px; font-weight:600; color:rgba(255,255,255,0.55); flex:none;")}>{phone}</span>
      {label && <span style={css("font-size:8px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.35); flex:none;")}>{label}</span>}
      <div style={css("display:flex; align-items:center; gap:5px; margin-left:auto;")}>
        <TwilioCallDialog landlord={landlord} phoneOverride={phone} iconOnly />
        <VapiCallDialog landlord={{ ...landlord, phone, whatsapp: phone }} iconOnly />
        <AircallButton phone={phone} iconOnly />
        <IconBtn href={`tel:${digits}`} title="Call" bg="rgba(59,130,246,0.12)" border="rgba(59,130,246,0.25)" color="#60a5fa">
          <Phone className="w-3 h-3" />
        </IconBtn>
        <IconBtn href={`https://wa.me/${digits}`} title="WhatsApp" bg="rgba(37,211,102,0.12)" border="rgba(37,211,102,0.25)" color="#4ade80">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
        </IconBtn>
      </div>
    </div>
  );
}

export default function PhoneNumbersPanel({ landlord, onAdded }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const phones = [];
  if (landlord?.phone && landlord.phone !== '—') {
    phones.push({ phone: landlord.phone, label: 'Primary' });
  }
  if (landlord?.whatsapp && landlord.whatsapp !== '—' && landlord.whatsapp !== landlord.phone) {
    phones.push({ phone: landlord.whatsapp, label: 'WhatsApp' });
  }
  if (Array.isArray(landlord?.additionalPhones)) {
    landlord.additionalPhones.forEach((p, i) => {
      if (p && p !== landlord.phone && p !== landlord.whatsapp) {
        phones.push({ phone: p, label: `Additional ${i + 1}` });
      }
    });
  }

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || !landlord?.id) return;
    setSaving(true);
    try {
      const next = [...(Array.isArray(landlord.additionalPhones) ? landlord.additionalPhones : []), trimmed];
      await base44.entities.Landlord.update(landlord.id, { additional_phones: next });
      toast.success('Number added');
      setValue('');
      setAdding(false);
      onAdded && onAdded();
    } catch (e) {
      toast.error('Failed to add number: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (phones.length === 0 && !adding) return null;

  return (
    <div>
      <div style={css("margin-top:12px; border-radius:11px; border:1px solid rgba(201,162,75,0.2); background:linear-gradient(135deg, rgba(201,162,75,0.06), rgba(255,255,255,0.02)); padding:10px 12px; animation: ld-rise 0.46s cubic-bezier(0.22,1,0.36,1) both; position: relative; overflow: hidden;")}>
        <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px;")}>
          <Phone className="w-3 h-3" style={css("color:hsl(38 92% 60%);")} />
          <span style={css("font-size:9px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:hsl(38 92% 55%);")}>Channels</span>
          <button
            onClick={() => setAdding(a => !a)}
            style={css("display:inline-flex; align-items:center; gap:3px; margin-left:auto; padding:2px 8px; border-radius:99px; border:1px dashed hsl(38 92% 50% / 0.5); background:transparent; color:hsl(38 92% 55%); font-size:9px; font-weight:700; cursor:pointer;")}
          >
            <Plus className="w-2.5 h-2.5" /> Add Number
          </button>
        </div>
        {adding && (
          <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:8px;")}>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="+971 5X XXX XXXX"
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
          {phones.map((entry, i) => (
            <PhoneRow key={i} phone={entry.phone} label={entry.label} landlord={landlord} />
          ))}
        </div>
      </div>
      <StraightDivider color="hsl(38 92% 50%)" opacity={0.35} />
    </div>
  );
}