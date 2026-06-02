import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'office', 'retail'];
const DUBAI_AREAS = [
  'Downtown Dubai', 'Dubai Marina', 'Palm Jumeirah', 'Business Bay', 'JVC',
  'Arabian Ranches', 'DIFC', 'Dubai Hills', 'Jumeirah', 'Al Barsha',
  'Meydan', 'Dubai Creek Harbour', 'Bluewaters', 'Emaar Beachfront', 'MBR City',
];

const inputCls = `w-full px-3 py-2 rounded-lg text-sm outline-none
  bg-white/5 border border-white/10 text-white placeholder-white/30
  focus:border-amber-500/50 focus:bg-white/8 transition-all`;

const labelCls = 'block text-xs font-semibold uppercase tracking-wider mb-1.5 text-white/40';

export default function ClientBriefForm({ leads = [], onSearch, onClose, loading }) {
  const [brief, setBrief] = useState({
    property_type: 'apartment',
    transaction: 'sale',
    location: '',
    building: '',
    bedrooms: '2',
    budget_min: '',
    budget_max: '',
    size_min: '',
    size_max: '',
    ready_only: false,
    client_id: '',
  });

  const set = (k, v) => setBrief(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({
      ...brief,
      bedrooms: brief.bedrooms ? parseInt(brief.bedrooms) : undefined,
      budget_min: brief.budget_min ? parseInt(brief.budget_min) : undefined,
      budget_max: brief.budget_max ? parseInt(brief.budget_max) : undefined,
      size_min: brief.size_min ? parseInt(brief.size_min) : undefined,
      size_max: brief.size_max ? parseInt(brief.size_max) : undefined,
    }, brief.client_id);
  };

  return (
    <div className="glass-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Client Brief</h3>
          <p className="text-xs text-white/40 mt-0.5">Search internal DB first, then escalate to live market</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Transaction</label>
            <div className="flex gap-2">
              {['sale', 'lease'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('transaction', t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all border ${
                    brief.transaction === t
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Property Type</label>
            <select value={brief.property_type} onChange={e => set('property_type', e.target.value)} className={inputCls}>
              {PROPERTY_TYPES.map(t => (
                <option key={t} value={t} className="bg-slate-900">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Area / Community</label>
            <input
              list="dubai-areas"
              value={brief.location}
              onChange={e => set('location', e.target.value)}
              placeholder="e.g. Dubai Marina"
              className={inputCls}
            />
            <datalist id="dubai-areas">
              {DUBAI_AREAS.map(a => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Building (optional)</label>
            <input value={brief.building} onChange={e => set('building', e.target.value)} placeholder="e.g. Marina Gate" className={inputCls} />
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Bedrooms</label>
            <select value={brief.bedrooms} onChange={e => set('bedrooms', e.target.value)} className={inputCls}>
              <option value="" className="bg-slate-900">Any</option>
              {['0', '1', '2', '3', '4', '5'].map(b => (
                <option key={b} value={b} className="bg-slate-900">{b === '0' ? 'Studio' : `${b} BR`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Budget Min (AED)</label>
            <input type="number" value={brief.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Budget Max (AED)</label>
            <input type="number" value={brief.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder="5,000,000" className={inputCls} />
          </div>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Link to Pipeline Client</label>
            <select value={brief.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
              <option value="" className="bg-slate-900">— No client —</option>
              {leads.map(l => (
                <option key={l.id} value={l.id} className="bg-slate-900">{l.full_name} {l.phone ? `(${l.phone})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={brief.ready_only}
                onChange={e => set('ready_only', e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-xs text-white/60">Ready properties only</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search Properties
            </>
          )}
        </button>
      </form>
    </div>
  );
}