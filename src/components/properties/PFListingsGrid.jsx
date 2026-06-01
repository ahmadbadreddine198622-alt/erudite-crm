import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { RefreshCw, Bed, Bath, Ruler, MapPin, Home, AlertCircle, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function PFListingsGrid() {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState(null);

  const { data: listings = [], isLoading, refetch } = useQuery({
    queryKey: ['pfListings'],
    queryFn: async () => {
      const result = await base44.entities.PFListing.filter({}, '-last_synced_at', 100);
      return result || [];
    },
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const unsubscribe = base44.entities.PFListing.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        refetch();
      }
    });
    return () => unsubscribe();
  }, []);

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
          <h3 className="text-lg font-medium text-gray-900">My Listings</h3>
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Synchronize'}
          </button>
        </div>
        {syncStatus && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            syncStatus.type === 'error' ? 'bg-rose-50 text-rose-600' : 
            syncStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
            'bg-amber-50 text-amber-600'
          }`}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{syncStatus.message}</span>
          </div>
        )}
        <iOSCard className="p-8 text-center">
          <Home className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500">No listings synced yet. Click Synchronize to fetch your Property Finder listings.</p>
        </iOSCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">My Listings</h3>
        <button
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Synchronize
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {listings.length} {listings.length === 1 ? 'listing' : 'listings'} from Property Finder
      </p>
    </div>
  );
}

function ListingCard({ listing }) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
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

  const generatePDFMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingPDF(true);
      const result = await base44.functions.invoke('generatePFListingPDF', { listing_id: listing.id });
      return result;
    },
    onSuccess: (result) => {
      setIsGeneratingPDF(false);
      if (result.data.pdf_url) {
        window.open(result.data.pdf_url, '_blank');
        toast.success('PDF opened in new tab');
      } else {
        toast.info('PDF generated but Google Drive not connected');
      }
    },
    onError: (error) => {
      setIsGeneratingPDF(false);
      toast.error('Failed to generate PDF: ' + error.message);
    },
  });

  const handleGeneratePDF = () => {
    generatePDFMutation.mutate();
  };

  const handleOpenPortal = () => {
    if (listing.pf_url) {
      window.open(listing.pf_url, '_blank');
    } else {
      toast.info('Portal URL not available for this listing');
    }
  };

  return (
    <iOSCard className="overflow-hidden flex flex-col h-full">
      {/* Image */}
      {displayData.image ? (
        <div className="relative w-full h-32 sm:h-40 bg-gray-100 overflow-hidden">
          <img
            src={displayData.image}
            alt={displayData.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
            loading="lazy"
          />
          <div className="absolute top-2 right-2">
            <iOSBadge variant={displayData.status === 'active' ? 'green' : 'gray'} className="text-xs">
              {displayData.status}
            </iOSBadge>
          </div>
        </div>
      ) : (
        <div className="w-full h-32 sm:h-40 bg-gray-100 flex items-center justify-center">
          <Home className="w-8 h-8 text-gray-400" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        {/* Title */}
        <h4 className="font-medium text-sm mb-1 line-clamp-2 text-gray-900">
          {displayData.title}
        </h4>

        {/* Reference */}
        <p className="text-xs mb-2 text-gray-500">
          Ref: {displayData.reference}
        </p>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-gray-600">
            {displayData.location}
          </span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-gray-200">
          <div className="flex flex-col items-center">
            <Bed className="w-3.5 h-3.5 mb-1 text-gray-400" />
            <span className="text-xs font-medium text-gray-700">
              {displayData.bedrooms}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Bath className="w-3.5 h-3.5 mb-1 text-gray-400" />
            <span className="text-xs font-medium text-gray-700">
              {displayData.bathrooms}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Ruler className="w-3.5 h-3.5 mb-1 text-gray-400" />
            <span className="text-xs font-medium text-gray-700">
              {Math.round(displayData.area)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Home className="w-3.5 h-3.5 mb-1 text-gray-400" />
            <span className="text-xs font-medium capitalize text-gray-700">
              {displayData.type}
            </span>
          </div>
        </div>

        {/* Price */}
        <p className="text-sm font-semibold text-amber-600 mb-3">
          AED {displayData.price?.toLocaleString()}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-50 text-xs font-medium"
          >
            <FileText className={`w-3.5 h-3.5 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
            {isGeneratingPDF ? 'Generating...' : 'PDF'}
          </button>
          <button
            onClick={handleOpenPortal}
            disabled={!listing.pf_url}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Portal
          </button>
        </div>
      </div>
    </iOSCard>
  );
}