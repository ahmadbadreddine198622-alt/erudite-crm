import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Upload, X } from 'lucide-react';

const initialForm = {
  title: '', description: '', property_type: 'apartment', listing_type: 'sale',
  price_aed: '', area_sqft: '', bedrooms: '', bathrooms: '', location: '',
  building_name: '', address: '', latitude: '', longitude: '',
  permit_number: '', developer: '', furnishing: 'unfurnished',
  portal_listings: { property_finder: false, bayut: false },
  images: [],
};

export default function AddPropertyDialog({ open, onClose }) {
  const [form, setForm] = useState(initialForm);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Property.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setForm(initialForm);
      onClose();
    },
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setForm(f => ({ ...f, images: [...f.images, ...urls] }));
    setUploading(false);
  };

  const removeImage = (idx) => {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      price_aed: Number(form.price_aed) || 0,
      area_sqft: Number(form.area_sqft) || 0,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      latitude: Number(form.latitude) || undefined,
      longitude: Number(form.longitude) || undefined,
      status: 'available',
    });
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e?.target?.value ?? e }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={set('title')} required placeholder="Luxury 3BR in Marina" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={set('description')} placeholder="Property description..." rows={3} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={form.property_type} onValueChange={set('property_type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'office', 'retail', 'warehouse', 'land'].map(t => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Listing Type</Label>
              <Select value={form.listing_type} onValueChange={set('listing_type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Furnishing</Label>
              <Select value={form.furnishing} onValueChange={set('furnishing')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="furnished">Furnished</SelectItem>
                  <SelectItem value="semi_furnished">Semi-Furnished</SelectItem>
                  <SelectItem value="unfurnished">Unfurnished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price (AED) *</Label>
              <Input value={form.price_aed} onChange={set('price_aed')} type="number" required />
            </div>
            <div>
              <Label>Area (sqft)</Label>
              <Input value={form.area_sqft} onChange={set('area_sqft')} type="number" />
            </div>
            <div>
              <Label>Bedrooms</Label>
              <Input value={form.bedrooms} onChange={set('bedrooms')} type="number" />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input value={form.bathrooms} onChange={set('bathrooms')} type="number" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={set('location')} placeholder="Dubai Marina" />
            </div>
            <div>
              <Label>Building</Label>
              <Input value={form.building_name} onChange={set('building_name')} placeholder="Tower name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Latitude</Label>
              <Input value={form.latitude} onChange={set('latitude')} placeholder="25.0657" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={form.longitude} onChange={set('longitude')} placeholder="55.1413" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>RERA Permit #</Label>
              <Input value={form.permit_number} onChange={set('permit_number')} />
            </div>
            <div>
              <Label>Developer</Label>
              <Input value={form.developer} onChange={set('developer')} placeholder="Emaar" />
            </div>
          </div>

          {/* Portal Listings */}
          <div>
            <Label className="mb-2 block">Portal Listings</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.portal_listings.property_finder}
                  onCheckedChange={(v) => setForm(f => ({ ...f, portal_listings: { ...f.portal_listings, property_finder: v } }))}
                />
                Property Finder
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.portal_listings.bayut}
                  onCheckedChange={(v) => setForm(f => ({ ...f, portal_listings: { ...f.portal_listings, bayut: v } }))}
                />
                Bayut
              </label>
            </div>
          </div>

          {/* Images */}
          <div>
            <Label className="mb-2 block">Images</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.images.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={url} className="w-full h-full object-cover" alt="" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-accent transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Add Property'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}