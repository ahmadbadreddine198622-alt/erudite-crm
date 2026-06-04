import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, MapPin, Home, Layers, Ruler, Key, AlertCircle, CheckCircle2, Film, Disc, FileText } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const PHOTOGRAPHY_STATUS_COLORS = {
  none: 'bg-red-500/10 text-red-400 border-red-500/30',
  phone_quality: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  professional_done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const PHOTOGRAPHY_STATUS_LABELS = {
  none: 'Not Started',
  phone_quality: 'Phone Quality',
  professional_done: 'Professional Done',
  scheduled: 'Scheduled',
};

export default function Photography() {
  const [selectedLandlord, setSelectedLandlord] = useState(null);

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['photography-landlords'],
    queryFn: async () => {
      const allLandlords = await base44.entities.Landlord.list();
      return allLandlords.filter(l => 
        ['photos_videos', 'photographer_scheduling'].includes(l.stage)
      );
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['landlord-properties'],
    queryFn: () => base44.entities.LandlordProperty.list(),
  });

  const getPropertyForLandlord = (landlordId) => {
    return properties.find(p => p.landlord_id === landlordId);
  };

  const getMissingMedia = (property) => {
    if (!property) return [];
    const missing = [];
    if (!property.has_360_tour) missing.push('360° Tour');
    if (!property.has_drone_footage) missing.push('Drone Footage');
    if (!property.has_video_walkthrough) missing.push('Video Walkthrough');
    if (!property.has_floor_plan) missing.push('Floor Plan');
    return missing;
  };

  if (isLoading) {
    return (
      <div className="page-root flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading photography worklist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title text-2xl font-semibold mb-1">Photography Worklist</h1>
        <p className="page-subtitle">Units requiring photos, videos, and media capture</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Needs Photography</p>
                <p className="text-xl font-bold text-foreground">
                  {landlords.filter(l => l.photography_status === 'none').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Quality</p>
                <p className="text-xl font-bold text-foreground">
                  {landlords.filter(l => l.photography_status === 'phone_quality').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Film className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="text-xl font-bold text-foreground">
                  {landlords.filter(l => l.photography_status === 'scheduled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards Grid */}
      {landlords.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No units currently need photography</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {landlords.map((landlord) => {
            const property = getPropertyForLandlord(landlord.id);
            const missingMedia = getMissingMedia(property);
            const statusColor = PHOTOGRAPHY_STATUS_COLORS[landlord.photography_status] || PHOTOGRAPHY_STATUS_COLORS.none;
            const statusLabel = PHOTOGRAPHY_STATUS_LABELS[landlord.photography_status] || landlord.photography_status;

            return (
              <Card 
                key={landlord.id} 
                className="glass-card cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setSelectedLandlord(selectedLandlord?.id === landlord.id ? null : landlord)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={statusColor}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-accent truncate" style={{ color: 'hsl(38 92% 55%)' }}>
                        {landlord.project_name || 'Unknown Project'}
                      </h3>
                      {landlord.unit_reference && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Home className="w-3 h-3" />
                          Unit {landlord.unit_reference}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Owner Name */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">
                      {landlord.full_name_en?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-[10px]">Owner</p>
                      <p className="text-xs font-medium text-foreground truncate">
                        {landlord.full_name_en || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Property Details */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    {property?.bedrooms && (
                      <div className="text-xs">
                        <p className="text-muted-foreground text-[10px]">Bedrooms</p>
                        <p className="font-medium">{property.bedrooms}</p>
                      </div>
                    )}
                    {property?.area_sqft && (
                      <div className="text-xs">
                        <p className="text-muted-foreground text-[10px]">Size</p>
                        <p className="font-medium">{property.area_sqft.toLocaleString()} sqft</p>
                      </div>
                    )}
                    {property?.floor && (
                      <div className="text-xs">
                        <p className="text-muted-foreground text-[10px]">Floor</p>
                        <p className="font-medium">{property.floor}</p>
                      </div>
                    )}
                  </div>

                  {/* Missing Media */}
                  {missingMedia.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] text-muted-foreground mb-1.5">Media Needed</p>
                      <div className="flex flex-wrap gap-1">
                        {missingMedia.map((item) => (
                          <Badge 
                            key={item} 
                            variant="outline" 
                            className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border-red-500/30"
                          >
                            {item === '360° Tour' && <Disc className="w-2.5 h-2.5 mr-0.5" />}
                            {item === 'Drone Footage' && <Camera className="w-2.5 h-2.5 mr-0.5" />}
                            {item === 'Video Walkthrough' && <Film className="w-2.5 h-2.5 mr-0.5" />}
                            {item === 'Floor Plan' && <FileText className="w-2.5 h-2.5 mr-0.5" />}
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Access/Keys Info */}
                  {(property?.keys_location || property?.key_access_instructions) && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5 text-xs mb-1">
                        <Key className="w-3 h-3 text-amber-400" />
                        <span className="font-medium text-amber-400">Access Information</span>
                      </div>
                      {property.keys_location && (
                        <p className="text-[10px] text-muted-foreground">
                          Keys: {property.keys_location.replace(/_/g, ' ')}
                        </p>
                      )}
                      {property.key_access_instructions && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {property.key_access_instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* No missing media - all done */}
                  {missingMedia.length === 0 && property && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">All media captured</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}