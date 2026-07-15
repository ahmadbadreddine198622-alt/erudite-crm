// OwnerHistoryTab — shows the landlord's real owner portfolio pulled live from
// the shared Google Drive portfolio spreadsheets (Peninsula 1/2/3/5).
//
// Data source: fetchOwnerPortfolio backend function, which reads the two Excel
// files in the Drive folder and matches the landlord by name / email / phone.
// Displays: total units owned, total apartments, projects, areas, and each
// unit's number, building/project name and area.

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Building2, MapPin, Home, Hash, Loader2, User, RefreshCw, Layers, AlertCircle, Phone, PhoneCall, Mail, Plus, Check } from 'lucide-react';

const GOLD = '#C9A24B';

function card() {
  return {
    borderRadius: 13,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
  };
}

function StatTile({ icon, label, value, accent }) {
  return (
    <div style={{ ...card(), padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (accent || GOLD) + '22', color: accent || GOLD }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function UnitRow({ u, index }) {
  return (
    <div style={{ ...card(), padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GOLD + '22', color: GOLD, fontSize: 11, fontWeight: 800, flex: 'none' }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={13} color={GOLD} /> {u.property_name || 'Unknown project'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <MapPin size={10} /> {u.area || '—'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', flex: 'none' }}>
        <Hash size={12} /> {u.unit_code || '—'}
      </div>
    </div>
  );
}

export default function OwnerHistoryTab({ landlordId, landlord }) {
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState(null);
  const [doneKey, setDoneKey] = useState(null);
  const ownerName = landlord?.full_name_en || landlord?.full_name || '';
  const ownerEmails = [landlord?.email, ...(Array.isArray(landlord?.additional_emails) ? landlord.additional_emails : [])].filter(Boolean);
  const ownerPhones = [landlord?.phone, landlord?.whatsapp, ...(Array.isArray(landlord?.additional_phones) ? landlord.additional_phones : [])].filter(Boolean);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['ownerPortfolio', ownerName, ownerEmails.join(','), ownerPhones.join(',')],
    queryFn: async () => {
      const res = await base44.functions.invoke('fetchOwnerPortfolio', {
        owner_name: ownerName,
        owner_emails: ownerEmails,
        owner_phones: ownerPhones,
      });
      return res?.data ?? res;
    },
    enabled: !!ownerName || !!ownerEmails.length || !!ownerPhones.length,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const matched = data?.matched === true;
  const units = data?.units || [];
  const totalUnits = data?.total_units || 0;
  const projects = data?.projects || [];
  const areas = data?.areas || [];

  // Internal CRM cross-reference — for each contact in the history, check which
  // internal databases (Landlord, Lead, Contact, OwnerPortfolioUnit) contain it
  // and how many records match. One backend call; cached 5 min.
  const crmPhones = useMemo(() => {
    if (!matched) return [];
    const isReal = (v) => { const s = String(v || '').trim().toLowerCase(); return s && s !== 'null' && s !== 'n/a' && s !== 'none' && s !== 'undefined'; };
    const hp = (data?.all_phones || []).filter(isReal);
    const up = (landlord?.phone || landlord?.whatsapp || '').trim();
    return [...new Set([...hp, up].filter(Boolean))];
  }, [matched, data, landlord]);
  const crmEmails = useMemo(() => {
    if (!matched) return [];
    const isReal = (v) => { const s = String(v || '').trim().toLowerCase(); return s && s !== 'null' && s !== 'n/a' && s !== 'none' && s !== 'undefined'; };
    const he = (data?.all_emails || []).filter(isReal).map(e => String(e).toLowerCase());
    const le = [landlord?.email, ...(Array.isArray(landlord?.additional_emails) ? landlord.additional_emails : [])].filter(Boolean).map(e => String(e).toLowerCase());
    return [...new Set([...he, ...le])];
  }, [matched, data, landlord]);
  const { data: crmCheck } = useQuery({
    queryKey: ['crm_contact_check', crmPhones.join(','), crmEmails.join(',')],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkContactInCRM', { phones: crmPhones, emails: crmEmails });
      return res?.data ?? res;
    },
    enabled: matched && (crmPhones.length > 0 || crmEmails.length > 0),
    staleTime: 5 * 60 * 1000,
  });

  // "Update" — add a history phone/email to the landlord's B-card. Add-only: never
  // overwrites an existing contact. Phone → fills empty primary, else appends to
  // additional_phones; email → fills empty primary, else appends to additional_emails.
  const handleAddContact = async (kind, value) => {
    const key = kind + '|' + value;
    setBusyKey(key);
    try {
      const patch = {};
      if (kind === 'phone') {
        const hasPrimary = !!(landlord?.phone && String(landlord.phone).trim());
        if (!hasPrimary) {
          patch.phone = value;
        } else {
          const cur = Array.isArray(landlord?.additional_phones) ? landlord.additional_phones : [];
          patch.additional_phones = [...cur, value];
        }
      } else {
        const hasPrimary = !!(landlord?.email && String(landlord.email).trim());
        if (!hasPrimary) {
          patch.email = value;
        } else {
          const cur = Array.isArray(landlord?.additional_emails) ? landlord.additional_emails : [];
          patch.additional_emails = [...cur, value];
        }
      }
      await base44.entities.Landlord.update(landlordId, patch);
      toast.success('Added to B-card');
      setDoneKey(key);
      queryClient.invalidateQueries({ queryKey: ['landlord', landlordId] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
    } catch (e) {
      toast.error('Failed: ' + (e?.message || 'unknown error'));
    } finally {
      setBusyKey(null);
    }
  };

  // "Sync All to V-Card" — merge EVERY phone + email discovered in the portfolio
  // spreadsheets into the landlord B-card in one shot (add-only, never overwrites).
  // Primary fields are filled only when empty; the rest append to additional_phones /
  // additional_emails. Contacts already on the B-card are skipped.
  const handleSyncAll = async () => {
    setBusyKey('sync_all');
    try {
      const isRealContact = (v) => { const s = String(v || '').trim().toLowerCase(); return s && s !== 'null' && s !== 'n/a' && s !== 'none' && s !== 'undefined'; };
      const historyPhones = (data.all_phones || []).filter(isRealContact);
      const historyEmails = (data.all_emails || []).filter(isRealContact);

      const curPrimaryPhone = (landlord?.phone || '').trim();
      const curAdditionalPhones = Array.isArray(landlord?.additional_phones) ? landlord.additional_phones : [];
      const phoneDigitsOnCard = new Set(
        [landlord?.phone, landlord?.whatsapp, ...curAdditionalPhones].filter(Boolean).map(p => String(p).replace(/\D/g, '')).filter(Boolean)
      );
      const phonesToAdd = historyPhones.filter(ph => !phoneDigitsOnCard.has(String(ph).replace(/\D/g, '')));

      const curEmail = (landlord?.email || '').trim();
      const curAdditionalEmails = Array.isArray(landlord?.additional_emails) ? landlord.additional_emails : [];
      const emailsOnCard = new Set([curEmail, ...curAdditionalEmails].filter(Boolean).map(e => String(e).trim().toLowerCase()).filter(Boolean));
      const emailsToAdd = historyEmails.filter(em => !emailsOnCard.has(String(em).trim().toLowerCase()));

      if (!phonesToAdd.length && !emailsToAdd.length) {
        toast.success('V-card is already up to date');
        setDoneKey('sync_all');
        return;
      }

      const patch = {};
      const newPhones = [];
      let primaryPhoneSet = false;
      for (const ph of phonesToAdd) {
        if (!curPrimaryPhone && !primaryPhoneSet) { patch.phone = ph; primaryPhoneSet = true; }
        else newPhones.push(ph);
      }
      if (newPhones.length) patch.additional_phones = [...curAdditionalPhones, ...newPhones];

      const newEmails = [];
      let primaryEmailSet = false;
      for (const em of emailsToAdd) {
        if (!curEmail && !primaryEmailSet) { patch.email = em; primaryEmailSet = true; }
        else newEmails.push(em);
      }
      if (newEmails.length) patch.additional_emails = [...curAdditionalEmails, ...newEmails];

      await base44.entities.Landlord.update(landlordId, patch);
      toast.success(`V-card updated — ${phonesToAdd.length} phone(s) + ${emailsToAdd.length} email(s) merged`);
      setDoneKey('sync_all');
      queryClient.invalidateQueries({ queryKey: ['landlord', landlordId] });
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
    } catch (e) {
      toast.error('Failed: ' + (e?.message || 'unknown error'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Refresh / status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', cursor: isLoading || isFetching ? 'wait' : 'pointer', background: 'transparent', border: 'none', fontFamily: 'inherit', opacity: isLoading || isFetching ? 0.5 : 1 }}
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh from Drive
        </button>
      </div>

      {isLoading && (
        <div style={{ ...card(), padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.5)' }}>
          <Loader2 size={22} className="animate-spin" style={{ color: GOLD }} />
          <div style={{ fontSize: 12.5 }}>Reading portfolio spreadsheets from Google Drive…</div>
        </div>
      )}

      {!isLoading && error && (
        <div style={{ ...card(), padding: '20px', display: 'flex', alignItems: 'center', gap: 10, color: '#fca5a5', fontSize: 12.5 }}>
          <AlertCircle size={16} /> Failed to load portfolio: {error.message || 'unknown error'}
        </div>
      )}

      {!isLoading && !error && !matched && (
        <div style={{ ...card(), padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12.5 }}>
          <AlertCircle size={18} style={{ margin: '0 auto 8px', display: 'block', color: 'rgba(255,255,255,0.3)' }} />
          No owner record found in the portfolio spreadsheets matching this landlord.
          {data?.totalUnits > 0 && (
            <div style={{ fontSize: 11, marginTop: 6, color: 'rgba(255,255,255,0.3)' }}>
              Searched {data.totalUnits.toLocaleString()} units synced from Drive.
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && matched && (
        <>
          {/* Owner summary header */}
          <div style={{ ...card(), padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GOLD + '22', color: GOLD }}>
              <User size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Owner</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{data.owner_name || ownerName || '—'}</div>
              {data.owner_email && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{data.owner_email}</div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <StatTile icon={<Home size={16} />} label="Total units owned" value={totalUnits} accent="#34d399" />
            <StatTile icon={<Layers size={16} />} label="Total apartments" value={totalUnits} accent="#60a5fa" />
            <StatTile icon={<Building2 size={16} />} label="Projects" value={projects.length} accent="#a78bfa" />
            <StatTile icon={<MapPin size={16} />} label="Areas" value={areas.length} accent={GOLD} />
          </div>

          {/* Units list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Building2 size={13} color={GOLD} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                Apartments ({units.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {units.map((u, i) => <UnitRow key={i} u={u} index={i} />)}
            </div>
          </div>

          {/* Contact history — all phone numbers + emails found in the system.
              Each history contact not already on the B-card shows an "Update" button
              that adds it to the landlord record (add-only, never overwrites). */}
          {(() => {
            const isRealContact = (v) => { const s = String(v || '').trim().toLowerCase(); return s && s !== 'null' && s !== 'n/a' && s !== 'none' && s !== 'undefined'; };
            const historyPhones = (data.all_phones || []).filter(isRealContact);
            const historyEmails = (data.all_emails || []).filter(isRealContact);
            const historyEmailsLower = historyEmails.map(e => String(e).toLowerCase());
            const updatePhone = (landlord?.phone || landlord?.whatsapp || '').trim();
            const landlordEmails = [landlord?.email, ...(Array.isArray(landlord?.additional_emails) ? landlord.additional_emails : [])].filter(Boolean);
            const allEmails = [...new Set([...historyEmailsLower, ...landlordEmails.map(e => e.toLowerCase())])];

            if (!historyPhones.length && !updatePhone && !allEmails.length) return null;

            // Contacts already on the B-card → show "Added" instead of an Update button.
            const phoneDigitsOnCard = new Set(
              [landlord?.phone, landlord?.whatsapp, ...(Array.isArray(landlord?.additional_phones) ? landlord.additional_phones : [])]
                .filter(Boolean).map(p => String(p).replace(/\D/g, '')).filter(Boolean)
            );
            const emailsOnCard = new Set(landlordEmails.map(e => String(e).trim().toLowerCase()).filter(Boolean));
            const phoneOnCard = (ph) => phoneDigitsOnCard.has(String(ph).replace(/\D/g, ''));
            const emailOnCard = (em) => emailsOnCard.has(String(em).trim().toLowerCase());

            // "On B-card" is a STATUS indicator only — never an action. It is a
            // non-interactive badge (pointer-events disabled) so clicking it can
            // never trigger a V-card update. Only the gold "Update" button adds.
            const UpdateChip = ({ onClick, busy, done }) => done ? (
              <span title="Already on V-card — status only" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: '#34d399', padding: '2px 7px', borderRadius: 99, background: 'rgba(52,211,153,0.16)', flex: 'none', pointerEvents: 'none', cursor: 'default', userSelect: 'none' }}>
                <Check size={11} /> On B-card
              </span>
            ) : (
              <button
                onClick={onClick}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
                  fontFamily: "'Inter',sans-serif", cursor: busy ? 'wait' : 'pointer',
                  color: GOLD, padding: '2px 8px', borderRadius: 99,
                  background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)',
                  flex: 'none', opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Update
              </button>
            );

            const crmLineFor = (crm) => {
              if (!crm) return { text: 'Checking CRM…', color: 'rgba(255,255,255,0.3)' };
              const parts = [];
              if (crm.landlords) parts.push(crm.landlords + ' Landlord');
              if (crm.leads) parts.push(crm.leads + (crm.leads > 1 ? ' Leads' : ' Lead'));
              if (crm.contacts) parts.push(crm.contacts + (crm.contacts > 1 ? ' Contacts' : ' Contact'));
              if (crm.portfolio_units) parts.push(crm.portfolio_units + ' Portfolio');
              return parts.length ? { text: 'In CRM: ' + parts.join(' · '), color: 'rgba(255,255,255,0.5)' } : { text: 'Not found in CRM', color: 'rgba(255,255,255,0.3)' };
            };

            const ContactRow = ({ icon: Icon, label, value, tag, tagColor, kind, contactValue, crm }) => {
              const key = kind ? (kind + '|' + contactValue) : null;
              const onCard = kind === 'phone' ? phoneOnCard(contactValue) : kind === 'email' ? emailOnCard(contactValue) : false;
              const busy = key ? busyKey === key : false;
              const done = key ? (doneKey === key || onCard) : false;
              const crmLine = crmLineFor(crm);
              return (
                <div style={{ ...card(), padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (tagColor || GOLD) + '22', color: tagColor || GOLD, flex: 'none' }}>
                    <Icon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                    <div style={{ fontSize: 9, color: crmLine.color, marginTop: 2 }}>{crmLine.text}</div>
                  </div>
                  {tag && (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: tagColor || GOLD, padding: '2px 7px', borderRadius: 99, background: (tagColor || GOLD) + '1a', border: '1px solid ' + (tagColor || GOLD) + '44', flex: 'none' }}>{tag}</span>
                  )}
                  {kind && (
                    <UpdateChip onClick={() => handleAddContact(kind, contactValue)} busy={busy} done={done} />
                  )}
                </div>
              );
            };

            // Ordered contact list: PRIMARY first, then existing (Old), then newly discovered (New).
            // Each row is tagged Primary / Old / New so the agent sees what was just synced.
            const primaryPhone = (landlord?.phone || '').trim() || (landlord?.whatsapp || '').trim() || '';
            const primaryEmail = (landlord?.email || '').trim() || '';
            const addPhones = Array.isArray(landlord?.additional_phones) ? landlord.additional_phones : [];
            const addEmails = Array.isArray(landlord?.additional_emails) ? landlord.additional_emails : [];

            const rows = [];
            const pushRow = (icon, label, value, kind, tag, tagColor) => {
              const cv = String(value || '').trim();
              if (!cv) return;
              rows.push({ icon, label, value: cv, kind, contactValue: cv, tag, tagColor });
            };

            // 1. Primary data first (the first data put stays first)
            if (primaryPhone) pushRow(PhoneCall, 'Primary phone', primaryPhone, 'phone', 'Primary', '#34d399');
            if (primaryEmail) pushRow(Mail, 'Primary email', primaryEmail, 'email', 'Primary', '#34d399');
            // 2. Existing additional contacts (Old)
            for (const ph of addPhones) {
              if (String(ph).replace(/\D/g, '') === String(primaryPhone).replace(/\D/g, '')) continue;
              pushRow(Phone, 'Additional phone', ph, 'phone', 'Old', 'rgba(255,255,255,0.5)');
            }
            for (const em of addEmails) {
              if (String(em).trim().toLowerCase() === String(primaryEmail).trim().toLowerCase()) continue;
              pushRow(Mail, 'Additional email', em, 'email', 'Old', 'rgba(255,255,255,0.5)');
            }
            // 3. Newly discovered from Drive, not yet on the V-card (New)
            for (const ph of historyPhones) {
              if (phoneOnCard(ph)) continue;
              pushRow(Phone, 'History number', ph, 'phone', 'New', GOLD);
            }
            for (const em of historyEmails) {
              if (emailOnCard(em)) continue;
              pushRow(Mail, 'Email address', em, 'email', 'New', GOLD);
            }

            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <PhoneCall size={13} color={GOLD} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                    Contact History
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map((r, i) => (
                    <ContactRow key={'r' + i} icon={r.icon} label={r.label} value={r.value} tag={r.tag} tagColor={r.tagColor} kind={r.kind} contactValue={r.contactValue} crm={r.kind === 'phone' ? crmCheck?.phones?.[r.contactValue] : crmCheck?.emails?.[r.contactValue]} />
                  ))}
                </div>

                {/* Sync ALL discovered contacts into the V-card at once (add-only).
                    Placed directly under the contact list so it's applied across every V-card. */}
                {(() => {
                  const pendingPhones = historyPhones.filter(ph => !phoneOnCard(ph));
                  const pendingEmails = historyEmails.filter(em => !emailOnCard(em));
                  const pendingCount = pendingPhones.length + pendingEmails.length;
                  const syncBusy = busyKey === 'sync_all';
                  const upToDate = pendingCount === 0 && !syncBusy;
                  const accent = upToDate ? '#34d399' : GOLD;
                  // The sync control is ALWAYS rendered at the bottom of Contact
                  // History — gold + actionable when there are new contacts to
                  // merge, green "V-card up to date" when current. It never
                  // disappears (re-clicking when up to date just re-confirms).
                  return (
                    <button
                      onClick={handleSyncAll}
                      disabled={syncBusy}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8,
                        padding: '11px 14px', borderRadius: 11, fontFamily: "'Inter',sans-serif",
                        cursor: syncBusy ? 'wait' : 'pointer',
                        background: upToDate ? 'rgba(52,211,153,0.10)' : 'rgba(212,175,55,0.14)',
                        border: `1px solid ${upToDate ? 'rgba(52,211,153,0.4)' : 'rgba(212,175,55,0.45)'}`,
                        color: accent, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
                        opacity: syncBusy ? 0.6 : 1,
                      }}
                    >
                      {syncBusy ? <Loader2 size={14} className="animate-spin" /> : upToDate ? <Check size={14} /> : <Plus size={14} />}
                      {syncBusy ? 'Syncing V-card…' : upToDate ? 'V-card up to date' : `Sync All to V-Card (${pendingCount} new)`}
                    </button>
                  );
                })()}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}