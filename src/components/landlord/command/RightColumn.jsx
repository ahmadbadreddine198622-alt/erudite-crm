// Right sidebar: Red Flags → Buying Signals → Property & Media → Mandate & Pipeline →
// Channels → Documents → People → AI Meta. Read-only consume of existing Landlord fields.
import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import CommandCard from './CommandCard';
import { PALETTE, fmtAED, fmtDate, daysUntil, titleize, relativeTime, STAGE_LABELS } from './cmdHelpers';

function StatusDot({ state }) {
  const c = state === 'available' ? PALETTE.green : state === 'unknown' ? PALETTE.amber : 'rgba(148,163,184,0.6)';
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: c }} />;
}

function ViewLink({ url, label = 'View' }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: PALETTE.gold }}>
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );
}

export default function RightColumn({ raw, prop, onResolveIMessage }) {
  const [resolving, setResolving] = useState(false);
  const redFlags = Array.isArray(raw.red_flags) ? raw.red_flags : [];
  const buyingSignals = Array.isArray(raw.buying_signals) ? raw.buying_signals : [];
  const priceHistory = Array.isArray(raw.asking_price_history) ? raw.asking_price_history : [];
  const imHandles = Array.isArray(raw.imessage_handles) ? raw.imessage_handles : [];
  const contracts = Array.isArray(raw.form_a_contracts) ? raw.form_a_contracts : [];
  const addlPhones = Array.isArray(raw.additional_phones) ? raw.additional_phones : [];
  const addlEmails = Array.isArray(raw.additional_emails) ? raw.additional_emails : [];
  const stageHistory = Array.isArray(raw.stage_history) ? raw.stage_history : [];

  // Price conflict: a logged history price that differs materially from the on-file asking price.
  const conflict = (() => {
    if (!raw.asking_price_aed || !priceHistory.length) return null;
    const mismatch = priceHistory.find((p) => p.price && Math.abs(p.price - raw.asking_price_aed) / raw.asking_price_aed > 0.2);
    return mismatch ? mismatch.price : null;
  })();

  const mediaChips = [
    { label: 'Photos', done: !!raw.media_photography_url || raw.media_photography_status === 'delivered' },
    { label: 'Video', done: !!raw.media_video_url },
    { label: '360', done: !!raw.media_tour_360_url },
    { label: 'Drone', done: !!raw.media_drone_url },
    { label: 'Floorplan', done: !!raw.media_floorplan_url },
  ];

  const resolve = async () => {
    setResolving(true);
    try { await onResolveIMessage(); } finally { setResolving(false); }
  };

  const mandateExpiry = daysUntil(raw.mandate_expires_at);

  return (
    <div className="flex flex-col gap-3">
      {/* RED FLAGS */}
      <CommandCard icon="⚑" title="Red Flags" accent={PALETTE.red} count={redFlags.length || undefined}>
        {redFlags.length === 0 ? (
          <p className="text-[13px]" style={{ color: PALETTE.green }}>✓ No red flags.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {redFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: PALETTE.text }}>
                <span style={{ color: PALETTE.red }}>⚑</span> {titleize(f)}
              </li>
            ))}
          </ul>
        )}
      </CommandCard>

      {/* BUYING SIGNALS */}
      {buyingSignals.length > 0 && (
        <CommandCard icon="✓" title="Buying Signals" accent={PALETTE.green} count={buyingSignals.length}>
          <ul className="flex flex-col gap-1.5">
            {buyingSignals.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: PALETTE.text }}>
                <span style={{ color: PALETTE.green }}>✓</span> {s}
              </li>
            ))}
          </ul>
        </CommandCard>
      )}

      {/* PROPERTY & MEDIA */}
      <CommandCard icon="🏠" title="Property & Media" accent={PALETTE.gold}>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <Kv label="Unit" value={raw.unit_reference || prop.unit_no} />
          <Kv label="Project" value={raw.project_name || prop.building_name} />
          <Kv label="Beds" value={prop.bedrooms != null ? `${prop.bedrooms} Bed` : '—'} />
          <Kv label="Size" value={prop.area_sqft ? `${prop.area_sqft} sqft` : '—'} />
          <Kv label="Asking" value={fmtAED(raw.asking_price_aed)} accent={PALETTE.gold} />
          <Kv label="Reserve" value={fmtAED(raw.reserve_price)} />
          <Kv label="Days on market" value={raw.days_on_market != null ? `${Math.round(raw.days_on_market)}d` : '—'} />
        </div>
        {conflict && (
          <div className="mt-2 rounded-lg p-2 text-[12px] font-semibold" style={{ background: `${PALETTE.amber}18`, color: PALETTE.amber, border: `1px solid ${PALETTE.amber}40` }}>
            ⚠ Price conflict — {fmtAED(conflict)} logged vs {fmtAED(raw.asking_price_aed)} on file. Confirm.
          </div>
        )}
        {priceHistory.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: PALETTE.textFaint }}>Price history</div>
            <div className="flex flex-col gap-1">
              {priceHistory.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]" style={{ color: PALETTE.textDim }}>
                  <span>{fmtDate(p.date)}</span>
                  <span style={{ color: PALETTE.text }}>{fmtAED(p.price)}</span>
                  <span className="truncate ml-2 max-w-[120px]">{p.change_reason || ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {mediaChips.map((c) => (
            <span key={c.label} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: c.done ? `${PALETTE.green}1f` : 'rgba(255,255,255,0.04)', color: c.done ? PALETTE.green : PALETTE.textFaint, border: `1px solid ${c.done ? PALETTE.green + '40' : 'rgba(255,255,255,0.1)'}` }}>
              {c.done ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
      </CommandCard>

      {/* MANDATE & PIPELINE */}
      <CommandCard icon="📄" title="Mandate & Pipeline" accent="#c4b5fd">
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <Kv label="Stage" value={STAGE_LABELS[raw.stage] || titleize(raw.stage)} />
          <Kv label="Days in stage" value={raw.days_in_stage != null ? `${Math.round(raw.days_in_stage)}d` : '—'} />
          {raw.sub_stage && <Kv label="Sub-stage" value={titleize(raw.sub_stage)} span />}
          <Kv label="Mandate type" value={raw.mandate_type ? titleize(raw.mandate_type) : '—'} />
          <Kv label="Mandate status" value={raw.mandate_status ? titleize(raw.mandate_status) : 'None'} />
          <Kv label="Start" value={fmtDate(raw.mandate_start_date)} />
          <Kv label="Expires" value={raw.mandate_expires_at ? `${fmtDate(raw.mandate_expires_at)}${mandateExpiry != null ? ` (${mandateExpiry}d)` : ''}` : '—'} accent={mandateExpiry != null && mandateExpiry <= 14 ? PALETTE.red : undefined} />
          <Kv label="Commission" value={raw.commission_pct_negotiated != null ? `${raw.commission_pct_negotiated}%` : '—'} />
        </div>
        {(raw.form_a_contract_number || contracts.length > 0 || raw.form_a_pdf_url) && (
          <div className="mt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: PALETTE.textFaint }}>Form A</div>
            {contracts.length > 0 ? contracts.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[12px] py-0.5" style={{ color: PALETTE.text }}>
                <span>{c.contract_number || '—'} {c.unit ? `· ${c.unit}` : ''}</span>
                <ViewLink url={c.pdf_url} label="PDF" />
              </div>
            )) : (
              <div className="flex items-center justify-between text-[12px]" style={{ color: PALETTE.text }}>
                <span>{raw.form_a_contract_number || 'Form A'}</span>
                <ViewLink url={raw.form_a_pdf_url} label="PDF" />
              </div>
            )}
          </div>
        )}
        {(raw.lease_agreement_status || raw.lease_pdf_url) && (
          <div className="flex items-center justify-between text-[12px] mt-2" style={{ color: PALETTE.text }}>
            <span>Lease: {titleize(raw.lease_agreement_status) || '—'}</span>
            <ViewLink url={raw.lease_pdf_url} label="PDF" />
          </div>
        )}
        {(raw.is_currently_listed_with_others || raw.competing_brokers_count || raw.prior_brokerage_count) ? (
          <div className="mt-2 text-[11px]" style={{ color: PALETTE.textDim }}>
            Competition: {raw.competing_brokers_count || 0} current · {raw.prior_brokerage_count || 0} prior{raw.is_currently_listed_with_others ? ' · listed elsewhere' : ''}
          </div>
        ) : null}
        {stageHistory.length > 0 && (
          <div className="mt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: PALETTE.textFaint }}>Stage history</div>
            <div className="flex flex-col gap-0.5">
              {stageHistory.slice(-5).reverse().map((h, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]" style={{ color: PALETTE.textDim }}>
                  <span>{STAGE_LABELS[h.stage] || titleize(h.stage)}</span>
                  <span>{fmtDate(h.entered_at)}{h.duration_days != null ? ` · ${Math.round(h.duration_days)}d` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CommandCard>

      {/* CHANNELS */}
      <CommandCard icon="📡" title="Channels" accent={PALETTE.green}>
        <div className="flex flex-col gap-2 text-[12px]">
          <ChannelRow label="WhatsApp" state={(raw.whatsapp || raw.phone) ? 'available' : 'not'} detail={raw.whatsapp || raw.phone || 'Not linked'} />
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><StatusDot state={raw.imessage_status || 'unknown'} /><span style={{ color: PALETTE.text }}>iMessage</span></span>
              <button onClick={resolve} disabled={resolving} className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: PALETTE.blue }}>
                {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Resolve
              </button>
            </div>
            {imHandles.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 pl-4">
                {imHandles.map((h, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: PALETTE.textDim }}>
                    <StatusDot state={h.imessage_status || 'unknown'} /> {h.handle} <span style={{ color: PALETTE.textFaint }}>· {h.source_field}</span>
                  </div>
                ))}
              </div>
            )}
            {raw.imessage_checked_at && <div className="text-[10px] pl-4 mt-0.5" style={{ color: PALETTE.textFaint }}>Checked {relativeTime(raw.imessage_checked_at)}</div>}
          </div>
          <ChannelRow label="Telegram" state={raw.telegram_chat_id ? 'available' : 'not'} detail={raw.telegram_chat_id ? (raw.telegram_username || 'Connected') : 'Not connected'} />
          <ChannelRow label="SMS" state={raw.phone ? 'available' : 'not'} detail={raw.phone || 'No number'} />
          <ChannelRow label="Email" state={raw.email ? 'available' : 'not'} detail={raw.email || 'No email'} />
        </div>
      </CommandCard>

      {/* DOCUMENTS */}
      <CommandCard icon="📎" title="Documents" accent={PALETTE.gold}>
        <div className="flex flex-col gap-2 text-[12px]">
          <DocRow label="Emirates ID" url={raw.emirates_id_file_url} />
          <DocRow label={`Passport${raw.passport_no ? ` · ${raw.passport_no}` : ''}`} url={raw.passport_file_url} />
          <DocRow label="Form A PDF" url={raw.form_a_pdf_url} />
          <DocRow label="Lease PDF" url={raw.lease_pdf_url} />
        </div>
      </CommandCard>

      {/* PEOPLE & CONTACT */}
      <CommandCard icon="👥" title="People & Contact" accent={PALETTE.blue}>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <Kv label="Assigned agent" value={raw.assigned_agent_email || '—'} />
          <Kv label="Co-agent" value={raw.co_agent_email || '—'} />
          <Kv label="Listing manager" value={raw.listing_manager_email || '—'} />
          <Kv label="Nationality" value={raw.nationality || '—'} />
          <Kv label="Residence" value={raw.residence_country || '—'} />
          <Kv label="Resident UAE" value={typeof raw.is_resident_uae === 'boolean' ? (raw.is_resident_uae ? 'Yes' : 'No') : '—'} />
          <Kv label="Language" value={raw.preferred_language ? raw.preferred_language.toUpperCase() : '—'} />
          <Kv label="Source" value={raw.source ? titleize(raw.source) : '—'} />
        </div>
        {(raw.phone || addlPhones.length > 0) && (
          <div className="mt-2 text-[11px]" style={{ color: PALETTE.textDim }}>
            <span className="font-semibold" style={{ color: PALETTE.textFaint }}>Phones: </span>{[raw.phone, ...addlPhones].filter(Boolean).join(', ')}
          </div>
        )}
        {(raw.email || addlEmails.length > 0) && (
          <div className="mt-1 text-[11px]" style={{ color: PALETTE.textDim }}>
            <span className="font-semibold" style={{ color: PALETTE.textFaint }}>Emails: </span>{[raw.email, ...addlEmails].filter(Boolean).join(', ')}
          </div>
        )}
      </CommandCard>

      {/* AI META */}
      <CommandCard icon="🧠" title="AI Meta" accent="#c4b5fd" dense>
        <div className="flex flex-col gap-1 text-[11px]" style={{ color: PALETTE.textDim }}>
          <div>Model: <span style={{ color: PALETTE.text }}>{raw.ai_model_used || '—'}</span></div>
          <div>Last run: <span style={{ color: PALETTE.text }}>{relativeTime(raw.last_orchestrator_run_at || raw.ai_processed_at)}</span></div>
          <div className="flex items-center gap-1.5">
            Status:
            <span className="px-1.5 py-0.5 rounded-full font-semibold" style={{ background: raw.ai_processing_status === 'needs_retry' ? `${PALETTE.amber}22` : 'rgba(255,255,255,0.06)', color: raw.ai_processing_status === 'needs_retry' ? PALETTE.amber : PALETTE.text }}>
              {raw.ai_processing_status || 'unknown'}
            </span>
          </div>
          {raw.needs_human_review && (
            <div style={{ color: PALETTE.red }}>⚠ Needs review{raw.review_reason ? `: ${raw.review_reason}` : ''}</div>
          )}
        </div>
      </CommandCard>
    </div>
  );
}

function Kv({ label, value, accent, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PALETTE.textFaint }}>{label}</div>
      <div className="text-[12.5px] font-semibold mt-0.5 break-words" style={{ color: accent || PALETTE.text }}>{value || '—'}</div>
    </div>
  );
}

function ChannelRow({ label, state, detail }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2"><StatusDot state={state} /><span style={{ color: PALETTE.text }}>{label}</span></span>
      <span className="text-[11px] truncate max-w-[150px]" style={{ color: PALETTE.textDim }}>{detail}</span>
    </div>
  );
}

function DocRow({ label, url }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: PALETTE.text }}>{label}</span>
      {url ? <ViewLink url={url} /> : <span className="text-[11px] font-semibold" style={{ color: PALETTE.amber }}>Upload</span>}
    </div>
  );
}