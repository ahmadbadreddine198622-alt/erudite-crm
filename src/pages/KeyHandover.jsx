import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Settings, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { toast } from 'sonner';
import HandoverItems from '@/components/handover/HandoverItems';
import { buildHandoverPDF } from '@/lib/buildHandoverPDF';

const HANDOVER_TYPES = {
  tenant_landlord: {
    label: 'Tenant to Landlord',
    fromLabel: 'HANDED OVER BY (LANDLORD)',
    toLabel: 'RECEIVED BY (TENANT)',
    toPreset: null,
  },
  tenant_agent: {
    label: 'Tenant to Erudite Agent',
    fromLabel: 'HANDED OVER BY (TENANT)',
    toLabel: 'RECEIVED BY (ERUDITE AGENT)',
    toPreset: { name: 'Ahmad Badreddine', contact: 'ahmad@erudite-estate.com' },
  },
  buyer_seller: {
    label: 'Buyer to Seller',
    fromLabel: 'SELLER / HANDED OVER BY',
    toLabel: 'BUYER / RECEIVED BY',
    toPreset: null,
  },
  generic: {
    label: 'Generic',
    fromLabel: 'HANDED OVER BY',
    toLabel: 'RECEIVED BY',
    toPreset: null,
  },
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function genRef() {
  const d = new Date().toISOString().replace(/-/g, '').slice(0, 8);
  const n = String(Math.floor(Math.random() * 900) + 100);
  return `EH-${d}-${n}`;
}

function useLocalAsset(key) {
  const [url, setUrl] = useState(() => localStorage.getItem(key) || '');
  const save = (dataUrl) => {
    localStorage.setItem(key, dataUrl);
    setUrl(dataUrl);
  };
  return [url, save];
}

function AssetUpload({ label, storageKey }) {
  const [url, save] = useLocalAsset(storageKey);
  const ref = useRef();
  const handle = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => save(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current.click()}
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        {url ? 'Replace' : 'Upload'} {label}
      </button>
      {url && (
        <img src={url} alt={label} className="h-8 object-contain rounded opacity-80" />
      )}
      <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handle} />
    </div>
  );
}

export default function KeyHandover() {
  const [handoverType, setHandoverType] = useState('generic');
  const typeConfig = HANDOVER_TYPES[handoverType];

  const [property, setProperty] = useState({
    address: '', building: '', unit: '', date: today(), reference: genRef(),
  });

  const [fromParty, setFromParty] = useState({ name: '', contact: '' });
  const [toParty, setToParty] = useState({ name: '', contact: '' });
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [logoUrl]  = useLocalAsset('erudite_logo');
  const [sigUrl]   = useLocalAsset('erudite_signature');
  const [stampUrl] = useLocalAsset('erudite_stamp');

  const setP = (k, v) => setProperty(p => ({ ...p, [k]: v }));

  const handleTypeChange = (t) => {
    setHandoverType(t);
    const preset = HANDOVER_TYPES[t].toPreset;
    if (preset) setToParty(preset);
    else setToParty({ name: '', contact: '' });
  };

  const handleGenerate = async () => {
    if (!property.address) { toast.error('Please enter a property address.'); return; }
    setGenerating(true);
    try {
      const doc = await buildHandoverPDF(
        {
          property,
          handoverType,
          fromLabel: typeConfig.fromLabel,
          toLabel: typeConfig.toLabel,
          fromParty,
          toParty,
          items,
          notes,
          eruditeAgent: 'Ahmad Badreddine',
        },
        { logoUrl, signatureUrl: sigUrl, stampUrl }
      );
      const lastName = (toParty.name || 'Recipient').trim().split(' ').pop();
      doc.save(`Erudite_KeyHandover_${lastName}.pdf`);
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF', { description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* App Header */}
      <div className="bg-card border-b border-border px-4 sm:px-8 py-4 flex items-center gap-4">
        {logoUrl && <img src={logoUrl} alt="Erudite" className="h-9 object-contain" />}
        <div>
          <h1 className="text-lg font-bold text-foreground">Key Access Handover Generator</h1>
          <p className="text-xs text-muted-foreground">Erudite Property Real Estate · ORN 29322</p>
        </div>
        <div className="ml-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(o => !o)}
            className="gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            Assets
            {settingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Assets settings panel */}
      {settingsOpen && (
        <div className="bg-card border-b border-border px-4 sm:px-8 py-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Upload Company Assets (saved in browser)
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Company Logo</Label>
              <AssetUpload label="Logo" storageKey="erudite_logo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Authorised Signature</Label>
              <AssetUpload label="Signature" storageKey="erudite_signature" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company Stamp</Label>
              <AssetUpload label="Stamp" storageKey="erudite_stamp" />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* Property Details */}
        <section>
          <div className="bg-[#2E4374] rounded-t-lg px-4 py-2.5">
            <h2 className="text-white text-sm font-bold uppercase tracking-wider">Property Details</h2>
          </div>
          <div className="bg-card border border-t-0 border-border rounded-b-lg p-5 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label>Property Address *</Label>
              <Input placeholder="Full property address" value={property.address}
                onChange={e => setP('address', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Building / Project</Label>
              <Input placeholder="e.g. Marquise Square Tower" value={property.building}
                onChange={e => setP('building', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Unit / Villa No.</Label>
              <Input placeholder="e.g. R-10" value={property.unit}
                onChange={e => setP('unit', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Handover Date</Label>
              <Input type="date" value={property.date}
                onChange={e => setP('date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Reference No.</Label>
              <div className="flex gap-2">
                <Input value={property.reference}
                  onChange={e => setP('reference', e.target.value)} />
                <Button type="button" size="sm" variant="outline"
                  onClick={() => setP('reference', genRef())}
                  className="shrink-0 text-xs">
                  New
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Parties */}
        <section>
          <div className="bg-[#2E4374] rounded-t-lg px-4 py-2.5 flex items-center gap-4">
            <h2 className="text-white text-sm font-bold uppercase tracking-wider">Parties</h2>
            <select
              className="ml-auto text-xs rounded border border-white/20 bg-white/10 text-white px-2 py-1 focus:outline-none"
              value={handoverType}
              onChange={e => handleTypeChange(e.target.value)}
            >
              {Object.entries(HANDOVER_TYPES).map(([k, v]) => (
                <option key={k} value={k} className="text-foreground bg-background">{v.label}</option>
              ))}
            </select>
          </div>
          <div className="bg-card border border-t-0 border-border rounded-b-lg p-5 grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Badge className="bg-[#2E4374] text-white text-xs border-0 rounded px-2 py-1">
                {typeConfig.fromLabel}
              </Badge>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={fromParty.name}
                  onChange={e => setFromParty(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Contact (phone / email)</Label>
                <Input value={fromParty.contact}
                  onChange={e => setFromParty(p => ({ ...p, contact: e.target.value }))}
                  placeholder="Phone or email" />
              </div>
            </div>
            <div className="space-y-3">
              <Badge className="bg-[#C9A24B] text-[#1a1d29] text-xs border-0 rounded px-2 py-1">
                {typeConfig.toLabel}
              </Badge>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={toParty.name}
                  onChange={e => setToParty(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Contact (phone / email)</Label>
                <Input value={toParty.contact}
                  onChange={e => setToParty(p => ({ ...p, contact: e.target.value }))}
                  placeholder="Phone or email" />
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section>
          <div className="bg-[#2E4374] rounded-t-lg px-4 py-2.5">
            <h2 className="text-white text-sm font-bold uppercase tracking-wider">Items Checklist</h2>
          </div>
          <div className="bg-card border border-t-0 border-border rounded-b-lg p-5">
            <HandoverItems items={items} onChange={setItems} />
          </div>
        </section>

        {/* Notes */}
        <section>
          <div className="bg-[#2E4374] rounded-t-lg px-4 py-2.5">
            <h2 className="text-white text-sm font-bold uppercase tracking-wider">
              Notes <span className="font-normal text-white/60 text-xs normal-case">(optional)</span>
            </h2>
          </div>
          <div className="bg-card border border-t-0 border-border rounded-b-lg p-5">
            <textarea
              className="w-full min-h-[80px] bg-transparent border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Any additional notes to include in the document..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </section>

        {/* Generate */}
        <div className="flex justify-end pt-2 pb-8">
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={generating}
            className="gap-2 bg-[#C9A24B] hover:bg-[#b8923c] text-[#1a1d29] font-bold px-8"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              : <><FileText className="w-4 h-4" /> Download Handover PDF</>
            }
          </Button>
        </div>

      </div>
    </div>
  );
}