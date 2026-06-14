import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle2, XCircle, Banknote } from 'lucide-react';

const FINANCING_LABELS = {
  cash: 'Cash',
  mortgage: 'Mortgage',
  pre_approved: 'Pre-approved',
  mixed: 'Mixed',
  unknown: 'Unknown',
};

function RiskNotice({ type, children }) {
  const styles = {
    amber: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)', color: 'hsl(38 92% 60%)', Icon: AlertTriangle },
    red:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.4)',   color: '#f87171',           Icon: XCircle },
    green: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.35)', color: '#34d399',           Icon: CheckCircle2 },
  };
  const { bg, border, color, Icon } = styles[type];
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-medium"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-amber-500 rounded"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

export default function LeadFinancePanel({ lead, onUpdate }) {
  const ft = lead.financing_type || 'unknown';

  const showMortgageFull = ft === 'mortgage' || ft === 'mixed' || ft === 'unknown';
  const showPreApproved  = ft === 'pre_approved' || ft === 'mixed' || ft === 'unknown';
  const showCash         = ft === 'cash' || ft === 'mixed' || ft === 'unknown';

  // Risk signals
  const isSpeculative = ft === 'mortgage' && (lead.mortgage_pre_approval_status === 'not_started' || !lead.mortgage_pre_approval_status);
  const isBelowOffer  = lead.mortgage_valuation_status === 'below_offer';
  const isCashReady   = ft === 'cash' && lead.proof_of_funds_received === true;
  const isFinanceReady = ft === 'pre_approved' || (ft === 'mortgage' && lead.mortgage_pre_approval_status === 'approved');

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Finance</span>
      </div>

      {/* Financing type selector */}
      <FieldRow label="Financing Type">
        <Select value={ft} onValueChange={v => onUpdate({ financing_type: v })}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FINANCING_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      {/* Risk notices */}
      {isSpeculative  && <RiskNotice type="amber">Speculative — no pre-approval started</RiskNotice>}
      {isBelowOffer   && <RiskNotice type="red">Deal risk: bank valuation below offer price</RiskNotice>}
      {isCashReady    && <RiskNotice type="green">Cash-ready / fast close</RiskNotice>}
      {isFinanceReady && !isBelowOffer && <RiskNotice type="green">Finance-ready</RiskNotice>}

      {/* Cash fields */}
      {(ft === 'cash') && (
        <div className="space-y-3">
          <FieldRow label="Proof of Funds">
            <CheckboxField
              label="Proof of funds received"
              checked={lead.proof_of_funds_received}
              onChange={v => onUpdate({ proof_of_funds_received: v })}
            />
          </FieldRow>
        </div>
      )}

      {/* Mortgage full track */}
      {ft === 'mortgage' && (
        <div className="space-y-3">
          <FieldRow label="Pre-approval Status">
            <Select
              value={lead.mortgage_pre_approval_status || 'not_started'}
              onValueChange={v => onUpdate({ mortgage_pre_approval_status: v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Bank Name">
              <Input
                defaultValue={lead.mortgage_bank_name || ''}
                placeholder="e.g. Emirates NBD"
                className="h-9 text-sm"
                onBlur={e => { if (e.target.value !== (lead.mortgage_bank_name || '')) onUpdate({ mortgage_bank_name: e.target.value }); }}
              />
            </FieldRow>
            <FieldRow label="Pre-approved Amount (AED)">
              <Input
                type="number"
                defaultValue={lead.mortgage_pre_approval_amount_aed || ''}
                placeholder="0"
                className="h-9 text-sm"
                onBlur={e => { const v = Number(e.target.value) || null; if (v !== (lead.mortgage_pre_approval_amount_aed || null)) onUpdate({ mortgage_pre_approval_amount_aed: v }); }}
              />
            </FieldRow>
          </div>
          <FieldRow label="Bank Valuation Status">
            <Select
              value={lead.mortgage_valuation_status || 'not_required'}
              onValueChange={v => onUpdate({ mortgage_valuation_status: v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_required">Not required</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="below_offer">Below offer ⚠️</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Offer Letter">
            <CheckboxField
              label="Mortgage offer letter received"
              checked={lead.mortgage_offer_letter_received}
              onChange={v => onUpdate({ mortgage_offer_letter_received: v })}
            />
          </FieldRow>
        </div>
      )}

      {/* Pre-approved track */}
      {ft === 'pre_approved' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Bank Name">
              <Input
                defaultValue={lead.mortgage_bank_name || ''}
                placeholder="e.g. Emirates NBD"
                className="h-9 text-sm"
                onBlur={e => { if (e.target.value !== (lead.mortgage_bank_name || '')) onUpdate({ mortgage_bank_name: e.target.value }); }}
              />
            </FieldRow>
            <FieldRow label="Pre-approved Amount (AED)">
              <Input
                type="number"
                defaultValue={lead.mortgage_pre_approval_amount_aed || ''}
                placeholder="0"
                className="h-9 text-sm"
                onBlur={e => { const v = Number(e.target.value) || null; if (v !== (lead.mortgage_pre_approval_amount_aed || null)) onUpdate({ mortgage_pre_approval_amount_aed: v }); }}
              />
            </FieldRow>
          </div>
          <FieldRow label="Offer Letter">
            <CheckboxField
              label="Mortgage offer letter received"
              checked={lead.mortgage_offer_letter_received}
              onChange={v => onUpdate({ mortgage_offer_letter_received: v })}
            />
          </FieldRow>
        </div>
      )}

      {/* Mixed / Unknown — show all */}
      {(ft === 'mixed' || ft === 'unknown') && (
        <div className="space-y-3">
          <FieldRow label="Pre-approval Status">
            <Select
              value={lead.mortgage_pre_approval_status || 'not_started'}
              onValueChange={v => onUpdate({ mortgage_pre_approval_status: v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Bank Name">
              <Input
                defaultValue={lead.mortgage_bank_name || ''}
                placeholder="e.g. Emirates NBD"
                className="h-9 text-sm"
                onBlur={e => { if (e.target.value !== (lead.mortgage_bank_name || '')) onUpdate({ mortgage_bank_name: e.target.value }); }}
              />
            </FieldRow>
            <FieldRow label="Pre-approved Amount (AED)">
              <Input
                type="number"
                defaultValue={lead.mortgage_pre_approval_amount_aed || ''}
                placeholder="0"
                className="h-9 text-sm"
                onBlur={e => { const v = Number(e.target.value) || null; if (v !== (lead.mortgage_pre_approval_amount_aed || null)) onUpdate({ mortgage_pre_approval_amount_aed: v }); }}
              />
            </FieldRow>
          </div>
          <FieldRow label="Bank Valuation Status">
            <Select
              value={lead.mortgage_valuation_status || 'not_required'}
              onValueChange={v => onUpdate({ mortgage_valuation_status: v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_required">Not required</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="below_offer">Below offer ⚠️</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Proof of Funds">
            <CheckboxField
              label="Proof of funds received"
              checked={lead.proof_of_funds_received}
              onChange={v => onUpdate({ proof_of_funds_received: v })}
            />
          </FieldRow>
          <FieldRow label="Offer Letter">
            <CheckboxField
              label="Mortgage offer letter received"
              checked={lead.mortgage_offer_letter_received}
              onChange={v => onUpdate({ mortgage_offer_letter_received: v })}
            />
          </FieldRow>
        </div>
      )}

      {/* Finance notes — always shown */}
      <FieldRow label="Finance Notes">
        <textarea
          defaultValue={lead.finance_notes || ''}
          placeholder="Notes on financing situation…"
          rows={2}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          onBlur={e => { if (e.target.value !== (lead.finance_notes || '')) onUpdate({ finance_notes: e.target.value }); }}
        />
      </FieldRow>
    </section>
  );
}