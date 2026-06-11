import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, Search, Building2, Home, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Generates the next DEAL-XXXX reference by scanning existing deal_references.
 */
async function getNextDealReference() {
  const deals = await base44.entities.Deal.list('-created_date', 200);
  let max = 0;
  for (const d of deals) {
    const ref = d.deal_reference;
    if (ref && ref.startsWith('DEAL-')) {
      const n = parseInt(ref.replace('DEAL-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `DEAL-${String(max + 1).padStart(4, '0')}`;
}

export default function LinkToListingDialog({ lead, trigger }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [linking, setLinking] = useState(false);
  const queryClient = useQueryClient();

  // Load landlords + their properties
  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords-for-link'],
    queryFn: () => base44.entities.Landlord.list('full_name_en', 500),
    enabled: open,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['landlord-properties-for-link'],
    queryFn: () => base44.entities.LandlordProperty.list('-created_date', 500),
    enabled: open,
  });

  // Existing deal for this lead (to update rather than duplicate)
  const { data: existingDeals = [] } = useQuery({
    queryKey: ['deals-for-lead', lead.id],
    queryFn: () => base44.entities.Deal.filter({ lead_id: lead.id }, '-created_date', 5),
    enabled: open && !!lead.id,
  });

  // Flatten units with landlord info for searching
  const enrichedUnits = useMemo(() => {
    const landlordMap = Object.fromEntries(landlords.map(l => [l.id, l]));
    return units.map(u => ({
      ...u,
      landlord: landlordMap[u.landlord_id] || null,
    }));
  }, [landlords, units]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return enrichedUnits.slice(0, 40);
    return enrichedUnits.filter(u => {
      const ll = u.landlord;
      return (
        u.title_deed_number?.toLowerCase().includes(q) ||
        (ll?.full_name_en?.toLowerCase().includes(q)) ||
        (ll?.project_name?.toLowerCase().includes(q)) ||
        (ll?.unit_reference?.toLowerCase().includes(q)) ||
        u.listing_title?.toLowerCase().includes(q)
      );
    }).slice(0, 40);
  }, [enrichedUnits, search]);

  const handleLink = async () => {
    if (!selectedUnit) return;
    setLinking(true);
    try {
      const user = await base44.auth.me();
      const existingDeal = existingDeals[0] || null;

      const payload = {
        landlord_id: selectedUnit.landlord_id,
        landlord_property_id: selectedUnit.id,
        property_id: selectedUnit.property_id || null,
      };

      if (existingDeal) {
        await base44.entities.Deal.update(existingDeal.id, payload);
        toast.success(`Deal ${existingDeal.deal_reference || existingDeal.id.slice(-6)} linked to listing.`);
      } else {
        const ref = await getNextDealReference();
        const ll = selectedUnit.landlord;
        await base44.entities.Deal.create({
          lead_id: lead.id,
          lead_name: lead.name || lead.full_name || '',
          client_phone: lead.phone || '',
          client_whatsapp: lead.whatsapp || lead.phone || '',
          assigned_agent_email: lead.assigned_agent_email || user?.email || '',
          agent_name: lead.assigned_agent_name || user?.full_name || '',
          deal_reference: ref,
          stage: 'discovery',
          deal_type: 'sale_secondary',
          property_ref: ll?.unit_reference || selectedUnit.title_deed_number || '',
          ...payload,
        });
        toast.success(`Deal ${ref} created and linked.`);
      }

      queryClient.invalidateQueries({ queryKey: ['deals-for-lead', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setOpen(false);
      setSelectedUnit(null);
      setSearch('');
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setLinking(false);
    }
  };

  const existingDeal = existingDeals[0] || null;

  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 overflow-hidden"
          style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 480, borderRadius: 16 }}
        >
          <DialogTitle className="sr-only">Link to Listing</DialogTitle>

          {/* Header */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <h2 className="font-semibold text-white text-sm">Link to Listing</h2>
            </div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {lead.name} → pick a landlord unit to connect
            </p>
            {existingDeal && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[10px] flex items-center gap-1.5"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'hsl(38 92% 60%)' }}>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                Existing deal <strong>{existingDeal.deal_reference || existingDeal.id.slice(-6)}</strong> will be updated (not duplicated)
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by owner, project, unit ref, title deed…"
                className="pl-8 h-9 text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
                autoFocus
              />
            </div>
          </div>

          {/* Unit list */}
          <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: 320 }}>
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-[11px] text-muted-foreground">
                No units found
              </div>
            ) : (
              filtered.map(u => {
                const ll = u.landlord;
                const selected = selectedUnit?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUnit(u)}
                    className="w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-start gap-3 transition-all"
                    style={{
                      background: selected ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: selected ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)' }}>
                      <Building2 className="w-4 h-4" style={{ color: selected ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.4)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: selected ? 'hsl(38 92% 60%)' : 'rgba(255,255,255,0.85)' }}>
                        {ll?.full_name_en || 'Unknown Owner'}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {ll?.project_name && (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {ll.project_name}
                          </span>
                        )}
                        {ll?.unit_reference && (
                          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {ll.unit_reference}
                          </span>
                        )}
                        {ll?.asking_price_aed && (
                          <span className="text-[10px]" style={{ color: 'hsl(38 92% 55%)' }}>
                            AED {Number(ll.asking_price_aed).toLocaleString()}
                          </span>
                        )}
                        {u.listing_production_stage && (
                          <span className="text-[10px] capitalize" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {u.listing_production_stage.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(38 92% 55%)' }} />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] px-3 py-1.5 rounded-lg transition"
              style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Cancel
            </button>
            <Button
              disabled={!selectedUnit || linking}
              onClick={handleLink}
              className="h-9 text-sm font-semibold"
              style={{ background: selectedUnit ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.08)', color: selectedUnit ? '#000' : 'rgba(255,255,255,0.3)', border: 'none' }}
            >
              {linking
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Linking…</>
                : <><Link2 className="w-3.5 h-3.5 mr-1.5" /> {existingDeal ? 'Update Deal' : 'Create & Link Deal'}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}