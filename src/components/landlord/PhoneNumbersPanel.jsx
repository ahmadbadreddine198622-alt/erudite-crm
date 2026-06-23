import React from 'react';
import { Phone, Plus } from 'lucide-react';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import AircallButton from '@/components/shared/AircallButton';

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

function WaButton({ phone }) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`WhatsApp ${phone}`}
      style={css("display:inline-flex; align-items:center; gap:4px; padding:4px 8px; borderRadius:99px; fontSize:9.5px; fontWeight:600; background:rgba(37,211,102,0.12); border:1px solid rgba(37,211,102,0.25); color:#4ade80; text-decoration:none;")}
    >
      WA
    </a>
  );
}

function PhoneRow({ phone, label, landlord }) {
  if (!phone) return null;
  return (
    <div style={css("display:flex; flex-direction:column; gap:6px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
      <div style={css("display:flex; align-items:center; gap:8px; min-width:0;")}>
        <Phone className="w-3.5 h-3.5" style={css("color:rgba(255,255,255,0.5);")} />
        {label && <span style={css("font-size:9.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>{label}</span>}
        <a href={`tel:${phone}`} style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.9); text-decoration:none; margin-left:auto;")}>{phone}</a>
      </div>
      <div style={css("display:flex; flex-wrap:wrap; gap:5px;")}>
        <TwilioCallDialog landlord={landlord} phoneOverride={phone} iconOnly={true}>
          <div style={css("display:inline-flex; align-items:center; gap:4px; padding:4px 8px; borderRadius:99px; fontSize:9.5px; fontWeight:600; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.25); color:#4ade80; cursor:pointer;")}>
            Twilio
          </div>
        </TwilioCallDialog>
        <AircallButton phone={phone} iconOnly={true} />
        <WaButton phone={phone} />
      </div>
    </div>
  );
}

export default function PhoneNumbersPanel({ landlord }) {
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

  if (phones.length === 0) return null;

  return (
    <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.46s cubic-bezier(0.22,1,0.36,1) both;")}>
      <div style={css("display:flex; align-items:center; gap:7px; margin-bottom:10px;")}>
        <Phone className="w-3.5 h-3.5" style={css("color:rgba(255,255,255,0.4);")} />
        <span style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38);")}>Phone Numbers</span>
        <span style={css("display:inline-flex; align-items:center; gap:4px; margin-left:auto; font-size:10px; font-weight:600; color:rgba(255,255,255,0.35);")}>
          <Plus className="w-3 h-3" /> {phones.length} number{phones.length > 1 ? 's' : ''}
        </span>
      </div>
      <div style={css("display:flex; flex-direction:column; gap:7px;")}>
        {phones.map((entry, i) => (
          <PhoneRow key={i} phone={entry.phone} label={entry.label} landlord={landlord} />
        ))}
      </div>
    </div>
  );
}