import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, UserCheck } from 'lucide-react';

const LISTING_MANAGERS = [
  { email: 'ajwa@erudite-estate.com', name: 'Ajwa' },
  { email: 'darry@erudite-estate.com', name: 'Darry (Videographer)' },
  { email: 'listing@erudite-estate.com', name: 'Listing Team' },
];

export default function ListingManagerAssignDialog({ open, onClose, onSuccess, landlordId, currentListingManager }) {
  const [selectedManager, setSelectedManager] = useState(currentListingManager || '');

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedManager) throw new Error('Please select a listing manager');
      await base44.entities.Landlord.update(landlordId, {
        listing_manager_email: selectedManager,
      });
    },
    onSuccess: () => {
      toast.success('Listing manager assigned successfully');
      onSuccess();
    },
    onError: (err) => {
      toast.error('Failed to assign: ' + err.message);
    },
  });

  const handleSubmit = () => {
    assignMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-accent" />
            Assign Listing Manager
          </DialogTitle>
          <DialogDescription>
            Select a listing manager to handle the listing production workflow for this property.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {currentListingManager && (
            <div className="p-3 rounded-lg border" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }}>
              <p className="text-xs font-medium" style={{ color: '#4ade80' }}>
                Currently assigned: {currentListingManager}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="listing-manager">Select Manager</Label>
            <select
              id="listing-manager"
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <option value="">Select a listing manager...</option>
              {LISTING_MANAGERS.map((mgr) => (
                <option key={mgr.email} value={mgr.email}>
                  {mgr.name} ({mgr.email})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>The listing manager will:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Handle permit creation</li>
              <li>Draft listing copy</li>
              <li>Coordinate photography</li>
              <li>Manage publication workflow</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assignMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={assignMutation.isPending || !selectedManager}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Assigning...
              </>
            ) : (
              'Assign Manager'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}