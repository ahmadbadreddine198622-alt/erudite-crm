/**
 * transferCalc.js
 * Pure calculation logic for Erudite Property Transfer Cost Calculator
 * 2026 Dubai DLD rules
 */

export function calcTransfer({
  price,
  propertyType,
  buyerFinancing,
  loanAmount,
  sellerMortgage,
  outstandingBalance,
  rateType,
  buyerCommPct,
  sellerCommPct,
  nocSide, // 'seller' | 'buyer'
}) {
  const p = Number(price) || 0;
  const loan = Number(loanAmount) || 0;
  const outstanding = Number(outstandingBalance) || 0;

  // ── BUYER LINES ──────────────────────────────────────────────────────────────
  const buyerLines = [];

  // Fixed government fees
  buyerLines.push({ id: 'dld_transfer', label: 'DLD Transfer Fee', basis: '4% × price', amount: p * 0.04, est: false });
  const trustee = p >= 500000 ? 4200 : 4000;
  buyerLines.push({ id: 'trustee', label: 'Trustee Office Fee', basis: p >= 500000 ? 'Fixed (price ≥ 500k, incl. VAT)' : 'Fixed (price < 500k, incl. VAT)', amount: trustee, est: false });
  buyerLines.push({ id: 'dld_admin', label: 'DLD Admin Fee', basis: 'Fixed', amount: 580, est: false });
  buyerLines.push({ id: 'title_deed', label: 'Title Deed Issuance', basis: 'Fixed', amount: 250, est: false });
  buyerLines.push({ id: 'map_fee', label: 'Map / Site Plan Fee', basis: 'Fixed', amount: 250, est: false });
  buyerLines.push({ id: 'knowledge', label: 'Knowledge & Innovation Fee', basis: 'Fixed', amount: 20, est: false });

  // Buyer financing
  if (buyerFinancing) {
    buyerLines.push({ id: 'mortgage_reg', label: 'Mortgage Registration Fee', basis: '0.25% × loan + 290', amount: loan * 0.0025 + 290, est: false });
    buyerLines.push({ id: 'bank_processing', label: 'Bank Processing Fee', basis: '~0.5% × loan', amount: loan * 0.005, est: true });
    buyerLines.push({ id: 'valuation', label: 'Property Valuation', basis: 'Estimate', amount: 3000, est: true });
  }

  // Seller mortgage — bank blocking fee on buyer
  if (sellerMortgage) {
    buyerLines.push({ id: 'bank_blocking', label: 'Bank Blocking Fee', basis: 'DLD charge (est. range 1,020–1,545)', amount: 1500, est: true });
  }

  // Buyer commission
  const buyerComm = p * (buyerCommPct / 100);
  const buyerCommVAT = buyerComm * 0.05;
  if (buyerCommPct > 0) {
    buyerLines.push({ id: 'buyer_comm', label: `Buyer Agency Commission (${buyerCommPct}%)`, basis: `${buyerCommPct}% × price`, amount: buyerComm, est: false });
    buyerLines.push({ id: 'buyer_comm_vat', label: 'VAT on Commission', basis: '5% × commission', amount: buyerCommVAT, est: false });
  }

  // Developer NOC on buyer (if reassigned)
  if (nocSide === 'buyer') {
    buyerLines.push({ id: 'dev_noc', label: 'Developer NOC (Resale)', basis: 'Fixed (resale)', amount: 525, est: false });
  }

  // ── SELLER LINES ─────────────────────────────────────────────────────────────
  const sellerLines = [];

  if (sellerMortgage) {
    sellerLines.push({ id: 'mortgage_release', label: 'Mortgage Release Procedure', basis: 'Fixed', amount: 1290, est: false });
    sellerLines.push({ id: 'registrar_release', label: 'Registrar Release Fee', basis: 'Fixed', amount: 315, est: false });
    sellerLines.push({ id: 'title_clear', label: 'Service Partner / Title Clear', basis: 'Estimate', amount: 315, est: true });

    let earlySettlementAmt, earlySettlementBasis;
    if (rateType === 'Fixed') {
      earlySettlementAmt = Math.min(outstanding * 0.01, 10000);
      earlySettlementBasis = 'min(1% × outstanding, 10,000) — Central Bank cap';
    } else {
      earlySettlementAmt = 0;
      earlySettlementBasis = 'est. — variable rate, ~3 months interest; confirm with bank';
    }
    sellerLines.push({ id: 'early_settlement', label: 'Early Settlement Fee', basis: earlySettlementBasis, amount: earlySettlementAmt, est: true });
  }

  // Seller commission
  const sellerComm = p * (sellerCommPct / 100);
  const sellerCommVAT = sellerComm * 0.05;
  if (sellerCommPct > 0) {
    sellerLines.push({ id: 'seller_comm', label: `Seller Agency Commission (${sellerCommPct}%)`, basis: `${sellerCommPct}% × price`, amount: sellerComm, est: false });
    sellerLines.push({ id: 'seller_comm_vat', label: 'VAT on Commission', basis: '5% × commission', amount: sellerCommVAT, est: false });
  }

  // Developer NOC on seller (default)
  if (nocSide === 'seller') {
    sellerLines.push({ id: 'dev_noc', label: 'Developer NOC (Resale)', basis: 'Fixed (resale)', amount: 525, est: false });
  }

  // DEWA deposit — separate, refundable
  const dewaDeposit = propertyType === 'villa' ? 4000 : 2000;

  return { buyerLines, sellerLines, dewaDeposit };
}

export function getScenarioName(buyerFinancing, sellerMortgage) {
  if (!buyerFinancing && !sellerMortgage) return 'Cash Buyer / Cash Seller';
  if (buyerFinancing && !sellerMortgage) return 'Finance Buyer / Cash Seller';
  if (!buyerFinancing && sellerMortgage) return 'Cash Buyer / Finance Seller';
  return 'Finance Buyer / Finance Seller';
}

export function sumLines(lines, overrides) {
  return lines.reduce((acc, l) => {
    const amt = overrides[l.id] !== undefined ? Number(overrides[l.id]) : l.amount;
    return acc + (Number.isFinite(amt) ? amt : 0);
  }, 0);
}