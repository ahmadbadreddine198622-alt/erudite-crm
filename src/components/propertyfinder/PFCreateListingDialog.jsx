import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, X, Image as ImageIcon } from 'lucide-react';

const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'studio', 'office', 'shop', 'warehouse', 'land', 'building', 'compound', 'factory', 'hotel_apartment', 'bulk_units'];
const CATEGORIES = ['residential', 'commercial'];
const OFFERING_TYPES = ['sale', 'rent'];
const EMIRATES = ['dubai', 'abu_dhabi', 'sharjah', 'ajman', 'ras_al_khaimah', 'fujairah', 'umm_al_quwain'];
const FURNISHING = ['furnished', 'unfurnished', 'semi_furnished'];
const COMPLETION = ['ready', 'off_plan'];

const ALL_AMENITIES = [
  'balcony', 'private_garden', 'private_pool', 'shared_pool', 'private_gym', 'shared_gym',
  'security', 'concierge', 'central_ac', 'built_in_wardrobes', 'maid_room', 'study',
  'covered_parking', 'public_parking', 'pets_allowed', 'children_play_area',
  'barbecue_area', 'jacuzzi', 'sauna', 'steam_room', 'tennis_court', 'squash_court',
  'basketball_court', 'walking_trails', 'cycling_tracks', 'beach_access', 'waterfront',
  'view_of_water', 'view_of_landmark', 'near_metro', 'public_transport', 'shopping_centre'
];

const initialForm = {
  title_en: '', title_ar: '',
  description_en: '', description_ar: '',
  reference: '',
  type: 'apartment',
  category: 'residential',
  offeringType: 'sale',
  price: '',
  bedrooms: '',
  bathrooms: '',
  size: '',
  floorNumber: '',
  parkingSlots: '',
  furnishingType: 'unfurnished',
  completionStatus: 'ready',
  uaeEmirate: 'dubai',
  community: '',
  subCommunity: '',
  buildingName: '',
  developerName: '',
  agentEmail: '',
  agentFirstName: '',
  agentLastName: '',
  agentPhone: '',
  amenities: [],
  imageUrls: [''],
};

function SelectField({ label, value, onChange, options, required }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map(o => (
          <option key={o} value={o}>{o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
        ))}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, required, type = 'text' }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function PFCreateListingDialog({ open, onClose, onSuccess, editListing }) {
  const isEdit = !!editListing;

  function initForm() {
    if (!editListing) return initialForm;
    const l = editListing;
    const titleEn = (l.title && typeof l.title === 'object') ? (l.title.en || '') : (l.title || '');
    const titleAr = (l.title && typeof l.title === 'object') ? (l.title.ar || '') : '';
    const descEn = (l.description && typeof l.description === 'object') ? (l.description.en || '') : (l.description || '');
    const descAr = (l.description && typeof l.description === 'object') ? (l.description.ar || '') : '';
    const price = (() => {
      if (!l.price) return '';
      if (typeof l.price === 'number') return String(l.price);
      const a = l.price.amounts || {};
      return String(a.sale || a.rent || a.monthly || '');
    })();
    const offering = (() => {
      if (!l.price) return 'sale';
      if (typeof l.price === 'object') return l.price.type || 'sale';
      return 'sale';
    })();
    const imgs = (() => {
      if (!l.media) return [''];
      const imgs2 = l.media.images || (Array.isArray(l.media) ? l.media : []);
      const urls = imgs2.map(f => (f.original && f.original.url) || (f.watermarked && f.watermarked.url) || f.url).filter(Boolean);
      return urls.length > 0 ? urls : [''];
    })();
    const amenityNames = (l.amenities || []).map(a => typeof a === 'string' ? a : (a.name || a.key || ''));
    const dev = l.developer ? (typeof l.developer === 'string' ? l.developer : l.developer.name || '') : '';
    const agent = l.assignedTo ? (typeof l.assignedTo === 'string' ? {} : l.assignedTo) : {};
    return {
      title_en: titleEn, title_ar: titleAr,
      description_en: descEn, description_ar: descAr,
      reference: l.reference || '',
      type: l.type || l.category || 'apartment',
      category: l.category || 'residential',
      offeringType: offering,
      price: price,
      bedrooms: l.bedrooms !== undefined ? String(l.bedrooms) : '',
      bathrooms: l.bathrooms !== undefined ? String(l.bathrooms) : '',
      size: l.size ? String(l.size) : '',
      floorNumber: l.floorNumber ? String(l.floorNumber) : '',
      parkingSlots: l.parkingSlots !== undefined ? String(l.parkingSlots) : '',
      furnishingType: l.furnishingType || 'unfurnished',
      completionStatus: l.completionStatus || 'ready',
      uaeEmirate: l.uaeEmirate || 'dubai',
      community: l.community || '',
      subCommunity: l.subCommunity || '',
      buildingName: l.buildingName || l.tower || '',
      developerName: dev,
      agentEmail: agent.email || '',
      agentFirstName: agent.firstName || '',
      agentLastName: agent.lastName || '',
      agentPhone: agent.phone || '',
      amenities: amenityNames,
      imageUrls: imgs,
    };
  }

  const [form, setForm] = useState(initForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Re-initialize form whenever dialog opens or editListing changes
  useEffect(() => {
    if (open) {
      setForm(initForm());
      setError(null);
    }
  }, [open, editListing]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleAmenity(a) {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a],
    }));
  }

  function buildPayload() {
    const payload = {
      title: { en: form.title_en.trim(), ...(form.title_ar.trim() ? { ar: form.title_ar.trim() } : {}) },
      type: form.type,
      category: form.category,
      price: {
        type: form.offeringType,
        amounts: form.offeringType === 'sale'
          ? { sale: Number(form.price) }
          : { rent: Number(form.price) },
      },
      uaeEmirate: form.uaeEmirate,
      furnishingType: form.furnishingType,
      completionStatus: form.completionStatus,
    };
    // Optional fields — only include if non-empty
    if (form.reference.trim()) payload.reference = form.reference.trim();
    if (form.description_en.trim()) {
      payload.description = { en: form.description_en.trim(), ...(form.description_ar.trim() ? { ar: form.description_ar.trim() } : {}) };
    }
    if (form.bedrooms !== '') payload.bedrooms = Number(form.bedrooms);
    if (form.bathrooms !== '') payload.bathrooms = Number(form.bathrooms);
    if (form.size !== '') payload.size = Number(form.size);
    if (form.floorNumber !== '') payload.floorNumber = Number(form.floorNumber);
    if (form.parkingSlots !== '') payload.parkingSlots = Number(form.parkingSlots);
    if (form.community) payload.community = form.community;
    if (form.subCommunity) payload.subCommunity = form.subCommunity;
    if (form.buildingName) payload.buildingName = form.buildingName;
    if (form.developerName) payload.developer = { name: form.developerName };
    const validImages = form.imageUrls.filter(u => u.trim());
    if (validImages.length > 0) {
      payload.media = { images: validImages.map(url => ({ original: { url } })) };
    }
    if (form.amenities.length > 0) payload.amenities = form.amenities;
    if (form.agentEmail || form.agentFirstName) {
      payload.assignedTo = {
        ...(form.agentEmail ? { email: form.agentEmail } : {}),
        ...(form.agentFirstName ? { firstName: form.agentFirstName } : {}),
        ...(form.agentLastName ? { lastName: form.agentLastName } : {}),
        ...(form.agentPhone ? { phone: form.agentPhone } : {}),
      };
    }
    return payload;
  }

  async function handleSubmit() {
    if (!form.title_en.trim()) { setError('Title (English) is required'); return; }
    if (!form.price || isNaN(Number(form.price))) { setError('A valid price is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = buildPayload();
      const res = await base44.functions.invoke('createPFListing', isEdit
        ? { action: 'update', listingId: editListing.id || editListing.reference, listing: payload }
        : { listing: payload }
      );
      if (res.data && res.data.ok) {
        onSuccess && onSuccess(res.data.listing);
        onClose();
      } else {
        setError(res.data.error || 'Failed to save listing');
      }
    } catch (err) {
      setError(err.message || 'Failed to save listing');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Listing' : 'Create New Listing on Property Finder'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-2">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
          </TabsList>

          {/* ── BASIC ── */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <TextField label="Title (English)" value={form.title_en} onChange={v => set('title_en', v)} placeholder="Stunning 2BR Apartment in Downtown Dubai" required />
            <TextField label="Title (Arabic)" value={form.title_ar} onChange={v => set('title_ar', v)} placeholder="شقة 2 غرف نوم رائعة في وسط دبي" />
            <div className="space-y-1.5">
              <Label>Description (English)<span className="text-red-500 ml-1">*</span></Label>
              <Textarea value={form.description_en} onChange={e => set('description_en', e.target.value)} placeholder="Describe the property..." rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (Arabic)</Label>
              <Textarea value={form.description_ar} onChange={e => set('description_ar', e.target.value)} placeholder="وصف العقار..." rows={3} dir="rtl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Reference / ID" value={form.reference} onChange={v => set('reference', v)} placeholder="EE-2024-001" />
              <SelectField label="Offering Type" value={form.offeringType} onChange={v => set('offeringType', v)} options={OFFERING_TYPES} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Property Type" value={form.type} onChange={v => set('type', v)} options={PROPERTY_TYPES} required />
              <SelectField label="Category" value={form.category} onChange={v => set('category', v)} options={CATEGORIES} />
            </div>
            <TextField label={`Price (AED) — ${form.offeringType === 'rent' ? 'Annual Rent' : 'Sale Price'}`} value={form.price} onChange={v => set('price', v)} placeholder="1500000" type="number" required />
          </TabsContent>

          {/* ── DETAILS ── */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Bedrooms" value={form.bedrooms} onChange={v => set('bedrooms', v)} placeholder="2" type="number" />
              <TextField label="Bathrooms" value={form.bathrooms} onChange={v => set('bathrooms', v)} placeholder="3" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Size (sq ft)" value={form.size} onChange={v => set('size', v)} placeholder="1200" type="number" />
              <TextField label="Floor Number" value={form.floorNumber} onChange={v => set('floorNumber', v)} placeholder="5" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Parking Slots" value={form.parkingSlots} onChange={v => set('parkingSlots', v)} placeholder="1" type="number" />
              <SelectField label="Furnishing" value={form.furnishingType} onChange={v => set('furnishingType', v)} options={FURNISHING} />
            </div>
            <SelectField label="Completion Status" value={form.completionStatus} onChange={v => set('completionStatus', v)} options={COMPLETION} />
          </TabsContent>

          {/* ── LOCATION ── */}
          <TabsContent value="location" className="space-y-4 mt-4">
            <SelectField label="UAE Emirate" value={form.uaeEmirate} onChange={v => set('uaeEmirate', v)} options={EMIRATES} required />
            <TextField label="Community / Area" value={form.community} onChange={v => set('community', v)} placeholder="Downtown Dubai" />
            <TextField label="Sub Community" value={form.subCommunity} onChange={v => set('subCommunity', v)} placeholder="Opera District" />
            <TextField label="Building / Tower Name" value={form.buildingName} onChange={v => set('buildingName', v)} placeholder="Burj Views A" />
            <TextField label="Developer Name" value={form.developerName} onChange={v => set('developerName', v)} placeholder="Emaar" />
          </TabsContent>

          {/* ── AGENT ── */}
          <TabsContent value="agent" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Assign a Property Finder agent to this listing.</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="First Name" value={form.agentFirstName} onChange={v => set('agentFirstName', v)} placeholder="Mohammed" />
              <TextField label="Last Name" value={form.agentLastName} onChange={v => set('agentLastName', v)} placeholder="Al Rashid" />
            </div>
            <TextField label="Email" value={form.agentEmail} onChange={v => set('agentEmail', v)} placeholder="agent@example.com" type="email" />
            <TextField label="Phone" value={form.agentPhone} onChange={v => set('agentPhone', v)} placeholder="+971501234567" />
          </TabsContent>

          {/* ── AMENITIES ── */}
          <TabsContent value="amenities" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">{form.amenities.length} selected</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_AMENITIES.map(a => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={form.amenities.includes(a)}
                    onChange={() => toggleAmenity(a)}
                    className="rounded border-input"
                  />
                  {a.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </label>
              ))}
            </div>
          </TabsContent>

          {/* ── MEDIA ── */}
          <TabsContent value="media" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Add image URLs for the listing. First image is the cover photo.</p>
            {form.imageUrls.map((url, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="relative w-10 h-10 shrink-0 bg-muted rounded overflow-hidden">
                  {url ? <img src={url} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} /> : <ImageIcon className="w-5 h-5 text-muted-foreground m-auto mt-2.5" />}
                </div>
                <Input
                  value={url}
                  onChange={e => {
                    const urls = [...form.imageUrls];
                    urls[idx] = e.target.value;
                    set('imageUrls', urls);
                  }}
                  placeholder={`Image URL ${idx + 1}`}
                  className="flex-1 font-mono text-xs"
                />
                {form.imageUrls.length > 1 && (
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => set('imageUrls', form.imageUrls.filter((_, i) => i !== idx))}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set('imageUrls', [...form.imageUrls, ''])} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Image
            </Button>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Submitting...' : isEdit ? 'Update Listing' : 'Create Listing on PF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}