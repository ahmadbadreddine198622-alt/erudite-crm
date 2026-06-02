import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeButton from '@/components/erudite/EruditeButton';
import ClientBriefForm from '@/components/propertyintel/ClientBriefForm';
import DeepLinkResults from '@/components/propertyintel/DeepLinkResults';
import { Building, Search, TrendingUp, MapPin, X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PropertyIntel() {
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [whatsappDraft, setWhatsappDraft] = useState(null);

  const stats = {
    tracked: 1248,
    priceChanges: 34,
    newListings: 156,
    avgPriceSqft: 1850,
  };

  const { data: leads = [] } = useQuery({
    queryKey: ['leads_for_brief'],
    queryFn: () => base44.entities.Lead.filter({ status: 'active' }, '-updated_date', 50),
    initialData: [],
  });

  const handleSearch = async (brief, clientId) => {
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await base44.functions.invoke('liveMarketSearch', {
        brief,
        client_id: clientId || undefined,
      });
      setSearchResults(res.data);
    } catch (err) {
      toast.error('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSearching(false);
    }
  };

  const handleWhatsApp = (portal) => {
    const results = searchResults;
    const brief = results?.brief_summary || '';
    const msg = `Hi! I've been searching the market for you and found some great current options.\n\n🔍 Search: ${brief}\n\n📲 Live results on ${portal.name}:\n${portal.url}\n\nI'll give you a call shortly to walk you through the best ones. Does that work for you?`;
    setWhatsappDraft(msg);
  };

  return (
    <EruditePage
      title="Property Intel"
      subtitle="Research and discovery engine"
      actions={
        <EruditeButton icon={Search} onClick={() => { setShowSearch(v => !v); setSearchResults(null); }}>
          New Search
        </EruditeButton>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Properties Tracked" value={stats.tracked.toLocaleString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Price Changes" value={stats.priceChanges.toString()} trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="New Listings" value={stats.newListings.toString()} trend="up" trendValue="+8%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Price/Sqft" value={`AED ${stats.avgPriceSqft.toLocaleString()}`} trend="up" trendValue="+2%" />
          </div>
        </EruditeCard>
      </div>

      {/* Search Section */}
      <EruditeSection title="Property Search" subtitle="Discovery" icon={MapPin}>
        {(showSearch || searchResults) && (
          <ClientBriefForm
            leads={leads}
            onSearch={handleSearch}
            onClose={() => { setShowSearch(false); setSearchResults(null); }}
            loading={searching}
          />
        )}

        {!showSearch && !searchResults && (
          <div className="text-center py-12">
            <Building className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40 mb-4">Search internal database or escalate to live market</p>
            <button
              onClick={() => setShowSearch(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-all"
            >
              Start New Search
            </button>
          </div>
        )}

        {searching && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-sm text-white/40">Checking internal database, then live market…</p>
          </div>
        )}

        {searchResults && !searching && (
          <DeepLinkResults
            results={searchResults}
            onDraftWhatsApp={handleWhatsApp}
          />
        )}
      </EruditeSection>

      {/* WhatsApp draft modal */}
      {whatsappDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-5 max-w-md w-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">WhatsApp Draft</span>
              </div>
              <button onClick={() => setWhatsappDraft(null)} className="text-white/30 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              className="w-full h-48 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white/80 resize-none outline-none focus:border-amber-500/40 font-mono"
              value={whatsappDraft}
              onChange={e => setWhatsappDraft(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { navigator.clipboard.writeText(whatsappDraft); toast.success('Copied!'); }}
                className="flex-1 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all"
              >
                Copy Message
              </button>
              <button
                onClick={() => setWhatsappDraft(null)}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-semibold hover:text-white/60 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Market Trends */}
      <EruditeSection title="Market Trends" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Property market trends and pricing analytics will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}