import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Crown, ShieldCheck, ShieldAlert, Shield, RefreshCw, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const INFLUENCE_CONFIG = {
  decision_maker: { color: 'bg-amber-500',   border: 'border-amber-500/50',   label: 'Decision Maker', icon: Crown,       text: 'text-amber-400' },
  influencer:     { color: 'bg-blue-500',    border: 'border-blue-500/50',    label: 'Influencer',     icon: ShieldCheck, text: 'text-blue-400' },
  blocker:        { color: 'bg-red-500',     border: 'border-red-500/50',     label: 'Blocker',        icon: ShieldAlert, text: 'text-red-400' },
  neutral:        { color: 'bg-slate-500',   border: 'border-slate-500/50',   label: 'Neutral',        icon: Shield,      text: 'text-slate-400' },
};

const ROLE_OPTIONS = ['spouse', 'sibling', 'business_partner', 'lawyer', 'financial_advisor', 'child', 'parent', 'property_manager', 'other'];
const INFLUENCE_OPTIONS = ['decision_maker', 'influencer', 'blocker', 'neutral'];

const EMPTY_FORM = { name: '', role: 'spouse', influence: 'influencer', notes: '' };

function AddStakeholderModal({ landlordId, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await base44.entities.LandlordStakeholder.create({
        landlord_id: landlordId,
        name: form.name.trim(),
        role: form.role,
        influence: form.influence,
        notes: form.notes,
        source: 'manual',
        decision_power: form.influence === 'decision_maker' ? 90 : form.influence === 'influencer' ? 60 : form.influence === 'blocker' ? 70 : 30,
        sentiment: form.influence === 'blocker' ? 'skeptical' : 'neutral',
      });
      toast.success('Stakeholder added');
      onSuccess();
      onClose();
    } catch (e) {
      toast.error('Failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-80 rounded-xl p-5 space-y-4 shadow-2xl" style={{ background: 'hsl(222 47% 13%)', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Add Stakeholder</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Name / Descriptor</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Wife, Brother Ahmed, Lawyer"
              className="w-full px-3 py-1.5 text-sm rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Relationship</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Influence</label>
              <select
                value={form.influence}
                onChange={e => setForm(f => ({ ...f, influence: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                {INFLUENCE_OPTIONS.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any context about this person…"
              rows={2}
              className="w-full px-3 py-1.5 text-xs rounded-lg resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function StakeholderChip({ stakeholder, onDelete, onEdit }) {
  const cfg = INFLUENCE_CONFIG[stakeholder.influence] || INFLUENCE_CONFIG[stakeholder.sentiment] || INFLUENCE_CONFIG.neutral;
  const Icon = cfg.icon;
  const initials = (stakeholder.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all border ${cfg.border}`} style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className={`w-7 h-7 rounded-full ${cfg.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{stakeholder.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{(stakeholder.role || '').replace(/_/g, ' ')}</p>
          </div>
          <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.text}`} />
          {stakeholder.source === 'auto' && (
            <span className="text-[9px] px-1 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: 'rgb(167,139,250)' }}>AI</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" style={{ background: 'hsl(222 47% 13%)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${cfg.color} flex items-center justify-center text-[10px] font-bold text-white`}>{initials}</div>
            <div>
              <p className="text-xs font-semibold text-foreground">{stakeholder.name}</p>
              <p className={`text-[10px] capitalize ${cfg.text}`}>{cfg.label}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { onEdit(stakeholder); setOpen(false); }} className="p-1 rounded hover:bg-white/10"><Edit2 className="w-3 h-3 text-muted-foreground" /></button>
            <button onClick={() => { onDelete(stakeholder.id); setOpen(false); }} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3 h-3 text-red-400" /></button>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-1">
          <p><span className="text-white/50">Role:</span> {(stakeholder.role || '').replace(/_/g, ' ')}</p>
          <p><span className="text-white/50">Influence:</span> {(stakeholder.influence || '').replace(/_/g, ' ')}</p>
          {stakeholder.decision_power != null && <p><span className="text-white/50">Power:</span> {stakeholder.decision_power}/100</p>}
        </div>
        {stakeholder.supporting_quote && (
          <div className="rounded p-2 text-xs italic" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.7)' }}>
            "{stakeholder.supporting_quote}"
          </div>
        )}
        {stakeholder.notes && (
          <p className="text-xs text-muted-foreground">{stakeholder.notes}</p>
        )}
        {stakeholder.claude_strategy && (
          <div className="rounded p-2 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'hsl(38 92% 65%)' }}>
            <p className="text-[9px] uppercase tracking-widest mb-1 font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>Strategy</p>
            {stakeholder.claude_strategy}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function CoalitionMap({ landlord }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const { data: stakeholders = [] } = useQuery({
    queryKey: ['stakeholders', landlord.id],
    queryFn: () => base44.entities.LandlordStakeholder.filter({ landlord_id: landlord.id }),
    enabled: !!landlord?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LandlordStakeholder.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stakeholders', landlord.id] }); toast.success('Removed'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      const res = await base44.functions.invoke('detectLandlordStakeholders', { landlord_id: landlord.id });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      const added = d?.added || 0;
      const skipped = d?.skipped || 0;
      toast.success(added > 0 ? `Found ${added} new stakeholder${added > 1 ? 's' : ''} (${skipped} already known)` : 'No new stakeholders detected');
      qc.invalidateQueries({ queryKey: ['stakeholders', landlord.id] });
    } catch (e) {
      toast.error('Detection failed: ' + e.message);
    } finally {
      setDetecting(false);
    }
  };

  // Sort: decision makers first, then by decision_power desc
  const sorted = [...stakeholders].sort((a, b) => {
    const order = { decision_maker: 0, influencer: 1, blocker: 2, neutral: 3 };
    const oa = order[a.influence] ?? order[a.sentiment] ?? 3;
    const ob = order[b.influence] ?? order[b.sentiment] ?? 3;
    if (oa !== ob) return oa - ob;
    return (b.decision_power || 0) - (a.decision_power || 0);
  });

  return (
    <>
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.18)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgb(167,139,250)' }}>
            <Users className="w-4 h-4" /> Coalition Map
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.2)', color: 'rgb(167,139,250)' }}>{stakeholders.length}</span>
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleAutoDetect}
              disabled={detecting}
              title="Auto-detect stakeholders from messages"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${detecting ? 'animate-spin text-violet-400' : 'text-muted-foreground'}`} />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(139,92,246,0.15)', color: 'rgb(167,139,250)', border: '1px solid rgba(139,92,246,0.25)' }}
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>

        {/* Primary contact */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, hsl(38 92% 50%), hsl(38 92% 35%))' }}>
            {(landlord.full_name_en || landlord.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{landlord.full_name_en || landlord.full_name}</p>
            <p className="text-[10px] text-muted-foreground">Primary contact</p>
          </div>
          <Crown className="w-3.5 h-3.5 ml-auto" style={{ color: 'hsl(38 92% 55%)' }} />
        </div>

        {stakeholders.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground space-y-1">
            <p>No stakeholders mapped yet.</p>
            <p className="text-[11px]">Click <RefreshCw className="inline w-3 h-3" /> to auto-detect from messages (e.g. "I'll ask my wife").</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((s) => (
              <StakeholderChip
                key={s.id}
                stakeholder={s}
                onDelete={(id) => deleteMutation.mutate(id)}
                onEdit={setEditTarget}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddStakeholderModal
          landlordId={landlord.id}
          onClose={() => setShowAdd(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['stakeholders', landlord.id] })}
        />
      )}
    </>
  );
}