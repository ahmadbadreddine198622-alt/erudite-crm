import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail, EyeOff, Loader2, X, AlertTriangle, Send, Check, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOLD = '#c9a85c';

// ── Shared portal backdrop ─────────────────────────────────────────────────
// Renders children at document.body level — escapes any overflow/transform context.
function PortalModal({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    // Backdrop: position fixed, covers viewport, centers dialog
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
    >
      {/* Dialog box: stop propagation so clicks inside don't close */}
      <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400 }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── Unpublish confirmation dialog ──────────────────────────────────────────
// BEFORE: rendered inline inside listing card → clipped by overflow:hidden + transform context
// AFTER:  rendered via createPortal at document.body → true fixed overlay, always centered
function UnpublishDialog({ listing, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleUnpublish = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('pfUnpublishListing', {
        pfListingId: listing.pf_listing_id,
        crmId: listing.id,
      });
      if (res.data?.ok) {
        toast.success('Listing unpublished from Property Finder');
        onSuccess();
        onClose();
      } else {
        toast.error(res.data?.error || 'Unpublish failed');
        setLoading(false);
      }
    } catch (err) {
      toast.error(err.message || 'Unpublish failed');
      setLoading(false);
    }
  };

  return (
    <PortalModal onClose={onClose}>
      <div style={{ background: '#0e1a2b', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 16 }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Unpublish Listing</span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            This will remove the listing from Property Finder immediately. Are you sure?
          </p>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listing.title || listing.reference_number}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>
              Ref: {listing.pf_listing_id}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleUnpublish}
              disabled={loading}
              style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(248,113,113,0.15)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}
            >
              {loading
                ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                : <EyeOff style={{ width: 13, height: 13 }} />}
              {loading ? 'Unpublishing…' : 'Yes, Unpublish'}
            </button>
          </div>
        </div>
      </div>
    </PortalModal>
  );
}

// ── Email compose dialog ───────────────────────────────────────────────────
function EmailDialog({ listing, onClose }) {
  const formatPrice = (p) => {
    if (!p) return 'POA';
    if (p >= 1_000_000) return `AED ${(p / 1_000_000).toFixed(2)}M`;
    if (p >= 1_000) return `AED ${(p / 1_000).toFixed(0)}K`;
    return `AED ${p.toLocaleString()}`;
  };

  const beds = listing.bedrooms === 0 ? 'Studio' : (listing.bedrooms ? `${listing.bedrooms} BR` : '—');
  const defaultBody = [
    `Please find the listing details below:`,
    ``,
    `Title: ${listing.title || '—'}`,
    `Reference: ${listing.reference_number || listing.pf_listing_id || '—'}`,
    `Price: ${formatPrice(listing.price)}`,
    `Type: ${(listing.listing_type || '').toUpperCase()} | ${beds} | ${listing.bathrooms || '—'} Bath | ${listing.area_sqft ? `${listing.area_sqft.toLocaleString()} sqft` : '—'}`,
    `Location: ${listing.location || '—'}${listing.building_name ? ', ' + listing.building_name : ''}`,
    listing.permit_number ? `Permit: ${listing.permit_number}` : null,
    listing.pf_url ? `\nView on Property Finder:\n${listing.pf_url}` : null,
    ``,
    `Best regards,\nErudite Real Estate`,
  ].filter(l => l !== null).join('\n');

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(`Property Listing: ${listing.title || listing.reference_number}`);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Recipient email required'); return; }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: to.trim(), subject, body });
      setSent(true);
      toast.success(`Email sent to ${to.trim()}`);
      setTimeout(onClose, 1200);
    } catch (err) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <PortalModal onClose={onClose}>
      <div style={{ background: '#0e1a2b', border: `1px solid rgba(201,168,92,0.25)`, borderRadius: 16, display: 'flex', flexDirection: 'column', maxHeight: '90vh', maxWidth: 520, width: '100%' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail style={{ width: 15, height: 15, color: GOLD }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Email Listing</span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
          {listing.images?.[0] && (
            <div style={{ background: 'rgba(201,168,92,0.07)', border: `1px solid rgba(201,168,92,0.18)`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={listing.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title || listing.reference_number}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: GOLD }}>{formatPrice(listing.price)} · {beds}</p>
              </div>
            </div>
          )}

          {[{ label: 'To', val: to, set: setTo, placeholder: 'recipient@example.com' }, { label: 'Subject', val: subject, set: setSubject, placeholder: '' }].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={9}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || sent}
            style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${sent ? 'rgba(63,207,142,0.4)' : 'rgba(201,168,92,0.4)'}`, background: sent ? 'rgba(63,207,142,0.15)' : 'rgba(201,168,92,0.15)', color: sent ? '#3fcf8e' : GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {sending ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : sent ? <Check style={{ width: 13, height: 13 }} /> : <Send style={{ width: 13, height: 13 }} />}
            {sending ? 'Sending…' : sent ? 'Sent!' : 'Send Email'}
          </button>
        </div>
      </div>
    </PortalModal>
  );
}

// ── Exported action buttons component ──────────────────────────────────────
export default function PFListingActions({ listing, onRefresh, onEdit }) {
  const [showEmail, setShowEmail] = useState(false);
  const [showUnpublish, setShowUnpublish] = useState(false);
  const isLive = listing.status === 'active';

  return (
    <>
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit?.(listing)} title="Edit listing"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ border: `1px solid rgba(201,168,92,0.35)`, color: GOLD, background: 'transparent' }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>

        <button onClick={() => setShowEmail(true)} title="Email listing"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
          <Mail className="w-3.5 h-3.5" />
        </button>

        {isLive && (
          <button onClick={() => setShowUnpublish(true)} title="Unpublish from Property Finder"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
            style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', background: 'transparent' }}>
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Portals — mounted at document.body, escape card's overflow:hidden + transform context */}
      {showEmail && <EmailDialog listing={listing} onClose={() => setShowEmail(false)} />}
      {showUnpublish && (
        <UnpublishDialog listing={listing} onClose={() => setShowUnpublish(false)} onSuccess={onRefresh} />
      )}
    </>
  );
}