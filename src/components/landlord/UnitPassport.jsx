import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Building2, Layers, SquareStack, Bed, Ruler, DollarSign, Key, Home,
  ShieldCheck, ShieldAlert, Camera, FileText, AlertTriangle, CheckCircle2, Clock, Ban
} from 'lucide-react';

// Derive floor from unit_no: "2511" → 25, "713" → 7, "313" → 3
function deriveFloor(unit_no) {
  if (!unit_no) return null;
  const s = String(unit_no).trim();
  const part = s.includes('-') ? s.split('-').pop() : s;
  const n = parseInt(part, 10);
  if (isNaN(n)) return null;
  const digits = String(n).length;
  if (digits <= 2) return n;
  return Math.floor(n / 100);
}

function InfoRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-xs text-white/50">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        {label}
      </div>
      <span className={`text-xs font-semibold ${highlight || 'text-white/85'}`}>{value || '—'}</span>
    </div>
  );
}

const STATUS_ICONS = {
  sole_owner: { icon: ShieldCheck, color: 'text-emerald-400' },
  joint_owner: { icon: ShieldAlert, color: 'text-amber-400' },
  power_of_attorney: { icon: FileText, color: 'text-blue-400' },
};

const TENANCY_COLORS = {
  vacant: 'text-emerald-400',
  tenanted_ejari_valid: 'text-amber-400',
  tenanted_ejari_expiring: 'text-orange-400',
  tenanted_eviction_notice_served: 'text-red-400',
  owner_occupied: 'text-blue-400',
};

const MORTGAGE_COLORS = {
  free_hold_no_mortgage: 'text-emerald-400',
  mortgaged_local_bank: 'text-amber-400',
  mortgaged_overseas: 'text-amber-400',
  developer_payment_plan: 'text-blue-400',
  lease_to_own: 'text-purple-400',
};

const PHOTO_ICONS = {
  none: { icon: Ban, color: 'text-red-400' },
  phone_quality: { icon: Camera, color: 'text-amber-400' },
  professional_done: { icon: CheckCircle2, color: 'text-emerald-400' },
  scheduled: { icon: Clock, color: 'text-blue-400' },
};

export default function UnitPassport({ landlordId }) {
  const { data: links = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['landlord_properties', landlordId],
    queryFn: () => base44.entities.LandlordProperty.filter({ landlord_id: landlordId }, '-created_date', 10),
    enabled: !!landlordId,
  });

  const propertyIds = links.map(l => l.property_id).filter(Boolean);

  const { data: properties = [], isLoading: loadingProps } = useQuery({
    queryKey: ['properties_for_landlord', ...propertyIds],
    queryFn: () => base44.entities.Property.list(),
    enabled: propertyIds.length > 0,
    select: (all) => all.filter(p => propertyIds.includes(p.id)),
  });

  if (loadingLinks || loadingProps) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/30 text-xs">
        <div className="w-4 h-4 border border-white/20 border-t-amber-400 rounded-full animate-spin" />
        Loading property data...
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="py-6 text-center">
        <Building2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
        <p className="text-xs text-white/30">No linked property units</p>
        <p className="text-[10px] text-white/20 mt-1">Run the unit sync or link a property manually</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {links.map((link, idx) => {
        const prop = properties.find(p => p.id === link.property_id);
        const floor = prop ? deriveFloor(prop.unit_no) : null;
        const layoutLabel = !prop ? null
          : prop.property_type === 'studio' ? 'Studio'
          : prop.bedrooms === 1 ? '1 BR'
          : prop.bedrooms === 2 ? '2 BR'
          : prop.bedrooms === 3 ? '3 BR'
          : prop.bedrooms >= 4 ? `${prop.bedrooms} BR`
          : null;

        const RoleIcon = STATUS_ICONS[link.role]?.icon || ShieldCheck;
        const roleColor = STATUS_ICONS[link.role]?.color || 'text-white/60';
        const PhotoIcon = PHOTO_ICONS[link.photography_status]?.icon || Ban;
        const photoColor = PHOTO_ICONS[link.photography_status]?.color || 'text-white/30';

        return (
          <div
            key={link.id || idx}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            {/* Unit header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <SquareStack className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">
                  {prop ? `Unit ${prop.unit_no}` : `Property ${idx + 1}`}
                </span>
                {floor !== null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white/8 text-white/50">
                    Floor {floor}
                  </span>
                )}
                {layoutLabel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-400">
                    {layoutLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <RoleIcon className={`w-3.5 h-3.5 ${roleColor}`} />
                <span className={`text-[10px] font-semibold ${roleColor}`}>
                  {(link.role || 'owner').replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Property details */}
            <div className="px-4 pt-1 pb-2">
              {prop && (
                <>
                  <InfoRow icon={Ruler} label="Size" value={prop.area_sqft ? `${Number(prop.area_sqft).toLocaleString()} sqft` : null} />
                  <InfoRow icon={Building2} label="Building" value={prop.building_name} />
                  {prop.view && <InfoRow icon={Layers} label="View" value={prop.view} />}
                  {(prop.price_aed || prop.rent_aed) && (
                    <InfoRow
                      icon={DollarSign}
                      label={prop.listing_type === 'rent' ? 'Listed Rent' : 'Listed Price'}
                      value={`AED ${Number(prop.price_aed || prop.rent_aed).toLocaleString()}`}
                      highlight="text-amber-400"
                    />
                  )}
                  <InfoRow
                    icon={prop.status === 'available' ? CheckCircle2 : Clock}
                    label="Listing Status"
                    value={prop.status?.replace(/_/g, ' ')}
                    highlight={prop.status === 'available' ? 'text-emerald-400' : 'text-white/60'}
                  />
                </>
              )}

              {/* Ownership & financial */}
              {link.ownership_pct && (
                <InfoRow icon={ShieldCheck} label="Ownership %" value={`${link.ownership_pct}%`} />
              )}
              {link.mortgage_status && (
                <InfoRow
                  icon={DollarSign}
                  label="Mortgage"
                  value={link.mortgage_status.replace(/_/g, ' ')}
                  highlight={MORTGAGE_COLORS[link.mortgage_status]}
                />
              )}
              {link.mortgage_balance_aed && (
                <InfoRow icon={DollarSign} label="Mortgage Balance" value={`AED ${Number(link.mortgage_balance_aed).toLocaleString()}`} highlight="text-orange-400" />
              )}
              {link.mortgage_bank && (
                <InfoRow icon={Building2} label="Mortgage Bank" value={link.mortgage_bank} />
              )}

              {/* Tenancy */}
              {link.tenancy_status && (
                <InfoRow
                  icon={Home}
                  label="Tenancy"
                  value={link.tenancy_status.replace(/_/g, ' ')}
                  highlight={TENANCY_COLORS[link.tenancy_status]}
                />
              )}
              {link.current_rent_aed && (
                <InfoRow icon={DollarSign} label="Current Rent" value={`AED ${Number(link.current_rent_aed).toLocaleString()}/yr`} />
              )}
              {link.lease_end_date && (
                <InfoRow
                  icon={Clock}
                  label="Lease End"
                  value={new Date(link.lease_end_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  highlight={new Date(link.lease_end_date) < new Date(Date.now() + 90 * 86400000) ? 'text-orange-400' : 'text-white/85'}
                />
              )}
              {link.currently_occupied !== null && link.currently_occupied !== undefined && (
                <InfoRow
                  icon={link.currently_occupied ? Home : Key}
                  label="Occupied?"
                  value={link.currently_occupied ? 'Yes — Tenanted' : 'No — Vacant'}
                  highlight={link.currently_occupied ? 'text-amber-400' : 'text-emerald-400'}
                />
              )}

              {/* Documents & Media */}
              {link.title_deed_number && (
                <InfoRow icon={FileText} label="Title Deed No." value={link.title_deed_number} />
              )}
              <InfoRow
                icon={link.title_deed_verified ? CheckCircle2 : AlertTriangle}
                label="Title Deed"
                value={link.title_deed_verified ? 'Verified' : 'Not verified'}
                highlight={link.title_deed_verified ? 'text-emerald-400' : 'text-amber-400'}
              />
              {link.oqood_number && (
                <InfoRow icon={FileText} label="Oqood No." value={link.oqood_number} />
              )}

              {/* Service charges */}
              {link.service_charge_status && (
                <InfoRow
                  icon={link.service_charge_status === 'clear' ? CheckCircle2 : AlertTriangle}
                  label="Service Charge"
                  value={link.service_charge_status.replace(/_/g, ' ')}
                  highlight={link.service_charge_status === 'clear' ? 'text-emerald-400' : 'text-red-400'}
                />
              )}
              {link.service_charge_arrears_aed && (
                <InfoRow icon={DollarSign} label="SC Arrears" value={`AED ${Number(link.service_charge_arrears_aed).toLocaleString()}`} highlight="text-red-400" />
              )}

              {/* Media / readiness */}
              <InfoRow
                icon={PhotoIcon}
                label="Photography"
                value={(link.photography_status || 'none').replace(/_/g, ' ')}
                highlight={photoColor}
              />
              <div className="flex gap-2 pt-2 flex-wrap">
                {link.has_360_tour && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">360° Tour</span>}
                {link.has_drone_footage && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">Drone Footage</span>}
                {link.has_video_walkthrough && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold">Video Walkthrough</span>}
                {link.has_floor_plan && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold">Floor Plan</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}