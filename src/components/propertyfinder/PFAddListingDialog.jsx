import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Upload, Loader2, Check, MapPin, Building2, AlertCircle, Pencil, Search, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WritingField from '@/components/shared/WritingField';

const GOLD = '#c9a85c';

// ── PF API full field constants ───────────────────────────────────────────
const PROPERTY_TYPES = [
  'apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'duplex',
  'land', 'office', 'retail', 'warehouse', 'hotel_apartment',
];

const ALL_AMENITIES = [
  'balcony', 'shared-pool', 'private-pool', 'built-in-wardrobes', 'central-ac',
  'covered-parking', 'gym', 'jacuzzi', 'maids-room', 'private-garden', 'security',
  'concierge', 'view-of-water', 'view-of-landmark', 'pets-allowed', 'study',
  'walk-in-closet', 'storage-room', 'laundry-room', 'basement-parking',
  'shared-gym', 'shared-spa', 'kitchen-appliances', 'lobby-in-building',
  'childrens-play-area', 'barbecue-area', 'tennis-court', 'squash-court',
  'basketball-court', 'steam-room', 'sauna', 'maid-service', 'networked',
  'satellite-cable-tv', 'intercom', 'double-glazed-windows', 'day-care-centre',
  'electricity-backup', 'first-aid-medical-centre', 'atm-facility', 'bank-facility',
  'shopping-centre', 'broadband-internet', 'communal-gardens', 'mosque',
];

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.9)',
  caretColor: GOLD,
};

const FIELD = ({ label, required, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>
      {label}{required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}
    </label>
    {children}
  </div>
);

const GlassInput = ({ value, onChange, placeholder, type = 'text', disabled }) => (
  <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
    style={{ ...INPUT_STYLE, width: '100%', height: 36, padding: '0 12px', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: disabled ? 0.5 : 1 }} />
);

const GlassSelect = ({ value, onChange, children, disabled }) => (
  <select value={value ?? ''} onChange={onChange} disabled={disabled}
    style={{ ...INPUT_STYLE, width: '100%', height: 36, padding: '0 12px', borderRadius: 10, fontSize: 13, outline: 'none', appearance: 'none', boxSizing: 'border-box', cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}>
    {children}
  </select>
);

const SectionTitle = ({ children }) => (
  <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(201,168,92,0.7)', marginBottom: 10, marginTop: 2, borderBottom: '1px solid rgba(201,168,92,0.15)', paddingBottom: 6 }}>
    {children}
  </p>
);

const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '7px 12px', background: checked ? 'rgba(201,168,92,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? 'rgba(201,168,92,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, userSelect: 'none' }}>
    <div style={{ width: 34, height: 18, borderRadius: 9, background: checked ? GOLD : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </div>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
    <span style={{ fontSize: 12, color: checked ? GOLD : 'rgba(255,255,255,0.55)' }}>{label}</span>
  </label>
);

// Location search component
function LocationPicker({ value, locationName, onChange }) {
  const [query, setQuery] = useState(locationName || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(locationName || '');

  useEffect(() => {
    if (locationName) { setQuery(locationName); setSelected(locationName); }
  }, [locationName]);

  const search = async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await base44.functions.invoke('pfSearchLocations', { query: q });
      setResults(res?.data?.locations || res?.data?.results || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <MapPin style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <input value={query} onChange={e => { setQuery(e.target.value); setSelected(''); search(e.target.value); }}
          placeholder="Search area, community, tower…"
          style={{ ...INPUT_STYLE, width: '100%', height: 36, paddingLeft: 30, paddingRight: searching ? 36 : 12, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        {searching && <Loader2 style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: GOLD, animation: 'spin 1s linear infinite' }} />}
      </div>
      {selected && value && (
        <p style={{ fontSize: 10, color: GOLD, marginTop: 4 }}>✓ Location ID: {value} — {selected}</p>
      )}
      {results.length > 0 && !selected && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#0b1525', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {results.map(r => (
            <button key={r.id} onClick={() => { onChange(r.id, r.name || r.path || String(r.id)); setSelected(r.name || r.path || String(r.id)); setQuery(r.name || r.path || String(r.id)); setResults([]); }}
              style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: GOLD, fontWeight: 600 }}>{r.name || r.path}</span>
              {r.breadcrumb && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6, fontSize: 10 }}>{r.breadcrumb}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  // Identity
  title: '', title_ar: '',
  listing_type: 'sale', property_type: 'apartment', category: 'residential',
  // Price
  price: '', price_on_request: false, downpayment: '', number_of_cheques: '', rent_frequency: 'yearly',
  // Size & specs
  bedrooms: '', bathrooms: '', area_sqft: '', plot_size_sqft: '',
  floor_number: '', number_of_floors: '', parking_slots: '',
  furnishing: 'unfurnished', completion_status: 'ready', project_status: 'completed', completion_date: '',
  // Location
  pf_location_id: null, location_name: '',
  community: '', building_name: '', unit_number: '', address: '', latitude: '', longitude: '',
  uae_emirate: 'dubai',
  // Developer & compliance
  developer: '', permit_number: '', issuing_license_number: '',
  // Agent
  agent_email: '', agent_name: '',
  // Descriptions
  description: '', description_ar: '',
  // Media & features
  amenities: [], tags: '', images: [],
  // Portal flags
  featured: false, verified: false,
};

export default function PFAddListingDialog({ onClose, onCreated, editListing = null }) {
  const isEdit = !!editListing;
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingLive, setLoadingLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  // On edit: load live data from PF API
  useEffect(() => {
    if (!isEdit) return;
    setLoadingLive(true);
    base44.functions.invoke('pfGetFullListing', { crmId: editListing.id, pfListingId: editListing.pf_listing_id })
      .then(res => {
        const l = res?.data?.listing;
        if (!l) { toast.error('Could not load live data from Property Finder'); setFormFromCRM(editListing); return; }
        setForm({
          title: l.title || '',
          title_ar: l.title_ar || '',
          listing_type: l.listing_type || 'sale',
          property_type: l.property_type || 'apartment',
          category: l.category || 'residential',
          price: l.price != null ? String(l.price) : '',
          price_on_request: l.price_on_request || false,
          downpayment: l.downpayment ? String(l.downpayment) : '',
          number_of_cheques: l.number_of_cheques ? String(l.number_of_cheques) : '',
          rent_frequency: l.rent_frequency || 'yearly',
          area_sqft: l.area_sqft ? String(l.area_sqft) : '',
          plot_size_sqft: l.plot_size_sqft ? String(l.plot_size_sqft) : '',
          bedrooms: l.bedrooms != null ? String(l.bedrooms) : '',
          bathrooms: l.bathrooms != null ? String(l.bathrooms) : '',
          floor_number: l.floor_number || '',
          number_of_floors: l.number_of_floors ? String(l.number_of_floors) : '',
          parking_slots: l.parking_slots ? String(l.parking_slots) : '',
          furnishing: l.furnishing || 'unfurnished',
          completion_status: l.project_status === 'off_plan' ? 'off_plan' : 'ready',
          project_status: l.project_status || 'completed',
          completion_date: '',
          pf_location_id: l.pf_location_id || null,
          location_name: l.community || l.location || '',
          community: l.community || '',
          building_name: l.building_name || '',
          unit_number: l.unit_number || '',
          address: l.address || '',
          latitude: l.latitude ? String(l.latitude) : '',
          longitude: l.longitude ? String(l.longitude) : '',
          uae_emirate: 'dubai',
          developer: l.developer || '',
          permit_number: l.permit_number || '',
          issuing_license_number: l.issuing_license_number || '',
          agent_email: l.agent_email || editListing.agent_email || '',
          agent_name: l.agent_name || editListing.agent_name || '',
          description: l.description || '',
          description_ar: l.description_ar || '',
          amenities: l.amenities || [],
          tags: editListing.tags ? editListing.tags.join(', ') : '',
          images: l.images || [],
          featured: editListing.featured || false,
          verified: editListing.verified || false,
          // Store the live internal ID for PATCH
          _pf_internal_id: l.pf_internal_id,
        });
      })
      .catch(() => { toast.error('Could not reach PF API — loaded from CRM cache'); setFormFromCRM(editListing); })
      .finally(() => setLoadingLive(false));
  }, []);

  const setFormFromCRM = (listing) => {
    setForm({
      title: listing.title || '',
      title_ar: listing.title_ar || '',
      listing_type: listing.listing_type || 'sale',
      property_type: listing.property_type || 'apartment',
      category: listing.category || 'residential',
      price: listing.price != null ? String(listing.price) : '',
      price_on_request: listing.price_on_request || false,
      downpayment: listing.downpayment ? String(listing.downpayment) : '',
      number_of_cheques: listing.number_of_cheques ? String(listing.number_of_cheques) : '',
      rent_frequency: listing.rent_frequency || 'yearly',
      area_sqft: listing.area_sqft ? String(listing.area_sqft) : '',
      plot_size_sqft: listing.plot_size_sqft ? String(listing.plot_size_sqft) : '',
      bedrooms: listing.bedrooms != null ? String(listing.bedrooms) : '',
      bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : '',
      floor_number: listing.floor_number || '',
      number_of_floors: listing.number_of_floors ? String(listing.number_of_floors) : '',
      parking_slots: listing.parking_slots ? String(listing.parking_slots) : '',
      furnishing: listing.furnishing || 'unfurnished',
      completion_status: listing.completion_status || 'ready',
      project_status: listing.project_status || 'completed',
      completion_date: listing.completion_date || '',
      pf_location_id: listing.pf_location_id || null,
      location_name: listing.community || listing.location || '',
      community: listing.community || listing.location || '',
      building_name: listing.building_name || '',
      unit_number: listing.unit_number || '',
      address: listing.address || '',
      latitude: listing.latitude ? String(listing.latitude) : '',
      longitude: listing.longitude ? String(listing.longitude) : '',
      uae_emirate: 'dubai',
      developer: listing.developer || '',
      permit_number: listing.permit_number || '',
      issuing_license_number: listing.issuing_license_number || '',
      agent_email: listing.agent_email || '',
      agent_name: listing.agent_name || '',
      description: listing.description || '',
      description_ar: listing.description_ar || '',
      amenities: listing.amenities || [],
      tags: listing.tags ? listing.tags.join(', ') : '',
      images: listing.images || [],
      featured: listing.featured || false,
      verified: listing.verified || false,
    });
  };

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const setBool = field => val => setForm(f => ({ ...f, [field]: val }));
  const toggleAmenity = a => setForm(f => ({
    ...f,
    amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
  }));

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    setForm(f => ({ ...f, images: [...f.images, url] }));
    setImageUrl('');
  };

  const removeImage = idx => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const handleFileUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res.file_url) { setForm(f => ({ ...f, images: [...f.images, res.file_url] })); toast.success('Image uploaded'); }
    } catch (err) { toast.error('Upload failed: ' + err.message); }
  };

  const buildPFPayload = () => {
    const isSale = form.listing_type === 'sale';
    const payload = {
      title: { en: form.title.trim(), ...(form.title_ar.trim() ? { ar: form.title_ar.trim() } : {}) },
      type: form.property_type,
      category: form.category,
      price: {
        type: form.listing_type,
        onRequest: form.price_on_request,
        amounts: isSale
          ? { sale: Number(form.price) }
          : { rent: Number(form.price) },
        ...(isSale && form.downpayment ? { downpayment: Number(form.downpayment) } : {}),
        ...(isSale && form.number_of_cheques ? { numberOfCheques: Number(form.number_of_cheques) } : {}),
        ...(!isSale ? { rentFrequency: form.rent_frequency } : {}),
      },
      uaeEmirate: 'dubai',
      furnishingType: form.furnishing,
      projectStatus: form.project_status,
      ...(form.pf_location_id ? { locationId: form.pf_location_id } : {}),
      ...(form.bedrooms !== '' ? { bedrooms: Number(form.bedrooms) } : {}),
      ...(form.bathrooms !== '' ? { bathrooms: Number(form.bathrooms) } : {}),
      ...(form.area_sqft ? { size: Number(form.area_sqft) } : {}),
      ...(form.plot_size_sqft ? { plotSize: Number(form.plot_size_sqft) } : {}),
      ...(form.floor_number ? { floorNumber: form.floor_number } : {}),
      ...(form.number_of_floors ? { numberOfFloors: Number(form.number_of_floors) } : {}),
      ...(form.parking_slots ? { parkingSlots: Number(form.parking_slots) } : {}),
      ...(form.unit_number ? { unitNumber: form.unit_number } : {}),
      ...(form.community ? { community: form.community } : {}),
      ...(form.building_name ? { buildingName: form.building_name } : {}),
      ...(form.developer ? { developer: form.developer } : {}),
      ...(form.latitude && form.longitude ? { coordinates: { latitude: Number(form.latitude), longitude: Number(form.longitude) } } : {}),
      ...(form.permit_number ? { listingAdvertisementNumber: form.permit_number } : {}),
      ...(form.issuing_license_number ? { issuingClientLicenseNumber: form.issuing_license_number } : {}),
      ...(form.amenities.length ? { amenities: form.amenities } : {}),
      ...(form.images.length ? { media: { images: form.images.map(url => ({ original: { url } })) } } : {}),
      ...(form.agent_email ? { assignedTo: { email: form.agent_email, ...(form.agent_name ? { firstName: form.agent_name.split(' ')[0], lastName: form.agent_name.split(' ').slice(1).join(' ') } : {}) } } : {}),
    };
    if (form.description.trim()) payload.description = { en: form.description.trim(), ...(form.description_ar.trim() ? { ar: form.description_ar.trim() } : {}) };
    return payload;
  };

  const buildCRMPayload = () => ({
    title: form.title.trim(),
    title_ar: form.title_ar.trim() || undefined,
    description: form.description.trim() || undefined,
    description_ar: form.description_ar.trim() || undefined,
    property_type: form.property_type,
    category: form.category,
    listing_type: form.listing_type,
    price: form.price ? Number(form.price) : undefined,
    price_on_request: form.price_on_request,
    downpayment: form.downpayment ? Number(form.downpayment) : undefined,
    number_of_cheques: form.number_of_cheques ? Number(form.number_of_cheques) : undefined,
    rent_frequency: form.listing_type === 'rent' ? form.rent_frequency : undefined,
    area_sqft: form.area_sqft ? Number(form.area_sqft) : undefined,
    plot_size_sqft: form.plot_size_sqft ? Number(form.plot_size_sqft) : undefined,
    bedrooms: form.bedrooms !== '' ? Number(form.bedrooms) : undefined,
    bathrooms: form.bathrooms !== '' ? Number(form.bathrooms) : undefined,
    floor_number: form.floor_number || undefined,
    number_of_floors: form.number_of_floors ? Number(form.number_of_floors) : undefined,
    parking_slots: form.parking_slots ? Number(form.parking_slots) : undefined,
    furnishing: form.furnishing,
    completion_status: form.completion_status,
    project_status: form.project_status || undefined,
    completion_date: form.completion_date || undefined,
    pf_location_id: form.pf_location_id || undefined,
    community: form.community.trim() || undefined,
    location: form.community.trim() || form.location_name || undefined,
    building_name: form.building_name.trim() || undefined,
    unit_number: form.unit_number.trim() || undefined,
    address: form.address.trim() || undefined,
    latitude: form.latitude ? Number(form.latitude) : undefined,
    longitude: form.longitude ? Number(form.longitude) : undefined,
    developer: form.developer.trim() || undefined,
    permit_number: form.permit_number.trim() || undefined,
    issuing_license_number: form.issuing_license_number.trim() || undefined,
    agent_email: form.agent_email.trim() || undefined,
    agent_name: form.agent_name.trim() || undefined,
    amenities: form.amenities,
    tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    images: form.images,
    featured: form.featured,
    verified: form.verified,
    last_synced_at: new Date().toISOString(),
  });

  const handleSave = async (publishToPF = false) => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.price && !form.price_on_request) { toast.error('Price is required (or mark as On Request)'); return; }
    if (publishToPF && !form.pf_location_id) { toast.error('Location ID is required to publish — search and select an area'); return; }
    if (!form.pf_location_id && !form.community) { toast.error('Location is required'); return; }

    setSaving(true);
    try {
      const pfPayload = buildPFPayload();
      const crmPayload = buildCRMPayload();

      if (isEdit) {
        const pfInternalId = form._pf_internal_id || editListing.pf_internal_id;
        if (pfInternalId) {
          const res = await base44.functions.invoke('pfListingAction', {
            action: 'patch_fields',
            pfListingId: editListing.pf_listing_id,
            crmId: editListing.id,
            fieldUpdates: pfPayload,
          });
          if (!res.data?.ok) {
            toast.error(res.data?.error || 'PF API update failed');
            setSaving(false);
            return;
          }
        }
        await base44.entities.PFListing.update(editListing.id, crmPayload);
        toast.success('Listing updated on Property Finder and CRM');
      } else if (publishToPF) {
        // Create + publish directly on PF API (sandbox or production)
        const res = await base44.functions.invoke('publishNewPFListing', { pfPayload, crmPayload });
        const data = res?.data;
        if (!data?.ok) throw new Error(data?.error || 'Publish failed');
        toast.success(`✅ Listing published on Property Finder (${data.environment || 'active env'})! ID: ${data.pf_listing_id}`);
      } else {
        // Save as CRM draft only
        await base44.entities.PFListing.create({
          ...crmPayload,
          pf_listing_id: `draft-${Date.now()}`,
          status: 'draft',
          sync_status: 'pending',
          city: 'Dubai',
        });
        toast.success('Listing saved as draft in CRM');
      }

      setSaved(true);
      setTimeout(() => { onCreated?.(); onClose(); }, 800);
    } catch (err) {
      toast.error(err.message || 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  const isSale = form.listing_type === 'sale';

  return createPortal(
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#0b1525', border: `1px solid rgba(201,168,92,0.25)`, borderRadius: 18, display: 'flex', flexDirection: 'column', maxHeight: '96vh' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(201,168,92,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(201,168,92,0.15)', border: `1px solid rgba(201,168,92,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isEdit ? <Pencil style={{ width: 14, height: 14, color: GOLD }} /> : <Plus style={{ width: 14, height: 14, color: GOLD }} />}
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: '#fff', margin: 0 }}>{isEdit ? 'Edit Listing' : 'New Listing'}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                {isEdit ? `Editing live PF data · ${editListing.pf_listing_id || editListing.title}` : 'Full Property Finder field set · saves as draft'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {loadingLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: GOLD }}>
                <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                Loading live data…
              </div>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>

        {/* Required notice */}
        <div style={{ margin: '10px 20px 0', padding: '7px 12px', borderRadius: 10, background: 'rgba(201,168,92,0.07)', border: '1px solid rgba(201,168,92,0.18)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <AlertCircle style={{ width: 12, height: 12, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Fields marked <span style={{ color: '#f87171' }}>*</span> are required to publish on Property Finder.</span>
        </div>

        {/* Scrollable form */}
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── OFFERING & TYPE ── */}
          <div>
            <SectionTitle>Offering & Property Type</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <FIELD label="Offering Type" required>
                <GlassSelect value={form.listing_type} onChange={set('listing_type')}>
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </GlassSelect>
              </FIELD>
              <FIELD label="Property Type" required>
                <GlassSelect value={form.property_type} onChange={set('property_type')}>
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </GlassSelect>
              </FIELD>
              <FIELD label="Category">
                <GlassSelect value={form.category} onChange={set('category')}>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                </GlassSelect>
              </FIELD>
            </div>
          </div>

          {/* ── PRICE ── */}
          <div>
            <SectionTitle>Price & Payment</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <FIELD label="Price (AED)" required>
                <GlassInput value={form.price} onChange={set('price')} placeholder="2500000" type="number" disabled={form.price_on_request} />
              </FIELD>
              {isSale ? (
                <>
                  <FIELD label="Downpayment (AED)">
                    <GlassInput value={form.downpayment} onChange={set('downpayment')} placeholder="0" type="number" />
                  </FIELD>
                  <FIELD label="No. of Cheques">
                    <GlassInput value={form.number_of_cheques} onChange={set('number_of_cheques')} placeholder="0" type="number" />
                  </FIELD>
                </>
              ) : (
                <>
                  <FIELD label="Rent Frequency">
                    <GlassSelect value={form.rent_frequency} onChange={set('rent_frequency')}>
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </GlassSelect>
                  </FIELD>
                  <FIELD label="No. of Cheques">
                    <GlassInput value={form.number_of_cheques} onChange={set('number_of_cheques')} placeholder="0" type="number" />
                  </FIELD>
                </>
              )}
            </div>
            <Toggle label="Price on Request (hide price on portal)" checked={form.price_on_request} onChange={setBool('price_on_request')} />
          </div>

          {/* ── SIZE & SPECS ── */}
          <div>
            <SectionTitle>Size & Specifications</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <FIELD label="Bedrooms (0=Studio)" required>
                <GlassInput value={form.bedrooms} onChange={set('bedrooms')} placeholder="0" type="number" />
              </FIELD>
              <FIELD label="Bathrooms">
                <GlassInput value={form.bathrooms} onChange={set('bathrooms')} placeholder="2" type="number" />
              </FIELD>
              <FIELD label="BUA / Built-up Area (sqft)" required>
                <GlassInput value={form.area_sqft} onChange={set('area_sqft')} placeholder="1200" type="number" />
              </FIELD>
              <FIELD label="Plot Size (sqft)">
                <GlassInput value={form.plot_size_sqft} onChange={set('plot_size_sqft')} placeholder="0" type="number" />
              </FIELD>
              <FIELD label="Floor Number">
                <GlassInput value={form.floor_number} onChange={set('floor_number')} placeholder="e.g. 9 or G" />
              </FIELD>
              <FIELD label="Total Floors in Building">
                <GlassInput value={form.number_of_floors} onChange={set('number_of_floors')} placeholder="0" type="number" />
              </FIELD>
              <FIELD label="Parking Slots">
                <GlassInput value={form.parking_slots} onChange={set('parking_slots')} placeholder="1" type="number" />
              </FIELD>
              <FIELD label="Furnishing">
                <GlassSelect value={form.furnishing} onChange={set('furnishing')}>
                  <option value="furnished">Furnished</option>
                  <option value="semi_furnished">Semi Furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                </GlassSelect>
              </FIELD>
              <FIELD label="Project Status">
                <GlassSelect value={form.project_status} onChange={set('project_status')}>
                  <option value="completed">Completed (Ready)</option>
                  <option value="completed_primary">Completed Primary</option>
                  <option value="off_plan">Off Plan</option>
                </GlassSelect>
              </FIELD>
              {form.project_status === 'off_plan' && (
                <FIELD label="Completion Date">
                  <GlassInput value={form.completion_date} onChange={set('completion_date')} type="date" />
                </FIELD>
              )}
            </div>
          </div>

          {/* ── LOCATION ── */}
          <div>
            <SectionTitle>Location</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FIELD label="Area / Community / Tower" required>
                <LocationPicker
                  value={form.pf_location_id}
                  locationName={form.location_name}
                  onChange={(id, name) => setForm(f => ({ ...f, pf_location_id: id, location_name: name, community: name }))}
                />
              </FIELD>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FIELD label="Building / Tower Name">
                  <div style={{ position: 'relative' }}>
                    <Building2 style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                    <input value={form.building_name} onChange={set('building_name')} placeholder="e.g. Marina Gate 2"
                      style={{ ...INPUT_STYLE, width: '100%', height: 36, paddingLeft: 30, paddingRight: 12, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </FIELD>
                <FIELD label="Unit Number">
                  <GlassInput value={form.unit_number} onChange={set('unit_number')} placeholder="e.g. 2401" />
                </FIELD>
                <FIELD label="Full Address">
                  <GlassInput value={form.address} onChange={set('address')} placeholder="Street, area, Dubai" />
                </FIELD>
                <FIELD label="Developer">
                  <GlassInput value={form.developer} onChange={set('developer')} placeholder="e.g. Emaar, Damac" />
                </FIELD>
                <FIELD label="Latitude">
                  <GlassInput value={form.latitude} onChange={set('latitude')} placeholder="25.0760" type="number" />
                </FIELD>
                <FIELD label="Longitude">
                  <GlassInput value={form.longitude} onChange={set('longitude')} placeholder="55.1404" type="number" />
                </FIELD>
              </div>
            </div>
          </div>

          {/* ── COMPLIANCE & AGENT ── */}
          <div>
            <SectionTitle>Compliance & Agent</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FIELD label="Trakheesi / RERA Permit No." required>
                <GlassInput value={form.permit_number} onChange={set('permit_number')} placeholder="Permit number" />
              </FIELD>
              <FIELD label="Issuing Client License (BRN/DED)">
                <GlassInput value={form.issuing_license_number} onChange={set('issuing_license_number')} placeholder="e.g. 34625" />
              </FIELD>
              <FIELD label="Agent Email">
                <GlassInput value={form.agent_email} onChange={set('agent_email')} placeholder="agent@erudite-estate.com" />
              </FIELD>
              <FIELD label="Agent Name">
                <GlassInput value={form.agent_name} onChange={set('agent_name')} placeholder="Ahmad Badreddine" />
              </FIELD>
            </div>
          </div>

          {/* ── TITLE & DESCRIPTION (bilingual) ── */}
          <div>
            <SectionTitle>Title & Description</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FIELD label="Title (English)" required>
                <GlassInput value={form.title} onChange={set('title')} placeholder="e.g. Spacious 2BR | Marina View | Ready to Move" />
              </FIELD>
              <FIELD label="Title (Arabic)">
                <GlassInput value={form.title_ar} onChange={set('title_ar')} placeholder="العنوان بالعربية" />
              </FIELD>
              <FIELD label="Description (English)">
                <WritingField value={form.description} onChange={set('description')} rows={5}
                  placeholder="Full property description for the portal listing…"
                  style={{ ...INPUT_STYLE, padding: '10px 12px', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
              </FIELD>
              <FIELD label="Description (Arabic)">
                <WritingField value={form.description_ar} onChange={set('description_ar')} rows={3}
                  placeholder="الوصف بالعربية…"
                  dir="rtl"
                  style={{ ...INPUT_STYLE, padding: '10px 12px', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
              </FIELD>
            </div>
          </div>

          {/* ── PORTAL FLAGS ── */}
          <div>
            <SectionTitle>Portal Flags</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Toggle label="⭐ Featured Listing" checked={form.featured} onChange={setBool('featured')} />
              <Toggle label="✓ Verified Listing" checked={form.verified} onChange={setBool('verified')} />
            </div>
          </div>

          {/* ── AMENITIES ── */}
          <div>
            <SectionTitle>Amenities ({form.amenities.length} selected)</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_AMENITIES.map(a => {
                const active = form.amenities.includes(a);
                return (
                  <button key={a} onClick={() => toggleAmenity(a)}
                    style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500, border: `1px solid ${active ? GOLD : 'rgba(255,255,255,0.12)'}`, background: active ? 'rgba(201,168,92,0.15)' : 'rgba(255,255,255,0.04)', color: active ? GOLD : 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'all 0.12s', userSelect: 'none' }}>
                    {a.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── TAGS ── */}
          <div>
            <SectionTitle>Tags (comma-separated)</SectionTitle>
            <GlassInput value={form.tags} onChange={set('tags')} placeholder="e.g. sea view, high floor, corner unit" />
          </div>

          {/* ── PHOTOS ── */}
          <div>
            <SectionTitle>Photos ({form.images.length})</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {form.images.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: 80, height: 64, borderRadius: 8, overflow: 'hidden' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeImage(idx)}
                        style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addImageUrl()}
                  placeholder="Paste image URL and press Enter"
                  style={{ ...INPUT_STYLE, flex: 1, height: 34, padding: '0 12px', borderRadius: 10, fontSize: 12, outline: 'none' }} />
                <button onClick={addImageUrl}
                  style={{ padding: '0 14px', height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', fontSize: 12, cursor: 'pointer' }}>
                  Add
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 12 }}>
                <Upload style={{ width: 12, height: 12 }} /> Upload from device
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {!isEdit && (
            <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(201,168,92,0.07)', border: '1px solid rgba(201,168,92,0.15)', fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle style={{ width: 11, height: 11, color: GOLD, flexShrink: 0 }} />
              <span>"Publish to Property Finder" creates the listing live on the active environment (sandbox or production). "Save as Draft" stores it locally in the CRM only.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
            {!isEdit && (
              <button onClick={() => handleSave(false)} disabled={saving || saved || loadingLive}
                style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', fontSize: 12, cursor: 'pointer', opacity: (saving || saved) ? 0.6 : 1 }}>
                Save as Draft
              </button>
            )}
            <button onClick={() => handleSave(isEdit ? false : true)} disabled={saving || saved || loadingLive}
              style={{ flex: 2, height: 38, borderRadius: 10, border: `1px solid ${saved ? 'rgba(63,207,142,0.4)' : 'rgba(201,168,92,0.4)'}`, background: saved ? 'rgba(63,207,142,0.15)' : 'rgba(201,168,92,0.15)', color: saved ? '#3fcf8e' : GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (saving || saved || loadingLive) ? 0.75 : 1 }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : saved ? <Check style={{ width: 14, height: 14 }} /> : isEdit ? <Pencil style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />}
              {saving ? 'Publishing…' : saved ? 'Published!' : isEdit ? 'Save Changes to Property Finder' : '🚀 Publish to Property Finder'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}