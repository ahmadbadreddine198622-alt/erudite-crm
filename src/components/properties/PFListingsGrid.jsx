import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { RefreshCw, Bed, Bath, Ruler, MapPin, Home, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PFListingsGrid() {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState(null);

  // Fetch Property Finder listings from database
  const { data: listings = [], isLoading, refetch } = useQuery({
    queryKey: ['pfListings'],
    queryFn: async () => {
      const result = await base44.entities.PFListing.filter({}, '-last_synced_at', 100);
      return result || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Sync mutation - uses syncPFListings for proper pagination
  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncStatus({ type: 'syncing', message: 'Syncing listings...' });
      const result = await base44.functions.invoke('syncPFListings', {});
      return result;
    },
    onSuccess: (result) => {
      setSyncStatus({ type: 'success', message: `Synced ${result.data.total_listings_written || 0} listings` });
      queryClient.invalidateQueries({ queryKey: ['pfListings'] });
      toast.success(`Synced ${result.data.total_listings_written || 0} listings`);
      setTimeout(() => setSyncStatus(null), 5000);
    },
    onError: (error) => {
      setSyncStatus({ type: 'error', message: error.message });
      toast.error('Sync failed: ' + error.message);
      setTimeout(() => setSyncStatus(null), 5000);
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  if (!listings.length && !isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.95)' }}>My Listings</h3>
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Synchronize'}
          </button>
        </div>
        {syncStatus && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            syncStatus.type === 'error' ? 'bg-rose-500/10 text-rose-400' : 
            syncStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 
            'bg-amber-500/10 text-amber-400'
          }`}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{syncStatus.message}</span>
          </div>
        )}
        <iOSCard className="p-8 text-center">
          <Home className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No listings synced yet. Click Synchronize to fetch your Property Finder listings.</p>
        </iOSCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.95)' }}>My Listings</h3>
        <button
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Synchronize
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {listings.length} {listings.length === 1 ? 'listing' : 'listings'} from Property Finder
      </p>
    </div>
  );
}

function ListingCard({ listing }) {
  const displayData = {
    image: listing.images?.[0] || '',
    title: listing.title || `${listing.property_type} in ${listing.location}`,
    reference: listing.reference_number || listing.pf_listing_id,
    location: listing.location || listing.community || '',
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms || 0,
    area: listing.area_sqft || 0,
    type: listing.property_type || 'apartment',
    price: listing.price || 0,
    status: listing.status || 'active',
  };

  return (
    <iOSCard className="overflow-hidden flex flex-col h-full">
      {/* Image */}
      {displayData.image ? (
        <div className="relative w-full h-40 bg-gradient-to-br from-white/5 to-white/2 overflow-hidden">
          <img
            src={displayData.image}
            alt={displayData.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
          />
          <div className="absolute top-2 right-2">
            <iOSBadge variant={displayData.status === 'active' ? 'green' : 'gray'} className="text-xs">
              {displayData.status}
            </iOSBadge>
          </div>
        </div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-white/5 to-white/2 flex items-center justify-center">
          <Home className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.2)' }} />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Title */}
        <h4 className="font-medium text-sm mb-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
          {displayData.title}
        </h4>

        {/* Reference */}
        <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Ref: {displayData.reference}
        </p>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin className="w-3 h-3" style={{ color: 'hsl(38 92% 50%)' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {displayData.location}
          </span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-white/10">
          <div className="flex flex-col items-center">
            <Bed className="w-3.5 h-3.5 mb-1" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {displayData.bedrooms}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Bath className="w-3.5 h-3.5 mb-1" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {displayData.bathrooms}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Ruler className="w-3.5 h-3.5 mb-1" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {Math.round(displayData.area)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Home className="w-3.5 h-3.5 mb-1" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {displayData.type}
            </span>
          </div>
        </div>

        {/* Price */}
        <p className="text-sm font-semibold text-amber-600">
          AED {displayData.price?.toLocaleString()}
        </p>
      </div>
    </iOSCard>
  );
}