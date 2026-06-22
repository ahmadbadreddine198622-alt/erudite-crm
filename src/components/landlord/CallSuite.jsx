import React from 'react';
import { Phone, MessageSquare, Headphones, Video } from 'lucide-react';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import AircallButton from '@/components/shared/AircallButton';

export default function CallSuite({ landlord, lead, phone }) {
  const entity = landlord || lead;
  const targetPhone = phone || entity?.phone || entity?.whatsapp || entity?.wa_phone_e164;

  if (!targetPhone) {
    return null;
  }

  const buttonBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginTop: '8px',
    }}>
      <TwilioCallDialog
        landlord={landlord}
        lead={lead}
        phoneOverride={targetPhone}
        iconOnly={false}
      >
        <div style={{
          ...buttonBase,
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: '#4ade80',
        }}>
          <Phone className="w-3.5 h-3.5" />
          Twilio
        </div>
      </TwilioCallDialog>

      <AircallButton
        phone={targetPhone}
        name={entity?.full_name || entity?.name}
        trigger={
          <div style={{
            ...buttonBase,
            background: 'rgba(0,190,255,0.12)',
            border: '1px solid rgba(0,190,255,0.25)',
            color: '#00beff',
          }}>
            <Headphones className="w-3.5 h-3.5" />
            Aircall
          </div>
        }
      />

      <div style={{
        ...buttonBase,
        background: 'rgba(139,92,246,0.12)',
        border: '1px solid rgba(139,92,246,0.25)',
        color: '#c4b5fd',
        opacity: 0.5,
        cursor: 'not-allowed',
      }} title="Vapi Coming Soon">
        <Video className="w-3.5 h-3.5" />
        Vapi
      </div>

      <a
        href={`https://wa.me/${targetPhone.replace(/[^0-9]/g, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...buttonBase,
          background: 'rgba(37,211,102,0.12)',
          border: '1px solid rgba(37,211,102,0.25)',
          color: '#4ade80',
          textDecoration: 'none',
        }}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        WhatsApp
      </a>
    </div>
  );
}