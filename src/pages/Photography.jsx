import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, Home, Key, AlertCircle, CheckCircle2, Film, Disc, FileText, Loader2, Zap, Droplet, Bed, Pill, Sparkles, Package } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from 'sonner';

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

const MEDIA_CONFIG = [
  { label: '360° Tour', key: 'has_360_tour', icon: Disc },
  { label: 'Drone Footage', key: 'has_drone_footage', icon: Film },
  { label: 'Video Walkthrough', key: 'has_video_walkthrough', icon: Camera },
  { label: 'Floor Plan', key: 'has_floor_plan', icon: FileText },
];

export default function Photography() {
  const [selectedLandlord, setSelectedLandlord] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: feed = [], isLoading, refetch } = useQuery({
    queryKey: ['photography-feed'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPhotographyFeed', {});
      return res.data?.feed || [];
    },
  });

  const handleToggleMedia = async (item, flag) => {
    if (!item.landlord_property_id) {
      toast.error('No property record found');
      return;
    }
    if (savingId) return; // prevent concurrent saves
    
    setSavingId(item.landlord_property_id);
    try {
      const currentValue = item[flag] || false;
      const res = await base44.functions.invoke('updatePhotographyStatus', {
        landlord_property_id: item.landlord_property_id,
        updates: { [flag]: !currentValue },
      });
      if (res.data?.ok) {
        await refetch();
        toast.success('Media status updated');
      }
    } catch (err) {
      toast.error('Failed to update: ' + (err.message || 'unknown error'));
    } finally {
      setSavingId(null);
    }
  };

  const getMediaItems = (item) => {
    return MEDIA_CONFIG.map((config) => ({
      ...config,
      isDone: item[config.key] === true,
    }));
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
                  {feed.filter(l => l.photography_status === 'none').length}
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
                  {feed.filter(l => l.photography_status === 'phone_quality').length}
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
                  {feed.filter(l => l.photography_status === 'scheduled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards Grid */}
      {feed.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No units currently need photography</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feed.map((item) => {
            const statusColor = PHOTOGRAPHY_STATUS_COLORS[item.photography_status] || PHOTOGRAPHY_STATUS_COLORS.none;
            const statusLabel = PHOTOGRAPHY_STATUS_LABELS[item.photography_status] || item.photography_status;

            return (
              <Card 
                key={item.landlord_id} 
                className="glass-card cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setSelectedLandlord(selectedLandlord?.landlord_id === item.landlord_id ? null : item)}
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
                        {item.project || 'Unknown Project'}
                      </h3>
                      {item.unit_reference && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Home className="w-3 h-3" />
                          Unit {item.unit_reference}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Owner Name */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">
                      {item.owner_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-[10px]">Owner</p>
                      <p className="text-xs font-medium text-foreground truncate">
                        {item.owner_name || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Media Items - Interactive Pills */}
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[10px] text-muted-foreground mb-1.5">Media Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getMediaItems(item).map((media) => {
                        const Icon = media.icon;
                        const isSaving = savingId === item.landlord_property_id;
                        return (
                          <button
                            key={media.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMedia(item, media.key);
                            }}
                            disabled={isSaving}
                            className={
                              media.isDone
                                ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50'
                                : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50'
                            }
                            title={media.isDone ? 'Click to mark as not done' : 'Click to mark as done'}
                          >
                            {isSaving ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : media.isDone ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <Icon className="w-2.5 h-2.5" />
                            )}
                            {media.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pre-shoot Details */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs mb-1">
                      <Camera className="w-3 h-3 text-accent" />
                      <span className="font-semibold text-accent" style={{ color: 'hsl(38 92% 50%)' }}>Pre-shoot Details</span>
                    </div>

                    {/* Access Block */}
                    {(item.keys_location || item.key_access_instructions) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Key className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="font-medium text-foreground">Access</span>
                        </div>
                        {item.keys_location && (
                          <p className="text-[10px] text-muted-foreground pl-5">
                            Keys: <span className="text-foreground">{item.keys_location.replace(/_/g, ' ')}</span>
                          </p>
                        )}
                        {item.key_access_instructions && (
                          <p className="text-[10px] text-muted-foreground pl-5 italic">
                            {item.key_access_instructions}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Condition Block */}
                    {(item.unit_condition || item.furnishing) && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Home className="w-3 h-3 text-blue-400 shrink-0" />
                          <span className="font-medium text-foreground">Condition</span>
                        </div>
                        {item.unit_condition && (
                          <p className="text-[10px] text-muted-foreground pl-5">
                            Unit: <span className="text-foreground">{item.unit_condition.replace(/_/g, ' ')}</span>
                          </p>
                        )}
                        {item.furnishing && (
                          <p className="text-[10px] text-muted-foreground pl-5">
                            Furnishing: <span className="text-foreground">{item.furnishing.replace(/_/g, ' ')}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Readiness Row */}
                    {(item.has_bedsheets !== undefined || item.has_pillows !== undefined || item.electricity_on !== undefined || item.water_on !== undefined) && (
                      <div className="pt-1">
                        <div className="flex items-center gap-1.5 text-xs mb-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="font-medium text-foreground">Readiness</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-5">
                          {/* Bedsheets */}
                          {item.has_bedsheets !== undefined && (
                            <div className="flex items-center gap-1 text-[10px]">
                              {item.has_bedsheets ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                              )}
                              <span className={item.has_bedsheets ? 'text-emerald-400' : 'text-red-400'}>
                                Bedsheets
                              </span>
                            </div>
                          )}
                          {/* Pillows */}
                          {item.has_pillows !== undefined && (
                            <div className="flex items-center gap-1 text-[10px]">
                              {item.has_pillows ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                              )}
                              <span className={item.has_pillows ? 'text-emerald-400' : 'text-red-400'}>
                                Pillows
                              </span>
                            </div>
                          )}
                          {/* Electricity */}
                          {item.electricity_on !== undefined && (
                            <div className="flex items-center gap-1 text-[10px]">
                              {item.electricity_on ? (
                                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Zap className="w-2.5 h-2.5 text-red-400 fill-red-400" />
                              )}
                              <span className={item.electricity_on ? 'text-emerald-400' : 'text-red-400 font-semibold'}>
                                Electricity
                              </span>
                            </div>
                          )}
                          {/* Water */}
                          {item.water_on !== undefined && (
                            <div className="flex items-center gap-1 text-[10px]">
                              {item.water_on ? (
                                <Droplet className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Droplet className="w-2.5 h-2.5 text-red-400 fill-red-400" />
                              )}
                              <span className={item.water_on ? 'text-emerald-400' : 'text-red-400 font-semibold'}>
                                Water
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Staging Block */}
                    {(item.staging_needed || item.what_to_bring) && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Package className="w-3 h-3 text-purple-400 shrink-0" />
                          <span className="font-medium text-foreground">Staging & Equipment</span>
                        </div>
                        {item.staging_needed && (
                          <p className="text-[10px] text-muted-foreground pl-5">
                            Staging: <span className="text-foreground">{item.staging_needed}</span>
                          </p>
                        )}
                        {item.what_to_bring && (
                          <p className="text-[10px] text-muted-foreground pl-5">
                            Bring: <span className="text-foreground">{item.what_to_bring}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>


                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}