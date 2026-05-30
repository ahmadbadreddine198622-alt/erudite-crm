import React from 'react';
import { Trash2, Key, CreditCard, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPE_STYLES = {
  Key:             'bg-blue-900/40 text-blue-200 border-blue-700/40',
  'Access Card':   'bg-emerald-900/40 text-emerald-200 border-emerald-700/40',
  'Smart Lock Code': 'bg-amber-900/40 text-amber-200 border-amber-700/40',
};

const STANDARD_HOUSE = [
  { type: 'Key',             description: 'Main Entrance Key',      qty: 1, remarks: '' },
  { type: 'Key',             description: 'Hall Door Key',           qty: 1, remarks: '' },
  { type: 'Key',             description: 'Master Bedroom',          qty: 1, remarks: '' },
  { type: 'Key',             description: 'Bedroom 2',               qty: 1, remarks: '' },
  { type: 'Key',             description: 'Bedroom 3',               qty: 1, remarks: '' },
  { type: 'Key',             description: 'Kitchen Door Key',        qty: 1, remarks: '' },
  { type: 'Key',             description: 'Bathroom',                qty: 1, remarks: '' },
  { type: 'Key',             description: 'Balcony',                 qty: 1, remarks: '' },
  { type: 'Key',             description: 'Maid / Store Room',       qty: 1, remarks: '' },
  { type: 'Key',             description: 'Meter Box Key',           qty: 1, remarks: '' },
  { type: 'Key',             description: 'Mailbox Key',             qty: 1, remarks: '' },
  { type: 'Access Card',     description: 'Building Access Card',    qty: 2, remarks: '' },
  { type: 'Access Card',     description: 'Parking Access Card',     qty: 1, remarks: '' },
  { type: 'Smart Lock Code', description: 'Front Door Smart Lock',   qty: 1, remarks: '' },
];

export default function HandoverItems({ items, onChange }) {
  const add = (type) => onChange([...items, { type, description: '', qty: 1, remarks: '' }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, field, value) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => add('Key')}
          className="gap-1.5 border-blue-700/50 text-blue-300 hover:bg-blue-900/30">
          <Key className="w-3.5 h-3.5" /> Door Key
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => add('Access Card')}
          className="gap-1.5 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/30">
          <CreditCard className="w-3.5 h-3.5" /> Access Card
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => add('Smart Lock Code')}
          className="gap-1.5 border-amber-700/50 text-amber-300 hover:bg-amber-900/30">
          <Lock className="w-3.5 h-3.5" /> Smart Lock Code
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(STANDARD_HOUSE)}
          className="gap-1.5 border-accent/50 text-accent hover:bg-accent/10 ml-auto">
          <Zap className="w-3.5 h-3.5" /> Load Standard House
        </Button>
      </div>

      {/* Table header */}
      {items.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-0 bg-secondary/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
            <div className="col-span-3">Type</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-3">Remarks / Code</div>
            <div className="col-span-1" />
          </div>

          <div className="divide-y divide-border">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-secondary/20">
                {/* Type badge */}
                <div className="col-span-3">
                  <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${TYPE_STYLES[item.type] || ''}`}>
                    {item.type}
                  </span>
                </div>
                {/* Description */}
                <div className="col-span-4">
                  <Input
                    value={item.description}
                    onChange={e => update(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="h-7 text-xs"
                  />
                </div>
                {/* Qty (hidden for Smart Lock) */}
                <div className="col-span-1 flex justify-center">
                  {item.type !== 'Smart Lock Code' ? (
                    <Input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={e => update(i, 'qty', parseInt(e.target.value) || 1)}
                      className="h-7 text-xs text-center w-12"
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
                {/* Remarks / Code */}
                <div className="col-span-3">
                  <Input
                    value={item.remarks}
                    onChange={e => update(i, 'remarks', e.target.value)}
                    placeholder={item.type === 'Smart Lock Code' ? 'PIN / Code' : 'Remarks'}
                    className="h-7 text-xs"
                  />
                </div>
                {/* Delete */}
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => remove(i)}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="border border-dashed border-border rounded-lg py-8 text-center text-muted-foreground text-sm">
          No items yet — add keys, cards or lock codes above, or load the standard house set.
        </div>
      )}
    </div>
  );
}