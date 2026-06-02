import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { Handshake, Plus, Eye, CheckCircle, XCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('list');

  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: async () => {
      const result = await base44.entities.Offer.list('-submitted_at');
      return result;
    },
  });

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

  const stats = {
    active: offers.filter(o => ['draft', 'submitted', 'countered'].includes(o.status)).length,
    avgValue: offers.length > 0 ? offers.reduce((sum, o) => sum + (o.offer_amount_aed || 0), 0) / offers.length : 0,
    won: offers.filter(o => o.status === 'accepted').length,
    winRate: offers.length > 0 ? (offers.filter(o => o.status === 'accepted').length / offers.length) * 100 : 0,
    avgTimeToClose: 14,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Negotiations</h1>
            <p className="text-gray-500 mt-1">Offer and counteroffer orchestration engine</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                New Offer
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Offer</DialogTitle>
              </DialogHeader>
              <CreateOfferForm onSubmit={handleCreateOffer} onCancel={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Active Negotiations</span>
              <Handshake className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. Deal Value</span>
              <DollarSign className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">AED {(stats.avgValue / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +12%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Win Rate</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.winRate.toFixed(0)}%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +5%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. Time to Close</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgTimeToClose} days</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              -2 days
            </p>
          </iOSCard>
        </div>

        {/* Main Content */}
        {viewMode === 'list' ? (
          <iOSCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100">
                <Handshake className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Active Deals</h2>
                <p className="text-sm text-gray-500">In Progress</p>
              </div>
            </div>

            {offers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
                <Handshake className="w-12 h-12 mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2 text-gray-700">No active negotiations</h3>
                <p className="text-sm text-center max-w-md text-gray-500">
                  Start your first offer to begin tracking deal negotiations
                </p>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                      Create First Offer
                    </button>
                  </DialogTrigger>
                </Dialog>
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Handshake className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">#{offer.id?.slice(-4)} • {offer.lead_name}</p>
                        <p className="text-xs text-gray-500">
                          {offer.property_title} • AED {offer.offer_amount_aed?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <iOSBadge variant={offer.status === 'accepted' ? 'green' : offer.status === 'rejected' ? 'red' : offer.status === 'submitted' ? 'blue' : 'purple'}>
                        {offer.status}
                      </iOSBadge>
                      <span className="text-xs text-gray-500">
                        {offer.submitted_at ? format(new Date(offer.submitted_at), 'MMM d, yyyy') : '-'}
                      </span>
                      <button
                        onClick={() => { setSelectedOffer(offer); setViewMode('detail'); }}
                        className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {offer.status === 'draft' && (
                        <button
                          onClick={() => handleUpdateStatus(offer.id, 'submitted')}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </iOSCard>
        ) : (
          selectedOffer && (
            <OfferDetailView
              offer={selectedOffer}
              onBack={() => { setSelectedOffer(null); setViewMode('list'); }}
              onUpdateStatus={handleUpdateStatus}
            />
          )
        )}
      </div>
    </div>
  );
}

function CreateOfferForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    lead_name: '',
    property_title: '',
    offer_amount_aed: '',
    asking_price_aed: '',
    deal_type: 'sale',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Lead Name</Label>
          <Input
            value={formData.lead_name}
            onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
            placeholder="Enter lead name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Property</Label>
          <Input
            value={formData.property_title}
            onChange={(e) => setFormData({ ...formData, property_title: e.target.value })}
            placeholder="Property title"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Offer Amount (AED)</Label>
          <Input
            type="number"
            value={formData.offer_amount_aed}
            onChange={(e) => setFormData({ ...formData, offer_amount_aed: e.target.value })}
            placeholder="e.g., 2500000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Asking Price (AED)</Label>
          <Input
            type="number"
            value={formData.asking_price_aed}
            onChange={(e) => setFormData({ ...formData, asking_price_aed: e.target.value })}
            placeholder="e.g., 2800000"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Deal Type</Label>
        <Select value={formData.deal_type} onValueChange={(value) => setFormData({ ...formData, deal_type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes or conditions..."
          className="min-h-[100px]"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Create Offer
        </button>
      </div>
    </form>
  );
}

function OfferDetailView({ offer, onBack, onUpdateStatus }) {
  return (
    <iOSCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Eye className="w-4 h-4 rotate-180" />
          Back to List
        </button>
        <iOSBadge variant={offer.status === 'accepted' ? 'green' : offer.status === 'rejected' ? 'red' : 'blue'}>
          {offer.status}
        </iOSBadge>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Offer Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Lead:</span>
              <span className="font-medium text-gray-900">{offer.lead_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Property:</span>
              <span className="font-medium text-gray-900">{offer.property_title}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Offer Amount:</span>
              <span className="font-semibold text-blue-600">AED {offer.offer_amount_aed?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Asking Price:</span>
              <span className="font-medium text-gray-900">AED {offer.asking_price_aed?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Deal Type:</span>
              <span className="font-medium text-gray-900 capitalize">{offer.deal_type}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Submitted:</span>
              <span className="font-medium text-gray-900">{offer.submitted_at ? format(new Date(offer.submitted_at), 'MMM d, yyyy') : 'Not submitted'}</span>
            </div>
            {offer.expires_at && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Expires:</span>
                <span className="font-medium text-gray-900">{format(new Date(offer.expires_at), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {offer.notes && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{offer.notes}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        {offer.status === 'draft' && (
          <>
            <button
              onClick={() => onUpdateStatus(offer.id, 'submitted')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Offer
            </button>
            <button
              onClick={() => onUpdateStatus(offer.id, 'rejected')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </>
        )}
        {offer.status === 'submitted' && (
          <>
            <button
              onClick={() => onUpdateStatus(offer.id, 'accepted')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Accepted
            </button>
            <button
              onClick={() => onUpdateStatus(offer.id, 'countered')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
            >
              Counter Offer
            </button>
            <button
              onClick={() => onUpdateStatus(offer.id, 'rejected')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
            >
              Mark Rejected
            </button>
          </>
        )}
      </div>
    </iOSCard>
  );
}