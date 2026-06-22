import React from 'react';
import { Phone, MessageSquare, Headphones, Video } from 'lucide-react';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';

/**
 * CallSuite — multi-system communication buttons for landlord/lead cards.
 */
export default function CallSuite({ landlord, lead, phone }) {
  const entity = landlord || lead;
  const targetPhone = phone || landlord?.phone || lead?.phone;

  if (!targetPhone) return null;

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
      {/* Twilio */}
      <TwilioCallDialog
        lead={lead}
        landlord={landlord}
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

      {/* Aircall */}
      <a
        href={`aircall://dial?phone=${encodeURIComponent(targetPhone.replace(/[\s\-()]/g, ''))}`}
        style={{
          ...buttonBase,
          background: 'rgba(0,190,255,0.12)',
          border: '1px solid rgba(0,190,255,0.25)',
          color: '#00beff',
          textDecoration: 'none',
        }}
      >
        <Headphones className="w-3.5 h-3.5" />
        Aircall
      </a>

      {/* Vapi */}
      <div style={{
        ...buttonBase,
        background: 'rgba(139,92,246,0.12)',
        border: '1px solid rgba(139,92,246,0.25)',
        color: '#c4b5fd',
        opacity: 0.5,
        cursor: 'not-allowed',
      }} title="Coming soon">
        <Video className="w-3.5 h-3.5" />
        Vapi
      </div>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/${targetPhone.replace(/^\+/, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...buttonBase,
          background: 'rgba(37,211,102,0.12)',
          border: '1px solid rgba(37,211,102,0.25)',
          color: '#4ade80',
        }}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        WhatsApp
      </a>
    </div>
  );
}