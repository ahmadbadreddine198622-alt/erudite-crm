import { useState } from 'react';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Mail, MessageCircle, Trash2, Link2, ExternalLink, Pencil, Check, X, CheckSquare, Square } from 'lucide-react';
import { Link } from 'react-router-dom';

// Emails excluded from the sales-agent dropdown (photographer, bots, etc.)
const NON_SALES_EMAILS = new Set([
  'dari@erudite-estate.com',
  'letsbulidaiagent@gmail.com',
  'info@erudite-estate.com',
]);

// ── Agent colors ──────────────────────────────────────────────────────────────
const AGENT_NAMES = {
  'ahmad@erudite-estate.com': 'Ahmad',
  'dari@erudite-estate.com':  'Dari',
  'tuiara@erudite-estate.com':'Tuiara',
  'malik@erudite-estate.com': 'Malik',
};
const AGENT_TINT = {
  'ahmad@erudite-estate.com': 'rgba(59,130,246,0.07)',
  'dari@erudite-estate.com':  'rgba(16,185,129,0.07)',
  'tuiara@erudite-estate.com':'rgba(139,92,246,0.07)',
  'malik@erudite-estate.com': 'rgba(245,158,11,0.07)',
};
const AGENT_BADGE = {
  'ahmad@erudite-estate.com': { bg:'rgba(59,130,246,0.18)',  color:'#93c5fd', border:'rgba(59,130,246,0.35)' },
  'dari@erudite-estate.com':  { bg:'rgba(16,185,129,0.18)',  color:'#6ee7b7', border:'rgba(16,185,129,0.35)' },
  'tuiara@erudite-estate.com':{ bg:'rgba(139,92,246,0.18)',  color:'#c4b5fd', border:'rgba(139,92,246,0.35)' },
  'malik@erudite-estate.com': { bg:'rgba(244,63,94,0.18)',   color:'#fda4af', border:'rgba(244,63,94,0.35)' },
};
const HASH_PAL = [
  { bg:'rgba(6,182,212,0.18)',  color:'#67e8f9', border:'rgba(6,182,212,0.35)' },
  { bg:'rgba(249,115,22,0.18)', color:'#fdba74', border:'rgba(249,115,22,0.35)' },
  { bg:'rgba(168,85,247,0.18)', color:'#d8b4fe', border:'rgba(168,85,247,0.35)' },
  { bg:'rgba(236,72,153,0.18)', color:'#f9a8d4', border:'rgba(236,72,153,0.35)' },
  { bg:'rgba(20,184,166,0.18)', color:'#5eead4', border:'rgba(20,184,166,0.35)' },
];
function hashEmail(e) { let h=0; for(let i=0;i<e.length;i++) h=(h*31+e.charCodeAt(i))>>>0; return h; }
function badgeStyle(email) {
  if (!email) return { bg:'rgba(148,163,184,0.12)', color:'rgba(255,255,255,0.4)', border:'rgba(148,163,184,0.2)' };
  return AGENT_BADGE[email] || HASH_PAL[hashEmail(email) % HASH_PAL.length];
}
function agentLabel(email) { return AGENT_NAMES[email] || email?.split('@')[0] || 'Unassigned'; }

// ── Stage enums (exact Lead schema values) ─────────────────────────────────
const BUYER_STAGES = [
  { value:'intake_clarify',          label:'Intake / Clarify' },
  { value:'contact_identity',        label:'Contact Identity' },
  { value:'financial_qualification', label:'Financial Qualification' },
  { value:'intent_lock',             label:'Intent Lock' },
  { value:'unit_matching',           label:'Unit Matching' },
  { value:'viewing',                 label:'Viewing' },
  { value:'objection_offer',         label:'Objection / Offer' },
  { value:'negotiation_deal_lock',   label:'Negotiation / Deal Lock' },
  { value:'closing_dld',             label:'Closing / DLD' },
  { value:'closed',                  label:'Closed' },
];
const TENANT_STAGES = [
  { value:'new_tenant_lead',  label:'New Tenant Lead' },
  { value:'qualified_tenant', label:'Qualified Tenant' },
  { value:'viewing_decision', label:'Viewing / Decision' },
  { value:'contract_cheques', label:'Contract / Cheques' },
  { value:'ejari_movein',     label:'Ejari / Move-in' },
];

// ── Inline editable field ─────────────────────────────────────────────────────
function InlineField({ label, value, onSave, placeholder = '—', dim = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const start = () => { setDraft(value || ''); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = () => { if (draft !== value) onSave(draft); setEditing(false); };
  const onKey = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); };

  if (editing) {
    return (
      <div className="flex items-center gap-1 w-full">
        <Input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={onKey}
          className="h-6 text-xs px-2 flex-1 bg-white/8 border-white/20"
          placeholder={placeholder}
        />
        <button onMouseDown={save} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
        <button onMouseDown={cancel} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      className="group flex items-center gap-1 text-left w-full min-h-[22px]"
      title={`Edit ${label}`}
    >
      <span className={`text-xs truncate ${dim || !value ? 'text-muted-foreground italic' : 'text-white/80'}`}>
        {value || placeholder}
      </span>
      <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
    </button>
  );
}

// ── Landlord picker ───────────────────────────────────────────────────────────
function LandlordPicker({ lead, landlords, onLink }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    if (!lq) return landlords.slice(0, 20);
    return landlords.filter(l =>
      l.full_name_en?.toLowerCase().includes(lq) ||
      l.unit_reference?.toLowerCase().includes(lq) ||
      l.project_name?.toLowerCase().includes(lq)
    ).slice(0, 20);
  }, [landlords, q]);

  const linked = lead.landlord_id ? landlords.find(l => l.id === lead.landlord_id) : null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={linked ? `Linked: ${linked.full_name_en}` : 'Link to landlord/listing'}
        className="h-7 px-2 rounded-lg flex items-center gap-1 text-xs transition-all hover:scale-105"
        style={linked
          ? { background:'rgba(16,185,129,0.18)', border:'1px solid rgba(16,185,129,0.35)', color:'#6ee7b7' }
          : { background:'rgba(148,163,184,0.1)',  border:'1px solid rgba(148,163,184,0.2)',  color:'rgba(255,255,255,0.5)' }
        }
      >
        <Link2 className="w-3 h-3" />
        {linked ? (linked.unit_reference || linked.full_name_en?.split(' ')[0]) : 'Link'}
      </button>
    );
  }

  return (
    <div className="relative" style={{ zIndex: 50 }}>
      <div
        className="absolute bottom-8 left-0 w-64 rounded-xl p-2 space-y-1.5 shadow-2xl"
        style={{ background:'rgba(15,20,35,0.98)', border:'1px solid rgba(255,255,255,0.15)' }}
      >
        <Input
          autoFocus
          placeholder="Search landlord / unit…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="h-7 text-xs bg-white/5 border-white/10"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {linked && (
            <button
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-red-500/10 text-rose-400"
              onClick={() => { onLink(lead.id, null, null); setOpen(false); setQ(''); }}
            >✕ Remove link</button>
          )}
          {filtered.map(l => (
            <button
              key={l.id}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors"
              style={{ color:'rgba(255,255,255,0.85)' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
              onClick={() => { onLink(lead.id, l.id, l.unit_reference || ''); setOpen(false); setQ(''); }}
            >
              <span className="font-medium">{l.full_name_en}</span>
              {l.unit_reference && <span className="text-muted-foreground ml-1">· {l.unit_reference}</span>}
              {l.project_name && <span className="text-muted-foreground ml-1">· {l.project_name}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No results</p>}
        </div>
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground py-0.5"
          onClick={() => { setOpen(false); setQ(''); }}
        >Cancel</button>
      </div>
    </div>
  );
}

// ── Listing ref link ──────────────────────────────────────────────────────────
function ListingRefLink({ listingRef, pfUrl }) {
  if (!listingRef) return <span className="text-xs text-muted-foreground italic">No ref</span>;

  const href = pfUrl || `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(listingRef)}`;
  const isVerified = !!pfUrl;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={isVerified ? 'Open on Property Finder' : 'Search on Property Finder (unverified)'}
      className="flex items-center gap-1 min-w-0 group"
    >
      <span className={`text-xs truncate font-mono ${isVerified ? 'text-sky-400 group-hover:text-sky-300' : 'text-muted-foreground group-hover:text-white/60'}`}>
        {listingRef}
      </span>
      <ExternalLink className={`w-2.5 h-2.5 shrink-0 ${isVerified ? 'text-sky-400/60' : 'text-muted-foreground/50'}`} />
      {!isVerified && <span className="text-[9px] text-amber-500/70 shrink-0">~</span>}
    </a>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export { NON_SALES_EMAILS };
export default function PFLeadCard({ lead, landlords, agents = [], waConversationId, selected, onToggleSelect, onUpdate, onDelete, onLandlordLink }) {
  const anonymous = lead.full_name === 'Ahmad Erudite Property';
  const respondLink = lead.notes?.match(/respond:(\S+)/)?.[1] || null;
  const bs = badgeStyle(lead.assigned_agent_email);
  const bg = AGENT_TINT[lead.assigned_agent_email] || 'rgba(255,255,255,0.06)';
  const border = anonymous ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.1)';

  const save = (field) => (value) => onUpdate(lead.id, { [field]: value });

  return (
    <Card className="glass-card p-2.5 space-y-2" style={{ background: bg, border }}>

      {/* Row 1 — checkbox + name + agent badge */}
      <div className="flex items-center gap-2">
        {/* Checkbox — dedicated tap target, no overlap */}
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect(); }}
          className="w-5 h-5 flex items-center justify-center rounded shrink-0 transition-colors"
          style={{ background: selected ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.35)', border: selected ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.18)' }}
          title={selected ? 'Deselect' : 'Select'}
        >
          {selected
            ? <CheckSquare className="w-3 h-3 text-amber-400" />
            : <Square className="w-3 h-3 text-white/40" />}
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
          {anonymous ? (
            <div className="font-semibold text-rose-400 italic text-xs">Anonymous buyer</div>
          ) : (
            <InlineField label="Name" value={lead.full_name} onSave={save('full_name')} placeholder="Unknown" />
          )}
        </div>

        {/* Agent badge */}
        <span
          className="whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background:bs.bg, color:bs.color, border:`1px solid ${bs.border}` }}
        >
          {agentLabel(lead.assigned_agent_email)}
        </span>
      </div>

      {/* Row 2 — inline editable fields */}
      <div className="space-y-1 rounded-md px-2 py-1.5" style={{ background:'rgba(0,0,0,0.15)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12 shrink-0 uppercase tracking-wide">Phone</span>
          <div className="flex-1 min-w-0">
            <InlineField label="Phone" value={lead.phone} onSave={save('phone')} placeholder="No phone" />
          </div>
          {waConversationId && (
            <Link
              to={`/whatsapp?conversation=${waConversationId}`}
              title="Open WhatsApp conversation"
              onClick={e => e.stopPropagation()}
              className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all hover:scale-105"
              style={{ background:'rgba(37,211,102,0.18)', border:'1px solid rgba(37,211,102,0.4)', color:'#4ade80' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              WA
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12 shrink-0 uppercase tracking-wide">Email</span>
          <div className="flex-1 min-w-0">
            <InlineField label="Email" value={lead.email} onSave={save('email')} placeholder="No email" dim />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12 shrink-0 uppercase tracking-wide">Listing</span>
          <div className="flex-1 min-w-0 overflow-hidden">
            <ListingRefLink listingRef={lead.closing_property_ref} pfUrl={lead.pf_url} />
          </div>
        </div>
      </div>

      {/* Row 3 — notes preview (compact) */}
      {lead.notes && (
        <p className="text-[11px] text-muted-foreground line-clamp-1 px-0.5">{lead.notes}</p>
      )}

      {/* Row 4 — agent + stage dropdowns */}
      <div className="flex gap-1.5 flex-wrap">
        <Select
          value={lead.assigned_agent_email || ''}
          onValueChange={email => onUpdate(lead.id, { assigned_agent_email: email })}
        >
          <SelectTrigger className="h-6 text-xs w-24 bg-white/5 border-white/10">
            <SelectValue placeholder="Agent…" />
          </SelectTrigger>
          <SelectContent>
            {agents.map(u => (
              <SelectItem key={u.email} value={u.email}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={lead.stage || ''}
          onValueChange={stage => onUpdate(lead.id, { stage })}
        >
          <SelectTrigger className="h-6 text-xs flex-1 min-w-[110px] bg-white/5 border-white/10">
            <SelectValue placeholder="Stage…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_b" disabled className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold opacity-60">── Buyer ──</SelectItem>
            {BUYER_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            <SelectItem value="_t" disabled className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold opacity-60">── Tenant ──</SelectItem>
            {TENANT_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Row 5 — action buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        {lead.phone && (
          <a
            href={`https://wa.me/${lead.phone.replace(/\D/g,'')}`}
            target="_blank" rel="noopener noreferrer"
            title="WhatsApp"
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:scale-110"
            style={{ background:'rgba(37,211,102,0.18)', border:'1px solid rgba(37,211,102,0.35)' }}
          >
            <MessageCircle className="w-3 h-3" style={{ color:'#25D166' }} />
          </a>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            title="Call"
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:scale-110"
            style={{ background:'rgba(59,130,246,0.18)', border:'1px solid rgba(59,130,246,0.35)' }}
          >
            <Phone className="w-3 h-3" style={{ color:'#60a5fa' }} />
          </a>
        )}
        {lead.email ? (
          <a
            href={`mailto:${lead.email}`}
            title="Email"
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:scale-110"
            style={{ background:'rgba(168,85,247,0.18)', border:'1px solid rgba(168,85,247,0.35)' }}
          >
            <Mail className="w-3 h-3" style={{ color:'#c084fc' }} />
          </a>
        ) : (
          <span
            title="No email"
            className="w-6 h-6 rounded-md flex items-center justify-center opacity-25 cursor-not-allowed"
            style={{ background:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.2)' }}
          >
            <Mail className="w-3 h-3 text-muted-foreground" />
          </span>
        )}

        <LandlordPicker lead={lead} landlords={landlords} onLink={onLandlordLink} />

        {anonymous && respondLink && (
          <a href={respondLink} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2">
              PF <ExternalLink className="w-2.5 h-2.5" />
            </Button>
          </a>
        )}

        <button
          onClick={() => { if (confirm('Delete this lead?')) onDelete(lead.id); }}
          title="Delete lead"
          className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:scale-110 ml-auto"
          style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)' }}
        >
          <Trash2 className="w-3 h-3" style={{ color:'#f87171' }} />
        </button>
      </div>

    </Card>
  );
}