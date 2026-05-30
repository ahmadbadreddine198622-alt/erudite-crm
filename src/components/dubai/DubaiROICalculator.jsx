import React, { useState, useMemo } from 'react';
import { Building2, TrendingUp, DollarSign, Percent, MapPin, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DUBAI_COMMUNITIES = [
  'Downtown Dubai', 'Dubai Marina', 'Palm Jumeirah', 'Business Bay', 'JBR',
  'Dubai Hills Estate', 'Arabian Ranches', 'Emirates Hills', 'JVC', 'DIFC',
  'Bluewaters Island', 'City Walk', 'Sobha Hartland', 'Mohammed Bin Rashid City',
  'Dubai South', 'Remraam', 'The Springs', 'The Meadows', 'The Lakes',
  'Discovery Gardens', 'International City', 'Dubai Silicon Oasis', 'Mirdif',
  'Deira', 'Bur Dubai', 'Al Barsha', 'Jumeirah', 'Umm Suqeim'
];

export default function DubaiROICalculator() {
  const [purchasePrice, setPurchasePrice] = useState(2000000);
  const [downPayment, setDownPayment] = useState(500000);
  const [monthlyRent, setMonthlyRent] = useState(120000);
  const [serviceCharge, setServiceCharge] = useState(15000);
  const [community, setCommunity] = useState('Dubai Marina');
  const [propertyType, setPropertyType] = useState('Apartment');

  const calculations = useMemo(() => {
    const annualRent = monthlyRent * 12;
    const grossYield = ((annualRent / purchasePrice) * 100).toFixed(2);
    const netYield = ((((annualRent - serviceCharge) / purchasePrice) * 100)).toFixed(2);
    const monthlyMortgage = downPayment > 0 ? ((purchasePrice - downPayment) * 0.05 / 12).toFixed(0) : 0;
    const cashFlow = annualRent - serviceCharge - (monthlyMortgage * 12);
    const roi = ((cashFlow / downPayment) * 100).toFixed(2);
    
    // Dubai-specific costs
    const dldFee = purchasePrice * 0.04; // 4% DLD transfer fee
    const agentCommission = purchasePrice * 0.02; // 2% agent fee
    const totalAcquisitionCost = purchasePrice + dldFee + agentCommission;

    return {
      annualRent,
      grossYield,
      netYield,
      monthlyMortgage,
      cashFlow,
      roi,
      dldFee,
      agentCommission,
      totalAcquisitionCost,
    };
  }, [purchasePrice, downPayment, monthlyRent, serviceCharge]);

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
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Dubai Investment Calculator</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Rental Yield and ROI Analysis</p>
          </div>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Purchase Price (AED)</Label>
          <Input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Down Payment (AED)</Label>
          <Input
            type="number"
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Annual Rent (AED)</Label>
          <Input
            type="number"
            value={monthlyRent * 12}
            onChange={(e) => setMonthlyRent(Number(e.target.value) / 12)}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Service Charge (AED/year)</Label>
          <Input
            type="number"
            value={serviceCharge}
            onChange={(e) => setServiceCharge(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Community</Label>
          <Select value={community} onValueChange={setCommunity}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#080b12] border border-white/10">
              {DUBAI_COMMUNITIES.map(c => (
                <SelectItem key={c} value={c} className="text-white hover:bg-white/10">{c}</SelectItem>
              ))}
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
              <SelectItem value="Apartment" className="text-white hover:bg-white/10">Apartment</SelectItem>
              <SelectItem value="Villa" className="text-white hover:bg-white/10">Villa</SelectItem>
              <SelectItem value="Townhouse" className="text-white hover:bg-white/10">Townhouse</SelectItem>
              <SelectItem value="Penthouse" className="text-white hover:bg-white/10">Penthouse</SelectItem>
              <SelectItem value="Studio" className="text-white hover:bg-white/10">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Gross Yield */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Gross Yield</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{calculations.grossYield}%</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Dubai avg: 5-8%</p>
        </div>

        {/* Net Yield */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Net Yield</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{calculations.netYield}%</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>After service charge</p>
        </div>

        {/* Cash Flow */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: calculations.cashFlow > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${calculations.cashFlow > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4" style={{ color: calculations.cashFlow > 0 ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)' }} />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Annual Cash Flow</span>
          </div>
          <p className="text-xl font-bold" style={{ color: calculations.cashFlow > 0 ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)' }}>
            AED {calculations.cashFlow.toLocaleString()}
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>After mortgage and charges</p>
        </div>

        {/* ROI */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(245,159,10,0.1)',
            border: '1px solid rgba(245,159,10,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Cash ROI</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{calculations.roi}%</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>On down payment</p>
        </div>
      </div>

      {/* Acquisition Costs */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>Dubai Acquisition Costs</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>DLD Transfer Fee (4%)</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>AED {calculations.dldFee.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Agent Commission (2%)</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>AED {calculations.agentCommission.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Total Acquisition</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>AED {calculations.totalAcquisitionCost.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}