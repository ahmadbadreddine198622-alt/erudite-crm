import React, { useState, useMemo } from 'react';
import { calcTransfer, getScenarioName, sumLines } from '@/lib/transferCalc';
import { LOGO_URL, loadImage } from '@/lib/pdfBrand';
import { jsPDF } from 'jspdf';
import { RefreshCw, Plus, FileText, Loader2, RotateCcw, X, ChevronDown } from 'lucide-react';

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg:        '#090E1A',
  card:      '#0F1729',
  surface:   '#141F38',
  amber:     '#F59F0A',
  amberText: '#0F1729',
  text:      '#E8EAED',
  muted:     'rgba(232,234,237,0.45)',
  border:    'rgba(232,234,237,0.12)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

// ─── Base Components ──────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          position: 'relative', width: 44, height: 24, borderRadius: 12,
          background: value ? T.amber : 'rgba(232,234,237,0.15)',
          border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          display: 'inline-block', width: 18, height: 18, borderRadius: 9, background: '#fff',
          position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </button>
      <span style={{ color: value ? T.amber : T.muted, fontSize: 12, fontWeight: 600, minWidth: 24 }}>{value ? 'Yes' : 'No'}</span>
    </div>
  );
}

function Input({ value, onChange, type = 'number', placeholder = '', style: s = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: T.card, color: T.text, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: '7px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box',
        outline: 'none', fontFamily: 'inherit', ...s,
      }}
      onFocus={e => { e.target.style.borderColor = T.amber; e.target.style.boxShadow = `0 0 0 2px ${T.amber}25`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function Select({ value, onChange, options, style: s = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: T.card, color: T.text, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: '7px 12px', fontSize: 13, width: '100%',
        outline: 'none', cursor: 'pointer', fontFamily: 'inherit', ...s,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ background: T.card }}>{o.label}</option>)}
    </select>
  );
}

function PillBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        border: `1px solid ${active ? T.amber : T.border}`,
        background: active ? T.amber : 'transparent',
        color: active ? T.amberText : T.muted,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ background: T.surface, borderRadius: '10px 10px 0 0', padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ color: T.text, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
    </div>
  );
}

// ─── Fee Table ─────────────────────────────────────────────────────────────────
function FeeTable({ title, lines, overrides, setOverrides, customLines, setCustomLines, commPct, commDisplay }) {
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState({ label: '', basis: '', amount: '', est: false });

  const getAmt = l => overrides[l.id] !== undefined ? overrides[l.id] : l.amount;
  const isOver = id => overrides[id] !== undefined;
  const resetOne = id => setOverrides(o => { const n = { ...o }; delete n[id]; return n; });
  const resetAll = () => setOverrides({});

  const total = lines.reduce((s, l) => {
    const hide = (l.id.includes('comm')) && commPct === 0 && commDisplay === 'hide';
    if (hide) return s;
    return s + Number(getAmt(l) || 0);
  }, 0) + customLines.reduce((s, l) => s + Number(l.amount || 0), 0);

  const addCustom = () => {
    if (!newLine.label) return;
    setCustomLines(c => [...c, { ...newLine, id: `custom_${Date.now()}` }]);
    setNewLine({ label: '', basis: '', amount: '', est: false });
    setAdding(false);
  };

  return (
    <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: T.surface, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: T.text, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
        <button onClick={resetAll} style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.muted, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }}>
          <RotateCcw size={11} /> Reset all
        </button>
      </div>

      {/* Column labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 32px', gap: 4, padding: '6px 16px', borderBottom: `1px solid ${T.border}` }}>
        <span style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fee Item</span>
        <span style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Basis</span>
        <span style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Amount (AED)</span>
        <span />
      </div>

      {/* Rows */}
      {lines.map((l, i) => {
        const isComm = l.id && l.id.includes('comm');
        if (isComm && commPct === 0 && commDisplay === 'hide') return null;
        const amt = getAmt(l);
        const over = isOver(l.id);
        return (
          <div
            key={l.id}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 120px 32px', gap: 4,
              padding: '7px 16px', alignItems: 'center',
              background: over ? 'rgba(245,159,10,0.08)' : i % 2 === 0 ? 'transparent' : 'rgba(232,234,237,0.02)',
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span style={{ color: T.text, fontSize: 13 }}>{l.label}</span>
              {l.est && <span style={{ color: '#F97316', fontSize: 10, marginLeft: 4 }}>(est.)</span>}
            </div>
            <span style={{ color: T.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.basis}</span>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={amt}
                onChange={e => setOverrides(o => ({ ...o, [l.id]: e.target.value }))}
                style={{
                  width: '100%', background: over ? 'rgba(245,159,10,0.12)' : T.surface,
                  border: `1px solid ${over ? T.amber : T.border}`,
                  borderRadius: 6, padding: '4px 8px', color: over ? T.amber : T.text,
                  fontSize: 13, textAlign: 'right', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  fontWeight: over ? 600 : 400,
                }}
                onFocus={e => { if (!over) e.target.style.borderColor = T.amber; }}
                onBlur={e => { if (!over) e.target.style.borderColor = T.border; }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {over && (
                <button onClick={() => resetOne(l.id)} title="Reset" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 2 }}>
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Zero-comm waived note */}
      {commPct === 0 && commDisplay === 'note' && (
        <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ color: T.muted, fontSize: 11, fontStyle: 'italic' }}>* Commission waived</span>
        </div>
      )}

      {/* Custom lines */}
      {customLines.map((l, i) => (
        <div
          key={l.id}
          style={{
            display: 'grid', gridTemplateColumns: '1fr 160px 120px 32px', gap: 4,
            padding: '7px 16px', alignItems: 'center',
            background: 'rgba(99,102,241,0.06)', borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div>
            <span style={{ color: T.text, fontSize: 13 }}>{l.label}</span>
            {l.est && <span style={{ color: '#F97316', fontSize: 10, marginLeft: 4 }}>(est.)</span>}
          </div>
          <span style={{ color: T.muted, fontSize: 11 }}>{l.basis}</span>
          <input
            type="number"
            value={l.amount}
            onChange={e => setCustomLines(c => c.map(x => x.id === l.id ? { ...x, amount: e.target.value } : x))}
            style={{
              width: '100%', background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '4px 8px', color: T.text,
              fontSize: 13, textAlign: 'right', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <button onClick={() => setCustomLines(c => c.filter(x => x.id !== l.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: 2, display: 'flex', justifyContent: 'center' }}>
            <X size={13} />
          </button>
        </div>
      ))}

      {/* Total row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: `2px solid ${T.amber}25`, borderLeft: `3px solid ${T.amber}` }}>
        <span style={{ color: T.amber, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title} Total</span>
        <span style={{ color: T.amber, fontWeight: 700, fontSize: 16 }}>AED {fmt(total)}</span>
      </div>

      {/* Add custom */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.amber, fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={13} /> Add custom line item
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input value={newLine.label} onChange={v => setNewLine(n => ({ ...n, label: v }))} type="text" placeholder="Label" />
              <Input value={newLine.basis} onChange={v => setNewLine(n => ({ ...n, basis: v }))} type="text" placeholder="Basis (optional)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input value={newLine.amount} onChange={v => setNewLine(n => ({ ...n, amount: v }))} placeholder="Amount" style={{ width: 130 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.muted, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={newLine.est} onChange={e => setNewLine(n => ({ ...n, est: e.target.checked }))} /> Estimate
              </label>
              <button onClick={addCustom} style={{ background: T.amber, color: T.amberText, border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
              <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PDF Generator ─────────────────────────────────────────────────────────────
async function generatePDF({ scenarioName, price, loanAmount, outstandingBalance, buyerFinancing, sellerMortgage, buyerLines, buyerOverrides, buyerCustom, dewaDeposit, sellerLines, sellerOverrides, sellerCustom, showSides, commDisplay, buyerCommPct, sellerCommPct }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, pad = 15;
  const navy = [15, 23, 41];
  const amber = [245, 159, 10];
  const gray = [100, 110, 130];

  // Logo
  const logo = await loadImage(LOGO_URL);
  if (logo) {
    const aspect = logo.width / logo.height;
    const lh = 13, lw = lh * aspect;
    doc.addImage(logo.dataUrl, 'PNG', (W - lw) / 2, 8, lw, lh);
  }

  let y = 27;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text('Property Transfer – Cost Estimate', W / 2, y, { align: 'center' });
  y += 5;

  // Amber rule
  doc.setFillColor(...amber);
  doc.rect(pad, y, W - pad * 2, 0.7, 'F');
  y += 4;

  // Sub-line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  let sub = `${scenarioName}  ·  AED ${fmt(price)}`;
  if (buyerFinancing) sub += `  ·  Loan AED ${fmt(loanAmount)}`;
  if (sellerMortgage) sub += `  ·  Outstanding AED ${fmt(outstandingBalance)}`;
  doc.text(sub, W / 2, y, { align: 'center' });
  y += 7;

  const drawTable = (title, lines, overrides, customLines, commPct) => {
    if (y > 248) { doc.addPage(); y = 14; }
    // Table header
    doc.setFillColor(...navy);
    doc.rect(pad, y, W - pad * 2, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, pad + 3, y + 5);
    doc.text('Basis', pad + 85, y + 5);
    doc.text('Amount (AED)', W - pad, y + 5, { align: 'right' });
    y += 7.5;

    let rowTotal = 0;
    const allLines = [...lines, ...customLines];

    allLines.forEach((l, i) => {
      const isComm = l.id && l.id.includes('comm');
      if (isComm && commPct === 0 && commDisplay === 'hide') return;
      const amt = overrides[l.id] !== undefined ? Number(overrides[l.id]) : l.amount;
      rowTotal += Number.isFinite(Number(amt)) ? Number(amt) : 0;
      if (y > 260) { doc.addPage(); y = 14; }
      doc.setFillColor(i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 251 : 255, i % 2 === 0 ? 253 : 255);
      doc.rect(pad, y, W - pad * 2, 6.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 41);
      let label = l.label;
      if (l.est) label += ' (est.)';
      doc.text(label, pad + 3, y + 4.5, { maxWidth: 78 });
      doc.setTextColor(...gray);
      doc.text(String(l.basis || ''), pad + 85, y + 4.5, { maxWidth: 58 });
      doc.setTextColor(15, 23, 41);
      const display = Number(amt) === 0 && l.est ? 'Confirm w/ bank' : `AED ${fmt(amt)}`;
      doc.text(display, W - pad, y + 4.5, { align: 'right' });
      y += 6.5;
    });

    // Zero-comm note
    if (commPct === 0 && commDisplay === 'note') {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...gray);
      doc.text('* Commission waived', pad + 3, y + 4);
      y += 6;
    }

    // Total row
    doc.setFillColor(...amber);
    doc.rect(pad, y, 3, 8, 'F');
    doc.setFillColor(255, 249, 235);
    doc.rect(pad + 3, y, W - pad * 2 - 3, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 41);
    doc.text(`${title} TOTAL`, pad + 7, y + 5.5);
    doc.setTextColor(...amber);
    doc.text(`AED ${fmt(rowTotal)}`, W - pad, y + 5.5, { align: 'right' });
    y += 12;
    return rowTotal;
  };

  let buyerTotal = 0, sellerTotal = 0;

  if (showSides !== 'seller') {
    buyerTotal = drawTable('BUYER', buyerLines, buyerOverrides, buyerCustom, buyerCommPct);
    // DEWA
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.text(`+ DEWA Security Deposit (refundable, not in total above): AED ${fmt(dewaDeposit)}`, pad + 3, y);
    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 41);
    doc.text(`Buyer cash needed on day (incl. refundable deposit): AED ${fmt(buyerTotal + dewaDeposit)}`, pad + 3, y);
    y += 9;
  }

  if (showSides !== 'buyer') {
    sellerTotal = drawTable('SELLER', sellerLines, sellerOverrides, sellerCustom, sellerCommPct);
  }

  // Grand total
  if (showSides === 'both') {
    doc.setFillColor(...amber);
    doc.rect(pad, y, W - pad * 2, 8.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 41);
    doc.text('GRAND TOTAL (Buyer + Seller, excl. refundable deposit)', pad + 4, y + 5.8);
    doc.text(`AED ${fmt(buyerTotal + sellerTotal)}`, W - pad, y + 5.8, { align: 'right' });
    y += 13;
  }

  // Notes
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.text('Note: Under 2026 regulations, closing costs cannot be financed into the mortgage — all transfer costs must be paid in cash upfront.', pad, y, { maxWidth: W - pad * 2 });
  y += 5;
  doc.text('Bank processing fees, valuation and mortgage-related charges vary by lender — confirm per deal.', pad, y, { maxWidth: W - pad * 2 });
  y += 7;

  // Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text('Disclaimer: Figures marked (est.) are estimates and vary by lender. DLD government fees are fixed but subject to change by circular. Final amounts are confirmed at the trustee office on the day of transfer. Under 2026 regulations, transaction costs must be paid in cash and cannot be added to the mortgage. This estimate is provided for guidance only and does not constitute a binding quotation.', pad, y, { maxWidth: W - pad * 2 });

  // Footer
  const fY = 272;
  doc.setFillColor(15, 23, 41);
  doc.rect(0, fY, W, 25, 'F');
  doc.setFillColor(...amber);
  doc.rect(0, fY, W, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Erudite Property · 058 180 6000 · ahmad@erudite-estate.com', W / 2, fY + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 195, 220);
  doc.text('Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, UAE', W / 2, fY + 13, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...amber);
  doc.text('A major key for your home', W / 2, fY + 19, { align: 'center' });

  doc.save('Erudite_Transfer_Cost_Estimate.pdf');
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TransferFeeCalculator() {
  // Inputs
  const [price, setPrice] = useState(2000000);
  const [propertyType, setPropertyType] = useState('apartment');
  const [buyerFinancing, setBuyerFinancing] = useState(true);
  const [loanAmount, setLoanAmount] = useState(1600000);
  const [ltvMode, setLtvMode] = useState('amount');
  const [ltvPct, setLtvPct] = useState(80);
  const [sellerMortgage, setSellerMortgage] = useState(true);
  const [outstandingBalance, setOutstandingBalance] = useState(1000000);
  const [rateType, setRateType] = useState('Fixed');
  const [buyerCommPct, setBuyerCommPct] = useState(2);
  const [sellerCommPct, setSellerCommPct] = useState(2);
  const [nocSide, setNocSide] = useState('seller');
  const [coAgencyNote, setCoAgencyNote] = useState('');

  // PDF options
  const [showSides, setShowSides] = useState('both');
  const [commDisplay, setCommDisplay] = useState('show');
  const [generating, setGenerating] = useState(false);

  // Overrides & custom
  const [buyerOverrides, setBuyerOverrides] = useState({});
  const [sellerOverrides, setSellerOverrides] = useState({});
  const [buyerCustom, setBuyerCustom] = useState([]);
  const [sellerCustom, setSellerCustom] = useState([]);

  const resolvedLoan = ltvMode === 'ltv' ? Math.round(Number(price) * Number(ltvPct) / 100) : Number(loanAmount);

  const { buyerLines, sellerLines, dewaDeposit } = useMemo(() => calcTransfer({
    price, propertyType, buyerFinancing,
    loanAmount: resolvedLoan,
    sellerMortgage, outstandingBalance, rateType,
    buyerCommPct, sellerCommPct, nocSide,
  }), [price, propertyType, buyerFinancing, resolvedLoan, sellerMortgage, outstandingBalance, rateType, buyerCommPct, sellerCommPct, nocSide]);

  const buyerTotal = sumLines(buyerLines, buyerOverrides) + buyerCustom.reduce((s, l) => s + Number(l.amount || 0), 0);
  const sellerTotal = sumLines(sellerLines, sellerOverrides) + sellerCustom.reduce((s, l) => s + Number(l.amount || 0), 0);
  const grandTotal = buyerTotal + sellerTotal;
  const scenarioName = getScenarioName(buyerFinancing, sellerMortgage);

  const handlePDF = async () => {
    setGenerating(true);
    try {
      await generatePDF({ scenarioName, price, loanAmount: resolvedLoan, outstandingBalance, buyerFinancing, sellerMortgage, buyerLines, buyerOverrides, buyerCustom, dewaDeposit, sellerLines, sellerOverrides, sellerCustom, showSides, commDisplay, buyerCommPct, sellerCommPct });
    } finally {
      setGenerating(false);
    }
  };

  const cardStyle = { background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' };
  const labelStyle = { color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, display: 'block', marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: T.card, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Erudite Property · Internal Tool</p>
          <h1 style={{ color: T.text, fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>Transfer Cost Calculator</h1>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: T.amber, whiteSpace: 'nowrap' }}>
          {scenarioName}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Inputs ── */}
        <div style={cardStyle}>
          <SectionHeader title="Transaction Inputs" />
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>

            {/* Price */}
            <div>
              <label style={labelStyle}>Agreed Sale Price (AED)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 18, fontWeight: 700, width: '100%', boxSizing: 'border-box', outline: 'none', textAlign: 'right' }}
                onFocus={e => e.target.style.borderColor = T.amber}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <p style={{ color: T.muted, fontSize: 11, margin: '4px 0 0', textAlign: 'right' }}>= AED {fmt(price)}</p>
            </div>

            {/* Property type */}
            <div>
              <label style={labelStyle}>Property Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <PillBtn active={propertyType === 'apartment'} onClick={() => setPropertyType('apartment')}>Apartment</PillBtn>
                <PillBtn active={propertyType === 'villa'} onClick={() => setPropertyType('villa')}>Villa</PillBtn>
              </div>
              <p style={{ color: T.muted, fontSize: 11, margin: '6px 0 0' }}>DEWA deposit: AED {fmt(dewaDeposit)} (refundable)</p>
            </div>

            {/* Commission */}
            <div>
              <label style={labelStyle}>Agency Commission</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, fontSize: 9 }}>Buyer</label>
                  <Select value={buyerCommPct} onChange={v => setBuyerCommPct(Number(v))} options={[{ value: 2, label: '2%' }, { value: 1, label: '1%' }, { value: 0, label: '0%' }]} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, fontSize: 9 }}>Seller</label>
                  <Select value={sellerCommPct} onChange={v => setSellerCommPct(Number(v))} options={[{ value: 2, label: '2%' }, { value: 1, label: '1%' }, { value: 0, label: '0%' }]} />
                </div>
              </div>
            </div>

            {/* Buyer financing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Toggle label="Buyer is financing (mortgage)?" value={buyerFinancing} onChange={setBuyerFinancing} />
              {buyerFinancing && (
                <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <PillBtn active={ltvMode === 'amount'} onClick={() => setLtvMode('amount')}>Loan AED</PillBtn>
                    <PillBtn active={ltvMode === 'ltv'} onClick={() => setLtvMode('ltv')}>LTV %</PillBtn>
                  </div>
                  {ltvMode === 'amount' ? (
                    <div>
                      <Input value={loanAmount} onChange={setLoanAmount} placeholder="Loan amount" />
                      <p style={{ color: T.muted, fontSize: 11, margin: '4px 0 0' }}>LTV: {Number(price) > 0 ? ((resolvedLoan / Number(price)) * 100).toFixed(1) : 0}%</p>
                    </div>
                  ) : (
                    <div>
                      <Input value={ltvPct} onChange={setLtvPct} placeholder="LTV %" />
                      <p style={{ color: T.muted, fontSize: 11, margin: '4px 0 0' }}>Loan: AED {fmt(resolvedLoan)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seller mortgage */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Toggle label="Seller has existing mortgage?" value={sellerMortgage} onChange={setSellerMortgage} />
              {sellerMortgage && (
                <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Input value={outstandingBalance} onChange={setOutstandingBalance} placeholder="Outstanding balance (AED)" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <PillBtn active={rateType === 'Fixed'} onClick={() => setRateType('Fixed')}>Fixed rate</PillBtn>
                    <PillBtn active={rateType === 'Variable'} onClick={() => setRateType('Variable')}>Variable rate</PillBtn>
                  </div>
                </div>
              )}
            </div>

            {/* NOC + Co-agency */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Developer NOC (AED 525)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PillBtn active={nocSide === 'seller'} onClick={() => setNocSide('seller')}>Seller pays</PillBtn>
                  <PillBtn active={nocSide === 'buyer'} onClick={() => setNocSide('buyer')}>Buyer pays</PillBtn>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Co-agency note (optional)</label>
                <Input value={coAgencyNote} onChange={setCoAgencyNote} type="text" placeholder="e.g. co-broker: XYZ Realty" />
              </div>
            </div>

          </div>
        </div>

        {/* ── Summary banner ── */}
        <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {[
            { label: 'Buyer Total', value: fmt(buyerTotal), amber: false },
            { label: 'Seller Total', value: fmt(sellerTotal), amber: false },
            { label: 'Grand Total', value: fmt(grandTotal), amber: true },
            { label: 'Buyer Cash Needed', value: fmt(buyerTotal + dewaDeposit), amber: false, sub: 'incl. DEWA deposit' },
          ].map(({ label, value, amber, sub }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
              <p style={{ color: amber ? T.amber : T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>AED {value}</p>
              {sub && <p style={{ color: T.muted, fontSize: 10, margin: '2px 0 0' }}>{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Fee tables ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FeeTable title="BUYER" lines={buyerLines} overrides={buyerOverrides} setOverrides={setBuyerOverrides} customLines={buyerCustom} setCustomLines={setBuyerCustom} commPct={buyerCommPct} commDisplay={commDisplay} />
            {/* DEWA card */}
            <div style={{ background: T.card, border: `1px solid rgba(99,179,237,0.2)`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#63B3ED', fontSize: 13, fontWeight: 600 }}>+ DEWA Security Deposit</span>
                <span style={{ color: '#63B3ED', fontWeight: 700, fontSize: 14 }}>AED {fmt(dewaDeposit)}</span>
              </div>
              <p style={{ color: T.muted, fontSize: 11, margin: '0 0 8px' }}>Refundable on exit — not included in buyer total above</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>Buyer cash needed on day</span>
                <span style={{ color: T.amber, fontWeight: 700, fontSize: 15 }}>AED {fmt(buyerTotal + dewaDeposit)}</span>
              </div>
            </div>
          </div>

          <FeeTable title="SELLER" lines={sellerLines} overrides={sellerOverrides} setOverrides={setSellerOverrides} customLines={sellerCustom} setCustomLines={setSellerCustom} commPct={sellerCommPct} commDisplay={commDisplay} />
        </div>

        {/* ── Grand total ── */}
        <div style={{ background: T.card, border: `2px solid ${T.amber}`, borderRadius: 12, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: T.text, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Grand Total (Buyer + Seller)</p>
            <p style={{ color: T.muted, fontSize: 11, margin: '3px 0 0' }}>Excludes refundable DEWA deposit · Amber = overridden cell</p>
          </div>
          <p style={{ color: T.amber, fontWeight: 700, fontSize: 24, margin: 0 }}>AED {fmt(grandTotal)}</p>
        </div>

        {/* ── Notes ── */}
        <div style={{ background: 'rgba(251,191,36,0.06)', border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ color: '#FCD34D', fontSize: 12, margin: 0 }}><strong>⚠ 2026 Regulation:</strong> Closing costs cannot be financed into the mortgage — all transfer costs must be paid in cash upfront.</p>
          <p style={{ color: '#FCD34D', fontSize: 12, margin: 0 }}><strong>⚠ Bank fees:</strong> Processing fees, valuation and mortgage-related charges vary by bank — confirm per deal.</p>
        </div>

        {/* ── PDF Export ── */}
        <div style={cardStyle}>
          <SectionHeader title="Generate Client PDF" />
          <div style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 180 }}>
              <label style={labelStyle}>Show sides</label>
              <Select value={showSides} onChange={setShowSides} options={[{ value: 'both', label: 'Both (Buyer + Seller)' }, { value: 'buyer', label: 'Buyer only' }, { value: 'seller', label: 'Seller only' }]} />
            </div>
            <div style={{ minWidth: 240 }}>
              <label style={labelStyle}>Zero-commission display</label>
              <Select value={commDisplay} onChange={setCommDisplay} options={[
                { value: 'hide', label: 'Hide the line entirely' },
                { value: 'show', label: 'Show row with AED 0' },
                { value: 'note', label: 'Hide row + add "commission waived" note' },
              ]} />
            </div>
            <button
              onClick={handlePDF}
              disabled={generating}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: generating ? 'rgba(245,159,10,0.4)' : T.amber,
                color: T.amberText, border: 'none', borderRadius: 9,
                padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
              }}
            >
              {generating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={15} />}
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div style={{ height: 32 }} />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }`}</style>
    </div>
  );
}