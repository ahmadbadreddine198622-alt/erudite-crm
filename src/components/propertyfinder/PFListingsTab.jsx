import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Home, BedDouble, Bath, MapPin, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusColors = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  unpublished: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
};

export default function PFListingsTab() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['pf-listings'],
    queryFn: async () => {
      const res = await base44.functions.invoke('propertyFinderSync', { mode: 'listings' });
      return res.data.listings || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const listings = data || [];

  const filtered = listings.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ((l.title || l.headline || '')).toLowerCase().includes(q) ||
      ((l.reference || l.referenceNumber || '')).toLowerCase().includes(q) ||
      ((l.location && (l.location.city || l.location.community || l.location.area || '')) || '').toLowerCase().includes(q)
    );
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading listings from PropertyFinder...</div>;
  if (error) return <div className="py-12 text-center text-sm text-red-600">{error.message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search listings..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 shrink-0">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No listings found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing, i) => {
            const title = listing.title || listing.headline || 'Untitled Listing';
            const ref = listing.reference || listing.referenceNumber || listing.id || '';
            const status = (listing.status || listing.state || '').toLowerCase();
            const price = listing.price || listing.askingPrice;
            const beds = listing.bedrooms !== undefined ? listing.bedrooms : (listing.beds !== undefined ? listing.beds : null);
            const baths = listing.bathrooms !== undefined ? listing.bathrooms : (listing.baths !== undefined ? listing.baths : null);
            const area = listing.area || listing.location;
            const areaText = typeof area === 'object' ? (area.community || area.area || area.city || '') : (area || '');
            const images = listing.photos || listing.images || listing.media || [];
            const imgUrl = images.length > 0 ? (images[0].url || images[0].src || images[0]) : null;
            const propertyType = listing.propertyType || listing.type || '';
            const category = listing.category || listing.offeringType || '';

            return (
              <Card key={listing.id || i} className="overflow-hidden hover:shadow-md transition-shadow">
                {imgUrl ? (
                  <img src={imgUrl} alt={title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Home className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
                    {status && (
                      <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
                        {status}
                      </span>
                    )}
                  </div>
                  {ref && (
                    <p className="text-xs font-mono text-muted-foreground">Ref: {ref}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {beds !== null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{beds} Bed</span>}
                    {baths !== null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{baths} Bath</span>}
                    {propertyType && <span className="capitalize">{propertyType}</span>}
                    {category && <span className="capitalize">{category}</span>}
                  </div>
                  {areaText && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />{areaText}
                    </div>
                  )}
                  {price && (
                    <p className="font-bold text-sm">
                      AED {Number(price).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground text-right">Showing {filtered.length} of {listings.length} listings</p>
    </div>
  );
}