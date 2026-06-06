import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

export default function AddLandlordDialog({ open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    full_name_en: '',
    phone: '',
    email: '',
    source: 'warm_intro',
    landlord_archetype: 'individual_end_user_relocating',
    assigned_agent_email: '',
    project_id: '',
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Landlord.create(data),
    onSuccess: () => {
      onSuccess();
      setFormData({
        full_name_en: '',
        phone: '',
        email: '',
        source: 'warm_intro',
        landlord_archetype: 'individual_end_user_relocating',
        assigned_agent_email: '',
        project_id: '',
      });
      toast.success('Landlord created');
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[AddLandlordDialog] Landlord.create failed:', error);
      toast.error(`Failed to create landlord: ${msg}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.full_name_en.trim() || !formData.phone.trim() || !formData.assigned_agent_email.trim()) {
      toast.error('Full name, phone, and assigned agent are required');
      return;
    }
    // Clean payload: valid stage enum + omit empty optional fields (an empty
    // email / project_id can fail validation and cause a silent DB rejection).
    const payload = {
      full_name_en: formData.full_name_en.trim(),
      phone: formData.phone.trim(),
      assigned_agent_email: formData.assigned_agent_email.trim(),
      source: formData.source,
      landlord_archetype: formData.landlord_archetype,
      stage: 'initial_contact',   // was 'sourced' (invalid enum) -> silent rejection
    };
    if (formData.email.trim()) payload.email = formData.email.trim();
    if (formData.project_id) payload.project_id = formData.project_id;
    createMutation.mutate(payload);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Add New Landlord</SheetTitle>
          <SheetDescription>
            Create a new landlord record to begin the mandate acquisition journey
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Full Name *</label>
            <Input
              value={formData.full_name_en}
              onChange={(e) => setFormData({ ...formData, full_name_en: e.target.value })}
              placeholder="e.g., Ahmed Al Mansouri"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Phone (E.164) *</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+971501234567"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Assigned Agent *</label>
            <Input
              value={formData.assigned_agent_email}
              onChange={(e) => setFormData({ ...formData, assigned_agent_email: e.target.value })}
              placeholder="agent@company.com"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Source</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-input rounded-md text-sm"
            >
              <option value="warm_intro">Warm Intro</option>
              <option value="dld_lookup">DLD Lookup</option>
              <option value="linkedin_outreach">LinkedIn Outreach</option>
              <option value="building_manager">Building Manager</option>
              <option value="expired_listing">Expired Listing</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Project</label>
            <select
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-input rounded-md text-sm"
            >
              <option value="">— Select a project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Archetype</label>
            <select
              value={formData.landlord_archetype}
              onChange={(e) => setFormData({ ...formData, landlord_archetype: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-input rounded-md text-sm"
            >
              <option value="professional_investor">Professional Investor</option>
              <option value="individual_end_user_relocating">Individual Relocating</option>
              <option value="first_time_seller">First Time Seller</option>
              <option value="portfolio_optimizer">Portfolio Optimizer</option>
              <option value="distressed_seller">Distressed Seller</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Landlord'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}