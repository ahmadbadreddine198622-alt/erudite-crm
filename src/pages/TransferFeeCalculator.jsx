import React, { useState, useMemo, useRef } from 'react';
import { calcTransfer, getScenarioName, sumLines } from '@/lib/transferCalc';
import { BRAND, BANK, LOGO_URL, loadImage, fmtAED, fmtDate } from '@/lib/pdfBrand';
import { jsPDF } from 'jspdf';
import { Building2, RefreshCw, Plus, FileText, Loader2, RotateCcw } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 font-medium">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-navy' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className={`text-xs font-semibold ${value ? 'text-navy' : 'text-gray-400'}`}>{value ? 'Yes' : 'No'}</span>
    </div>
  );
}

function NumInput({ value, onChange, className = '' }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`border rounded px-2 py-1 text-right text-sm w-full focus:outline-none focus:ring-2 focus:ring-navy/30 ${className}`}
    />
  );
}

// ── Fee Table ─────────────────────────────────────────────────────────────────

function FeeTable({ title, lines, overrides, setOverrides, customLines, setCustomLines, color, commPct, commDisplay }) {
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState({ label: '', basis: '', amount: '', est: false });

  const getAmt = (l) => overrides[l.id] !== undefined ? overrides[l.id] : l.amount;
  const isOverridden = (id) => overrides[id] !== undefined;
  const reset = (id) => setOverrides(o => { const n = { ...o }; delete n[id]; return n; });
  const resetAll = () => setOverrides({});

  const total = lines.reduce((s, l) => s + Number(getAmt(l) || 0), 0)
    + customLines.reduce((s, l) => s + Number(l.amount || 0), 0);

  const addCustom = () => {
    if (!newLine.label) return;
    setCustomLines(c => [...c, { ...newLine, id: `custom_${Date.now()}` }]);
    setNewLine({ label: '', basis: '', amount: '', est: false });
    setAdding(false);
  };

  const removeCustom = (id) => setCustomLines(c => c.filter(l => l.id !== id));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#1F3864' }}>
        <h3 className="text-white font-bold text-base tracking-wide">{title}</h3>
        <button onClick={resetAll} className="text-white/60 hover:text-white text-xs flex items-center gap-1 transition">
          <RotateCcw className="w-3 h-3" /> Reset all
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {lines.map(l => {
          const hidden = l.id.includes('comm') && commPct === 0 && commDisplay === 'hide';
          if (hidden) return null;
          const amt = getAmt(l);
          const over = isOverridden(l.id);
          return (
            <div key={l.id} className={`flex items-center gap-2 px-4 py-2.5 text-sm ${over ? 'bg-amber-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-800">{l.label}</span>
                {l.est && <span className="text-xs text-orange-500 ml-1">(est.)</span>}
              </div>
              <div className="text-gray-400 text-xs hidden sm:block w-48 shrink-0 text-right pr-3">{l.basis}</div>
              <div className="flex items-center gap-1 shrink-0">
                <div className={`w-28 ${over ? 'ring-2 ring-amber-400 rounded' : ''}`}>
                  <NumInput
                    value={amt}
                    onChange={v => setOverrides(o => ({ ...o, [l.id]: v }))}
                  />
                </div>
                {over && (
                  <button onClick={() => reset(l.id)} className="text-gray-400 hover:text-navy" title="Reset to calculated">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Custom lines */}
        {customLines.map(l => (
          <div key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-50">
            <div className="flex-1 font-medium text-gray-800">
              {l.label} {l.est && <span className="text-xs text-orange-500">(est.)</span>}
            </div>
            <div className="text-gray-400 text-xs hidden sm:block w-48 shrink-0 text-right pr-3">{l.basis}</div>
            <div className="w-28">
              <NumInput value={l.amount} onChange={v => setCustomLines(c => c.map(x => x.id === l.id ? { ...x, amount: v } : x))} />
            </div>
            <button onClick={() => removeCustom(l.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>

      {/* Total row */}
      <div className="px-4 py-3 flex items-center justify-between border-t-2 border-gray-200 bg-gray-50">
        <span className="font-bold text-gray-900 text-sm">{title} TOTAL</span>
        <span className="font-bold text-navy text-base">AED {fmt(total)}</span>
      </div>

      {/* Add custom */}
      <div className="px-4 py-3 border-t border-gray-100">
        {!adding ? (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-navy text-xs font-medium hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add custom line item
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Label" value={newLine.label} onChange={e => setNewLine(n => ({ ...n, label: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
              <input placeholder="Basis (optional)" value={newLine.basis} onChange={e => setNewLine(n => ({ ...n, basis: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Amount" value={newLine.amount} onChange={e => setNewLine(n => ({ ...n, amount: e.target.value }))} className="border rounded px-2 py-1 text-sm w-32" />
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={newLine.est} onChange={e => setNewLine(n => ({ ...n, est: e.target.checked }))} /> Estimate
              </label>
              <button onClick={addCustom} className="bg-navy text-white px-3 py-1 rounded text-xs font-medium">Add</button>
              <button onClick={() => setAdding(false)} className="text-gray-400 text-xs">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

async function generatePDF({
  scenarioName, price, loanAmount, outstandingBalance, buyerFinancing, sellerMortgage,
  buyerLines, buyerOverrides, buyerCustom, dewaDeposit,
  sellerLines, sellerOverrides, sellerCustom,
  showSides, commDisplay, buyerCommPct, sellerCommPct,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, pad = 14;
  const navy = [31, 56, 100];
  const gold = [201, 168, 74];
  const gray = [100, 110, 130];

  // Logo
  const logo = await loadImage(LOGO_URL);
  if (logo) {
    const aspect = logo.width / logo.height;
    const lh = 14, lw = lh * aspect;
    doc.addImage(logo.dataUrl, 'PNG', (W - lw) / 2, 8, lw, lh);
  }

  let y = 27;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navy);
  doc.text('Property Transfer – Cost Estimate', W / 2, y, { align: 'center' });
  y += 6;

  // Sub-line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  let subLine = `${scenarioName} · AED ${fmt(price)}`;
  if (buyerFinancing) subLine += ` · Loan AED ${fmt(loanAmount)}`;
  if (sellerMortgage) subLine += ` · Outstanding AED ${fmt(outstandingBalance)}`;
  doc.text(subLine, W / 2, y, { align: 'center' });
  y += 2;

  // Gold rule
  doc.setFillColor(...gold);
  doc.rect(pad, y, W - pad * 2, 0.6, 'F');
  y += 5;

  const drawTable = (title, lines, overrides, customLines, commPct) => {
    // Table header
    doc.setFillColor(...navy);
    doc.rect(pad, y, W - pad * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title, pad + 3, y + 4.8);
    doc.text('Basis', pad + 80, y + 4.8);
    doc.text('Amount (AED)', W - pad, y + 4.8, { align: 'right' });
    y += 7;

    // Rows
    let rowTotal = 0;
    const allLines = [...lines, ...customLines.map(l => ({ ...l, custom: true }))];

    allLines.forEach((l, i) => {
      const isComm = l.id && l.id.includes('comm');
      if (isComm && commPct === 0 && commDisplay === 'hide') return;

      const amt = overrides[l.id] !== undefined ? Number(overrides[l.id]) : l.amount;
      rowTotal += Number(amt) || 0;

      if (y > 260) { doc.addPage(); y = 14; }

      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(pad, y, W - pad * 2, 6.5, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      let label = l.label;
      if (l.est) label += ' (est.)';
      doc.text(label, pad + 3, y + 4.5, { maxWidth: 73 });
      doc.setTextColor(...gray);
      doc.text(l.basis || '', pad + 80, y + 4.5, { maxWidth: 65 });
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', amt === 0 && l.est ? 'italic' : 'normal');
      doc.text(amt === 0 && l.est ? 'Confirm w/ bank' : `AED ${fmt(amt)}`, W - pad, y + 4.5, { align: 'right' });
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
    doc.setFillColor(...navy);
    doc.rect(pad, y, W - pad * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`${title} TOTAL`, pad + 3, y + 4.8);
    doc.text(`AED ${fmt(rowTotal)}`, W - pad, y + 4.8, { align: 'right' });
    y += 10;

    return rowTotal;
  };

  let buyerTotal = 0, sellerTotal = 0;

  if (showSides !== 'seller') {
    buyerTotal = drawTable('BUYER', buyerLines, buyerOverrides, buyerCustom, buyerCommPct);

    // DEWA deposit
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.text(`+ DEWA Security Deposit (refundable): AED ${fmt(dewaDeposit)} — not included in buyer total above`, pad + 3, y);
    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...navy);
    doc.text(`Buyer cash needed on day (incl. refundable deposit): AED ${fmt(buyerTotal + dewaDeposit)}`, pad + 3, y);
    y += 8;
  }

  if (showSides !== 'buyer') {
    sellerTotal = drawTable('SELLER', sellerLines, sellerOverrides, sellerCustom, sellerCommPct);
  }

  // Grand total
  if (showSides === 'both') {
    doc.setFillColor(...gold);
    doc.rect(pad, y, W - pad * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text('GRAND TOTAL (Buyer + Seller, excl. refundable deposit)', pad + 3, y + 5.5);
    doc.text(`AED ${fmt(buyerTotal + sellerTotal)}`, W - pad, y + 5.5, { align: 'right' });
    y += 12;
  }

  // Notes
  y += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.text('Note: Under 2026 regulations, transaction closing costs cannot be financed into the mortgage and must be paid in cash upfront.', pad, y, { maxWidth: W - pad * 2 });
  y += 5;
  doc.text('Bank processing fees, valuation, and mortgage-related charges vary by lender — confirm per deal.', pad, y, { maxWidth: W - pad * 2 });
  y += 7;

  // Disclaimer
  doc.setFontSize(6.5);
  doc.text(
    'Disclaimer: Figures marked (est.) are estimates and vary by lender. DLD government fees are fixed but subject to change by circular. Final amounts are confirmed at the trustee office on the day of transfer. Under 2026 regulations, transaction costs must be paid in cash and cannot be added to the mortgage. This estimate is provided for guidance only and does not constitute a binding quotation.',
    pad, y, { maxWidth: W - pad * 2 }
  );

  // Footer
  const footerY = 272;
  doc.setFillColor(...navy);
  doc.rect(0, footerY, W, 25, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, footerY, W, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Erudite Property · 058 180 6000 · ahmad@erudite-estate.com', W / 2, footerY + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 210, 225);
  doc.text('Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, UAE', W / 2, footerY + 13, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...gold);
  doc.text('A major key for your home', W / 2, footerY + 19, { align: 'center' });

  doc.save('Erudite_Transfer_Cost_Estimate.pdf');
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TransferFeeCalculator() {
  // Inputs
  const [price, setPrice] = useState(2000000);
  const [propertyType, setPropertyType] = useState('apartment');
  const [buyerFinancing, setBuyerFinancing] = useState(true);
  const [loanAmount, setLoanAmount] = useState(1600000);
  const [ltvMode, setLtvMode] = useState('amount'); // 'amount' | 'ltv'
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

  // Overrides & custom lines
  const [buyerOverrides, setBuyerOverrides] = useState({});
  const [sellerOverrides, setSellerOverrides] = useState({});
  const [buyerCustom, setBuyerCustom] = useState([]);
  const [sellerCustom, setSellerCustom] = useState([]);

  // Sync loan from LTV
  const resolvedLoan = ltvMode === 'ltv' ? Math.round(price * ltvPct / 100) : Number(loanAmount);

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

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      await generatePDF({
        scenarioName, price, loanAmount: resolvedLoan, outstandingBalance, buyerFinancing, sellerMortgage,
        buyerLines, buyerOverrides, buyerCustom, dewaDeposit,
        sellerLines, sellerOverrides, sellerCustom,
        showSides, commDisplay, buyerCommPct, sellerCommPct,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Erudite Property · Internal Tool</p>
            <h1 className="text-lg font-bold text-navy leading-tight">Transfer Cost Calculator</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <span className="font-semibold text-navy">{scenarioName}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Inputs Panel ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100" style={{ background: '#1F3864' }}>
            <h2 className="text-white font-bold text-sm uppercase tracking-wider">Transaction Inputs</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Price */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agreed Sale Price (AED)</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right font-semibold text-lg text-navy focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <p className="text-xs text-gray-400 text-right">= AED {fmt(price)}</p>
            </div>

            {/* Property type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Property Type</label>
              <div className="flex gap-2">
                {['apartment', 'villa'].map(t => (
                  <button
                    key={t}
                    onClick={() => setPropertyType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all border ${propertyType === t ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/40'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">DEWA deposit: AED {fmt(dewaDeposit)} (refundable)</p>
            </div>

            {/* Commission */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agency Commission</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Buyer</label>
                  <select value={buyerCommPct} onChange={e => setBuyerCommPct(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none">
                    <option value={2}>2%</option>
                    <option value={1}>1%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Seller</label>
                  <select value={sellerCommPct} onChange={e => setSellerCommPct(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none">
                    <option value={2}>2%</option>
                    <option value={1}>1%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Buyer financing toggle */}
            <div className="space-y-3">
              <Toggle label="Buyer is financing (mortgage)?" value={buyerFinancing} onChange={setBuyerFinancing} />
              {buyerFinancing && (
                <div className="pl-2 space-y-2">
                  <div className="flex gap-2 text-xs">
                    {['amount', 'ltv'].map(m => (
                      <button key={m} onClick={() => setLtvMode(m)} className={`px-2 py-1 rounded border text-xs font-medium transition ${ltvMode === m ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200'}`}>
                        {m === 'amount' ? 'Loan AED' : 'LTV %'}
                      </button>
                    ))}
                  </div>
                  {ltvMode === 'amount' ? (
                    <div>
                      <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder="Loan amount" />
                      <p className="text-xs text-gray-400 mt-1">LTV: {price > 0 ? ((resolvedLoan / price) * 100).toFixed(1) : 0}%</p>
                    </div>
                  ) : (
                    <div>
                      <input type="number" value={ltvPct} onChange={e => setLtvPct(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder="LTV %" />
                      <p className="text-xs text-gray-400 mt-1">Loan: AED {fmt(resolvedLoan)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seller mortgage toggle */}
            <div className="space-y-3">
              <Toggle label="Seller has existing mortgage?" value={sellerMortgage} onChange={setSellerMortgage} />
              {sellerMortgage && (
                <div className="pl-2 space-y-2">
                  <input type="number" value={outstandingBalance} onChange={e => setOutstandingBalance(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder="Outstanding balance (AED)" />
                  <div className="flex gap-2">
                    {['Fixed', 'Variable'].map(r => (
                      <button key={r} onClick={() => setRateType(r)} className={`flex-1 py-1.5 rounded border text-xs font-medium transition ${rateType === r ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200'}`}>{r}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* NOC + co-agency */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Developer NOC (AED 525)</label>
                <div className="flex gap-2 mt-1">
                  {['seller', 'buyer'].map(s => (
                    <button key={s} onClick={() => setNocSide(s)} className={`flex-1 py-1.5 rounded border text-xs font-medium capitalize transition ${nocSide === s ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200'}`}>{s} pays</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Co-Agency Note (optional)</label>
                <input type="text" value={coAgencyNote} onChange={e => setCoAgencyNote(e.target.value)} placeholder="e.g. co-broker: XYZ Realty" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary Banner ── */}
        <div className="rounded-xl p-4 text-white grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ background: '#1F3864' }}>
          <div className="text-center">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Buyer Total</p>
            <p className="font-bold text-xl">AED {fmt(buyerTotal)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Seller Total</p>
            <p className="font-bold text-xl">AED {fmt(sellerTotal)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Grand Total</p>
            <p className="font-bold text-xl text-amber-300">AED {fmt(grandTotal)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Cash Needed (Buyer)</p>
            <p className="font-bold text-xl">AED {fmt(buyerTotal + dewaDeposit)}</p>
            <p className="text-white/50 text-xs">incl. DEWA refundable</p>
          </div>
        </div>

        {/* ── Fee Tables ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <FeeTable
              title="BUYER"
              lines={buyerLines}
              overrides={buyerOverrides}
              setOverrides={setBuyerOverrides}
              customLines={buyerCustom}
              setCustomLines={setBuyerCustom}
              commPct={buyerCommPct}
              commDisplay={commDisplay}
            />
            {/* DEWA info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <p className="font-semibold">+ DEWA Security Deposit (refundable)</p>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-blue-600">Not included in buyer total — refunded on exit</span>
                <span className="font-bold">AED {fmt(dewaDeposit)}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-blue-200">
                <span className="font-semibold text-xs">Buyer cash needed on day</span>
                <span className="font-bold text-navy">AED {fmt(buyerTotal + dewaDeposit)}</span>
              </div>
            </div>
          </div>

          <FeeTable
            title="SELLER"
            lines={sellerLines}
            overrides={sellerOverrides}
            setOverrides={setSellerOverrides}
            customLines={sellerCustom}
            setCustomLines={setSellerCustom}
            commPct={sellerCommPct}
            commDisplay={commDisplay}
          />
        </div>

        {/* ── Grand Total ── */}
        <div className="bg-white border-2 border-navy rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Grand Total (Buyer + Seller, excl. refundable deposit)</p>
            <p className="text-xs text-gray-400 mt-0.5">Overridden cells are highlighted in amber</p>
          </div>
          <p className="text-2xl font-bold text-navy">AED {fmt(grandTotal)}</p>
        </div>

        {/* ── Notes ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1.5 text-xs text-amber-800">
          <p><span className="font-semibold">⚠ 2026 Regulation:</span> Closing costs cannot be financed into the mortgage — all transfer costs must be paid in cash upfront.</p>
          <p><span className="font-semibold">⚠ Bank fees:</span> Processing fees, valuation, and mortgage-related charges vary by bank — confirm per deal.</p>
        </div>

        {/* ── PDF Export ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100" style={{ background: '#1F3864' }}>
            <h2 className="text-white font-bold text-sm uppercase tracking-wider">Generate Client PDF</h2>
          </div>
          <div className="p-5 flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Show sides</label>
              <select value={showSides} onChange={e => setShowSides(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="both">Both (Buyer + Seller)</option>
                <option value="buyer">Buyer only</option>
                <option value="seller">Seller only</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zero-commission display</label>
              <select value={commDisplay} onChange={e => setCommDisplay(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="hide">Hide the line entirely</option>
                <option value="show">Show row with AED 0</option>
                <option value="note">Hide row but add "commission waived" note</option>
              </select>
            </div>
            <button
              onClick={handleGeneratePDF}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all text-white"
              style={{ background: generating ? '#9ca3af' : '#1F3864' }}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="h-8" />
      </div>

      <style>{`.text-navy { color: #1F3864; } .bg-navy { background-color: #1F3864; } .border-navy { border-color: #1F3864; } .focus\\:ring-navy\\/30:focus { --tw-ring-color: rgba(31,56,100,0.3); }`}</style>
    </div>
  );
}