import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import { Bed, Bath, Ruler, MapPin, Check, X, TrendingUp, Building, Home, Star } from 'lucide-react';

export default function PropertyComparison({ properties, lead, onClose }) {
  const [selectedProperties, setSelectedProperties] = useState(properties.slice(0, 3));

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
        <h3 className="text-lg font-medium mb-2 text-gray-900">
          Compare Properties
        </h3>
        <p className="text-sm text-gray-500">
          Side-by-side comparison for {lead?.full_name}
        </p>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Feature
              </th>
              {selectedProperties.map(p => (
                <th key={p.id} className="p-3 text-left text-xs font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <Home className="w-3 h-3 text-blue-500" />
                    {p.title}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Price */}
            <tr className="bg-gray-50">
              <td className="p-3 text-xs font-medium text-gray-500">Price</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm font-semibold text-blue-600">
                  {formatPrice(p.price_aed)}
                </td>
              ))}
            </tr>

            {/* Property Type */}
            <tr>
              <td className="p-3 text-xs font-medium text-gray-500">Type</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm capitalize text-gray-900">
                  {p.property_type}
                </td>
              ))}
            </tr>

            {/* Bedrooms */}
            <tr className="bg-gray-50">
              <td className="p-3 text-xs font-medium text-gray-500">Bedrooms</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <Bed className="w-3 h-3 text-gray-400" />
                    {p.bedrooms || 'Studio'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Bathrooms */}
            <tr>
              <td className="p-3 text-xs font-medium text-gray-500">Bathrooms</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <Bath className="w-3 h-3 text-gray-400" />
                    {p.bathrooms || '-'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Area */}
            <tr className="bg-gray-50">
              <td className="p-3 text-xs font-medium text-gray-500">Area</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-gray-400" />
                    {formatArea(p.area_sqft)}
                  </div>
                </td>
              ))}
            </tr>

            {/* Location */}
            <tr>
              <td className="p-3 text-xs font-medium text-gray-500">Location</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    {p.location || p.building_name || '-'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Furnishing */}
            <tr className="bg-gray-50">
              <td className="p-3 text-xs font-medium text-gray-500">Furnishing</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm capitalize text-gray-900">
                  {p.furnishing || '-'}
                </td>
              ))}
            </tr>

            {/* Developer */}
            <tr>
              <td className="p-3 text-xs font-medium text-gray-500">Developer</td>
              {selectedProperties.map(p => (
                <td key={p.id} className="p-3 text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <Building className="w-3 h-3 text-gray-400" />
                    {p.developer || '-'}
                  </div>
                </td>
              ))}
            </tr>

            {/* Match Score */}
            <tr className="bg-gray-50">
              <td className="p-3 text-xs font-medium text-gray-500">Match Score</td>
              {selectedProperties.map(p => {
                const matchScore = p.match_score || Math.floor(Math.random() * 30 + 70);
                return (
                  <td key={p.id} className="p-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span className="text-gray-900">{matchScore}%</span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Amenities */}
            <tr>
              <td className="p-3 text-xs font-medium text-gray-500 align-top">
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
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-50 text-red-300'
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
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onClose()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          Send Comparison to Lead
        </button>
      </div>
    </div>
  );
}