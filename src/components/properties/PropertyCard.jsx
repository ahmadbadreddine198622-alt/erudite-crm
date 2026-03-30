import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath, Maximize, Eye } from 'lucide-react';
import { formatAED } from '@/lib/constants';
import { cn } from '@/lib/utils';

const statusStyles = {
  available: 'bg-emerald-500/10 text-emerald-600',
  under_offer: 'bg-amber-500/10 text-amber-600',
  sold: 'bg-red-500/10 text-red-600',
  rented: 'bg-blue-500/10 text-blue-600',
  off_market: 'bg-muted text-muted-foreground',
};

export default function PropertyCard({ property, onClick }) {
  const img = property.images?.[0] || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop';

  return (
    <Card
      className="overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300"
      onClick={() => onClick(property)}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={img}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge className={cn("text-[10px] font-semibold", statusStyles[property.status])}>
            {property.status?.replace('_', ' ')}
          </Badge>
          <Badge className="bg-card/80 text-foreground backdrop-blur text-[10px] font-semibold capitalize">
            {property.listing_type}
          </Badge>
        </div>
        {property.views_count > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-card/80 backdrop-blur rounded-full px-2 py-0.5 text-[10px]">
            <Eye className="w-3 h-3" /> {property.views_count}
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
          <p className="text-white font-bold text-lg">
            {formatAED(property.price_aed)}
            {property.listing_type === 'rent' && <span className="text-xs font-normal opacity-80"> /year</span>}
          </p>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-sm truncate">{property.title}</h3>
        {property.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" /> {property.location}{property.building_name ? `, ${property.building_name}` : ''}
          </p>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {property.bedrooms != null && (
            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {property.bedrooms} BR</span>
          )}
          {property.bathrooms != null && (
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {property.bathrooms}</span>
          )}
          {property.area_sqft && (
            <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {property.area_sqft.toLocaleString()} sqft</span>
          )}
        </div>

        {property.portal_listings && (
          <div className="flex gap-1.5 mt-3">
            {property.portal_listings.property_finder && (
              <Badge variant="outline" className="text-[9px]">Property Finder</Badge>
            )}
            {property.portal_listings.bayut && (
              <Badge variant="outline" className="text-[9px]">Bayut</Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}