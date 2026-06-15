import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { base44 } from '@/api/base44Client';
import { LOGO_URL, SIGNATURE_URL, STAMP_URL, loadImage } from '@/lib/pdfBrand';
import { FileText, Loader2, Upload, RotateCcw, CheckCircle, Info, X, AlertTriangle, FileCheck, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Erudite fixed details ────────────────────────────────────────────────────
const ERUDITE = {
  establishment: 'Erudite Property (Erudite Real Estate)',
  address: 'Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, U.A.E.',
  phone: '058 180 6000',
  mobile: '0581806000',
  email: 'Info@erudite-estate.com',
  orn: '29322',
  ded: '1032973',
  poBox: '121828',
  agentName: 'Ahmad Badreddine',
  brn: '34625',
  dateIssued: '17-05-2022',
  agentEmail: 'ahmad@erudite-estate.com',
  title: 'CEO',
};

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#090E1A', card: '#0F1729', surface: '#141F38',
  amber: '#F59F0A', amberText: '#0F1729',
  text: '#E8EAED', muted: 'rgba(232,234,237,0.5)', border: 'rgba(232,234,237,0.12)',
  navy: '#2E4374',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder = '', type = 'text', rows }) {
  const base = {
    background: T.surface, color: T.text, border: `1px solid ${T.border}`,
    borderRadius: 7, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
    width: '100%', boxSizing: 'border-box', outline: 'none',
  };
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>}
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
          style={{ ...base, resize: 'vertical' }}
          onFocus={e => e.target.style.borderColor = T.amber}
          onBlur={e => e.target.style.borderColor = T.border}
        />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={base}
          onFocus={e => e.target.style.borderColor = T.amber}
          onBlur={e => e.target.style.borderColor = T.border}
        />
      )}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ background: T.surface, padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
        <span style={{ color: T.text, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

function Toggle3({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{label}</label>}
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: `1px solid ${value === o ? T.amber : T.border}`,
              background: value === o ? T.amber : 'transparent',
              color: value === o ? T.amberText : T.muted, cursor: 'pointer',
            }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function ImageUpload({ label, storageKey, fallback }) {
  const [url, setUrl] = useState(() => localStorage.getItem(storageKey) || fallback || '');
  const ref = useRef();
  const handle = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { localStorage.setItem(storageKey, ev.target.result); setUrl(ev.target.result); };
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <button onClick={() => ref.current.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '6px 12px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>
        <Upload size={13} /> {url ? 'Replace' : 'Upload'} {label}
      </button>
      {url && <img src={url} alt={label} style={{ height: 28, objectFit: 'contain', borderRadius: 4, opacity: 0.85 }} />}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handle} />
    </div>
  );
}

// ─── PDF Generation ────────────────────────────────────────────────────────────
async function generateFormIPDF({ eruditeSide, other, property, commA, commB, buyerName, flags, datetime, declA, declB, logoUrl, sigUrl, stampUrl }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, pad = 14;
  const navy = [46, 67, 116];
  const amberC = [245, 159, 10];
  const dark = [15, 23, 41];

  const isEruditeA = eruditeSide === 'A';
  const agentA = isEruditeA ? { ...ERUDITE, isErudite: true } : { ...other, isErudite: false };
  const agentB = isEruditeA ? { ...other, isErudite: false } : { ...ERUDITE, isErudite: true };

  // ── Header ──
  const logo = await loadImage(logoUrl || LOGO_URL);
  if (logo) {
    const aspect = logo.width / logo.height;
    const lh = 14, lw = lh * aspect;
    doc.addImage(logo.dataUrl, 'PNG', pad, 8, lw, lh);
  }

  // Title block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navy);
  doc.text('AGENT TO AGENT AGREEMENT', W / 2, 13, { align: 'center' });
  doc.setFontSize(11);
  doc.text('(FORM I – SALES)', W / 2, 19, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 120);
  doc.text('As per the Real Estate Brokers By-Law No. (85) of 2006', W / 2, 24, { align: 'center' });

  // Date/Time
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...dark);
  const dateStr = datetime.date || '_______________';
  const timeStr = datetime.time || '_______________';
  doc.text(`Date: ${dateStr}    Time: ${timeStr}`, W / 2, 30, { align: 'center' });

  // Gold rule
  doc.setFillColor(...amberC);
  doc.rect(pad, 33, W - pad * 2, 0.6, 'F');

  let y = 37;

  // ── Band helper ──
  const band = (text) => {
    doc.setFillColor(...navy);
    doc.rect(pad, y, W - pad * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(text, W / 2, y + 4.8, { align: 'center' });
    y += 7;
  };

  // ── kv helper (two-column) ──
  const sanitizeText = (val) => {
    if (!val) return '';
    return String(val).replace(/\s+/g, ' ').slice(0, 80);
  };
  const kv = (labelA, valA, labelB, valB) => {
    if (y > 265) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...navy);
    const col1x = pad + 2, col2x = W / 2 + 2;
    doc.text(labelA + ':', col1x, y + 3.5);
    doc.text(labelB + ':', col2x, y + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    doc.text(sanitizeText(valA), col1x + 30, y + 3.5, { maxWidth: (W / 2 - pad - 32) });
    doc.text(sanitizeText(valB), col2x + 30, y + 3.5, { maxWidth: (W / 2 - pad - 32) });
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.2);
    doc.line(pad, y + 6, W - pad, y + 6);
    y += 7;
  };

  // ── Part 1 ──
  band('PART 1 – THE PARTIES');
  y += 2;

  // Sub-headers Agent A / B
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...navy);
  doc.text(`AGENT A (Seller's Agent)${isEruditeA ? ' — ERUDITE' : ''}`, pad + 2, y + 3);
  doc.text(`AGENT B (Buyer's Agent)${!isEruditeA ? ' — ERUDITE' : ''}`, W / 2 + 2, y + 3);
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.4);
  doc.line(pad, y + 5, W / 2 - 2, y + 5);
  doc.line(W / 2 + 0, y + 5, W - pad, y + 5);
  y += 8;

  kv('Establishment', agentA.establishment, 'Establishment', agentB.establishment);
  kv('Address', agentA.address, 'Address', agentB.address);
  kv('Phone', agentA.phone, 'Phone', agentB.phone);
  kv('Mobile', agentA.mobile, 'Mobile', agentB.mobile);
  kv('Email', agentA.email, 'Email', agentB.email);
  kv('ORN', agentA.orn, 'ORN', agentB.orn);
  kv('DED Lisc', agentA.ded, 'DED Lisc', agentB.ded);
  kv('P.O. Box', agentA.poBox, 'P.O. Box', agentB.poBox);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text('REGISTERED AGENT:', pad + 2, y + 3);
  doc.text('REGISTERED AGENT:', W / 2 + 2, y + 3);
  y += 6;

  kv('Agent Name', agentA.agentName, 'Agent Name', agentB.agentName);
  kv('BRN', agentA.brn, 'BRN', agentB.brn);
  kv('Date Issued', agentA.dateIssued, 'Date Issued', agentB.dateIssued);
  kv('Agent Mobile', agentA.agentMobile || agentA.mobile, 'Agent Mobile', agentB.agentMobile || agentB.mobile);
  kv('Agent Email', agentA.agentEmail || agentA.email, 'Agent Email', agentB.agentEmail || agentB.email);

  // ── Declarations ──
  if (declA || declB) {
    y += 2;
    band('DECLARATIONS');
    y += 2;

    const drawDecl = (label, text, x, maxW) => {
      if (!text) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...navy);
      doc.text(label, x, y + 3);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...dark);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach((line, i) => { doc.text(line, x, y + 9 + i * 4); });
    };

    const halfW = (W - pad * 2) / 2 - 4;
    drawDecl('Declaration by Agent A:', declA, pad + 2, halfW);
    drawDecl('Declaration by Agent B:', declB, W / 2 + 2, halfW);

    const lineCount = Math.max(
      declA ? doc.splitTextToSize(declA, halfW).length : 0,
      declB ? doc.splitTextToSize(declB, halfW).length : 0,
    );
    y += 12 + lineCount * 4 + 4;
  }

  // ── Part 2 The Property ──
  if (y > 220) { doc.addPage(); y = 14; }
  y += 2;
  band('PART 2 – THE PROPERTY');
  y += 2;

  const propKv = (label, val) => {
    if (y > 268) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...navy);
    doc.text(label + ':', pad + 2, y + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    doc.text(String(val || ''), pad + 50, y + 3.5, { maxWidth: W - pad * 2 - 52 });
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.2);
    doc.line(pad, y + 6, W - pad, y + 6);
    y += 7;
  };

  propKv('Property Address', property.address);
  propKv('Master Developer', property.masterDeveloper);
  propKv('Master Project Name', property.masterProject);
  propKv('Building Name', property.buildingName);
  propKv('Listed Price', property.price ? `AED ${property.price}` : '');
  propKv('Description', property.description);
  propKv('Maintenance Fee p.a.', property.maintenanceFee ? `AED ${property.maintenanceFee} per sq ft` : '');
  propKv("Buyer's Family Name", buyerName);

  y += 3;
  // Flags row
  const flagPairs = [
    ['MOU Exists', flags.mou], ['Property Tenanted', flags.tenanted],
    ['Transfer Fee Paid By', flags.transferFee], ['Buyer Pre-Finance Approved', flags.preFinance],
    ['Buyer Contacted Listing Agent', flags.contactedAgent], ['Budget', flags.budget],
  ];
  flagPairs.forEach(([label, val]) => propKv(label, val));

  // ── Part 3 Commission ──
  if (y > 240) { doc.addPage(); y = 14; }
  y += 2;
  band('PART 3 – THE COMMISSION (SPLIT)');
  y += 4;

  // Two boxes
  const boxW = 70, boxH = 20, gap = (W - pad * 2 - boxW * 2) / 3;
  const box1x = pad + gap, box2x = pad + gap * 2 + boxW;

  doc.setFillColor(245, 249, 255);
  doc.rect(box1x, y, boxW, boxH, 'F');
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.5);
  doc.rect(box1x, y, boxW, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  doc.text("Agent A (Seller's)", box1x + boxW / 2, y + 7, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...amberC);
  doc.text(`${commA}%`, box1x + boxW / 2, y + 15, { align: 'center' });

  doc.setFillColor(245, 249, 255);
  doc.rect(box2x, y, boxW, boxH, 'F');
  doc.setDrawColor(...navy);
  doc.rect(box2x, y, boxW, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  doc.text("Agent B (Buyer's)", box2x + boxW / 2, y + 7, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...amberC);
  doc.text(`${commB}%`, box2x + boxW / 2, y + 15, { align: 'center' });

  y += boxH + 6;

  // ── Part 4 Signatures ──
  if (y > 220) { doc.addPage(); y = 14; }
  band('PART 4 – THE SIGNATURES');
  y += 3;

  const sigColW = (W - pad * 2) / 2 - 4;
  const drawSigBlock = async (agent, x, isErudite) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...navy);
    doc.text(isErudite ? `Agent ${eruditeSide}${eruditeSide === 'A' ? " (Seller's Agent)" : " (Buyer's Agent)"}` : `Agent ${eruditeSide === 'A' ? 'B' : 'A'}${eruditeSide === 'A' ? " (Buyer's Agent)" : " (Seller's Agent)"}`, x, y + 4);

    let sigY = y + 8;

    if (isErudite) {
      // Signature image
      const sig = await loadImage(sigUrl || SIGNATURE_URL);
      const stmp = await loadImage(stampUrl || STAMP_URL);
      if (sig) {
        const a = sig.width / sig.height;
        const sh = 14, sw = sh * a;
        try { doc.addImage(sig.dataUrl, 'PNG', x, sigY, sw, sh); } catch { }
      }
      if (stmp) {
        const a = stmp.width / stmp.height;
        const sh = 18, sw = sh * a;
        try { doc.addImage(stmp.dataUrl, 'PNG', x + 36, sigY - 2, sw, sh); } catch { }
      }
      sigY += 16;
    } else {
      // Blank signature line
      doc.setDrawColor(160, 170, 190);
      doc.setLineWidth(0.3);
      doc.line(x, sigY + 12, x + sigColW, sigY + 12);
      sigY += 14;
    }

    // Name / Date / Stamp label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...navy);
    doc.text('Name:', x, sigY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    doc.text(isErudite ? ERUDITE.agentName : (agent.agentName || ''), x + 14, sigY + 4);
    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.2);
    doc.line(x + 14, sigY + 5.5, x + sigColW, sigY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...navy);
    doc.text('Date:', x, sigY + 10);
    doc.line(x + 14, sigY + 11.5, x + sigColW, sigY + 11.5);

    doc.text('Stamp:', x, sigY + 16);
  };

  // Draw A (left) and B (right)
  if (isEruditeA) {
    await drawSigBlock(agentA, pad + 2, true);
    await drawSigBlock(agentB, W / 2 + 2, false);
  } else {
    await drawSigBlock(agentA, pad + 2, false);
    await drawSigBlock(agentB, W / 2 + 2, true);
  }

  // Footer
  const fY = 285;
  doc.setFillColor(...navy);
  doc.rect(0, fY, W, 12, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 210, 230);
  doc.text('Erudite Property · 058 180 6000 · Info@erudite-estate.com · Shop R-10, Marquise Square Tower, Business Bay, Dubai', W / 2, fY + 7, { align: 'center' });

  return { doc, fname: buyerName ? `Erudite_FormI_${buyerName.replace(/\s+/g, '_')}.pdf` : `Erudite_FormI_${(datetime.date || 'undated').replace(/\//g, '-')}.pdf` };
}

// ─── Drag & Drop Upload Zone ──────────────────────────────────────────────────
function UploadZone({ onFileSelect, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    console.log('[FormI] Drop event fired', e.dataTransfer.files);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log('[FormI] drop fired', file);
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    console.log('[FormI] Click-to-browse fired', e.target.files);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      console.log('[FormI] browse fired', file);
      onFileSelect(file);
    }
  };

  return (
    <div
      style={{
        border: `2px dashed ${isDragging ? T.amber : T.border}`,
        borderRadius: 12,
        padding: '24px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        background: isDragging ? 'rgba(245,159,10,0.08)' : T.card,
        opacity: disabled ? 0.6 : 1,
      }}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled}
      />
      <Upload size={32} style={{ color: T.amber, marginBottom: 12 }} />
      <p style={{ color: T.text, fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
        {isDragging ? 'Drop to upload' : 'Upload Form I PDF'}
      </p>
      <p style={{ color: T.muted, fontSize: 11, margin: 0 }}>
        Drag & drop a Form I PDF — review before filling
      </p>
    </div>
  );
}

// ─── Review Modal (Diagnostic) ────────────────────────────────────────────────
function ReviewModal({ result, editedData, setEditedData, sideMismatch, onApply, onFlip, onCancel }) {
  const updateField = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  // result is now diagnosticData: { success, file_url, http_status, raw_response, error }
  const isError = result?.success === false;
  const rawResponse = result?.raw_response;
  const fileUrl = result?.file_url || '(not available)';
  const httpStatus = result?.http_status;
  const fullJson = JSON.stringify(result?.raw_response, null, 2);
  const rawText = rawResponse?.raw_text_first_4000 || '(not in response)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
        maxWidth: 1100, width: '100%', maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ color: T.text, fontSize: 16, fontWeight: 700, margin: 0 }}>
              {isError ? '❌ Upload/Parse Error' : '📋 Full Diagnostic Response'}
            </h2>
            <p style={{ color: T.muted, fontSize: 11, margin: '4px 0 0' }}>
              {isError ? 'Error details below — check console for stack trace' : 'Complete raw JSON from parseFormI — nothing auto-fills'}
            </p>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', color: T.muted, cursor: 'pointer',
            padding: 4, borderRadius: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Error Banner */}
        {isError && (
          <div style={{
            margin: '16px 20px 0', padding: '14px 16px',
            background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.35)`,
            borderRadius: 10,
          }}>
            <p style={{ color: '#F87171', fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>
              ⚠️ Exception Thrown
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#FCA5A5', marginBottom: 8 }}>
              <strong>Name:</strong> {result?.error?.name}<br/>
              <strong>Message:</strong> {result?.error?.message}<br/>
              <strong>File URL:</strong> {result?.file_url}
            </div>
            <details style={{ fontSize: 9, color: '#F87171' }}>
              <summary style={{ cursor: 'pointer', marginBottom: 4 }}>Show Stack Trace</summary>
              <pre style={{
                margin: 0, padding: 8, background: 'rgba(0,0,0,0.3)',
                borderRadius: 6, overflow: 'auto', maxHeight: 200,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{result?.error?.stack}</pre>
            </details>
          </div>
        )}

        {/* Side Mismatch Warning (only on success) */}
        {!isError && sideMismatch && (
          <div style={{
            margin: '16px 20px 0', padding: '12px 14px',
            background: 'rgba(245,159,10,0.12)', border: `1px solid rgba(245,159,10,0.3)`,
            borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={18} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: '#FCD34D', fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>
                Side Mismatch Detected
              </p>
              <p style={{ color: T.muted, fontSize: 11, margin: 0 }}>
                The PDF shows Erudite as {rawResponse?.erudite_side === 'seller' ? "Seller's Agent (A)" : "Buyer's Agent (B)"},
                but your form has Erudite as {rawResponse?.erudite_side === 'seller' ? "Buyer's" : "Seller's"}.
              </p>
              <button onClick={onFlip} style={{
                marginTop: 8, padding: '6px 12px', background: T.amber, color: T.amberText,
                border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                Flip Erudite Side to Match PDF
              </button>
            </div>
          </div>
        )}

        {/* File URL + HTTP Status */}
        <div style={{
          margin: '16px 20px 0', padding: '10px 14px',
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 8, fontFamily: 'monospace', fontSize: 10,
        }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: T.muted, textTransform: 'uppercase', fontSize: 9 }}>Storage File URL:</span>{' '}
            <span style={{ color: T.text, wordBreak: 'break-all' }}>{fileUrl}</span>
          </div>
          {httpStatus && (
            <div>
              <span style={{ color: T.muted, textTransform: 'uppercase', fontSize: 9 }}>HTTP Status:</span>{' '}
              <span style={{ color: httpStatus >= 200 && httpStatus < 300 ? '#4ADE80' : '#F87171' }}>{httpStatus}</span>
            </div>
          )}
        </div>

        {/* Full Raw JSON Response */}
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ color: T.text, fontSize: 12, fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Complete parseFormI Response (Raw JSON)
          </h3>
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: 12, maxHeight: 500, overflow: 'auto',
          }}>
            <pre style={{
              margin: 0, fontSize: 9, fontFamily: 'monospace', color: T.text,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.3,
            }}>{fullJson || '(no response data)'}</pre>
          </div>
        </div>

        {/* Parsed Fields (only on success with counterparty data) */}
        {!isError && rawResponse?.counterparty && (
          <div style={{ padding: '0 20px 20px' }}>
            <h3 style={{ color: T.text, fontSize: 12, fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Editable Counterparty Fields (Agent {rawResponse?.their_side === 'seller' ? 'A' : 'B'})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Establishment</label>
                <input value={editedData.establishment || ''} onChange={e => updateField('establishment', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Address</label>
                <input value={editedData.address || ''} onChange={e => updateField('address', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>ORN</label>
                <input value={editedData.orn || ''} onChange={e => updateField('orn', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>DED</label>
                <input value={editedData.ded || ''} onChange={e => updateField('ded', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Agent Name</label>
                <input value={editedData.agentName || ''} onChange={e => updateField('agentName', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>BRN</label>
                <input value={editedData.brn || ''} onChange={e => updateField('brn', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Phone</label>
                <input value={editedData.phone || ''} onChange={e => updateField('phone', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Mobile</label>
                <input value={editedData.mobile || ''} onChange={e => updateField('mobile', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 9, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Email</label>
                <input value={editedData.email || ''} onChange={e => updateField('email', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 11 }} />
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{
          padding: '16px 20px', borderTop: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10, background: T.surface,
        }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: T.surface, color: T.muted,
            border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Close
          </button>
          {!isError && (
            <>
              <button onClick={onFlip} disabled={!sideMismatch} style={{
                padding: '10px 20px', background: sideMismatch ? T.amber : 'rgba(245,159,10,0.3)', color: T.amberText,
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: sideMismatch ? 'pointer' : 'not-allowed',
                opacity: sideMismatch ? 1 : 0.5,
              }}>
                Flip Side
              </button>
              <button onClick={onApply} disabled={!rawResponse?.counterparty} style={{
                padding: '10px 20px', background: rawResponse?.counterparty ? T.amber : 'rgba(148,163,184,0.3)', color: T.amberText,
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: rawResponse?.counterparty ? 'pointer' : 'not-allowed',
                opacity: rawResponse?.counterparty ? 1 : 0.5,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle size={14} /> Apply to Form
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FormIGenerator() {
  const [eruditeSide, setEruditeSide] = useState('A');

  const [other, setOther] = useState({
    establishment: '', address: '', phone: '', mobile: '', fax: '',
    email: '', orn: '', ded: '', poBox: '',
    agentName: '', brn: '', dateIssued: '', agentMobile: '', agentEmail: '',
  });

  const [property, setProperty] = useState({
    address: '', masterDeveloper: '', masterProject: '', buildingName: '',
    price: '', description: '', maintenanceFee: '',
  });

  const [commSplit, setCommSplit] = useState(50);
  const commA = commSplit;
  const commB = 100 - commSplit;

  const [buyerName, setBuyerName] = useState('');
  const [flags, setFlags] = useState({
    mou: '', tenanted: '', transferFee: '', preFinance: '', contactedAgent: '', budget: '',
  });

  const [datetime, setDatetime] = useState({ date: '', time: '' });
  const [declA, setDeclA] = useState('');
  const [declB, setDeclB] = useState('');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // ─── PDF Upload & Parse State ───────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [sideMismatch, setSideMismatch] = useState(false);
  const [editedCounterparty, setEditedCounterparty] = useState(null);


  const logoUrl = localStorage.getItem('erudite_logo') || LOGO_URL;
  const sigUrl = localStorage.getItem('erudite_signature') || SIGNATURE_URL;
  const stampUrl = localStorage.getItem('erudite_stamp') || STAMP_URL;

  const setO = (k, v) => setOther(o => ({ ...o, [k]: v }));
  const setP = (k, v) => setProperty(p => ({ ...p, [k]: v }));
  const setF = (k, v) => setFlags(f => ({ ...f, [k]: v }));

  // ─── PDF Upload & Parse Handlers ────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    console.log('[FormI] handleFileUpload called with:', file);
    if (file.type !== 'application/pdf') {
      toast.error('PDF files only', { description: 'Please upload a Form I PDF document' });
      return;
    }

    setUploading(true);
    let diagnosticData = null;
    let fileUrl = null;
    try {
      // (a) Upload to Base44 storage using Core integration
      console.log('[FormI] Calling UploadFile with file:', file.name, file.type, file.size);
      let uploadRes;
      try {
        uploadRes = await base44.integrations.Core.UploadFile({ file });
      } catch (uploadErr) {
        console.error('[FormI] UploadFile integration call failed:', uploadErr);
        console.error('[FormI] Error details:', {
          message: uploadErr.message,
          name: uploadErr.name,
          stack: uploadErr.stack,
          response: uploadErr.response?.data,
          status: uploadErr.response?.status,
        });
        throw uploadErr;
      }
      fileUrl = uploadRes.file_url;
      console.log('[FormI] Storage URL after upload:', fileUrl);
      if (!fileUrl) {
        throw new Error('UploadFile returned no file_url');
      }

      // (b) Exact payload sent to parseFormI
      const parsePayload = { file_url: fileUrl, debug: true };
      console.log('[FormI] Payload sent to parseFormI:', parsePayload);

      // Parse the Form I
      const parseRes = await base44.functions.invoke('parseFormI', parsePayload);

      // (c) Full parseFormI response
      console.log('[FormI] Full parseFormI response:', JSON.stringify(parseRes, null, 2));

      const result = parseRes.data;
      const status = parseRes.status;

      // Build diagnostic data for modal display
      diagnosticData = {
        success: true,
        file_url: fileUrl,
        http_status: status,
        raw_response: result,
        error: null,
      };

      // Check for side mismatch
      const eruditeIsSeller = eruditeSide === 'A';
      const pdfEruditeIsSeller = result?.erudite_side === 'seller';
      const mismatch = eruditeIsSeller !== pdfEruditeIsSeller;

      setSideMismatch(mismatch);
      setParseResult({ ...diagnosticData });
      setEditedCounterparty({ ...(result?.counterparty || {}) });
      setShowReviewModal(true);

      if (!result?.ok) {
        toast.warning('Parse returned ok=false', {
          description: result?.note || 'Check modal for full response'
        });
      } else if (mismatch) {
        toast.warning('Side mismatch detected', {
          description: 'The uploaded PDF shows Erudite on the opposite side'
        });
      } else {
        toast.success('Form I parsed', {
          description: 'Review modal opened with full diagnostic data'
        });
      }
    } catch (err) {
      console.error('[FormI] Upload/parse threw exception:', err);
      // Build error diagnostic data
      diagnosticData = {
        success: false,
        file_url: fileUrl || '(upload failed)',
        http_status: null,
        raw_response: null,
        error: {
          message: err?.message || 'Unknown error',
          stack: err?.stack || 'No stack trace',
          name: err?.name || 'Error',
        },
      };
      setParseResult(diagnosticData);
      setShowReviewModal(true);
      toast.error('Upload/parse failed', {
        description: 'Check modal for full error details'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApplyParsedData = () => {
    if (!editedCounterparty) return;

    // Map counterparty fields to the "other" state
    const mappedFields = {
      establishment: editedCounterparty.establishment || '',
      address: editedCounterparty.address || '',
      phone: editedCounterparty.phone || '',
      mobile: editedCounterparty.mobile || '',
      fax: editedCounterparty.fax || '',
      email: editedCounterparty.email || '',
      orn: editedCounterparty.orn || '',
      ded: editedCounterparty.ded || '',
      poBox: editedCounterparty.poBox || '',
      agentName: editedCounterparty.agentName || '',
      brn: editedCounterparty.brn || '',
      dateIssued: editedCounterparty.dateIssued || '',
      agentMobile: editedCounterparty.agentMobile || '',
      agentEmail: editedCounterparty.agentEmail || '',
    };

    setOther(mappedFields);
    setShowReviewModal(false);
    setParseResult(null);
    setEditedCounterparty(null);
    setSideMismatch(false);

    toast.success('Other agency details applied', {
      description: 'Review the form before generating the PDF'
    });
  };

  const handleFlipSide = () => {
    setEruditeSide(prev => prev === 'A' ? 'B' : 'A');
    setSideMismatch(false);
    toast.success('Side updated', {
      description: `Erudite is now Agent ${eruditeSide === 'A' ? 'B' : 'A'}`
    });
  };

  const handleCancelParse = () => {
    setShowReviewModal(false);
    setParseResult(null);
    setEditedCounterparty(null);
    setSideMismatch(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setDone('');
    try {
      const { doc, fname } = await generateFormIPDF({ eruditeSide, other, property, commA, commB, buyerName, flags, datetime, declA, declB, logoUrl, sigUrl, stampUrl });
      const pdfBase64 = doc.output('datauristring');
      const base64Data = pdfBase64.split(',')[1];

      // Upload to Google Drive
      try {
        const driveUpload = await base44.functions.invoke('uploadToGoogleDrive', {
          base64Content: base64Data,
          fileName: fname,
          folderPath: 'Form I Generator',
          mimeType: 'application/pdf'
        });
        if (driveUpload?.file_url) {
          toast.success('Form I uploaded to Google Drive', { description: fname });
          setDone(`PDF generated and uploaded to Google Drive — Erudite is Agent ${eruditeSide} (${eruditeSide === 'A' ? "Seller's" : "Buyer's"} Agent), signed & stamped on that side.`);
        } else {
          throw new Error('Upload failed');
        }
      } catch (driveError) {
        console.error('Google Drive upload failed:', driveError.message);
        // Fallback: download locally
        doc.save(fname);
        toast.warning('Saved locally (Drive upload failed)', { description: fname });
        setDone(`PDF generated locally — Erudite is Agent ${eruditeSide} (${eruditeSide === 'A' ? "Seller's" : "Buyer's"} Agent), signed & stamped on that side.`);
      }
    } catch (err) {
      console.error('Form I generation failed:', err);
      toast.error('PDF generation failed', { description: err?.message || 'unknown error' });
    } finally {
      setGenerating(false);
    }
  };

  const labelStyle = { color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Erudite Property · Internal Tool</p>
          <h1 style={{ color: T.text, fontSize: 17, fontWeight: 700, margin: 0 }}>Form I Generator — Agent-to-Agent Agreement</h1>
        </div>
        <button onClick={handleGenerate} disabled={generating} style={{
          display: 'flex', alignItems: 'center', gap: 8, background: generating ? 'rgba(245,159,10,0.4)' : T.amber,
          color: T.amberText, border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', whiteSpace: 'nowrap',
        }}>
          {generating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={15} />}
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>

        {/* Disclaimer */}
        {showDisclaimer && (
          <div style={{ background: 'rgba(245,159,10,0.08)', border: `1px solid rgba(245,159,10,0.25)`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
            <Info size={14} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: '#FCD34D', fontSize: 12, margin: 0, flex: 1 }}>This is a branded working copy of Form I. The official Form I is issued via RERA Trakheesi / Dubai REST.</p>
            <button onClick={() => setShowDisclaimer(false)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Success message */}
        {done && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <CheckCircle size={14} style={{ color: '#4ADE80', flexShrink: 0 }} />
            <p style={{ color: '#4ADE80', fontSize: 12, margin: 0 }}>{done}</p>
          </div>
        )}

        {/* Image assets */}
        <SectionCard title="Company Assets">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            <div><span style={labelStyle}>Logo</span><div style={{ marginTop: 6 }}><ImageUpload label="Logo" storageKey="erudite_logo" fallback={LOGO_URL} /></div></div>
            <div><span style={labelStyle}>Signature</span><div style={{ marginTop: 6 }}><ImageUpload label="Signature" storageKey="erudite_signature" fallback={SIGNATURE_URL} /></div></div>
            <div><span style={labelStyle}>Stamp</span><div style={{ marginTop: 6 }}><ImageUpload label="Stamp" storageKey="erudite_stamp" fallback={STAMP_URL} /></div></div>
          </div>
        </SectionCard>

        {/* Erudite side + date */}
        <SectionCard title="Agreement Setup">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>Which side is Erudite on?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['A', 'B'].map(s => (
                  <button key={s} onClick={() => setEruditeSide(s)} style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: `1px solid ${eruditeSide === s ? T.amber : T.border}`,
                    background: eruditeSide === s ? T.amber : T.surface,
                    color: eruditeSide === s ? T.amberText : T.muted, cursor: 'pointer',
                  }}>
                    Agent {s} ({s === 'A' ? "Seller's" : "Buyer's"} Agent)
                  </button>
                ))}
              </div>
              <p style={{ color: T.muted, fontSize: 11, marginTop: 6 }}>Erudite details auto-fill; opposite side is editable.</p>
            </div>
            <div>
              <Field label="Agreement Date" value={datetime.date} onChange={v => setDatetime(d => ({ ...d, date: v }))} type="date" />
              <Field label="Agreement Time" value={datetime.time} onChange={v => setDatetime(d => ({ ...d, time: v }))} type="time" />
            </div>
          </div>
        </SectionCard>

        {/* PDF Upload Zone */}
        <SectionCard title="Import from Existing Form I">
          <UploadZone onFileSelect={handleFileUpload} disabled={uploading} />
          {uploading && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 11 }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Uploading and parsing PDF...
            </div>
          )}
        </SectionCard>

        {/* Other agency */}
        <SectionCard title={`Other Agency Details (Agent ${eruditeSide === 'A' ? 'B' : 'A'} — ${eruditeSide === 'A' ? "Buyer's" : "Seller's"} Agent)`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 20px' }}>
            <Field label="Establishment Name" value={other.establishment} onChange={v => setO('establishment', v)} />
            <Field label="ORN" value={other.orn} onChange={v => setO('orn', v)} />
            <Field label="DED Licence No." value={other.ded} onChange={v => setO('ded', v)} />
            <Field label="P.O. Box" value={other.poBox} onChange={v => setO('poBox', v)} />
            <Field label="Phone" value={other.phone} onChange={v => setO('phone', v)} />
            <Field label="Mobile" value={other.mobile} onChange={v => setO('mobile', v)} />
            <Field label="Fax" value={other.fax} onChange={v => setO('fax', v)} />
            <Field label="Email" value={other.email} onChange={v => setO('email', v)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Address" value={other.address} onChange={v => setO('address', v)} />
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 12 }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 10 }}>Registered Agent</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 20px' }}>
              <Field label="Agent Name" value={other.agentName} onChange={v => setO('agentName', v)} />
              <Field label="BRN" value={other.brn} onChange={v => setO('brn', v)} />
              <Field label="Date Issued" value={other.dateIssued} onChange={v => setO('dateIssued', v)} />
              <Field label="Agent Mobile" value={other.agentMobile} onChange={v => setO('agentMobile', v)} />
              <Field label="Agent Email" value={other.agentEmail} onChange={v => setO('agentEmail', v)} />
            </div>
          </div>
        </SectionCard>

        {/* Declarations */}
        <SectionCard title="Declarations (Optional)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <Field label={`Declaration by Agent A (${eruditeSide === 'A' ? 'Erudite' : 'Other Agency'})`} value={declA} onChange={setDeclA} rows={3} />
            <Field label={`Declaration by Agent B (${eruditeSide === 'B' ? 'Erudite' : 'Other Agency'})`} value={declB} onChange={setDeclB} rows={3} />
          </div>
        </SectionCard>

        {/* Property */}
        <SectionCard title="Property Details">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 20px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Property Address" value={property.address} onChange={v => setP('address', v)} />
            </div>
            <Field label="Master Developer" value={property.masterDeveloper} onChange={v => setP('masterDeveloper', v)} />
            <Field label="Master Project Name" value={property.masterProject} onChange={v => setP('masterProject', v)} />
            <Field label="Building Name" value={property.buildingName} onChange={v => setP('buildingName', v)} />
            <Field label="Listed Price (AED)" value={property.price} onChange={v => setP('price', v)} />
            <Field label="Maintenance Fee p.a. (per sq ft)" value={property.maintenanceFee} onChange={v => setP('maintenanceFee', v)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Property Description" value={property.description} onChange={v => setP('description', v)} rows={2} />
            </div>
          </div>
        </SectionCard>

        {/* Commission split */}
        <SectionCard title="Commission Split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', margin: '0 0 4px' }}>Agent A (Seller's)</p>
                <p style={{ color: T.amber, fontWeight: 700, fontSize: 28, margin: 0 }}>{commA}%</p>
              </div>
              <span style={{ color: T.border, fontSize: 20, fontWeight: 300 }}>|</span>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', margin: '0 0 4px' }}>Agent B (Buyer's)</p>
                <p style={{ color: T.amber, fontWeight: 700, fontSize: 28, margin: 0 }}>{commB}%</p>
              </div>
            </div>
            <div>
              <input
                type="range" min={0} max={100} step={5} value={commSplit}
                onChange={e => setCommSplit(Number(e.target.value))}
                style={{ width: '100%', accentColor: T.amber }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: T.muted, fontSize: 10 }}>0 / 100</span>
                <span style={{ color: T.muted, fontSize: 10 }}>50 / 50</span>
                <span style={{ color: T.muted, fontSize: 10 }}>100 / 0</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[[50, 50], [60, 40], [70, 30], [40, 60], [30, 70]].map(([a, b]) => (
                <button key={a} onClick={() => setCommSplit(a)} style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${commSplit === a ? T.amber : T.border}`,
                  background: commSplit === a ? T.amber : T.surface,
                  color: commSplit === a ? T.amberText : T.muted, cursor: 'pointer',
                }}>{a}/{b}</button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Buyer & Deal flags */}
        <SectionCard title="Buyer & Deal Details">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 20px' }}>
            <Field label="Buyer's Family Name" value={buyerName} onChange={setBuyerName} />
            <Field label="Buyer Budget" value={flags.budget} onChange={v => setF('budget', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 8 }}>
            <Toggle3 label="MOU Exists?" value={flags.mou} onChange={v => setF('mou', v)} options={['Yes', 'No']} />
            <Toggle3 label="Property Tenanted?" value={flags.tenanted} onChange={v => setF('tenanted', v)} options={['Yes', 'No']} />
            <Toggle3 label="Transfer Fee Paid By" value={flags.transferFee} onChange={v => setF('transferFee', v)} options={['Seller', 'Buyer', 'Negotiable']} />
            <Toggle3 label="Buyer Pre-Finance Approved?" value={flags.preFinance} onChange={v => setF('preFinance', v)} options={['Yes', 'No']} />
            <Toggle3 label="Buyer Contacted Listing Agent?" value={flags.contactedAgent} onChange={v => setF('contactedAgent', v)} options={['Yes', 'No']} />
          </div>
        </SectionCard>

        {/* Generate button bottom */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 40 }}>
          <button onClick={handleGenerate} disabled={generating} style={{
            display: 'flex', alignItems: 'center', gap: 8, background: generating ? 'rgba(245,159,10,0.4)' : T.amber,
            color: T.amberText, border: 'none', borderRadius: 9, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
          }}>
            {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
            {generating ? 'Generating…' : 'Download Form I PDF'}
          </button>
        </div>

      </div>

      {/* Review Modal */}
      {showReviewModal && parseResult && (
        <ReviewModal
          result={parseResult}
          editedData={editedCounterparty}
          setEditedData={setEditedCounterparty}
          sideMismatch={sideMismatch}
          onApply={handleApplyParsedData}
          onFlip={handleFlipSide}
          onCancel={handleCancelParse}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}