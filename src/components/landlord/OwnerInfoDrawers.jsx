import React from 'react';
import { ChevronDown, Phone, Mail, Globe, User, MapPin, MessageCircle, Video, Mic } from 'lucide-react';

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

const SERVICE_BUTTONS = {
  twilio: { label: 'Twilio', icon: Phone, color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  aircall: { label: 'Aircall', icon: Video, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  vapi: { label: 'Vapi', icon: Mic, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
};

function InfoDrawer({ label, value, icon: Icon, isOpen, onToggle, statusButtons = [], children }) {
  return (
    <div style={css("border-radius:10px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); overflow:hidden;")}>
      <button 
        onClick={onToggle}
        style={css("width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; background:transparent; border:none; cursor:pointer; transition:background 0.15s ease;")}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={css("display:flex; align-items:center; gap:8px; min-width:0;")}>
          <Icon className="w-3.5 h-3.5" style={css("color:rgba(255,255,255,0.5);")} />
          <span style={css("font-size:9.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>{label}</span>
        </div>
        <div style={css("display:flex; align-items:center; gap:6px;")}>
          <span style={css("font-size:12px; font-weight:600; color:rgba(255,255,255,0.85); overflow:hidden; textOverflow:'ellipsis'; whiteSpace:'nowrap'; max-width:140px;")}>{value}</span>
          <ChevronDown className={"w-3.5 h-3.5 transition-transform duration-200 " + (isOpen ? 'rotate-180' : '')} style={css("color:rgba(255,255,255,0.3);")} />
        </div>
      </button>

      {isOpen && (
        <div style={css("padding:10px 12px; border-top:1px solid rgba(255,255,255,0.05); animation:ld-fade 0.2s ease-out;")}>
          {children}
          {statusButtons && statusButtons.length > 0 && (
            <div style={css("display:flex; flex-wrap:wrap; gap:5px; marginTop:8px;")}>
              {statusButtons.map((svc) => {
                const BtnIcon = SERVICE_BUTTONS[svc]?.icon || Phone;
                const config = SERVICE_BUTTONS[svc] || SERVICE_BUTTONS.twilio;
                return (
                  <button
                    key={svc}
                    style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 9px; borderRadius:99px; fontSize:9.5px; fontWeight:600; background:"+config.bg+"; border:1px solid "+config.color+"; color:"+config.color+";")}
                  >
                    <BtnIcon className="w-2.5 h-2.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OwnerInfoDrawers({ landlord = {}, openDrawers = new Set(), toggleDrawer }) {
  const hasPhone = landlord.phone && landlord.phone !== '—';
  const hasAdditionalPhones = Array.isArray(landlord.additionalPhones) && landlord.additionalPhones.length > 0;
  const hasEmail = landlord.email && landlord.email !== '—';
  const hasAdditionalEmails = Array.isArray(landlord.additionalEmails) && landlord.additionalEmails.length > 0;
  const hasWhatsApp = landlord.whatsapp && landlord.whatsapp !== '—' && landlord.whatsapp !== landlord.phone;

  if (!hasPhone && !hasEmail && !hasWhatsApp && !hasAdditionalPhones && !hasAdditionalEmails && !landlord.passport && !landlord.nationality && !landlord.residence && !landlord.language && !landlord.residentUAE) {
    return null;
  }

  return (
    <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.46s cubic-bezier(0.22,1,0.36,1) both;")}>
      <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:10px;")}>Owner Information</div>
      <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:8px;")}>
        {hasPhone && (
          <InfoDrawer 
            label="Phone" 
            value={landlord.phone} 
            icon={Phone}
            isOpen={openDrawers.has('phone')}
            onToggle={() => toggleDrawer('phone')}
            statusButtons={['twilio', 'aircall', 'vapi', 'whatsapp']}
          >
            <a href={`tel:${landlord.phone}`} style={css("display:inline-flex; align-items:center; gap:5px; padding:7px 11px; borderRadius:8px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); color:hsl(38 92% 60%); fontSize:11.5px; fontWeight:600; textDecoration:none;")}>
              <Phone className="w-3.5 h-3.5" />
              Call Now
            </a>
          </InfoDrawer>
        )}

        {hasAdditionalPhones && (
          <InfoDrawer 
            label="Additional Phones" 
            value={`${landlord.additionalPhones.length} number${landlord.additionalPhones.length > 1 ? 's' : ''}`}
            icon={Phone}
            isOpen={openDrawers.has('additionalPhones')}
            onToggle={() => toggleDrawer('additionalPhones')}
          >
            <div style={css("display:flex; flex-direction:column; gap:6px;")}>
              {landlord.additionalPhones.map((p, i) => (
                <div key={i} style={css("display:flex; flex-direction:column; gap:4px; padding:8px 10px; borderRadius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);")}>
                  <a href={`tel:${p}`} style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.9); textDecoration:none;")}>{p}</a>
                  <div style={css("display:flex; flex-wrap:wrap; gap:5px;")}>
                    {['twilio', 'whatsapp'].map((svc) => {
                      const BtnIcon = SERVICE_BUTTONS[svc]?.icon || Phone;
                      const config = SERVICE_BUTTONS[svc] || SERVICE_BUTTONS.twilio;
                      return (
                        <button key={svc} style={css("display:inline-flex; align-items:center; gap:4px; padding:4px 8px; borderRadius:99px; fontSize:9.5px; fontWeight:600; background:"+config.bg+"; border:1px solid "+config.color+"; color:"+config.color+";")}>
                          <BtnIcon className="w-2.5 h-2.5" />
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </InfoDrawer>
        )}

        {hasEmail && (
          <InfoDrawer 
            label="Email" 
            value={landlord.email} 
            icon={Mail}
            isOpen={openDrawers.has('email')}
            onToggle={() => toggleDrawer('email')}
          >
            <a href={`mailto:${landlord.email}`} style={css("display:inline-flex; align-items:center; gap:5px; padding:7px 11px; borderRadius:8px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); color:hsl(38 92% 60%); fontSize:11.5px; fontWeight:600; textDecoration:none;")}>
              <Mail className="w-3.5 h-3.5" />
              Send Email
            </a>
          </InfoDrawer>
        )}

        {hasAdditionalEmails && (
          <InfoDrawer 
            label="Additional Emails" 
            value={`${landlord.additionalEmails.length} address${landlord.additionalEmails.length > 1 ? 'es' : ''}`}
            icon={Mail}
            isOpen={openDrawers.has('additionalEmails')}
            onToggle={() => toggleDrawer('additionalEmails')}
          >
            <div style={css("display:flex; flex-direction:column; gap:5px;")}>
              {landlord.additionalEmails.map((e, i) => (
                <a key={i} href={`mailto:${e}`} style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.85); textDecoration:none; padding:6px 9px; borderRadius:7px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);")}>{e}</a>
              ))}
            </div>
          </InfoDrawer>
        )}

        {hasWhatsApp && (
          <InfoDrawer 
            label="WhatsApp" 
            value={landlord.whatsapp} 
            icon={MessageCircle}
            isOpen={openDrawers.has('whatsapp')}
            onToggle={() => toggleDrawer('whatsapp')}
            statusButtons={['whatsapp']}
          >
            <a href={`https://wa.me/${landlord.whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:5px; padding:7px 11px; borderRadius:8px; background:rgba(37,211,102,0.12); border:1px solid rgba(37,211,102,0.3); color:#4ade80; fontSize:11.5px; fontWeight:600; textDecoration:none;")}>
              <MessageCircle className="w-3.5 h-3.5" />
              Open Chat
            </a>
          </InfoDrawer>
        )}

        {landlord.passport && (
          <InfoDrawer 
            label="Passport" 
            value={landlord.passport} 
            icon={User}
            isOpen={openDrawers.has('passport')}
            onToggle={() => toggleDrawer('passport')}
          />
        )}

        {landlord.nationality && (
          <InfoDrawer 
            label="Nationality" 
            value={landlord.nationality} 
            icon={Globe}
            isOpen={openDrawers.has('nationality')}
            onToggle={() => toggleDrawer('nationality')}
          />
        )}

        {landlord.residence && (
          <InfoDrawer 
            label="Residence" 
            value={landlord.residence} 
            icon={MapPin}
            isOpen={openDrawers.has('residence')}
            onToggle={() => toggleDrawer('residence')}
          />
        )}

        {landlord.language && (
          <InfoDrawer 
            label="Language" 
            value={landlord.language} 
            icon={Globe}
            isOpen={openDrawers.has('language')}
            onToggle={() => toggleDrawer('language')}
          />
        )}

        {landlord.residentUAE && (
          <InfoDrawer 
            label="UAE Resident" 
            value={landlord.residentUAE} 
            icon={MapPin}
            isOpen={openDrawers.has('residentUAE')}
            onToggle={() => toggleDrawer('residentUAE')}
          />
        )}
      </div>
    </div>
  );
}