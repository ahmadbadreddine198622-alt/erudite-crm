import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, XCircle, Upload, ExternalLink, MapPin, Search, Building2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function PFPublishPanel({ landlordPropertyId, landlordProperty }) {
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // Load linked Property
  const { data: property } = useQuery({
    queryKey: ['pf-publish-property', landlordProperty?.property_id],
    queryFn: async () => {
      if (!landlordProperty?.property_id) return null;
      const res = await base44.entities.Property.filter({ id: landlordProperty.property_id });
      return res?.[0] || null;
    },
    enabled: !!landlordProperty?.property_id,
  });

  // Load existing PFListing (determine create vs update)
  const { data: existingPF, refetch: refetchPF } = useQuery({
    queryKey: ['pf-listing-by-lp', landlordPropertyId],
    queryFn: async () => {
      if (!landlordPropertyId) return null;
      const res = await base44.entities.PFListing.filter({ landlord_property_id: landlordPropertyId });
      return res?.[0] || null;
    },
    enabled: !!landlordPropertyId,
  });

  // Load agent
  const { data: landlord } = useQuery({
    queryKey: ['pf-publish-landlord', landlordProperty?.landlord_id],
    queryFn: async () => {
      if (!landlordProperty?.landlord_id) return null;
      const res = await base44.entities.Landlord.filter({ id: landlordProperty.landlord_id });
      return res?.[0] || null;
    },
    enabled: !!landlordProperty?.landlord_id,
  });

  const agentEmail = landlord?.assigned_agent_email || landlord?.listing_manager_email || property?.agent_email;

  const { data: agent } = useQuery({
    queryKey: ['pf-publish-agent', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return null;
      const res = await base44.entities.User.filter({ email: agentEmail });
      return res?.[0] || null;
    },
    enabled: !!agentEmail,
  });

  // ── Pre-flight checks ──
  const checks = buildChecks(property, agent, landlordProperty, existingPF);
  const allPass = checks.every(c => c.pass);
  const isUpdate = !!(existingPF?.pf_listing_id);

  // ── Location autocomplete ──
  const searchLocations = useCallback(async (query) => {
    if (!query.trim() || query.trim().length < 3) { setLocationResults([]); return; }
    setSearchingLocations(true);
    try {
      const res = await base44.functions.invoke('pfSearchLocations', {});
      // Actually call with search param — use fetch via the function
      const response = await fetch(`/api/functions/pfSearchLocations?search=${encodeURIComponent(query.trim())}`);
      // Fallback: invoke as a function with the URL approach
    } catch (_) {}
    // Use the function invoke approach with the URL
    try {
      const result = await base44.functions.invoke('pfSearchLocations', { search: query.trim() });
      const data = result.data || result;
      setLocationResults(data.locations || []);
    } catch (err) {
      // Try query string approach
      try {
        const res = await fetch(`/.proxy/functions/pfSearchLocations?search=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setLocationResults(data.locations || []);
      } catch (e2) {
        toast.error('Location search failed');
      }
    } finally {
      setSearchingLocations(false);
    }
  }, []);

  // Debounced location search
  useEffect(() => {
    if (locationSearch.trim().length < 3) { setLocationResults([]); return; }
    const timer = setTimeout(() => searchLocations(locationSearch), 400);
    return () => clearTimeout(timer);
  }, [locationSearch, searchLocations]);

  // ── Publish mutation ──
  const publishMutation = useMutation({
    mutationFn: async ({ locationId, locationName }) => {
      const res = await base44.functions.invoke('pfPublishListing', {
        landlordPropertyId,
        locationId,
        locationName,
      });
      return res.data || res;
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(data.message || 'Publish request sent');
        setPublishResult(data);
        refetchPF();
      } else {
        toast.error(data.error || 'Publish failed');
        setPublishResult({ error: data.error || 'Publish failed', missing: data.missing, detail: data.detail });
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Publish failed');
      setPublishResult({ error: err.message });
    },
    onSettled: () => setPublishing(false),
  });

  const handlePublish = () => {
    if (!allPass) return;
    const locationId = landlordProperty?.pf_location_id;
    setPublishing(true);
    setPublishResult(null);
    publishMutation.mutate({ locationId, locationName: landlordProperty?.pf_location_name });
  };

  const currentStatus = existingPF?.status || publishResult?.status;
  const isPublishing = currentStatus === 'publishing';

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
          <span className="text-sm font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>Property Finder Publish</span>
        </div>
        {isUpdate ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
            Update Existing
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
            New Listing
          </span>
        )}
      </div>

      <div className="p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Pre-flight checklist */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Pre-flight Checklist</p>
          <div className="space-y-1">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1">
                {check.pass ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span className={check.pass ? 'text-white/60' : 'text-rose-300'}>{check.label}</span>
                {!check.pass && check.detail && (
                  <span className="text-[10px] text-muted-foreground ml-auto">{check.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Location picker */}
        {!landlordProperty?.pf_location_id && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> PF Location (required)
            </p>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={e => setLocationSearch(e.target.value)}
                  placeholder="Search area e.g. Marina, Downtown..."
                  className="w-full h-8 pl-9 pr-3 rounded-md text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                />
                {searchingLocations && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin" />}
              </div>
              {locationResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md overflow-y-auto" style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.15)', maxHeight: '180px' }}>
                  {locationResults.map(loc => (
                    <button
                      key={loc.id}
                      onClick={async () => {
                        try {
                          await base44.entities.LandlordProperty.update(landlordPropertyId, {
                            pf_location_id: loc.id,
                            pf_location_name: loc.name,
                          });
                          setLocationResults([]);
                          setLocationSearch('');
                          toast.success('Location saved');
                        } catch (e) {
                          toast.error('Failed to save location');
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition border-b border-white/5 last:border-0"
                    >
                      <span className="text-white/85">{loc.name}</span>
                      {loc.type && <span className="text-[9px] text-muted-foreground ml-2">{loc.type}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {landlordProperty?.pf_location_id && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> {landlordProperty.pf_location_name || landlordProperty.pf_location_id}
              </div>
            )}
          </div>
        )}

        {landlordProperty?.pf_location_id && (
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span className="text-white/60">Location:</span>
            <span className="text-emerald-400">{landlordProperty.pf_location_name || landlordProperty.pf_location_id}</span>
          </div>
        )}

        {/* Publish status */}
        {isPublishing && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
            <span className="text-orange-300">Publishing… (confirming with Property Finder)</span>
          </div>
        )}

        {existingPF?.status === 'active' && existingPF?.pf_url && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300">Live on Property Finder</span>
            <a href={existingPF.pf_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-emerald-400 hover:underline flex items-center gap-1">
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Error */}
        {publishResult?.error && (
          <div className="px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)' }}>
            <div className="flex items-center gap-1.5 text-rose-300 mb-1">
              <AlertCircle className="w-3.5 h-3.5" /> {publishResult.error}
            </div>
            {publishResult.missing && (
              <p className="text-rose-400/80 ml-5">Missing: {publishResult.missing.join(', ')}</p>
            )}
            {publishResult.detail && (
              <pre className="text-[10px] text-rose-400/60 mt-1 ml-5 whitespace-pre-wrap">{JSON.stringify(publishResult.detail, null, 2).substring(0, 400)}</pre>
            )}
          </div>
        )}

        {/* Publish button — disabled, listing from CRM not yet enabled */}
        <button
          disabled
          className="w-full h-9 rounded-lg flex items-center justify-center gap-2 text-sm font-medium opacity-40 cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Upload className="w-4 h-4" /> {isUpdate ? 'Update on Property Finder' : 'Publish to Property Finder'}
        </button>

        <p className="text-[10px] text-muted-foreground text-center">
          Publishing from CRM is coming soon — listing is being prepared
        </p>
      </div>
    </div>
  );
}

function buildChecks(property, agent, landlordProperty, existingPF) {
  const images = Array.isArray(property?.images) ? property.images.filter(Boolean) : [];
  const permit = property?.trakheesi_permit_no || property?.permit_number;
  const price = property?.listing_type === 'rent' ? property?.rent_aed : property?.price_aed;
  const hasCoords = !!(property?.latitude && property?.longitude);

  return [
    { label: 'Trakheesi permit number', pass: !!permit },
    { label: 'Price', pass: !!price && !isNaN(Number(price)), detail: !price ? 'missing' : null },
    { label: 'Area (sqft)', pass: !!property?.area_sqft },
    { label: 'Purpose (sale/rent)', pass: !!property?.listing_type },
    { label: 'Coordinates (lat + lng)', pass: hasCoords },
    { label: 'Agent BRN', pass: !!agent?.brn, detail: !agent?.brn ? 'set in Agent BRN admin' : null },
    { label: 'PF Location selected', pass: !!landlordProperty?.pf_location_id },
    { label: 'At least one image', pass: images.length > 0 },
    {
      label: 'Listing title',
      pass: !!(landlordProperty?.listing_title || property?.title),
      detail: !landlordProperty?.listing_title ? 'set in Listing Copy Manager' : null,
    },
  ];
}