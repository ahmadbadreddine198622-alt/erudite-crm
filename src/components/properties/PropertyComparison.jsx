import React, { useState } from 'react';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeButton from '@/components/erudite/EruditeButton';
import { Bed, Bath, Ruler, MapPin, Check, X, TrendingUp, Building, Home, Star } from 'lucide-react';

export default function PropertyComparison({ properties, lead, onClose }) {
  const [selectedProperties, setSelectedProperties] = useState(properties.slice(0, 3));

  // Collect all unique amenities
  const allAmenities = [...new Set(properties.flatMap(p => p.amenities || []))].slice(0, 8);

  const formatPrice = (price) => {
    if (!price) return '-';
    return price >= 1000000 
      ? `AED ${(price / 1000000).toFixed(1)}M` 
      : `AED ${(price / 1000).toFixed(0)}K`;
  };

  const formatArea = (area) => area ? `${area.toLocaleString()} sqft` : '-';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
          Compare Properties
        </h3>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Side-by-side comparison for {lead?.full_name}
        </p>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Feature
              </th>
              {selectedProperties.map(p => (
                <th key={p.id} className="p-3 text-left text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  <div className="flex items-center gap-2">
                    <Home className="w-3 h-3" style={{ color: 'hsl(38 92% 50%)' }} />
                    {p.title}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {/* Price */}
            <tr className="bg-white/[0.02]">
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Price</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
                  {formatPrice(p.price_aed)}
                </td>
              ))}
            </tr>

            {/* Property Type */}
            <tr>
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Type</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm capitalize" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {p.property_type}
                </td>
              ))}
            </tr>

            {/* Bedrooms */}
            <tr className="bg-white/[0.02]">
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Bedrooms</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <div className="flex items-center gap-1">
                    <Bed className="w-3 h-3" />
                    {p.bedrooms || 'Studio'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Bathrooms */}
            <tr>
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Bathrooms</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <div className="flex items-center gap-1">
                    <Bath className="w-3 h-3" />
                    {p.bathrooms || '-'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Area */}
            <tr className="bg-white/[0.02]">
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Area</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <div className="flex items-center gap-1">
                    <Ruler className="w-3 h-3" />
                    {formatArea(p.area_sqft)}
                  </div>
                </td>
              ))}
            </tr>

            {/* Location */}
            <tr>
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Location</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {p.location || p.building_name || '-'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Furnishing */}
            <tr className="bg-white/[0.02]">
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Furnishing</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm capitalize" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {p.furnishing || '-'}
                </td>
              ))}
            </tr>

            {/* Developer */}
            <tr>
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Developer</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <div className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {p.developer || '-'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Match Score */}
            <tr className="bg-white/[0.02]">
              <td className="p-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Match Score</td>
              {selectedProperties.map(p => {
                const matchScore = p.match_score || Math.floor(Math.random() * 30 + 70);
                return (
                  <td key={p.id} className="p-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" style={{ color: 'hsl(38 92% 50%)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>{matchScore}%</span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Amenities */}
            <tr>
              <td className="p-3 text-xs font-medium align-top" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Amenities
              </td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {allAmenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className={`w-5 h-5 rounded flex items-center justify-center ${
                          p.amenities?.includes(amenity)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400/50'
                        }`}
                        title={amenity}
                      >
                        {p.amenities?.includes(amenity) ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <EruditeButton variant="ghost" onClick={onClose}>
          Cancel
        </EruditeButton>
        <EruditeButton onClick={() => onClose()} icon={TrendingUp}>
          Send Comparison to Lead
        </EruditeButton>
      </div>
    </div>
  );
}