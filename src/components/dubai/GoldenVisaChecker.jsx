import React, { useState, useMemo } from 'react';
import { Plane, DollarSign, CircleCheck, CircleX, Info, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const GOLDEN_VISA_TIERS = [
  { amount: 2000000, type: 'Property Investment', benefits: ['10-year renewable', 'Family sponsorship', '100% business ownership'] },
  { amount: 750000, type: 'Property Investment', benefits: ['2-year renewable', 'Family sponsorship', 'Multiple entry'] },
];

export default function GoldenVisaChecker() {
  const [purchasePrice, setPurchasePrice] = useState(2000000);
  const [propertyType, setPropertyType] = useState('off_plan');
  const [location, setLocation] = useState('freehold');
  const [nationality, setNationality] = useState('');

  const eligibility = React.useMemo(() => {
    const isFreehold = location === 'freehold';
    const meetsThreshold = purchasePrice >= 2000000;
    const meetsLowerTier = purchasePrice >= 750000;

    return {
      golden10Year: isFreehold && meetsThreshold,
      golden2Year: isFreehold && meetsLowerTier && !meetsThreshold,
      investor: isFreehold && purchasePrice >= 500000,
    };
  }, [purchasePrice, location]);

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
            <FileText className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>UAE Golden Visa Checker</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Eligibility assessment for investors</p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Property Value (AED)</Label>
          <Input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Property Type</Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#080b12] border border-white/10">
              <SelectItem value="off_plan" className="text-white hover:bg-white/10">Off-Plan</SelectItem>
              <SelectItem value="ready" className="text-white hover:bg-white/10">Ready Property</SelectItem>
              <SelectItem value="mortgaged" className="text-white hover:bg-white/10">Mortgaged Property</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Area Type</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </TooltipTrigger>
                <TooltipContent className="bg-[#080b12] border border-white/10 text-xs">
                  <p>Only freehold areas qualify for Golden Visa</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#080b12] border border-white/10">
              <SelectItem value="freehold" className="text-white hover:bg-white/10">Freehold Area</SelectItem>
              <SelectItem value="leasehold" className="text-white hover:bg-white/10">Leasehold Area</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Buyer Nationality</Label>
          <Input
            type="text"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="e.g. Indian, British, Russian"
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
      </div>

      {/* Eligibility Results */}
      <div className="space-y-3">
        {/* 10-Year Golden Visa */}
        <Card className={eligibility.golden10Year ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {eligibility.golden10Year ? (
                  <CircleCheck className="w-6 h-6 text-emerald-500" />
                ) : (
                  <CircleX className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.3)' }} />
                )}
                <div>
                  <p className={`font-semibold ${eligibility.golden10Year ? 'text-emerald-500' : 'text-white/50'}`}>
                    10-Year Golden Visa
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Property investment ≥ AED 2M
                  </p>
                </div>
              </div>
              {eligibility.golden10Year && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-emerald-500">✓ ELIGIBLE</p>
                </div>
              )}
            </div>
            {eligibility.golden10Year && (
              <div className="mt-3 flex flex-wrap gap-2">
                {GOLDEN_VISA_TIERS[0].benefits.map(benefit => (
                  <span key={benefit} className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                    {benefit}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2-Year Golden Visa */}
        <Card className={eligibility.golden2Year ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/5'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {eligibility.golden2Year ? (
                  <CircleCheck className="w-6 h-6 text-blue-500" />
                ) : (
                  <CircleX className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.3)' }} />
                )}
                <div>
                  <p className={`font-semibold ${eligibility.golden2Year ? 'text-blue-500' : 'text-white/50'}`}>
                    2-Year Golden Visa
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Property investment ≥ AED 750K
                  </p>
                </div>
              </div>
              {eligibility.golden2Year && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-blue-500">✓ ELIGIBLE</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Investor Visa */}
        <Card className={eligibility.investor ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-white/5'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {eligibility.investor ? (
                  <CircleCheck className="w-6 h-6 text-amber-500" />
                ) : (
                  <CircleX className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.3)' }} />
                )}
                <div>
                  <p className={`font-semibold ${eligibility.investor ? 'text-amber-500' : 'text-white/50'}`}>
                    Investor Visa (2-Year)
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Property investment ≥ AED 500K
                  </p>
                </div>
              </div>
              {eligibility.investor && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-amber-500">✓ ELIGIBLE</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>📋 Golden Visa Requirements</h3>
        <ul className="space-y-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>Property must be in designated freehold areas (Downtown, Marina, Palm, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>Property must be completed (not off-plan) for 10-year visa</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>Mortgaged properties accepted with NOC from UAE bank</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>Valid passport with minimum 6 months validity</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>Health insurance coverage in UAE</span>
          </li>
        </ul>
      </div>
    </div>
  );
}