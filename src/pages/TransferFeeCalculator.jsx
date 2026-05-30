import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, Download, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import jsPDF from 'jspdf';
import { BRAND, LOGO_URL, loadImage, fmtAED } from '@/lib/pdfBrand';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const pct = (n, p) => (Number(n) || 0) * (Number(p) || 0) / 100;

function numField(val, set, placeholder = '0') {
  return (
    <Input
      type="number"
      min="0"
      step="any"
      placeholder={placeholder}
      value={val}
      onChange={e => set(e.target.value)}
      className="bg-secondary border-border text-foreground"
    />
  );
}

// ── calculation core (pure, no AI) ───────────────────────────────────────────
function calculate({ price, buyerFinancing, loanAmount, sellerMortgage, outstanding,
  buyerCommPct, sellerCommPct, processingFee, valuationFee, blockingFee,
  earlySettlement, nocFee }) {
  const P = Number(price) || 0;
  const L = Number(loanAmount) || 0;
  const OUT = Number(outstanding) || 0;
  const BCP = Number(buyerCommPct) || 2;
  const SCP = Number(sellerCommPct) || 2;

  const buyerItems = [];
  const sellerItems = [];

  // ── BUYER always ──
  buyerItems.push({ label: 'DLD Transfer Fee (4%)',  basis: `AED ${fmt(P)} × 4%`, amount: P * 0.04, est: false });
  const trustee = P >= 500000 ? 4200 : 4000;
  buyerItems.push({ label: 'Trustee Office Fee',     basis: P >= 500000 ? '(price ≥ 500K)' : '(price < 500K)', amount: trustee, est: false });
  buyerItems.push({ label: 'DLD Admin Fee',           basis: 'Fixed',   amount: 580,  est: false });
  buyerItems.push({ label: 'Title Deed Issuance',     basis: 'Fixed',   amount: 250,  est: false });
  buyerItems.push({ label: 'Map / Site Plan Fee',     basis: 'Fixed',   amount: 250,  est: false });
  buyerItems.push({ label: 'Knowledge & Innovation Fee', basis: 'Fixed', amount: 20,  est: false });
  const buyerComm = pct(P, BCP);
  buyerItems.push({ label: `Agency Commission (Buyer ${BCP}%)`, basis: `AED ${fmt(P)} × ${BCP}%`, amount: buyerComm, est: false });
  buyerItems.push({ label: 'VAT on Buyer Commission (5%)', basis: `AED ${fmt(buyerComm)} × 5%`, amount: buyerComm * 0.05, est: false });

  // ── BUYER if financing ──
  if (buyerFinancing && L > 0) {
    const mortReg = L * 0.0025 + 290;
    buyerItems.push({ label: 'Mortgage Registration', basis: `(Loan × 0.25%) + AED 290`, amount: mortReg, est: false });

    const proc = processingFee !== '' ? Number(processingFee) : L * 0.005;
    const procEst = processingFee === '';
    buyerItems.push({ label: 'Bank Processing Fee', basis: procEst ? `Loan × 0.5% (est.)` : 'User figure', amount: proc, est: procEst });

    const val = valuationFee !== '' ? Number(valuationFee) : 3000;
    const valEst = valuationFee === '';
    buyerItems.push({ label: 'Bank Valuation Fee', basis: valEst ? 'Standard (est.)' : 'User figure', amount: val, est: valEst });
  }

  // ── BUYER if seller has mortgage (blocking) ──
  if (sellerMortgage) {
    const block = blockingFee !== '' ? Number(blockingFee) : 1500;
    const blockEst = blockingFee === '';
    buyerItems.push({ label: 'Bank Blocking Fee', basis: blockEst ? 'Standard (est.)' : 'User figure', amount: block, est: blockEst });
  }

  // ── SELLER always ──
  const sellerComm = pct(P, SCP);
  sellerItems.push({ label: `Agency Commission (Seller ${SCP}%)`, basis: `AED ${fmt(P)} × ${SCP}%`, amount: sellerComm, est: false });
  sellerItems.push({ label: 'VAT on Seller Commission (5%)', basis: `AED ${fmt(sellerComm)} × 5%`, amount: sellerComm * 0.05, est: false });
  const noc = Number(nocFee) || 525;
  sellerItems.push({ label: 'Developer NOC Fee', basis: 'Standard', amount: noc, est: false });

  // ── SELLER if mortgage ──
  let earlySettlementEntry = null;
  if (sellerMortgage) {
    sellerItems.push({ label: 'Mortgage Release Procedure', basis: 'Fixed', amount: 1290, est: false });
    sellerItems.push({ label: 'Registrar Release Fee',       basis: 'Fixed', amount: 315,  est: false });
    sellerItems.push({ label: 'Service Partner / Title Clear', basis: 'Fixed', amount: 315, est: false });

    if (earlySettlement !== '') {
      const es = Number(earlySettlement);
      sellerItems.push({ label: 'Early Settlement Fee', basis: 'User figure', amount: es, est: false });
    } else if (OUT > 0) {
      const es = OUT * 0.01;
      sellerItems.push({ label: 'Early Settlement Fee', basis: `Outstanding × 1% (est./varies)`, amount: es, est: true });
      earlySettlementEntry = es;
    } else {
      sellerItems.push({ label: 'Early Settlement Fee', basis: 'Varies — not included in total', amount: null, est: true });
    }
  }

  const buyerTotal  = buyerItems.reduce((s, i) => s + (i.amount || 0), 0);
  const sellerTotal = sellerItems.reduce((s, i) => s + (i.amount ?? 0), 0) - (earlySettlementEntry && OUT === 0 ? 0 : 0);
  const grandTotal  = buyerTotal + sellerTotal;

  // scenario label
  let scenario = 'Cash Buyer / Cash Seller';
  if (buyerFinancing && sellerMortgage)    scenario = 'Financed Buyer / Mortgaged Seller';
  else if (buyerFinancing)                 scenario = 'Financed Buyer / Cash Seller';
  else if (sellerMortgage)                 scenario = 'Cash Buyer / Mortgaged Seller';

  return { buyerItems, sellerItems, buyerTotal, sellerTotal, grandTotal, scenario };
}

// ── PDF generation ────────────────────────────────────────────────────────────
async function generatePDF({ result, price, loanAmount, buyerFinancing, ltvPct }) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const W    = 210;
  const pad  = 14;
  const navy = [31, 56, 100];
  const gold = [201, 168, 74];
  const grey = [245, 246, 248];
  const text = [30, 41, 59];
  const mut  = [110, 120, 140];

  let y = 12;

  // Logo
  const logo = await loadImage(LOGO_URL);
  if (logo) {
    const maxH = 16; const maxW = 60;
    const aspect = logo.width / logo.height;
    let lw = maxW; let lh = lw / aspect;
    if (lh > maxH) { lh = maxH; lw = lh * aspect; }
    try { doc.addImage(logo.dataUrl, 'PNG', (W - lw) / 2, y, lw, lh); } catch {}
    y += lh + 6;
  } else {
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('ERUDITE REAL ESTATE', W / 2, y + 6, { align: 'center' });
    y += 14;
  }

  // Title
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Property Transfer – Cost Estimate', W / 2, y, { align: 'center' });
  y += 7;

  // Sub-line
  const ltv = buyerFinancing && loanAmount ? ` · Loan AED ${fmt(loanAmount)} (${Number(ltvPct || 0).toFixed(1)}% LTV)` : '';
  const subLine = `Scenario: ${result.scenario}  ·  Price AED ${fmt(price)}${ltv}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mut);
  doc.text(subLine, W / 2, y, { align: 'center' });
  y += 8;

  // divider
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.4);
  doc.line(pad, y, W - pad, y);
  y += 6;

  const drawTable = (title, items, total) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(title, pad, y);
    y += 5;

    // Header row
    const colFee = 78; const colBasis = 58; const colAmt = W - 2*pad - colFee - colBasis;
    doc.setFillColor(...navy);
    doc.rect(pad, y, W - 2*pad, 7, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Fee Item',     pad + 2,            y + 5);
    doc.text('Basis',        pad + colFee + 2,   y + 5);
    doc.text('Amount (AED)', W - pad - 2,        y + 5, { align: 'right' });
    y += 7;

    items.forEach((item, i) => {
      if (i % 2 === 1) {
        doc.setFillColor(...grey);
        doc.rect(pad, y, W - 2*pad, 7, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...text);
      const label = item.est ? `${item.label} (est.)` : item.label;
      doc.text(label, pad + 2, y + 5);
      doc.setTextColor(...mut);
      doc.text(item.basis, pad + colFee + 2, y + 5);
      doc.setTextColor(...text);
      if (item.amount !== null && item.amount !== undefined) {
        doc.text(`AED ${fmt(item.amount)}`, W - pad - 2, y + 5, { align: 'right' });
      } else {
        doc.setTextColor(...mut);
        doc.text('—  varies', W - pad - 2, y + 5, { align: 'right' });
      }
      y += 7;
    });

    // Total row
    doc.setFillColor(...navy);
    doc.rect(pad, y, W - 2*pad, 8, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(title.includes('Buyer') ? 'BUYER TOTAL' : 'SELLER TOTAL', pad + 2, y + 5.5);
    doc.text(`AED ${fmt(total)}`, W - pad - 2, y + 5.5, { align: 'right' });
    y += 12;
  };

  drawTable('Buyer — Estimated Costs', result.buyerItems, result.buyerTotal);
  drawTable('Seller — Estimated Costs', result.sellerItems, result.sellerTotal);

  // Grand total banner
  doc.setFillColor(...gold);
  doc.rect(pad, y, W - 2*pad, 10, 'F');
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Combined Transaction Costs:  AED ${fmt(result.grandTotal)}`, W / 2, y + 7, { align: 'center' });
  y += 16;

  // Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...mut);
  const disc = 'Figures marked (est.) — including bank processing, valuation and mortgage-related charges — are estimates and vary by lender. DLD government fees are fixed but subject to change by circular. Final amounts are confirmed at the trustee office on the day of transfer. Under 2026 regulations, transaction costs must be paid in cash and cannot be added to the mortgage. This estimate is provided for guidance only and does not constitute a binding quotation.';
  const discLines = doc.splitTextToSize(disc, W - 2*pad);
  doc.text(discLines, pad, y);
  y += discLines.length * 4 + 6;

  // Footer
  const footerY = 285;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(pad, footerY - 4, W - pad, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mut);
  doc.text('Erudite Property  ·  058 180 6000  ·  ahmad@erudite-estate.com', W / 2, footerY, { align: 'center' });
  doc.text('Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, UAE', W / 2, footerY + 4.5, { align: 'center' });
  doc.setTextColor(...gold);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('A major key for your home', W / 2, footerY + 9, { align: 'center' });

  return doc;
}

// ── main component ────────────────────────────────────────────────────────────
export default function TransferFeeCalculator() {
  // form state
  const [price, setPrice]             = useState('');
  const [buyerFinancing, setBuyerFin] = useState(false);
  const [ltvMode, setLtvMode]         = useState('loan'); // 'loan' | 'ltv'
  const [loanAmount, setLoanAmount]   = useState('');
  const [ltvPct, setLtvPct]           = useState('');
  const [sellerMortgage, setSellerMort] = useState(false);
  const [outstanding, setOutstanding] = useState('');
  const [buyerCommPct, setBuyerComm]  = useState('2');
  const [sellerCommPct, setSellerComm] = useState('2');
  const [processingFee, setProcessing] = useState('');
  const [valuationFee, setValuation]  = useState('');
  const [blockingFee, setBlocking]    = useState('');
  const [earlySettlement, setEarlySet] = useState('');
  const [nocFee, setNocFee]           = useState('525');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [result, setResult]     = useState(null);
  const [pdfUrl, setPdfUrl]     = useState(null);
  const [generating, setGen]    = useState(false);
  const [error, setError]       = useState('');

  const iframeRef = useRef();

  const resolvedLoan = () => {
    if (!buyerFinancing) return '';
    if (ltvMode === 'ltv') return String(pct(price, ltvPct));
    return loanAmount;
  };

  const handleCalculate = async () => {
    if (!price || Number(price) <= 0) { setError('Please enter a valid sale price.'); return; }
    setError('');
    setGen(true);
    const loan = resolvedLoan();
    const computedLtv = ltvMode === 'ltv' ? ltvPct : (price && loan ? ((Number(loan)/Number(price))*100).toFixed(1) : '0');

    const res = calculate({
      price, buyerFinancing, loanAmount: loan, sellerMortgage, outstanding,
      buyerCommPct, sellerCommPct, processingFee, valuationFee, blockingFee,
      earlySettlement, nocFee,
    });
    setResult(res);

    try {
      const doc = await generatePDF({ result: res, price, loanAmount: loan, buyerFinancing, ltvPct: computedLtv });
      const blob = doc.output('blob');
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e) {
      console.error(e);
    }
    setGen(false);
  };

  const handleDownload = async () => {
    const loan = resolvedLoan();
    const computedLtv = ltvMode === 'ltv' ? ltvPct : (price && loan ? ((Number(loan)/Number(price))*100).toFixed(1) : '0');
    const res = result || calculate({ price, buyerFinancing, loanAmount: loan, sellerMortgage, outstanding, buyerCommPct, sellerCommPct, processingFee, valuationFee, blockingFee, earlySettlement, nocFee });
    const doc = await generatePDF({ result: res, price, loanAmount: loan, buyerFinancing, ltvPct: computedLtv });
    doc.save(`Erudite_Transfer_Estimate_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const Toggle = ({ value, onChange, label }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${value ? 'bg-accent text-accent-foreground border-accent' : 'bg-secondary text-muted-foreground border-border hover:border-accent/50'}`}
    >
      <span className={`w-8 h-4 rounded-full transition-all relative ${value ? 'bg-accent-foreground/30' : 'bg-muted-foreground/30'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-current transition-all ${value ? 'left-4' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );

  const Section = ({ title, children }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="bg-[#1F3864] px-5 py-3">
        <h3 className="text-white text-sm font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Page header */}
      <div className="bg-card border-b border-border px-4 sm:px-8 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Transfer-Fee Calculator</h1>
          <p className="text-xs text-muted-foreground">Dubai DLD costs · 2026 regulations</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 grid lg:grid-cols-2 gap-8">

        {/* ── LEFT: FORM ── */}
        <div className="space-y-6">

          {/* Sale Price */}
          <Section title="1. Sale Price">
            <div className="space-y-1">
              <Label>Agreed Sale Price (AED) *</Label>
              {numField(price, setPrice, 'e.g. 2,500,000')}
            </div>
          </Section>

          {/* Buyer Financing */}
          <Section title="2. Buyer Financing">
            <div className="space-y-4">
              <Toggle value={buyerFinancing} onChange={setBuyerFin} label={buyerFinancing ? 'Buyer is financing' : 'Buyer pays cash'} />
              {buyerFinancing && (
                <div className="space-y-3 pl-2 border-l-2 border-accent/30">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setLtvMode('loan')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${ltvMode==='loan' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                      Enter Loan Amount
                    </button>
                    <button type="button" onClick={() => setLtvMode('ltv')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${ltvMode==='ltv' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                      Enter LTV %
                    </button>
                  </div>
                  {ltvMode === 'loan' ? (
                    <div className="space-y-1">
                      <Label>Loan Amount (AED)</Label>
                      {numField(loanAmount, setLoanAmount, 'e.g. 1,875,000')}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label>LTV %</Label>
                      {numField(ltvPct, setLtvPct, 'e.g. 75')}
                      {price && ltvPct && <p className="text-xs text-muted-foreground">= AED {fmt(pct(price, ltvPct))}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Seller Mortgage */}
          <Section title="3. Seller Mortgage">
            <div className="space-y-4">
              <Toggle value={sellerMortgage} onChange={setSellerMort} label={sellerMortgage ? 'Seller has mortgage to clear' : 'Seller owns outright'} />
              {sellerMortgage && (
                <div className="space-y-1 pl-2 border-l-2 border-accent/30">
                  <Label>Outstanding Balance (AED) — optional</Label>
                  {numField(outstanding, setOutstanding, 'Approx. outstanding mortgage')}
                  <p className="text-xs text-muted-foreground">Used to estimate early settlement (1%). Leave blank to show "varies".</p>
                </div>
              )}
            </div>
          </Section>

          {/* Commission */}
          <Section title="4. Agency Commission">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Buyer Commission (%)</Label>
                {numField(buyerCommPct, setBuyerComm, '2')}
              </div>
              <div className="space-y-1">
                <Label>Seller Commission (%)</Label>
                {numField(sellerCommPct, setSellerComm, '2')}
              </div>
            </div>
          </Section>

          {/* Advanced / bank fees */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(o => !o)}
              className="w-full bg-[#1F3864] px-5 py-3 flex items-center justify-between"
            >
              <h3 className="text-white text-sm font-bold uppercase tracking-wider">5. Advanced — Override Estimates</h3>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-white/70" /> : <ChevronDown className="w-4 h-4 text-white/70" />}
            </button>
            {showAdvanced && (
              <div className="p-5 grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Bank Processing Fee (AED)</Label>
                  {numField(processingFee, setProcessing, 'Default: loan × 0.5% (est.)')}
                </div>
                <div className="space-y-1">
                  <Label>Valuation Fee (AED)</Label>
                  {numField(valuationFee, setValuation, 'Default: AED 3,000 (est.)')}
                </div>
                <div className="space-y-1">
                  <Label>Bank Blocking Fee (AED)</Label>
                  {numField(blockingFee, setBlocking, 'Default: AED 1,500 (est.)')}
                </div>
                <div className="space-y-1">
                  <Label>Early Settlement Fee (AED)</Label>
                  {numField(earlySettlement, setEarlySet, 'Default: outstanding × 1% (est.)')}
                </div>
                <div className="space-y-1">
                  <Label>Developer NOC Fee (AED)</Label>
                  {numField(nocFee, setNocFee, '525')}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button
            size="lg"
            onClick={handleCalculate}
            disabled={generating}
            className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base h-12"
          >
            <Calculator className="w-5 h-5" />
            {generating ? 'Calculating...' : 'Calculate & Preview PDF'}
          </Button>
        </div>

        {/* ── RIGHT: RESULTS + PDF ── */}
        <div className="space-y-6">
          {result && (
            <>
              {/* Quick summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Buyer Total', amount: result.buyerTotal, color: 'border-blue-500/30 bg-blue-500/10' },
                  { label: 'Seller Total', amount: result.sellerTotal, color: 'border-emerald-500/30 bg-emerald-500/10' },
                  { label: 'Grand Total', amount: result.grandTotal, color: 'border-accent/30 bg-accent/10' },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl border p-3 ${c.color}`}>
                    <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                    <p className="text-sm font-bold text-foreground">AED {fmt(c.amount)}</p>
                  </div>
                ))}
              </div>

              <Badge className="bg-[#1F3864] text-white border-0 text-xs px-3 py-1">
                {result.scenario}
              </Badge>

              {/* Inline tables */}
              {[
                { title: 'Buyer — Estimated Costs', items: result.buyerItems, total: result.buyerTotal },
                { title: 'Seller — Estimated Costs', items: result.sellerItems, total: result.sellerTotal },
              ].map(({ title, items, total }) => (
                <div key={title} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="bg-[#1F3864] px-4 py-2.5">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider">{title}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Fee Item</th>
                          <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Amount (AED)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-secondary/30' : ''}>
                            <td className="px-4 py-2 text-xs text-foreground">
                              {item.label}{item.est ? <span className="text-amber-400 ml-1">(est.)</span> : ''}
                            </td>
                            <td className="px-4 py-2 text-xs text-right font-mono font-medium text-foreground">
                              {item.amount !== null && item.amount !== undefined ? `AED ${fmt(item.amount)}` : <span className="text-muted-foreground">— varies</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#1F3864]">
                          <td className="px-4 py-3 text-xs font-bold text-white">{title.includes('Buyer') ? 'BUYER TOTAL' : 'SELLER TOTAL'}</td>
                          <td className="px-4 py-3 text-xs font-bold text-white text-right font-mono">AED {fmt(total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

              {/* Grand total */}
              <div className="rounded-xl bg-accent/20 border border-accent/30 px-5 py-4 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Combined Transaction Costs</span>
                <span className="text-base font-bold text-accent font-mono">AED {fmt(result.grandTotal)}</span>
              </div>
            </>
          )}

          {/* PDF Preview */}
          {pdfUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="w-4 h-4 text-accent" />
                  PDF Preview
                </div>
                <Button size="sm" onClick={handleDownload} className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden bg-white">
                <iframe
                  ref={iframeRef}
                  src={pdfUrl}
                  className="w-full"
                  style={{ height: '700px' }}
                  title="Transfer Fee Estimate PDF"
                />
              </div>
            </div>
          )}

          {!result && (
            <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-border rounded-xl text-muted-foreground gap-3">
              <Calculator className="w-10 h-10 opacity-30" />
              <p className="text-sm">Fill in the form and click Calculate<br/>to see the cost breakdown and PDF preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}