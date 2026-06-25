// Right sidebar: Red Flags → Buying Signals → Property & Media → Mandate & Pipeline →
// Channels → Documents → People → AI Meta. Read-only consume of existing fields.
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Chip, KV, Label, EmptyLine, GOLD, fmtAEDFull, fmtDate, relativeTime, titleize } from './ccPrimitives';

function ViewLink({ url, label = 'View' }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );
}

function availChip(state) {
  if (state === 'available') return { label: 'Available', color: '#34d399', bg: 'rgba(16,185,129,0.14)' };
  if (state === 'not') return { label: 'Not available', color: 'rgba(255,255,255,0.5)', bg: 'rgba(148,163,184,0.12)' };
  return { label: 'Unknown', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' };
}

function ChannelRow({ name, state, detail, action, onAction }) {
  const c = availChip(state);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{name}</div>
        {detail && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 1, wordBreak: 'break-all' }}>{detail}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
        {action && <button onClick={onAction} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Montserrat,sans-serif' }}>{action}</button>}
        <Chip label={c.label} color={c.color} bg={c.bg} border={c.bg} style={{ fontSize: 9.5, padding: '2px 7px' }} />
      </div>
    </div>
  );
}

export default function CCRightSidebar({ vm, actions }) {
  const p = vm.property || {};
  const m = vm.mandate || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* RED FLAGS — top, never hidden */}
      <Card icon="⚑" title="Red Flags" accent="#f87171" count={vm.redFlags?.length || 0}>
        {vm.redFlags && vm.redFlags.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {vm.redFlags.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>
                <span style={{ flex: 'none' }}>⚑</span>{titleize(f)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: '#34d399', fontWeight: 600 }}>✓ No red flags.</div>
        )}
      </Card>

      {/* BUYING SIGNALS */}
      {Array.isArray(vm.buyingSignals) && vm.buyingSignals.length > 0 && (
        <Card icon="✓" title="Buying Signals" accent="#34d399" count={vm.buyingSignals.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {vm.buyingSignals.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6ee7b7', lineHeight: 1.4 }}>
                <span style={{ flex: 'none' }}>✓</span>{titleize(b)}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PROPERTY & MEDIA */}
      <Card icon="🏠" title="Property & Media" accent="#3B5C8A">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KV label="Unit" value={p.unitReference} />
          <KV label="Project" value={p.projectName} />
          <KV label="Beds" value={p.bedsLabel} />
          <KV label="Size" value={p.sqft != null ? `${p.sqft} sqft` : '—'} />
          <KV label="Asking" value={p.askingPrice != null ? fmtAEDFull(p.askingPrice) : '—'} accent={GOLD} />
          <KV label="Reserve" value={p.reservePrice != null ? fmtAEDFull(p.reservePrice) : '—'} />
          <KV label="Days on market" value={p.daysOnMarket != null ? `${p.daysOnMarket}d` : '—'} />
        </div>

        {Array.isArray(p.priceHistory) && p.priceHistory.length > 0 && (
          <div style={{ marginTop: 11, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Label>Price history</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 5 }}>
              {p.priceHistory.map((h, i) => {
                const conflict = p.askingPrice != null && h.price != null && Math.abs(h.price - p.askingPrice) / Math.max(p.askingPrice, 1) > 0.1;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>
                    <span>{fmtDate(h.date)}{h.change_reason ? ` · ${h.change_reason}` : ''}</span>
                    <span style={{ color: conflict ? '#fbbf24' : 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{fmtAEDFull(h.price)}{conflict ? ' ⚠' : ''}</span>
                  </div>
                );
              })}
            </div>
            {p.priceConflict && <div style={{ fontSize: 10.5, color: '#fbbf24', marginTop: 5 }}>⚠ Price conflict — confirm with landlord.</div>}
          </div>
        )}

        {Array.isArray(p.mediaChips) && p.mediaChips.length > 0 && (
          <div style={{ marginTop: 11, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Label>Media</Label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {p.mediaChips.map((c, i) => (
                <Chip key={i} label={c.label} color={c.done ? '#34d399' : 'rgba(255,255,255,0.5)'} bg={c.done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'} border={c.done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'} icon={c.done ? '✓' : '○'} style={{ fontSize: 10 }} />
              ))}
            </div>
          </div>
        )}
        {Array.isArray(p.listingUrls) && p.listingUrls.length > 0 && (
          <div style={{ marginTop: 9, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.listingUrls.map((u, i) => <ViewLink key={i} url={u} label={`Live listing ${p.listingUrls.length > 1 ? i + 1 : ''}`} />)}
          </div>
        )}
      </Card>

      {/* MANDATE & PIPELINE */}
      <Card icon="📄" title="Mandate & Pipeline" accent={GOLD}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KV label="Stage" value={m.stageLabel} />
          <KV label="Days in stage" value={m.daysInStage != null ? `${Math.round(m.daysInStage)}d` : '—'} />
          {m.subStage && <KV label="Sub-stage" value={titleize(m.subStage)} />}
          <KV label="Mandate type" value={m.type} />
          <KV label="Status" value={m.statusLabel} accent={m.statusLabel === 'Signed' ? '#34d399' : undefined} />
          <KV label="Commission" value={m.commissionPct != null ? `${m.commissionPct}%` : '—'} accent={GOLD} />
          <KV label="Start" value={m.startDate} />
          <KV label="Expires" value={m.expiryCountdown || m.expiryDate} accent={m.expirySoon ? '#fbbf24' : undefined} />
        </div>
        {(m.formAContractNumber || (m.formAContracts && m.formAContracts.length > 0)) && (
          <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Label>Form A</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 5 }}>
              {(m.formAContracts && m.formAContracts.length > 0 ? m.formAContracts : [{ contract_number: m.formAContractNumber, pdf_url: m.formAPdfUrl }]).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{c.contract_number || '—'}</span>
                  <ViewLink url={c.pdf_url} label="View PDF" />
                </div>
              ))}
            </div>
          </div>
        )}
        {m.leaseStatus && (
          <div style={{ marginTop: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>Lease: {titleize(m.leaseStatus)}</span>
            <ViewLink url={m.leasePdfUrl} label="View PDF" />
          </div>
        )}
        {(m.competingBrokers != null || m.priorBrokerages != null || m.listedElsewhere) && (
          <div style={{ marginTop: 9, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {m.listedElsewhere ? 'Listed with other brokers · ' : ''}{m.competingBrokers != null ? `${m.competingBrokers} competing · ` : ''}{m.priorBrokerages != null ? `${m.priorBrokerages} prior` : ''}
          </div>
        )}
      </Card>

      {/* CHANNELS */}
      <Card icon="📡" title="Channels" accent="#3B5C8A">
        <ChannelRow name="WhatsApp" state={vm.channels?.whatsapp} detail={vm.whatsapp || vm.phone} />
        <ChannelRow name="iMessage" state={vm.channels?.imessage} detail={vm.imessageHandle ? `${vm.imessageHandle} · checked ${relativeTime(vm.imessageCheckedAt)}` : 'No handle'} action="Resolve" onAction={actions.onResolveIMessage} />
        <ChannelRow name="Telegram" state={vm.channels?.telegram} detail={vm.telegramChatId ? `${vm.telegramUsername || 'Connected'}` : 'Not connected'} />
        <ChannelRow name="SMS" state={vm.channels?.sms} detail={vm.phone} />
        <ChannelRow name="Email" state={vm.channels?.email} detail={vm.email} />
        {Array.isArray(vm.imessageHandles) && vm.imessageHandles.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>iMessage handles ({vm.imessageHandles.length})</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
              {vm.imessageHandles.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>
                  <span>{h.handle} · {h.source_field}</span>
                  <span style={{ color: h.imessage_status === 'available' ? '#34d399' : 'rgba(255,255,255,0.4)' }}>{h.imessage_status}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </Card>

      {/* DOCUMENTS */}
      <Card icon="📎" title="Documents" accent="#3B5C8A">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vm.documents.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>{d.label}{d.note ? <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {d.note}</span> : ''}</span>
              {d.url ? <ViewLink url={d.url} /> : <Chip label="Upload" color="#fbbf24" bg="rgba(251,191,36,0.12)" border="rgba(251,191,36,0.3)" style={{ fontSize: 9.5 }} />}
            </div>
          ))}
        </div>
      </Card>

      {/* PEOPLE & CONTACT */}
      <Card icon="👥" title="People & Contact" accent="#3B5C8A">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KV label="Assigned agent" value={vm.people.assignedAgent} accent={GOLD} />
          <KV label="Co-agent" value={vm.people.coAgent} />
          <KV label="Listing manager" value={vm.people.listingManager} />
          <KV label="Source" value={titleize(vm.people.source)} />
          <KV label="Nationality" value={vm.people.nationality} />
          <KV label="Residence" value={vm.people.residence} />
          <KV label="Resident UAE" value={vm.people.residentUAE} />
          <KV label="Language" value={vm.people.language} />
        </div>
        {vm.people.phones?.length > 0 && (
          <div style={{ marginTop: 9 }}>
            <Label>Phones</Label>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{vm.people.phones.join(' · ')}</div>
          </div>
        )}
        {vm.people.emails?.length > 0 && (
          <div style={{ marginTop: 7 }}>
            <Label>Emails</Label>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3, wordBreak: 'break-all' }}>{vm.people.emails.join(' · ')}</div>
          </div>
        )}
      </Card>

      {/* AI META */}
      <Card icon="🧠" title="AI Meta" accent="#3B5C8A">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KV label="Model" value={vm.aiMeta.model} />
          <KV label="Last run" value={relativeTime(vm.aiMeta.lastRun)} />
          <KV label="Status" value={titleize(vm.aiMeta.status)} accent={vm.aiMeta.status === 'needs_retry' ? '#fbbf24' : undefined} />
        </div>
        {vm.aiMeta.needsReview && (
          <div style={{ marginTop: 9, padding: '8px 10px', borderRadius: 9, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11.5, color: '#fcd34d' }}>
            Needs human review{vm.aiMeta.reviewReason ? `: ${vm.aiMeta.reviewReason}` : ''}
          </div>
        )}
        <button onClick={actions.onRerunBrain} disabled={vm.rerunning} style={{ marginTop: 11, width: '100%', padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: vm.rerunning ? 'wait' : 'pointer', background: `${GOLD}1f`, border: `1px solid ${GOLD}55`, color: GOLD, fontFamily: 'Montserrat,sans-serif', opacity: vm.rerunning ? 0.6 : 1 }}>
          {vm.rerunning ? 'Re-running…' : '↻ Re-run brain'}
        </button>
      </Card>
    </div>
  );
}