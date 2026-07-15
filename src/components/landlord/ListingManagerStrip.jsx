import React, { useState } from 'react';
import { Building2, User, Mail, Phone, MessageCircle, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/* Convert CSS string to React style object */
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

export default function ListingManagerStrip({ listingManagerEmail, assignedAgentEmail, phone, whatsapp, users = [], landlordId, onAssigned }) {
  const hasListingManager = listingManagerEmail && listingManagerEmail.trim() !== '';
  const hasAgent = assignedAgentEmail && assignedAgentEmail.trim() !== '';
  const [savingLM, setSavingLM] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);

  const userOptions = Array.isArray(users) ? users.filter(u => u && u.email) : [];

  const handleReassignLM = async (e) => {
    const email = e.target.value;
    if (!landlordId || !email) return;
    setSavingLM(true);
    try {
      await base44.entities.Landlord.update(landlordId, { listing_manager_email: email });
      toast.success('Listing manager updated');
      if (onAssigned) await onAssigned();
    } catch (err) {
      toast.error('Failed to reassign: ' + (err?.message || 'unknown error'));
    } finally {
      setSavingLM(false);
    }
  };

  const handleReassignAgent = async (e) => {
    const email = e.target.value;
    if (!landlordId || !email) return;
    setSavingAgent(true);
    try {
      await base44.entities.Landlord.update(landlordId, { assigned_agent_email: email });
      toast.success('Assigned agent updated');
      if (onAssigned) await onAssigned();
    } catch (err) {
      toast.error('Failed to reassign: ' + (err?.message || 'unknown error'));
    } finally {
      setSavingAgent(false);
    }
  };

  const selectBase = (accent) => ({
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '7px 28px 7px 10px',
    borderRadius: '9px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: "'Inter',sans-serif",
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid ' + accent + '44',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '8px',
    outline: 'none',
  });

  const arrowStyle = (accent) => ({
    position: 'absolute',
    right: '9px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: accent,
  });

  const labelStyle = {
    fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)', marginBottom: '4px', display: 'block',
  };

  if (!hasListingManager && !hasAgent && !phone && !whatsapp && userOptions.length === 0) {
    return (
      <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px;")}>
        <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:10px;")}>Listing Manager & Contact</div>
        <p style={css("font-size:12px; color:rgba(255,255,255,0.4);")}>No listing manager assigned yet. Progress to listing_creation stage to auto-assign.</p>
      </div>
    );
  }

  return (
    <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.5s cubic-bezier(0.22,1,0.36,1) both;")}>
      <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:10px;")}>Listing Manager & Contact</div>
      
      <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:10px;")}>
        {/* Listing Manager */}
        <div style={{
          borderRadius: '11px',
          background: 'hsl(38 92% 50% / 0.08)',
          border: '1px solid hsl(38 92% 50% / 0.25)',
          padding: '11px 13px'
        }}>
          {userOptions.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <label style={labelStyle}>Reassign Listing Manager</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={listingManagerEmail || ''}
                  onChange={handleReassignLM}
                  disabled={savingLM || !landlordId}
                  style={selectBase('hsl(38 92% 60%)')}
                >
                  {!hasListingManager && <option value="">Select…</option>}
                  {userOptions.map(u => (
                    <option key={u.email} value={u.email}>{(u.display_name || u.full_name || u.email.split('@')[0])}</option>
                  ))}
                </select>
                <ChevronDown size={12} style={arrowStyle('hsl(38 92% 60%)')} />
              </div>
            </div>
          )}
          {hasListingManager && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px'
              }}>
                <Building2 className="w-4 h-4" style={{ color: 'hsl(38 92% 60%)' }} />
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '600',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'hsl(38 92% 55%)'
                }}>
                  Listing Manager
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '4px'
              }}>
                <Building2 className="w-3.5 h-3.5" style={{ color: 'hsl(38 92% 60%)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {listingManagerEmail.split('@')[0]}
                </span>
              </div>
              <a
                href={`mailto:${listingManagerEmail}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: 'hsl(38 92% 60%)',
                  textDecoration: 'none'
                }}
              >
                <Mail className="w-3 h-3" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {listingManagerEmail}
                </span>
              </a>
            </>
          )}
          {!hasListingManager && (
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Not assigned yet — pick above.</p>
          )}
        </div>

        {/* Assigned Agent */}
        <div style={{
          borderRadius: '11px',
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.25)',
          padding: '11px 13px'
        }}>
          {userOptions.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <label style={labelStyle}>Reassign Agent</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={assignedAgentEmail || ''}
                  onChange={handleReassignAgent}
                  disabled={savingAgent || !landlordId}
                  style={selectBase('#c4b5fd')}
                >
                  {!hasAgent && <option value="">Select…</option>}
                  {userOptions.map(u => (
                    <option key={u.email} value={u.email}>{(u.display_name || u.full_name || u.email.split('@')[0])}</option>
                  ))}
                </select>
                <ChevronDown size={12} style={arrowStyle('#c4b5fd')} />
              </div>
            </div>
          )}
          {hasAgent && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px'
              }}>
                <User className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '600',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#c4b5fd'
                }}>
                  Assigned Agent
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '4px'
              }}>
                <User className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {assignedAgentEmail.split('@')[0]}
                </span>
              </div>
              <a
                href={`mailto:${assignedAgentEmail}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#a78bfa',
                  textDecoration: 'none'
                }}
              >
                <Mail className="w-3 h-3" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {assignedAgentEmail}
                </span>
              </a>
            </>
          )}
          {!hasAgent && (
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Not assigned yet — pick above.</p>
          )}
        </div>
      </div>

      {/* Contact quick actions */}
      {whatsapp && (
        <div style={{ 
          marginTop: '10px', 
          paddingTop: '10px', 
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <a 
            href={`https://wa.me/${whatsapp.replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 11px', 
              borderRadius: '9px', 
              background: 'rgba(37,211,102,0.1)', 
              border: '1px solid rgba(37,211,102,0.25)',
              color: '#4ade80',
              fontSize: '11px',
              fontWeight: '600',
              textDecoration: 'none'
            }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}