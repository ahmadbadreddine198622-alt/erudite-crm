import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Maximize } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatAED } from '@/lib/constants';
import PropertyDetailSheet from '@/components/properties/PropertyDetailSheet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function MapView() {
  const [selectedProperty, setSelectedProperty] = useState(null);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
  });

  const mappable = properties.filter(p => p.latitude && p.longitude);

  // Dubai center
  const center = mappable.length > 0
    ? [mappable[0].latitude, mappable[0].longitude]
    : [25.2048, 55.2708];

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 md:px-8 md:pt-8 md:pb-4">
        <PageHeader title="Property Map" subtitle={`${mappable.length} properties with location`} />
      </div>
      <div className="flex-1 px-4 md:px-8 pb-4">
        <div className="rounded-xl overflow-hidden border h-full min-h-[400px]">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            {mappable.map(p => (
              <Marker key={p.id} position={[p.latitude, p.longitude]}>
                <Popup>
                  <div
                    className="cursor-pointer min-w-[200px]"
                    onClick={() => setSelectedProperty(p)}
                  >
                    <p className="font-semibold text-sm">{p.title}</p>
                    <p className="text-accent font-bold text-sm mt-1">{formatAED(p.price_aed)}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {p.bedrooms != null && <span>{p.bedrooms} BR</span>}
                      {p.bathrooms != null && <span>{p.bathrooms} BA</span>}
                      {p.area_sqft && <span>{p.area_sqft} sqft</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.location}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {selectedProperty && (
        <PropertyDetailSheet
          property={selectedProperty}
          open={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}