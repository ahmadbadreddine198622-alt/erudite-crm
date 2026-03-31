import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { MapPin, Bed, Bath, Maximize, Building2, Trash2, ExternalLink } from 'lucide-react';
import PropertyLeadMatcher from '@/components/matching/PropertyLeadMatcher';
import { formatAED } from '@/lib/constants';
import { cn } from '@/lib/utils';

const statusStyles = {
  available: 'bg-emerald-500/10 text-emerald-600',
  under_offer: 'bg-amber-500/10 text-amber-600',
  sold: 'bg-red-500/10 text-red-600',
  rented: 'bg-blue-500/10 text-blue-600',
  off_market: 'bg-muted text-muted-foreground',
};

export default function PropertyDetailSheet({ property, open, onClose }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Property.update(property.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['properties'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Property.delete(property.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      onClose();
    },
  });

  const images = property.images?.length > 0 ? property.images : ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop'];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[560px] overflow-y-auto p-0">
        {/* Image Gallery */}
        <div className="relative">
          <div className="flex overflow-x-auto snap-x snap-mandatory">
            {images.map((img, i) => (
              <div key={i} className="w-full shrink-0 snap-center aspect-[16/10]">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full">
            {images.length} photos
          </div>
        </div>

        <div className="p-6 space-y-5">
          <SheetHeader className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-xl">{property.title}</SheetTitle>
                {property.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {property.location}
                    {property.building_name && `, ${property.building_name}`}
                  </p>
                )}
              </div>
              <Badge className={cn("text-xs font-semibold capitalize shrink-0", statusStyles[property.status])}>
                {property.status?.replace('_', ' ')}
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-accent">{formatAED(property.price_aed)}</p>
            {property.listing_type === 'rent' && <span className="text-sm text-muted-foreground">/year</span>}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Bed className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold">{property.bedrooms ?? '-'}</p>
              <p className="text-[10px] text-muted-foreground">Beds</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Bath className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold">{property.bathrooms ?? '-'}</p>
              <p className="text-[10px] text-muted-foreground">Baths</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Maximize className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold">{property.area_sqft?.toLocaleString() ?? '-'}</p>
              <p className="text-[10px] text-muted-foreground">Sqft</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Building2 className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold capitalize">{property.property_type ?? '-'}</p>
              <p className="text-[10px] text-muted-foreground">Type</p>
            </div>
          </div>

          {/* Status Select */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
            <Select value={property.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['available', 'under_offer', 'sold', 'rented', 'off_market'].map(s => (
                  <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Details */}
          {property.description && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
              <p className="text-sm mt-1 leading-relaxed">{property.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {property.furnishing && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Furnishing</label>
                <p className="mt-0.5 capitalize">{property.furnishing.replace('_', ' ')}</p>
              </div>
            )}
            {property.developer && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Developer</label>
                <p className="mt-0.5">{property.developer}</p>
              </div>
            )}
            {property.permit_number && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">RERA Permit</label>
                <p className="mt-0.5">{property.permit_number}</p>
              </div>
            )}
          </div>

          {/* Portal status */}
          {property.portal_listings && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Portal Listings</label>
              <div className="flex gap-2 mt-1.5">
                {property.portal_listings.property_finder && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]">Property Finder</Badge>
                )}
                {property.portal_listings.bayut && (
                  <Badge className="bg-blue-500/10 text-blue-600 text-[10px]">Bayut</Badge>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {property.amenities?.length > 0 && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Amenities</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {property.amenities.map(a => (
                  <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lead Matching */}
          <div className="border border-[#E5E7EB] rounded-xl overflow-hidden -mx-0">
            <PropertyLeadMatcher mode="property" entityId={property.id} entityData={property} />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t flex justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm('Delete this property?')) deleteMutation.mutate(); }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}