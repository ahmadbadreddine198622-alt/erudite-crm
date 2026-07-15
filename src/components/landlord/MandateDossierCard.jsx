import React, { useEffect, useState } from 'react';
import { FileText, Loader2, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WritingField from '@/components/shared/WritingField';
import { buildMandateDossierPDF, dossierFileName } from '@/lib/buildMandateDossierPDF';

// MandateDossierCard — THE MANDATE DOSSIER.
//
// Sits after the Call Script Forge on the landlord detail page. One gold button forges a
// complete, owner-facing "why list with Erudite" proposal PDF for THIS owner and THIS unit:
//
//   1. forgeMandateDossier (backend) — assembles the verified data_snapshot (AI valuation,
//      DXB Interact medians + comps, pricing scenarios) and forges the narrative with Claude
//      in the owner's language (EN | RU). Persists a MandateDossier record (status 'forged').
//   2. buildMandateDossierPDF (client) — typesets the branded navy/gold PDF on the shared
//      pdfBrand identity (logo, signature, stamp, TRN) with embedded Noto Sans for Cyrillic.
//   3. The PDF uploads to Base44 storage, the record flips to 'pdf_ready', and the file
//      downloads locally, ready to send on any channel.
//
// Every number in the document comes from data_snapshot — the model writes prose only.

const GOLD = '#d4af37';
const NAVY = '#1a2744';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

function relTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const selStyle = css(
  'font-size:10.5px; padding:3px 6px; border:1px solid #e2e6ee; border-radius:7px; background:#fff; color:#1a2744; font-weight:600; outline:none; cursor:pointer;'
);

export default function MandateDossierCard({ landlordId, landlord }) {
  const [language, setLanguage] = useState('en');
  const [focus, setFocus] = useState('both');
  const [working, setWorking] = useState(false);
  const [phase, setPhase] = useState('');
  const [history, setHistory] = useState([]);
  const [sendForId, setSendForId] = useState(null);
  const [sendChannel, setSendChannel] = useState('whatsapp');
  const [waLine, setWaLine] = useState('personal');
  const [coverText, setCoverText] = useState('');
  const [sending, setSending] = useState(false);

  // Defaults follow the record; the agent can override per forge.
  useEffect(() => {
    setLanguage(landlord?.preferred_language === 'ru' ? 'ru' : 'en');
    const lt = landlord?.lead_type;
    setFocus(lt === 'landlord_sale' ? 'sale' : lt === 'landlord_rent' ? 'rent' : 'both');
  }, [landlordId, landlord?.preferred_language, landlord?.lead_type]);

  const loadHistory = React.useCallback(async () => {
    if (!landlordId) return;
    try {
      const rows = await base44.entities.MandateDossier.filter({ landlord_id: landlordId }, '-created_date', 8);
      setHistory(Array.isArray(rows) ? rows : []);
    } catch { setHistory([]); }
  }, [landlordId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const forge = async () => {
    if (!landlordId || working) return;
    setWorking(true);
    try {
      setPhase('Forging narrative…');
      const res = await base44.functions.invoke('forgeMandateDossier', {
        landlord_id: landlordId, language, focus, force: true,
      });
      const data = res?.data || res;
      if (!data?.ok) throw new Error(data?.error || 'forge failed');

      setPhase('Typesetting PDF…');
      const doc = await buildMandateDossierPDF(data);
      const fileName = dossierFileName(data);
      const blob = doc.output('blob');

      setPhase('Storing…');
      let pdfUrl = null;
      try {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const up = await base44.integrations.Core.UploadFile({ file });
        pdfUrl = up?.file_url || null;
        if (data.dossier_id) {
          await base44.entities.MandateDossier.update(data.dossier_id, {
            pdf_url: pdfUrl, file_name: fileName, status: 'pdf_ready',
          });
        }
      } catch (e) {
        console.error('Dossier upload failed (download still proceeds):', e);
      }

      doc.save(fileName);
      toast.success(`Mandate Dossier v${data.version} forged — ${String(language).toUpperCase()} · ${focus}`);
      await loadHistory();
    } catch (e) {
      console.error('MandateDossier forge failed:', e);
      toast.error('Dossier forge failed: ' + (e?.message || 'unknown error'));
    } finally {
      setWorking(false);
      setPhase('');
    }
  };

  const openSend = (d) => {
    if (sendForId === d.id) { setSendForId(null); return; }
    setSendForId(d.id);
    setSendChannel('whatsapp');
    setWaLine('personal');
    setCoverText(String(d?.narrative?.send_cover_message || ''));
  };

  const sendDossier = async () => {
    if (!sendForId || sending) return;
    if (!coverText.trim()) { toast.error('Write a short cover message — the owner never receives a bare file.'); return; }
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendMandateDossier', {
        dossier_id: sendForId,
        channel: sendChannel,
        cover_message: coverText.trim(),
        whatsapp_channel: waLine,
      });
      const data = res?.data || res;
      if (!data?.ok) throw new Error(data?.error || 'send failed');
      toast.success(`Dossier sent via ${sendChannel}`);
      setSendForId(null);
      await loadHistory();
    } catch (e) {
      console.error('Dossier send failed:', e);
      toast.error('Send failed: ' + (e?.message || 'unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={css('background:#fff; border:1px solid #e7eaf1; border-radius:14px; padding:13px 14px; margin-top:10px; box-shadow:0 1px 2px rgba(16,24,40,0.04);')}>
      <div style={css('display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;')}>
        <div style={css('display:flex; align-items:center; gap:7px; min-width:0;')}>
          <span style={css('display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:7px; background:' + NAVY + ';')}>
            <FileText size={13} color={GOLD} />
          </span>
          <div style={css('min-width:0;')}>
            <div style={css('font-size:11.5px; font-weight:800; letter-spacing:0.05em; color:' + NAVY + ';')}>MANDATE DOSSIER</div>
            <div style={css('font-size:9px; color:#8a93a6;')}>Owner-facing listing proposal — forged from live intelligence, branded PDF</div>
          </div>
        </div>

        <div style={css('display:flex; align-items:center; gap:6px; flex-wrap:wrap;')}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={working} style={selStyle} title="Dossier language">
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} disabled={working} style={selStyle} title="Dossier focus">
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
            <option value="both">Both</option>
          </select>
          <button
            onClick={forge}
            disabled={working || !landlordId}
            style={css(
              'display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; letter-spacing:0.03em;' +
              'padding:7px 13px; border-radius:9px; border:1px solid ' + GOLD + '; cursor:' + (working ? 'wait' : 'pointer') + ';' +
              'background:linear-gradient(135deg,#c9a84a,#e2c56d); color:' + NAVY + '; box-shadow:0 1px 3px rgba(201,168,74,0.45);' +
              (working ? 'opacity:0.75;' : '')
            )}
          >
            {working ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {working ? (phase || 'Forging…') : 'Forge Dossier'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div style={css('margin-top:10px; border-top:1px solid #eef1f6; padding-top:8px;')}>
          {history.map((d) => (
            <React.Fragment key={d.id}>
              <div style={css('display:flex; align-items:center; justify-content:space-between; gap:8px; padding:3.5px 0;')}>
                <div style={css('font-size:10px; color:#5b6474; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;')}>
                  <span style={css('font-weight:800; color:' + NAVY + ';')}>v{d.version || 1}</span>
                  {'  ·  '}{String(d.language || 'en').toUpperCase()}{'  ·  '}{d.focus || 'both'}
                  {'  ·  '}{relTime(d.forged_at || d.created_date)}
                  {d.generated_by_name ? `  ·  ${d.generated_by_name}` : ''}
                  {d.status === 'sent' && (
                    <span style={css('margin-left:6px; font-size:8.5px; font-weight:800; color:#0b7a3e; background:#e8f6ee; border-radius:6px; padding:1.5px 6px;')}>
                      SENT · {String(d.sent_channel || '').toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={css('display:flex; align-items:center; gap:5px; flex-shrink:0;')}>
                  {d.pdf_url && (
                    <a
                      href={d.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      style={css('display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:' + NAVY + '; text-decoration:none; border:1px solid #e2e6ee; border-radius:7px; padding:2.5px 8px;')}
                    >
                      <ExternalLink size={11} color={GOLD} /> Open
                    </a>
                  )}
                  {d.pdf_url ? (
                    <button
                      onClick={() => openSend(d)}
                      style={css('display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:800; color:' + NAVY + '; background:#fdf7e8; border:1px solid ' + GOLD + '; border-radius:7px; padding:2.5px 9px; cursor:pointer;')}
                    >
                      <Send size={11} color={GOLD} /> {sendForId === d.id ? 'Close' : 'Send'}
                    </button>
                  ) : (
                    <span style={css('font-size:9.5px; color:#a7aebc;')}>{d.status || 'forged'}</span>
                  )}
                </div>
              </div>

              {sendForId === d.id && (
                <div style={css('margin:4px 0 8px; background:#fbfcfe; border:1px solid #e7eaf1; border-radius:10px; padding:9px 10px;')}>
                  <div style={css('display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:7px;')}>
                    <select value={sendChannel} onChange={(e) => setSendChannel(e.target.value)} disabled={sending} style={selStyle}>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="imessage">iMessage</option>
                      <option value="telegram">Telegram</option>
                      <option value="email">Email</option>
                    </select>
                    {sendChannel === 'whatsapp' && (
                      <select value={waLine} onChange={(e) => setWaLine(e.target.value)} disabled={sending} style={selStyle}>
                        <option value="personal">Personal line</option>
                        <option value="business">Business line</option>
                      </select>
                    )}
                    <span style={css('font-size:8.5px; color:#8a93a6;')}>AI cover message — review, edit, send. The dossier PDF attaches automatically.</span>
                  </div>
                  <WritingField
                    value={coverText}
                    onChange={(e) => setCoverText(e.target.value)}
                    rows={4}
                    placeholder="Cover message the owner receives with the dossier…"
                    style={{ width: '100%', fontSize: 11, lineHeight: 1.45, color: '#1f2937', border: '1px solid #e2e6ee', borderRadius: 8, padding: '7px 9px', outline: 'none', resize: 'vertical', background: '#fff', boxSizing: 'border-box' }}
                  />
                  <div style={css('display:flex; justify-content:flex-end; margin-top:6px;')}>
                    <button
                      onClick={sendDossier}
                      disabled={sending || !coverText.trim()}
                      style={css('display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; padding:6px 13px; border-radius:8px; border:1px solid ' + GOLD + '; background:linear-gradient(135deg,#c9a84a,#e2c56d); color:' + NAVY + '; cursor:' + (sending ? 'wait' : 'pointer') + ';' + (sending || !coverText.trim() ? 'opacity:0.7;' : ''))}
                    >
                      {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {sending ? 'Sending…' : 'Send Dossier'}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
