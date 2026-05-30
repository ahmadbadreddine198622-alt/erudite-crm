import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, Percent, Home, TrendingUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function MortgageCalculator() {
  const [propertyPrice, setPropertyPrice] = useState(2000000);
  const [downPayment, setDownPayment] = useState(500000);
  const [interestRate, setInterestRate] = useState(5.25);
  const [termYears, setTermYears] = useState(25);
  const [propertyType, setPropertyType] = useState('ready');
  const [isFirstTime, setIsFirstTime] = useState(false);

  const calculations = useMemo(() => {
    const loanAmount = propertyPrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const totalPayments = termYears * 12;
    
    // Monthly mortgage payment (principal + interest)
    const monthlyPayment = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments) / 
                          (Math.pow(1 + monthlyRate, totalPayments) - 1);
    
    const totalPayment = monthlyPayment * totalPayments;
    const totalInterest = totalPayment - loanAmount;
    
    // Dubai-specific costs
    const dldFee = propertyPrice * 0.04; // 4% DLD
    const agentCommission = propertyPrice * 0.02; // 2%
    const mortgageRegistration = loanAmount * 0.0025 + 525; // 0.25% + AED 525
    const valuationFee = 2500;
    const arrangementFee = loanAmount * 0.01; // 1% typical
    
    const totalUpfront = downPayment + dldFee + agentCommission + mortgageRegistration + valuationFee + arrangementFee;
    
    // Affordability check (UAE banks typically use 50% DTI)
    const requiredMonthlyIncome = monthlyPayment / 0.5;
    const requiredAnnualIncome = requiredMonthlyIncome * 12;

    return {
      loanAmount,
      monthlyPayment,
      totalPayment,
      totalInterest,
      dldFee,
      agentCommission,
      mortgageRegistration,
      valuationFee,
      arrangementFee,
      totalUpfront,
      requiredMonthlyIncome,
      requiredAnnualIncome,
    };
  }, [propertyPrice, downPayment, interestRate, termYears, propertyType, isFirstTime]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(245,159,10,0.15)',
              border: '1px solid rgba(245,159,10,0.3)',
            }}
          >
            <Calculator className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>UAE Mortgage Calculator</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Instant pre-approval estimates</p>
          </div>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Property Price (AED)</Label>
          <Input
            type="number"
            value={propertyPrice}
            onChange={(e) => setPropertyPrice(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Down Payment (AED)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </TooltipTrigger>
                <TooltipContent className="bg-[#080b12] border border-white/10 text-xs">
                  <p>UAE: Min 20% for expats, 25% for non-residents</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            type="number"
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Interest Rate (%)</Label>
          <Input
            type="number"
            step="0.25"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Loan Term (Years)</Label>
          <Select value={String(termYears)} onValueChange={(v) => setTermYears(Number(v))}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#080b12] border border-white/10">
              <SelectItem value="15" className="text-white hover:bg-white/10">15 Years</SelectItem>
              <SelectItem value="20" className="text-white hover:bg-white/10">20 Years</SelectItem>
              <SelectItem value="25" className="text-white hover:bg-white/10">25 Years</SelectItem>
              <SelectItem value="30" className="text-white hover:bg-white/10">30 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Property Type</Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#080b12] border border-white/10">
              <SelectItem value="ready" className="text-white hover:bg-white/10">Ready Property</SelectItem>
              <SelectItem value="off_plan" className="text-white hover:bg-white/10">Off-Plan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="firstTime"
            checked={isFirstTime}
            onChange={(e) => setIsFirstTime(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5"
          />
          <Label htmlFor="firstTime" className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            First-time buyer (UAE national)
          </Label>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Monthly Payment */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Monthly Payment</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">AED {calculations.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Principal + Interest</p>
        </div>

        {/* Loan Amount */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Loan Amount</span>
          </div>
          <p className="text-xl font-bold text-blue-500">AED {calculations.loanAmount.toLocaleString()}</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>After down payment</p>
        </div>

        {/* Total Interest */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(245,159,10,0.1)',
            border: '1px solid rgba(245,159,10,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Interest</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {calculations.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Over {termYears} years</p>
        </div>

        {/* Required Income */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Required Income</span>
          </div>
          <p className="text-lg font-bold text-purple-500">AED {calculations.requiredMonthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>50% DTI ratio</p>
        </div>
      </div>

      {/* Upfront Costs Breakdown */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>Total Upfront Costs (AED)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Down Payment</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{calculations.downPayment.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>DLD (4%)</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{calculations.dldFee.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Agent (2%)</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{calculations.agentCommission.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Mortgage Reg.</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{calculations.mortgageRegistration.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Valuation</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{calculations.valuationFee.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Arrangement</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{calculations.arrangementFee.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Total Cash Needed</p>
            <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {calculations.totalUpfront.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Pre-Approval CTA */}
      <div className="flex justify-center gap-3">
        <Button className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8">
          <DollarSign className="w-5 h-5 mr-2" />
          Get Pre-Approved
        </Button>
        <Button variant="outline" className="h-12 px-8">
          <Calculator className="w-5 h-5 mr-2" />
          Compare Banks
        </Button>
      </div>
    </div>
  );
}