import { useState } from 'react';
import { X, Plus, Upload, Loader2, Check, MapPin, Building2, AlertCircle, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOLD = '#c9a85c';

const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'duplex', 'land', 'office', 'retail', 'warehouse', 'hotel_apartment'];
const FURNISHING_OPTIONS = ['furnished', 'semi_furnished', 'unfurnished'];
const COMPLETION_OPTIONS = ['ready', 'off_plan'];

const FIELD = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</label>
    {children}
  </div>
);

const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: GOLD };

const GlassInput = ({ value, onChange, placeholder, type = 'text', className = '' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    className={`w-full h-9 px-3 rounded-xl text-sm outline-none ${className}`}
    style={INPUT_STYLE} />
);

const GlassSelect = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange}
    className="w-full h-9 px-3 rounded-xl text-sm outline-none"
    style={{ ...INPUT_STYLE, appearance: 'none' }}>
    {children}
  </select>
);

export default function PFAddListingDialog({ onClose, onCreated, editListing = null }) {
  const isEdit = !!editListing;
  const [form, setForm] = useState({
    title: editListing?.title || '',
    listing_type: editListing?.listing_type || 'sale',
    property_type: editListing?.property_type || 'apartment',
    price: editListing?.price != null ? String(editListing.price) : '',
    bedrooms: editListing?.bedrooms != null ? String(editListing.bedrooms) : '',
    bathrooms: editListing?.bathrooms != null ? String(editListing.bathrooms) : '',
    area_sqft: editListing?.area_sqft != null ? String(editListing.area_sqft) : '',
    location: editListing?.location || '',
    building_name: editListing?.building_name || '',
    unit_number: editListing?.unit_number || '',
    permit_number: editListing?.permit_number || '',
    furnishing: editListing?.furnishing || 'unfurnished',
    completion_status: editListing?.completion_status || 'ready',
    description: editListing?.description || '',
    agent_email: editListing?.agent_email || '',
    images: editListing?.images || [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

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
        bedrooms: form.bedrooms !== '' ? Number(form.bedrooms) : undefined,
        bathrooms: form.bathrooms !== '' ? Number(form.bathrooms) : undefined,
        area_sqft: Number(form.area_sqft),
        location: form.location.trim(),
        building_name: form.building_name.trim() || undefined,
        unit_number: form.unit_number.trim() || undefined,
        permit_number: form.permit_number.trim() || undefined,
        furnishing: form.furnishing,
        completion_status: form.completion_status,
        description: form.description.trim() || undefined,
        agent_email: form.agent_email.trim() || undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0b1525', border: `1px solid rgba(201,168,92,0.25)`, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(201,168,92,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,168,92,0.15)', border: `1px solid rgba(201,168,92,0.3)` }}>
              {isEdit ? <Pencil className="w-4 h-4" style={{ color: GOLD }} /> : <Plus className="w-4 h-4" style={{ color: GOLD }} />}
            </div>
            <div>
              <p className="font-semibold text-sm text-white">{isEdit ? 'Edit Listing' : 'Add New Listing'}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{isEdit ? 'Update CRM record · changes saved locally' : 'Property Finder–ready format · saves as draft'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition">
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Required fields notice */}
        <div className="mx-6 mt-4 shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px]" style={{ background: 'rgba(201,168,92,0.07)', border: '1px solid rgba(201,168,92,0.18)', color: 'rgba(255,255,255,0.55)' }}>
          <AlertCircle className="w-3 h-3 shrink-0" style={{ color: GOLD }} />
          Fields marked <span className="text-rose-400 ml-1 mr-1">*</span> are required to publish on Property Finder.
        </div>

        {/* Scrollable form */}
        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">

          {/* Section: Core */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'rgba(201,168,92,0.7)' }}>Core Details</p>
            <div className="space-y-3">
              <FIELD label="Title *">
                <GlassInput value={form.title} onChange={set('title')} placeholder="e.g. Spacious 2BR | Marina View | Ready to Move" />
              </FIELD>
              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Listing Type *">
                  <GlassSelect value={form.listing_type} onChange={set('listing_type')}>
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                  </GlassSelect>
                </FIELD>
                <FIELD label="Property Type *">
                  <GlassSelect value={form.property_type} onChange={set('property_type')}>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
                  </GlassSelect>
                </FIELD>
              </div>
              <FIELD label="Price (AED) *">
                <GlassInput value={form.price} onChange={set('price')} placeholder="1250000" type="number" />
              </FIELD>
            </div>
          </div>

          {/* Section: Size & Specs */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'rgba(201,168,92,0.7)' }}>Size & Specs</p>
            <div className="grid grid-cols-3 gap-3">
              <FIELD label="Bedrooms">
                <GlassInput value={form.bedrooms} onChange={set('bedrooms')} placeholder="0 = Studio" type="number" />
              </FIELD>
              <FIELD label="Bathrooms">
                <GlassInput value={form.bathrooms} onChange={set('bathrooms')} placeholder="2" type="number" />
              </FIELD>
              <FIELD label="Area (sqft) *">
                <GlassInput value={form.area_sqft} onChange={set('area_sqft')} placeholder="1200" type="number" />
              </FIELD>
              <FIELD label="Furnishing">
                <GlassSelect value={form.furnishing} onChange={set('furnishing')}>
                  {FURNISHING_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}</option>)}
                </GlassSelect>
              </FIELD>
              <FIELD label="Completion">
                <GlassSelect value={form.completion_status} onChange={set('completion_status')}>
                  {COMPLETION_OPTIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>)}
                </GlassSelect>
              </FIELD>
            </div>
          </div>

          {/* Section: Location */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'rgba(201,168,92,0.7)' }}>Location</p>
            <div className="grid grid-cols-2 gap-3">
              <FIELD label="Area / Community *">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <input value={form.location} onChange={set('location')} placeholder="e.g. Dubai Marina"
                    className="w-full h-9 pl-9 pr-3 rounded-xl text-sm outline-none"
                    style={INPUT_STYLE} />
                </div>
              </FIELD>
              <FIELD label="Building / Tower">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <input value={form.building_name} onChange={set('building_name')} placeholder="e.g. Marina Gate 1"
                    className="w-full h-9 pl-9 pr-3 rounded-xl text-sm outline-none"
                    style={INPUT_STYLE} />
                </div>
              </FIELD>
              <FIELD label="Unit Number">
                <GlassInput value={form.unit_number} onChange={set('unit_number')} placeholder="e.g. 2401" />
              </FIELD>
            </div>
          </div>

          {/* Section: Compliance */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'rgba(201,168,92,0.7)' }}>Compliance & Agent</p>
            <div className="grid grid-cols-2 gap-3">
              <FIELD label="Trakheesi Permit No. *">
                <GlassInput value={form.permit_number} onChange={set('permit_number')} placeholder="RERA/DLD permit number" />
              </FIELD>
              <FIELD label="Agent Email">
                <GlassInput value={form.agent_email} onChange={set('agent_email')} placeholder="agent@erudite-estate.com" />
              </FIELD>
            </div>
          </div>

          {/* Section: Description */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'rgba(201,168,92,0.7)' }}>Description</p>
            <textarea value={form.description} onChange={set('description')} rows={5}
              placeholder="Full property description for the portal listing…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none leading-relaxed"
              style={INPUT_STYLE} />
          </div>

          {/* Section: Photos */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'rgba(201,168,92,0.7)' }}>Photos</p>
            <div className="space-y-2">
              {/* Existing images */}
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.images.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-16 rounded-lg overflow-hidden group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        style={{ background: 'rgba(0,0,0,0.7)' }}>
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add by URL */}
              <div className="flex gap-2">
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addImageUrl()}
                  placeholder="Paste image URL and press Enter or Add"
                  className="flex-1 h-9 px-3 rounded-xl text-sm outline-none"
                  style={INPUT_STYLE} />
                <button onClick={addImageUrl}
                  className="px-3 h-9 rounded-xl text-xs font-medium transition"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
                  Add
                </button>
              </div>
              {/* File upload */}
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition hover:bg-white/5"
                style={{ border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)' }}>
                <Upload className="w-3.5 h-3.5" />
                <span className="text-xs">Upload from device</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onClose} className="flex-1 h-9 rounded-xl text-xs font-medium transition"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || saved}
            className="flex-[2] h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
            style={{ background: saved ? 'rgba(63,207,142,0.15)' : 'rgba(201,168,92,0.15)', border: `1px solid ${saved ? 'rgba(63,207,142,0.4)' : 'rgba(201,168,92,0.4)'}`, color: saved ? '#3fcf8e' : GOLD }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : isEdit ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : isEdit ? 'Save Changes' : 'Save as Draft in CRM'}
          </button>
        </div>
      </div>
    </div>
  );
}