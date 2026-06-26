import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Upload, Loader2, Check, MapPin, Building2, AlertCircle, Pencil, Star, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOLD = '#c9a85c';

const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'duplex', 'land', 'office', 'retail', 'warehouse', 'hotel_apartment'];
const FURNISHING_OPTIONS = ['furnished', 'semi_furnished', 'unfurnished'];
const COMPLETION_OPTIONS = ['ready', 'off_plan'];

const ALL_AMENITIES = [
  'balcony', 'shared_pool', 'private_pool', 'built_in_wardrobes', 'central_ac',
  'covered_parking', 'gym', 'jacuzzi', 'maid_room', 'private_garden', 'security',
  'concierge', 'view_of_water', 'view_of_landmark', 'pets_allowed', 'study',
  'walk_in_closet', 'storage_room', 'laundry_room', 'basement_parking',
  'shared_gym', 'shared_spa', 'kitchen_appliances', 'lobby_in_building',
  'children_play_area', 'barbecue_area', 'tennis_court', 'squash_court',
];

const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: GOLD };

const FIELD = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</label>
    {children}
  </div>
);

const GlassInput = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ ...INPUT_STYLE, width: '100%', height: 36, padding: '0 12px', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
);

const GlassSelect = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange}
    style={{ ...INPUT_STYLE, width: '100%', height: 36, padding: '0 12px', borderRadius: 10, fontSize: 13, outline: 'none', appearance: 'none', boxSizing: 'border-box' }}>
    {children}
  </select>
);

const SectionTitle = ({ children }) => (
  <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(201,168,92,0.7)', marginBottom: 12, marginTop: 4 }}>{children}</p>
);

const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: checked ? 'rgba(201,168,92,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? 'rgba(201,168,92,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, userSelect: 'none' }}>
    <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? GOLD : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </div>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
    <span style={{ fontSize: 12, color: checked ? GOLD : 'rgba(255,255,255,0.6)' }}>{label}</span>
  </label>
);

export default function PFAddListingDialog({ onClose, onCreated, editListing = null }) {
  const isEdit = !!editListing;

  const [form, setForm] = useState({
    // Core
    title: editListing?.title || '',
    listing_type: editListing?.listing_type || 'sale',
    property_type: editListing?.property_type || 'apartment',
    price: editListing?.price != null ? String(editListing.price) : '',
    price_per_sqft: editListing?.price_per_sqft != null ? String(editListing.price_per_sqft) : '',
    // Size & specs
    bedrooms: editListing?.bedrooms != null ? String(editListing.bedrooms) : '',
    bathrooms: editListing?.bathrooms != null ? String(editListing.bathrooms) : '',
    area_sqft: editListing?.area_sqft != null ? String(editListing.area_sqft) : '',
    furnishing: editListing?.furnishing || 'unfurnished',
    completion_status: editListing?.completion_status || 'ready',
    completion_date: editListing?.completion_date || '',
    // Location
    location: editListing?.location || '',
    building_name: editListing?.building_name || '',
    unit_number: editListing?.unit_number || '',
    address: editListing?.address || '',
    latitude: editListing?.latitude != null ? String(editListing.latitude) : '',
    longitude: editListing?.longitude != null ? String(editListing.longitude) : '',
    // Developer & project
    developer: editListing?.developer || '',
    // Compliance & agent
    permit_number: editListing?.permit_number || '',
    agent_email: editListing?.agent_email || '',
    agent_name: editListing?.agent_name || '',
    agency_name: editListing?.agency_name || '',
    // Portals
    featured: editListing?.featured || false,
    verified: editListing?.verified || false,
    // Description
    description: editListing?.description || '',
    // Amenities
    amenities: editListing?.amenities || [],
    // Tags
    tags: editListing?.tags ? editListing.tags.join(', ') : '',
    // Media
    images: editListing?.images || [],
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const setBool = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

  const toggleAmenity = (a) => setForm(f => ({
    ...f,
    amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
  }));

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    setForm(f => ({ ...f, images: [...f.images, url] }));
    setImageUrl('');
  };

  const removeImage = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res.file_url) {
        setForm(f => ({ ...f, images: [...f.images, res.file_url] }));
        toast.success('Image uploaded');
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    }
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required';
    if (!form.price || isNaN(Number(form.price))) return 'Valid price is required';
    if (!form.location.trim()) return 'Location/area is required';
    if (!form.permit_number.trim()) return 'Trakheesi permit number is required';
    if (!form.area_sqft || isNaN(Number(form.area_sqft))) return 'Area (sqft) is required';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        listing_type: form.listing_type,
        property_type: form.property_type,
        price: Number(form.price),
        price_per_sqft: form.price_per_sqft ? Number(form.price_per_sqft) : undefined,
        bedrooms: form.bedrooms !== '' ? Number(form.bedrooms) : undefined,
        bathrooms: form.bathrooms !== '' ? Number(form.bathrooms) : undefined,
        area_sqft: Number(form.area_sqft),
        furnishing: form.furnishing,
        completion_status: form.completion_status,
        completion_date: form.completion_date || undefined,
        location: form.location.trim(),
        building_name: form.building_name.trim() || undefined,
        unit_number: form.unit_number.trim() || undefined,
        address: form.address.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        developer: form.developer.trim() || undefined,
        permit_number: form.permit_number.trim() || undefined,
        agent_email: form.agent_email.trim() || undefined,
        agent_name: form.agent_name.trim() || undefined,
        agency_name: form.agency_name.trim() || undefined,
        featured: form.featured,
        verified: form.verified,
        description: form.description.trim() || undefined,
        amenities: form.amenities,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        images: form.images,
      };
      if (isEdit) {
        await base44.entities.PFListing.update(editListing.id, payload);
        toast.success('Listing updated in CRM');
      } else {
        await base44.entities.PFListing.create({
          ...payload,
          pf_listing_id: `draft-${Date.now()}`,
          status: 'draft',
          sync_status: 'pending',
          city: 'Dubai',
        });
        toast.success('Listing saved as draft in CRM');
      }
      setSaved(true);
      setTimeout(() => { onCreated?.(); onClose(); }, 900);
    } catch (err) {
      toast.error(err.message || 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 680, background: '#0b1525', border: `1px solid rgba(201,168,92,0.25)`, borderRadius: 18, display: 'flex', flexDirection: 'column', maxHeight: '94vh' }}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(201,168,92,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(201,168,92,0.15)', border: `1px solid rgba(201,168,92,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isEdit ? <Pencil style={{ width: 15, height: 15, color: GOLD }} /> : <Plus style={{ width: 15, height: 15, color: GOLD }} />}
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: '#fff', margin: 0 }}>{isEdit ? 'Edit Listing' : 'Add New Listing'}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>{isEdit ? 'All Property Finder fields · changes saved to CRM' : 'Full Property Finder format · saves as draft'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Required notice */}
        <div style={{ margin: '12px 20px 0', padding: '8px 12px', borderRadius: 10, background: 'rgba(201,168,92,0.07)', border: '1px solid rgba(201,168,92,0.18)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <AlertCircle style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Fields marked <span style={{ color: '#f87171' }}>*</span> are required to publish on Property Finder.</span>
        </div>

        {/* Scrollable form */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── CORE ── */}
          <div>
            <SectionTitle>Core Details</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FIELD label="Title *">
                <GlassInput value={form.title} onChange={set('title')} placeholder="e.g. Spacious 2BR | Marina View | Ready to Move" />
              </FIELD>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FIELD label="Listing Type *">
                  <GlassSelect value={form.listing_type} onChange={set('listing_type')}>
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                  </GlassSelect>
                </FIELD>
                <FIELD label="Property Type *">
                  <GlassSelect value={form.property_type} onChange={set('property_type')}>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </GlassSelect>
                </FIELD>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FIELD label="Price (AED) *">
                  <GlassInput value={form.price} onChange={set('price')} placeholder="1250000" type="number" />
                </FIELD>
                <FIELD label="Price per sqft">
                  <GlassInput value={form.price_per_sqft} onChange={set('price_per_sqft')} placeholder="Auto or enter" type="number" />
                </FIELD>
              </div>
            </div>
          </div>

          {/* ── SIZE & SPECS ── */}
          <div>
            <SectionTitle>Size & Specifications</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <FIELD label="Bedrooms (0=Studio)">
                <GlassInput value={form.bedrooms} onChange={set('bedrooms')} placeholder="0" type="number" />
              </FIELD>
              <FIELD label="Bathrooms">
                <GlassInput value={form.bathrooms} onChange={set('bathrooms')} placeholder="2" type="number" />
              </FIELD>
              <FIELD label="Area (sqft) *">
                <GlassInput value={form.area_sqft} onChange={set('area_sqft')} placeholder="1200" type="number" />
              </FIELD>
              <FIELD label="Furnishing">
                <GlassSelect value={form.furnishing} onChange={set('furnishing')}>
                  {FURNISHING_OPTIONS.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </GlassSelect>
              </FIELD>
              <FIELD label="Completion Status">
                <GlassSelect value={form.completion_status} onChange={set('completion_status')}>
                  {COMPLETION_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}</option>)}
                </GlassSelect>
              </FIELD>
              <FIELD label="Completion Date">
                <GlassInput value={form.completion_date} onChange={set('completion_date')} placeholder="YYYY-MM-DD" type="date" />
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

          {/* ── LOCATION ── */}
          <div>
            <SectionTitle>Location</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FIELD label="Area / Community *">
                <div style={{ position: 'relative' }}>
                  <MapPin style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'rgba(255,255,255,0.3)' }} />
                  <input value={form.location} onChange={set('location')} placeholder="e.g. Dubai Marina"
                    style={{ ...INPUT_STYLE, width: '100%', height: 36, paddingLeft: 30, paddingRight: 12, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </FIELD>
              <FIELD label="Building / Tower">
                <div style={{ position: 'relative' }}>
                  <Building2 style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'rgba(255,255,255,0.3)' }} />
                  <input value={form.building_name} onChange={set('building_name')} placeholder="e.g. Marina Gate 1"
                    style={{ ...INPUT_STYLE, width: '100%', height: 36, paddingLeft: 30, paddingRight: 12, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </FIELD>
              <FIELD label="Unit Number">
                <GlassInput value={form.unit_number} onChange={set('unit_number')} placeholder="e.g. 2401" />
              </FIELD>
              <FIELD label="Full Address">
                <GlassInput value={form.address} onChange={set('address')} placeholder="Street, area, Dubai" />
              </FIELD>
              <FIELD label="Latitude">
                <GlassInput value={form.latitude} onChange={set('latitude')} placeholder="25.0760" type="number" />
              </FIELD>
              <FIELD label="Longitude">
                <GlassInput value={form.longitude} onChange={set('longitude')} placeholder="55.1404" type="number" />
              </FIELD>
            </div>
          </div>

          {/* ── DEVELOPER & PROJECT ── */}
          <div>
            <SectionTitle>Developer & Project</SectionTitle>
            <FIELD label="Developer Name">
              <GlassInput value={form.developer} onChange={set('developer')} placeholder="e.g. Emaar, Damac, Nakheel" />
            </FIELD>
          </div>

          {/* ── COMPLIANCE & AGENT ── */}
          <div>
            <SectionTitle>Compliance & Agent</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FIELD label="Trakheesi / RERA Permit *">
                <GlassInput value={form.permit_number} onChange={set('permit_number')} placeholder="Permit number" />
              </FIELD>
              <FIELD label="Agent Email">
                <GlassInput value={form.agent_email} onChange={set('agent_email')} placeholder="agent@erudite-estate.com" />
              </FIELD>
              <FIELD label="Agent Name">
                <GlassInput value={form.agent_name} onChange={set('agent_name')} placeholder="Ahmad Badreddine" />
              </FIELD>
              <FIELD label="Agency Name">
                <GlassInput value={form.agency_name} onChange={set('agency_name')} placeholder="Erudite Real Estate" />
              </FIELD>
            </div>
          </div>

          {/* ── DESCRIPTION ── */}
          <div>
            <SectionTitle>Description</SectionTitle>
            <textarea value={form.description} onChange={set('description')} rows={5}
              placeholder="Full property description for the portal listing…"
              style={{ ...INPUT_STYLE, width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
          </div>

          {/* ── AMENITIES ── */}
          <div>
            <SectionTitle>Amenities</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_AMENITIES.map(a => {
                const active = form.amenities.includes(a);
                return (
                  <button key={a} onClick={() => toggleAmenity(a)}
                    style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500, border: `1px solid ${active ? GOLD : 'rgba(255,255,255,0.12)'}`, background: active ? 'rgba(201,168,92,0.15)' : 'rgba(255,255,255,0.04)', color: active ? GOLD : 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {a.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
            <SectionTitle>Photos</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {form.images.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: 80, height: 64, borderRadius: 8, overflow: 'hidden' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeImage(idx)}
                        style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <X style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addImageUrl()}
                  placeholder="Paste image URL then press Enter or Add"
                  style={{ ...INPUT_STYLE, flex: 1, height: 36, padding: '0 12px', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button onClick={addImageUrl}
                  style={{ padding: '0 14px', height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', fontSize: 12, cursor: 'pointer' }}>
                  Add
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 12 }}>
                <Upload style={{ width: 13, height: 13 }} />
                Upload from device
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || saved}
            style={{ flex: 2, height: 36, borderRadius: 10, border: `1px solid ${saved ? 'rgba(63,207,142,0.4)' : 'rgba(201,168,92,0.4)'}`, background: saved ? 'rgba(63,207,142,0.15)' : 'rgba(201,168,92,0.15)', color: saved ? '#3fcf8e' : GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving || saved ? 0.8 : 1 }}>
            {saving ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : saved ? <Check style={{ width: 13, height: 13 }} /> : isEdit ? <Pencil style={{ width: 13, height: 13 }} /> : <Plus style={{ width: 13, height: 13 }} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : isEdit ? 'Save Changes' : 'Save as Draft in CRM'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}