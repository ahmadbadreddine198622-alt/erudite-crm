import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, TrendingDown, CheckCircle2, XCircle, Clock, RefreshCw, DollarSign, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import OfferFormDialog from '@/components/offers/OfferFormDialog';
import OfferDetailPanel from '@/components/offers/OfferDetailPanel';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-slate-500/10 text-slate-400',   icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-500/10 text-blue-400',    icon: Clock },
  countered: { label: 'Countered', color: 'bg-accent/10 text-accent',  icon: RefreshCw },
  accepted:  { label: 'Accepted',  color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/10 text-red-400',      icon: XCircle },
  expired:   { label: 'Expired',   color: 'bg-slate-500/10 text-slate-400',    icon: Clock },
};

const STATUS_ORDER = ['submitted', 'countered', 'draft', 'accepted', 'rejected', 'expired'];

function OfferCard({ offer, isSelected, onClick }) {
  const cfg = STATUS_CONFIG[offer.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const discount = offer.asking_price_aed
    ? Math.round((1 - offer.offer_amount_aed / offer.asking_price_aed) * 100)
    : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected ? 'border-accent/30 bg-accent/5 shadow-sm' : 'border-border bg-card hover:border-accent/20 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{offer.lead_name || 'Unknown Lead'}</p>
          {offer.property_title && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{offer.property_title}</p>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 shrink-0 ${cfg.color}`}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-foreground">
            AED {offer.offer_amount_aed?.toLocaleString()}
          </p>
          {offer.asking_price_aed && (
            <p className="text-[10px] text-muted-foreground">
              Asking: AED {offer.asking_price_aed.toLocaleString()}
              {discount !== null && discount > 0 && (
                <span className="ml-1 text-accent">(-{discount}%)</span>
              )}
            </p>
          )}
        </div>
        <div className="text-right">
          {offer.form_f_signed && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Form F ✓</span>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {offer.created_date ? format(new Date(offer.created_date), 'MMM d, yyyy') : '—'}
          </p>
        </div>
      </div>

      {offer.counter_amount_aed && offer.status === 'countered' && (
        <div className="mt-2 p-2 bg-accent/5 border border-accent/20 rounded-lg">
          <p className="text-xs text-accent font-medium">
            Counter: AED {offer.counter_amount_aed.toLocaleString()}
          </p>
        </div>
      )}
    </button>
  );
}

export default function OffersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: () => base44.entities.Offer.list('-created_date', 200),
  });

  const filtered = offers.filter(o => {
    const matchSearch = !search ||
      o.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.property_title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    const orderA = STATUS_ORDER.indexOf(a.status);
    const orderB = STATUS_ORDER.indexOf(b.status);
    return orderA - orderB;
  });

  // Stats
  const active = offers.filter(o => ['submitted', 'countered'].includes(o.status));
  const accepted = offers.filter(o => o.status === 'accepted');
  const totalValue = accepted.reduce((s, o) => s + (o.offer_amount_aed || 0), 0);

  return (
    <div className="flex flex-col bg-background -m-6 overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Offer Management</h1>
          <p className="text-xs text-muted-foreground">{offers.length} total offers · Dubai Form F tracker</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs px-4 h-8 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New Offer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-6 py-3 flex-shrink-0">
        {[
          { label: 'Active Offers', value: active.length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Accepted', value: accepted.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Closed Value', value: `AED ${(totalValue / 1e6).toFixed(1)}M`, color: 'text-accent', bg: 'bg-accent/5' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl p-3 ${stat.bg}`}>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: List */}
        <div className={`flex flex-col bg-card border-r border-border transition-all ${selectedOffer ? 'w-80' : 'flex-1 max-w-2xl'}`}>
          {/* Search + Filter */}
          <div className="px-4 py-3 space-y-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by lead or property..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-card text-muted-foreground border-border hover:border-accent/30'
                  }`}
                >
                  {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm font-semibold text-foreground">No offers yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first offer to start tracking deals</p>
                <Button onClick={() => setShowForm(true)} className="mt-3 bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-8">
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Offer
                </Button>
              </div>
            ) : (
              filtered.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  isSelected={selectedOffer?.id === offer.id}
                  onClick={() => setSelectedOffer(offer)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Detail */}
        {selectedOffer && (
          <div className="flex-1 overflow-hidden">
            <OfferDetailPanel
              offer={selectedOffer}
              onClose={() => setSelectedOffer(null)}
              onUpdate={(updated) => {
                setSelectedOffer(updated);
                queryClient.invalidateQueries({ queryKey: ['offers'] });
              }}
            />
          </div>
        )}
      </div>

      {showForm && (
        <OfferFormDialog
          onClose={() => setShowForm(false)}
          onCreated={(offer) => {
            queryClient.invalidateQueries({ queryKey: ['offers'] });
            setSelectedOffer(offer);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}