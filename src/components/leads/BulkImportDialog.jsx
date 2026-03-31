import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const PROJECT_LAYERS = [
  { id: 'peninsula-three', label: 'Peninsula Three' },
  { id: 'jumeirah-living', label: 'Jumeirah Living' },
  { id: 'six-senses', label: 'Six Senses' },
  { id: 'peninsula-four', label: 'Peninsula Four' },
];

export default function BulkImportDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState([
    { name: '', phone: '', email: '', project_layer: '', address: '' }
  ]);
  const [assignToAll, setAssignToAll] = useState(false);
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLeadRow = () => {
    setLeads([...leads, { name: '', phone: '', email: '', project_layer: '', address: '' }]);
  };

  const updateLead = (index, field, value) => {
    const updated = [...leads];
    updated[index][field] = value;
    setLeads(updated);
  };

  const removeLead = (index) => {
    setLeads(leads.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validLeads = leads.filter(lead => lead.name && lead.phone);
    
    if (validLeads.length === 0) {
      toast.error('Please fill in at least name and phone for one lead');
      return;
    }

    setLoading(true);
    try {
      for (const lead of validLeads) {
        let projectLayer = lead.project_layer;
        
        // If "assign to all" is checked, create a lead for each layer
        if (assignToAll) {
          for (const layer of PROJECT_LAYERS) {
            await base44.entities.Lead.create({
              name: lead.name,
              phone: lead.phone,
              email: lead.email || undefined,
              address: lead.address || undefined,
              stage: 'new_lead',
              project_layer: layer.id,
              lead_score: Math.floor(Math.random() * 40 + 30),
              tags: [],
            });
          }
        } else if (projectLayer) {
          await base44.entities.Lead.create({
            name: lead.name,
            phone: lead.phone,
            email: lead.email || undefined,
            address: lead.address || undefined,
            stage: 'new_lead',
            project_layer: projectLayer,
            lead_score: Math.floor(Math.random() * 40 + 30),
            tags: [],
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Successfully imported ${validLeads.length} lead(s)`);
      setLeads([{ name: '', phone: '', email: '', project_layer: '', address: '' }]);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to import leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Layer Assignment */}
          <div className="border rounded-lg p-4 bg-accent/5">
            <div className="flex items-center gap-4 mb-3">
              <Checkbox
                checked={assignToAll}
                onCheckedChange={setAssignToAll}
                id="assign-all"
              />
              <Label htmlFor="assign-all" className="cursor-pointer">
                Assign to all project layers
              </Label>
            </div>
            
            {!assignToAll && (
              <div>
                <Label className="text-sm">Or select specific layers:</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PROJECT_LAYERS.map(layer => (
                    <div key={layer.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedLayers.includes(layer.id)}
                        onCheckedChange={(checked) => {
                          setSelectedLayers(checked 
                            ? [...selectedLayers, layer.id]
                            : selectedLayers.filter(l => l !== layer.id)
                          );
                        }}
                        id={layer.id}
                      />
                      <Label htmlFor={layer.id} className="cursor-pointer text-sm">
                        {layer.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lead Entries */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {leads.map((lead, idx) => (
              <div key={idx} className="border rounded-lg p-3 bg-card space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Name *</Label>
                    <Input
                      placeholder="Timothy John Heath"
                      value={lead.name}
                      onChange={(e) => updateLead(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone *</Label>
                    <Input
                      placeholder="0581653375"
                      value={lead.phone}
                      onChange={(e) => updateLead(idx, 'phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      placeholder="tim@yolo.io"
                      value={lead.email}
                      onChange={(e) => updateLead(idx, 'email', e.target.value)}
                    />
                  </div>
                  {!assignToAll && (
                    <div>
                      <Label className="text-xs">Project Layer</Label>
                      <Select value={lead.project_layer} onValueChange={(val) => updateLead(idx, 'project_layer', val)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_LAYERS.map(layer => (
                            <SelectItem key={layer.id} value={layer.id}>{layer.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Address</Label>
                  <Input
                    placeholder="GT Court B FL 13 Triq II- Villeggjatura San Pawl, Il Bahar Malta"
                    value={lead.address}
                    onChange={(e) => updateLead(idx, 'address', e.target.value)}
                  />
                </div>
                {leads.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLead(idx)}
                    className="w-full text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add Lead Button */}
          <Button
            variant="outline"
            onClick={addLeadRow}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Another Lead
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import {leads.filter(l => l.name).length} Lead(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}