import { useState } from 'react';
import { Mail, EyeOff, Loader2, X, AlertTriangle, Send, Check, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOLD = '#c9a85c';

// ── Unpublish confirmation dialog ──────────────────────────────────────────
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
        onClose();
        onSuccess();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0e1a2b', border: '1px solid rgba(248,113,113,0.3)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="font-semibold text-sm text-white">Unpublish Listing</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition">
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            This will remove the listing from Property Finder immediately.
          </p>
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-semibold truncate text-white/80">{listing.title || listing.reference_number}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Ref: {listing.pf_listing_id}</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 h-9 rounded-xl text-xs font-medium transition"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              Cancel
            </button>
            <button onClick={handleUnpublish} disabled={loading}
              className="flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
              {loading ? 'Unpublishing…' : 'Yes, Unpublish'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
      await base44.integrations.Core.SendEmail({
        to: to.trim(),
        subject,
        body,
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0e1a2b', border: `1px solid rgba(201,168,92,0.25)`, maxHeight: '90vh' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" style={{ color: GOLD }} />
            <span className="font-semibold text-sm text-white">Email Listing</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition">
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          {/* Listing pill */}
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: 'rgba(201,168,92,0.07)', border: `1px solid rgba(201,168,92,0.18)` }}>
            {listing.images?.[0] && (
              <img src={listing.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate text-white/85">{listing.title || listing.reference_number}</p>
              <p className="text-[10px]" style={{ color: GOLD }}>{formatPrice(listing.price)} · {beds}</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>To</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com"
              className="w-full h-9 px-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: GOLD }} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full h-9 px-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: GOLD }} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: GOLD }} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onClose} className="flex-1 h-9 rounded-xl text-xs font-medium transition"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || sent}
            className="flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
            style={{ background: sent ? 'rgba(63,207,142,0.15)' : `rgba(201,168,92,0.15)`, border: `1px solid ${sent ? 'rgba(63,207,142,0.4)' : 'rgba(201,168,92,0.4)'}`, color: sent ? '#3fcf8e' : GOLD }}>
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : sent ? 'Sent!' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
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
        {/* Edit */}
        <button
          onClick={() => onEdit?.(listing)}
          title="Edit listing"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ border: `1px solid rgba(201,168,92,0.35)`, color: GOLD, background: 'transparent' }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Email */}
        <button
          onClick={() => setShowEmail(true)}
          title="Email listing"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}
        >
          <Mail className="w-3.5 h-3.5" />
        </button>

        {/* Unpublish — only shown for live listings */}
        {isLive && (
          <button
            onClick={() => setShowUnpublish(true)}
            title="Unpublish from Property Finder"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
            style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', background: 'transparent' }}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showEmail && <EmailDialog listing={listing} onClose={() => setShowEmail(false)} />}
      {showUnpublish && (
        <UnpublishDialog
          listing={listing}
          onClose={() => setShowUnpublish(false)}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}