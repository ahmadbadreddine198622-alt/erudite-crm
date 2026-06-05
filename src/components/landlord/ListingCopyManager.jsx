import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2, Star, TrendingUp, Users, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const ANGLE_CONFIG = {
  luxury: {
    label: 'Luxury / Lifestyle',
    icon: Star,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/8',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  investment: {
    label: 'Investment / ROI',
    icon: TrendingUp,
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/8',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  family: {
    label: 'Family / Practical',
    icon: Users,
    color: 'text-sky-400',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/8',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
};

export default function ListingCopyManager({ landlordId, landlordPropertyId, landlordProperty }) {
  const savedAngle = landlordProperty?.listing_angle || null;
  const savedTitle = landlordProperty?.listing_title || '';
  const savedDescription = landlordProperty?.listing_description || '';

  const [options, setOptions] = useState(null);
  const [edits, setEdits] = useState({});
  const [generating, setGenerating] = useState(false);
  const [savingAngle, setSavingAngle] = useState(null);
  const [copiedAngle, setCopiedAngle] = useState(null);

  const handleCopy = async (angle) => {
    const edited = edits[angle] || {};
    const opt = options?.find(o => o.angle === angle);
    const title = edited.title ?? opt?.title ?? '';
    const description = edited.description ?? opt?.description ?? '';
    await navigator.clipboard.writeText(`${title}\n\n${description}`);
    setCopiedAngle(angle);
    setTimeout(() => setCopiedAngle(null), 1500);
  };
  const [savedInfo, setSavedInfo] = useState(
    savedAngle ? { angle: savedAngle, title: savedTitle, description: savedDescription } : null
  );

  const handleGenerate = async () => {
    setGenerating(true);
    setOptions(null);
    setEdits({});
    try {
      const res = await base44.functions.invoke('generateListingCopy', { landlord_id: landlordId });
      const opts = res?.data?.options || res?.options || [];
      setOptions(opts);
      // pre-populate edits with generated text
      const initEdits = {};
      opts.forEach(o => {
        initEdits[o.angle] = { title: o.title, description: o.description };
      });
      setEdits(initEdits);
    } catch (err) {
      toast.error('Generation failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (angle) => {
    if (!landlordPropertyId) {
      toast.error('No property record linked to this landlord.');
      return;
    }
    const edited = edits[angle] || {};
    const opt = options?.find(o => o.angle === angle);
    const title = edited.title ?? opt?.title ?? '';
    const description = edited.description ?? opt?.description ?? '';

    setSavingAngle(angle);
    try {
      await base44.functions.invoke('saveChosenListing', {
        landlord_id: landlordId,
        landlord_property_id: landlordPropertyId,
        title,
        description,
        angle,
      });
      setSavedInfo({ angle, title, description });
      toast.success('Listing copy saved!');
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSavingAngle(null);
    }
  };

  const cfg = savedInfo ? ANGLE_CONFIG[savedInfo.angle] : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            AI Listing Copy
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-1.5 text-xs"
        >
          {generating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : options ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? 'Generating…' : options ? 'Re-generate' : 'Generate listing copy'}
        </Button>
      </div>

      {/* Currently saved copy — shown on load if exists */}
      {savedInfo && !options && (
        <div
          className="rounded-xl p-4 border space-y-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${cfg ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)'}` }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-400">Saved listing copy</span>
            {cfg && (
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${cfg.badge}`}>
                {cfg.label}
              </Badge>
            )}
          </div>
          <p className="text-sm font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>{savedInfo.title}</p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{savedInfo.description}</p>
          <p className="text-[10px] text-muted-foreground">Click "Generate listing copy" to create new options and re-choose.</p>
        </div>
      )}

      {/* 3 option cards */}
      {options && options.length > 0 && (
        <div className="space-y-3">
          {options.map((opt) => {
            const c = ANGLE_CONFIG[opt.angle] || ANGLE_CONFIG.luxury;
            const Icon = c.icon;
            const isSaved = savedInfo?.angle === opt.angle;
            const isSaving = savingAngle === opt.angle;
            const editedTitle = edits[opt.angle]?.title ?? opt.title;
            const editedDesc = edits[opt.angle]?.description ?? opt.description;

            return (
              <div
                key={opt.angle}
                className={`rounded-xl p-4 border space-y-3 transition-all ${isSaved ? 'ring-1 ring-emerald-500/50' : ''}`}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderColor: isSaved ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)',
                }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${c.color}`} />
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${c.badge}`}>
                      {c.label}
                    </Badge>
                    {isSaved && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Saved
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(opt.angle)}
                      className="gap-1 text-xs h-7 px-2"
                      style={{ color: copiedAngle === opt.angle ? 'rgb(52,211,153)' : 'rgba(255,255,255,0.5)' }}
                      title="Copy title + description"
                    >
                      {copiedAngle === opt.angle ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedAngle === opt.angle ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(opt.angle)}
                      disabled={isSaving || savingAngle !== null}
                      className="gap-1.5 text-xs h-7"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {isSaving ? 'Saving…' : isSaved ? 'Re-save' : 'Use this one'}
                    </Button>
                  </div>
                </div>

                {/* Editable title */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Title</p>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEdits(prev => ({
                      ...prev,
                      [opt.angle]: { ...prev[opt.angle], title: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'hsl(38 92% 58%)',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Editable description */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Description</p>
                  <textarea
                    rows={5}
                    value={editedDesc}
                    onChange={(e) => setEdits(prev => ({
                      ...prev,
                      [opt.angle]: { ...prev[opt.angle], description: e.target.value }
                    }))}
                    className="w-full px-3 py-2 text-xs leading-relaxed rounded-lg resize-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.82)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when no options generated and nothing saved */}
      {!options && !savedInfo && !generating && (
        <p className="text-xs text-muted-foreground pl-1">
          Click "Generate listing copy" to create AI-written listing options for this unit.
        </p>
      )}
    </div>
  );
}