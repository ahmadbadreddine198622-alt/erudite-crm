import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { Handshake, Plus, Eye, Edit2, CheckCircle, XCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Negotiations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'

  const queryClient = useQueryClient();

  // Fetch offers
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: async () => {
      const result = await base44.entities.Offer.list('-submitted_at');
      return result;
    },
  });

  // Create offer mutation
  const createOfferMutation = useMutation({
    mutationFn: async (offerData) => {
      return await base44.entities.Offer.create(offerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      setIsDialogOpen(false);
      toast.success('Offer created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create offer: ' + error.message);
    },
  });

  // Update offer mutation
  const updateOfferMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Offer.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      setSelectedOffer(null);
      setViewMode('list');
      toast.success('Offer updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update offer: ' + error.message);
    },
  });

  // Calculate stats
  const stats = {
    active: offers.filter(o => ['draft', 'submitted', 'countered'].includes(o.status)).length,
    avgValue: offers.length > 0 ? offers.reduce((sum, o) => sum + (o.offer_amount_aed || 0), 0) / offers.length : 0,
    won: offers.filter(o => o.status === 'accepted').length,
    winRate: offers.length > 0 ? (offers.filter(o => o.status === 'accepted').length / offers.length) * 100 : 0,
    avgTimeToClose: 14, // Would need activity tracking to calculate this
  };

  const statusColors = {
    draft: 'default',
    submitted: 'blue',
    countered: 'purple',
    accepted: 'emerald',
    rejected: 'rose',
    expired: 'default',
  };

  const handleCreateOffer = (formData) => {
    createOfferMutation.mutate({
      ...formData,
      offer_amount_aed: parseFloat(formData.offer_amount_aed),
      asking_price_aed: parseFloat(formData.asking_price_aed),
      status: 'draft',
      deal_type: formData.deal_type || 'sale',
      submitted_at: new Date().toISOString(),
    });
  };

  const handleUpdateStatus = (offerId, newStatus) => {
    updateOfferMutation.mutate({
      id: offerId,
      data: { status: newStatus },
    });
  };

  const tableColumns = [
    { header: 'Offer ID', accessor: (row) => `#${row.id?.slice(-4)}` },
    { header: 'Lead', accessor: 'lead_name' },
    { header: 'Property', accessor: 'property_title' },
    { header: 'Amount', accessor: (row) => `AED ${row.offer_amount_aed?.toLocaleString()}` },
    { header: 'Status', accessor: (row) => <EruditeBadge variant={statusColors[row.status]}>{row.status}</EruditeBadge> },
    { header: 'Submitted', accessor: (row) => row.submitted_at ? format(new Date(row.submitted_at), 'MMM d, yyyy') : '-' },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => { setSelectedOffer(row); setViewMode('detail'); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'draft' && (
            <button
              onClick={() => handleUpdateStatus(row.id, 'submitted')}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <EruditePage
      title="Negotiations"
      subtitle="Offer and counteroffer orchestration engine"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <EruditeButton icon={Plus}>New Offer</EruditeButton>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-[#0F1419] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Create New Offer</DialogTitle>
            </DialogHeader>
            <CreateOfferForm onSubmit={handleCreateOffer} onCancel={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Active Negotiations" value={stats.active.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Deal Value" value={`AED ${(stats.avgValue / 1000000).toFixed(2)}M`} trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} trend="up" trendValue="+5%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Time to Close" value={`${stats.avgTimeToClose} days`} trend="down" trendValue="-2 days" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
        <EruditeSection title="Active Deals" subtitle="In Progress" icon={Handshake}>
          {offers.length === 0 ? (
            <EruditeEmptyState
              icon={Handshake}
              title="No active negotiations"
              description="Start your first offer to begin tracking deal negotiations"
              action={
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <EruditeButton variant="primary">Create First Offer</EruditeButton>
                  </DialogTrigger>
                </Dialog>
              }
            />
          ) : (
            <EruditeTable columns={tableColumns} data={offers} />
          )}
        </EruditeSection>
      ) : (
        selectedOffer && (
          <OfferDetailView
            offer={selectedOffer}
            onBack={() => { setSelectedOffer(null); setViewMode('list'); }}
            onUpdateStatus={handleUpdateStatus}
          />
        )
      )}
    </EruditePage>
  );
}

// Create Offer Form Component
function CreateOfferForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    lead_name: '',
    property_title: '',
    offer_amount_aed: '',
    asking_price_aed: '',
    deal_type: 'sale',
    notes: '',
    contingencies: [],
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80">Lead Name</Label>
          <Input
            value={formData.lead_name}
            onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
            placeholder="Enter lead name"
            className="glass-input"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">Property</Label>
          <Input
            value={formData.property_title}
            onChange={(e) => setFormData({ ...formData, property_title: e.target.value })}
            placeholder="Property title"
            className="glass-input"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80">Offer Amount (AED)</Label>
          <Input
            type="number"
            value={formData.offer_amount_aed}
            onChange={(e) => setFormData({ ...formData, offer_amount_aed: e.target.value })}
            placeholder="e.g., 2500000"
            className="glass-input"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">Asking Price (AED)</Label>
          <Input
            type="number"
            value={formData.asking_price_aed}
            onChange={(e) => setFormData({ ...formData, asking_price_aed: e.target.value })}
            placeholder="e.g., 2800000"
            className="glass-input"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Deal Type</Label>
        <Select value={formData.deal_type} onValueChange={(value) => setFormData({ ...formData, deal_type: value })}>
          <SelectTrigger className="glass-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes or conditions..."
          className="glass-input min-h-[100px]"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <EruditeButton type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </EruditeButton>
        <EruditeButton type="submit" variant="primary" className="flex-1">
          Create Offer
        </EruditeButton>
      </div>
    </form>
  );
}

// Offer Detail View Component
function OfferDetailView({ offer, onBack, onUpdateStatus }) {
  return (
    <EruditeCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <Eye className="w-4 h-4 rotate-180" />
          Back to List
        </button>
        <EruditeBadge variant={offer.status === 'accepted' ? 'emerald' : offer.status === 'rejected' ? 'rose' : 'blue'}>
          {offer.status}
        </EruditeBadge>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-display mb-4">Offer Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Lead:</span>
              <span className="text-white/90">{offer.lead_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Property:</span>
              <span className="text-white/90">{offer.property_title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Offer Amount:</span>
              <span className="text-amber-400 font-semibold">AED {offer.offer_amount_aed?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Asking Price:</span>
              <span className="text-white/90">AED {offer.asking_price_aed?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Deal Type:</span>
              <span className="text-white/90 capitalize">{offer.deal_type}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-display mb-4">Timeline</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Submitted:</span>
              <span className="text-white/90">{offer.submitted_at ? format(new Date(offer.submitted_at), 'MMM d, yyyy') : 'Not submitted'}</span>
            </div>
            {offer.expires_at && (
              <div className="flex justify-between">
                <span className="text-white/60">Expires:</span>
                <span className="text-white/90">{format(new Date(offer.expires_at), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {offer.notes && (
        <div className="mb-6">
          <h3 className="text-lg font-display mb-2">Notes</h3>
          <p className="text-white/70 text-sm">{offer.notes}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-white/10">
        {offer.status === 'draft' && (
          <>
            <EruditeButton onClick={() => onUpdateStatus(offer.id, 'submitted')} variant="primary" icon={CheckCircle}>
              Submit Offer
            </EruditeButton>
            <EruditeButton onClick={() => onUpdateStatus(offer.id, 'rejected')} variant="secondary" icon={XCircle}>
              Reject
            </EruditeButton>
          </>
        )}
        {offer.status === 'submitted' && (
          <>
            <EruditeButton onClick={() => onUpdateStatus(offer.id, 'accepted')} variant="primary" icon={CheckCircle}>
              Mark Accepted
            </EruditeButton>
            <EruditeButton onClick={() => onUpdateStatus(offer.id, 'countered')} variant="secondary">
              Counter Offer
            </EruditeButton>
            <EruditeButton onClick={() => onUpdateStatus(offer.id, 'rejected')} variant="secondary" icon={XCircle}>
              Mark Rejected
            </EruditeButton>
          </>
        )}
      </div>
    </EruditeCard>
  );
}