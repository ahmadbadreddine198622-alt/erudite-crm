import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail, EyeOff, Eye, Loader2, X, AlertTriangle, Send, Check, Pencil,
  RefreshCw, Star, StarOff, ShieldCheck, Trash2, ExternalLink, MoreHorizontal, ChevronRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WritingField from '@/components/shared/WritingField';

const GOLD = '#c9a85c';
const RED = '#f87171';
const GREEN = '#3fcf8e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

// ── Portal backdrop ────────────────────────────────────────────────────────
function PortalModal({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── Generic confirm dialog ─────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, confirmColor = RED, icon: Icon = AlertTriangle, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };
  return (
    <PortalModal onClose={onClose}>
      <div style={{ background: '#0e1a2b', border: `1px solid ${confirmColor}55`, borderRadius: 16 }}>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon style={{ width: 16, height: 16, color: confirmColor, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{message}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={loading} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handle} disabled={loading} style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${confirmColor}66`, background: `${confirmColor}22`, color: confirmColor, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Icon style={{ width: 13, height: 13 }} />}
              {loading ? 'Working…' : confirmLabel}
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
    } finally { setSending(false); }
  };

  return (
    <PortalModal onClose={onClose}>
      <div style={{ background: '#0e1a2b', border: `1px solid rgba(201,168,92,0.25)`, borderRadius: 16, display: 'flex', flexDirection: 'column', maxHeight: '90vh', maxWidth: 520, width: '100%' }}>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail style={{ width: 15, height: 15, color: GOLD }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Email Listing</span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
          {[{ label: 'To', val: to, set: setTo, placeholder: 'recipient@example.com' }, { label: 'Subject', val: subject, set: setSubject, placeholder: '' }].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Message</label>
            <WritingField value={body} onChange={e => setBody(e.target.value)} rows={9}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.9)', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSend} disabled={sending || sent}
            style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${sent ? 'rgba(63,207,142,0.4)' : 'rgba(201,168,92,0.4)'}`, background: sent ? 'rgba(63,207,142,0.15)' : 'rgba(201,168,92,0.15)', color: sent ? GREEN : GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {sending ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : sent ? <Check style={{ width: 13, height: 13 }} /> : <Send style={{ width: 13, height: 13 }} />}
            {sending ? 'Sending…' : sent ? 'Sent!' : 'Send Email'}
          </button>
        </div>
      </div>
    </PortalModal>
  );
}

// ── Actions dropdown menu ──────────────────────────────────────────────────
function ActionsMenu({ items, onClose }) {
  return createPortal(
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99998 }}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 99999,
        background: '#0e1a2b',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        padding: '6px',
        minWidth: 210,
        boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        // Position set by parent
        ...items._menuPos,
      }}>
        {items.groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />}
            {group.label && <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', margin: '4px 8px 2px' }}>{group.label}</p>}
            {group.items.map((item, i) => (
              <button key={i} onClick={() => { onClose(); item.onClick(); }}
                disabled={item.disabled}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: item.disabled ? 'not-allowed' : 'pointer', color: item.danger ? RED : item.color || 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'left', opacity: item.disabled ? 0.4 : 1, transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <item.icon style={{ width: 14, height: 14, flexShrink: 0, color: item.danger ? RED : item.color || 'rgba(255,255,255,0.5)' }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: item.badge === 'LIVE' ? 'rgba(63,207,142,0.2)' : 'rgba(255,255,255,0.08)', color: item.badge === 'LIVE' ? GREEN : 'rgba(255,255,255,0.4)' }}>{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── Main exported component ────────────────────────────────────────────────
export default function PFListingActions({ listing, onRefresh, onEdit }) {
  const [showEmail, setShowEmail] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [activeDialog, setActiveDialog] = useState(null); // 'unpublish' | 'publish' | 'feature' | 'unfeature' | 'verify' | 'refresh' | 'delete'
  const [loading, setLoading] = useState(false);

  const isLive = listing.status === 'active' || listing.status === 'publishing';
  const isFeatured = listing.featured;
  const isVerified = listing.verified;
  const hasPFId = !!(listing.pf_listing_id && !listing.pf_listing_id.startsWith('draft-'));

  const invokeAction = async (action, successMsg, newStatusOverride) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('pfListingAction', {
        action,
        pfListingId: listing.pf_listing_id,
        crmId: listing.id,
      });
      if (res.data?.ok) {
        toast.success(successMsg);
        onRefresh?.();
      } else {
        toast.error(res.data?.error || `Action "${action}" failed`);
      }
    } catch (err) {
      toast.error(err.message || `Action "${action}" failed`);
    } finally {
      setLoading(false);
      setActiveDialog(null);
    }
  };

  const openMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  const menuGroups = [
    {
      label: 'Portal',
      items: [
        {
          icon: Eye,
          label: 'Publish to Portal',
          color: GREEN,
          disabled: !hasPFId || isLive,
          badge: isLive ? 'LIVE' : null,
          onClick: () => setActiveDialog('publish'),
        },
        {
          icon: EyeOff,
          label: 'Unpublish / Take Down',
          color: RED,
          disabled: !hasPFId || !isLive,
          onClick: () => setActiveDialog('unpublish'),
        },
        {
          icon: RefreshCw,
          label: 'Sync from PF Portal',
          color: BLUE,
          disabled: !hasPFId,
          onClick: () => setActiveDialog('refresh'),
        },
      ],
    },
    {
      label: 'Boost',
      items: [
        {
          icon: isFeatured ? StarOff : Star,
          label: isFeatured ? 'Remove Featured' : 'Mark as Featured',
          color: GOLD,
          disabled: !hasPFId,
          onClick: () => setActiveDialog(isFeatured ? 'unfeature' : 'feature'),
        },
        {
          icon: ShieldCheck,
          label: 'Mark as Verified',
          color: PURPLE,
          disabled: !hasPFId || isVerified,
          badge: isVerified ? '✓' : null,
          onClick: () => setActiveDialog('verify'),
        },
      ],
    },
    {
      label: 'Share',
      items: [
        {
          icon: Pencil,
          label: 'Edit Listing',
          onClick: () => onEdit?.(listing),
        },
        {
          icon: Mail,
          label: 'Email Listing',
          onClick: () => setShowEmail(true),
        },
        ...(listing.pf_url ? [{
          icon: ExternalLink,
          label: 'View on Property Finder',
          onClick: () => window.open(listing.pf_url, '_blank'),
        }] : []),
      ],
    },
    {
      label: 'Danger',
      items: [
        {
          icon: Trash2,
          label: 'Delete from CRM',
          danger: true,
          onClick: () => setActiveDialog('delete'),
        },
      ],
    },
  ];

  const dialogConfigs = {
    unpublish: {
      title: 'Unpublish Listing',
      message: 'This will remove the listing from Property Finder immediately. The CRM record will be kept but marked inactive.',
      confirmLabel: 'Yes, Unpublish',
      confirmColor: RED,
      icon: EyeOff,
      onConfirm: () => invokeAction('unpublish', 'Listing unpublished from Property Finder'),
    },
    publish: {
      title: 'Publish Listing',
      message: 'This will make the listing live on Property Finder. It may take a few minutes to appear.',
      confirmLabel: 'Yes, Publish',
      confirmColor: GREEN,
      icon: Eye,
      onConfirm: () => invokeAction('publish', 'Publish request sent to Property Finder'),
    },
    feature: {
      title: 'Mark as Featured',
      message: 'This will mark the listing as Featured on Property Finder, giving it higher visibility.',
      confirmLabel: 'Mark Featured',
      confirmColor: GOLD,
      icon: Star,
      onConfirm: () => invokeAction('feature', 'Listing marked as Featured'),
    },
    unfeature: {
      title: 'Remove Featured Status',
      message: 'This will remove the Featured flag from this listing on Property Finder.',
      confirmLabel: 'Remove Featured',
      confirmColor: GOLD,
      icon: StarOff,
      onConfirm: () => invokeAction('unfeature', 'Featured status removed'),
    },
    verify: {
      title: 'Mark as Verified',
      message: 'This will mark the listing as Verified on Property Finder.',
      confirmLabel: 'Mark Verified',
      confirmColor: PURPLE,
      icon: ShieldCheck,
      onConfirm: () => invokeAction('verify', 'Listing marked as Verified'),
    },
    refresh: {
      title: 'Sync from Property Finder',
      message: 'This will pull the latest status, images, and data for this listing from Property Finder and update the CRM record.',
      confirmLabel: 'Sync Now',
      confirmColor: BLUE,
      icon: RefreshCw,
      onConfirm: () => invokeAction('refresh_crm', 'Listing synced from Property Finder'),
    },
    delete: {
      title: 'Delete from CRM',
      message: 'This will permanently delete this listing from your CRM. The listing on Property Finder will NOT be affected.',
      confirmLabel: 'Delete from CRM',
      confirmColor: RED,
      icon: Trash2,
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await base44.functions.invoke('pfListingAction', { action: 'delete_crm', crmId: listing.id });
          if (res.data?.ok) { toast.success('Listing deleted from CRM'); onRefresh?.(); }
          else toast.error(res.data?.error || 'Delete failed');
        } catch (err) {
          toast.error(err.message || 'Delete failed');
        } finally { setLoading(false); setActiveDialog(null); }
      },
    },
  };

  const activeCfg = activeDialog ? dialogConfigs[activeDialog] : null;

  return (
    <>
      {/* Quick action buttons always visible */}
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={(e) => { e.stopPropagation(); onEdit?.(listing); }} title="Edit listing"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ border: `1px solid rgba(201,168,92,0.35)`, color: GOLD, background: 'transparent' }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {isLive ? (
          <button onClick={(e) => { e.stopPropagation(); setActiveDialog('unpublish'); }} title="Unpublish from Property Finder"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
            style={{ border: '1px solid rgba(248,113,113,0.3)', color: RED, background: 'transparent' }}>
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); setActiveDialog('publish'); }} title="Publish to Property Finder"
            disabled={!hasPFId}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
            style={{ border: `1px solid rgba(63,207,142,${hasPFId ? '0.35' : '0.15'})`, color: hasPFId ? GREEN : 'rgba(255,255,255,0.2)', background: 'transparent', cursor: hasPFId ? 'pointer' : 'not-allowed' }}>
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}

        {/* More actions dropdown */}
        <button onClick={openMenu} title="More actions"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <ActionsMenu
          items={{ groups: menuGroups, _menuPos: { top: menuPos.top, right: menuPos.right } }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Confirm dialogs */}
      {activeCfg && (
        <ConfirmDialog
          title={activeCfg.title}
          message={activeCfg.message}
          confirmLabel={activeCfg.confirmLabel}
          confirmColor={activeCfg.confirmColor}
          icon={activeCfg.icon}
          onClose={() => setActiveDialog(null)}
          onConfirm={activeCfg.onConfirm}
        />
      )}

      {/* Email dialog */}
      {showEmail && <EmailDialog listing={listing} onClose={() => setShowEmail(false)} />}
    </>
  );
}