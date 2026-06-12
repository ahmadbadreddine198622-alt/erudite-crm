import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIELDS = [
  { key: "company_name_en", label: "Company Name (EN)" },
  { key: "company_name_ar", label: "Company Name (AR)" },
  { key: "establishment",   label: "Legal Establishment Name" },
  { key: "address",         label: "Address" },
  { key: "po_box",          label: "P.O. Box" },
  { key: "phone",           label: "Phone" },
  { key: "whatsapp",        label: "WhatsApp" },
  { key: "email",           label: "Email" },
  { key: "website",         label: "Website" },
  { key: "orn",             label: "ORN" },
  { key: "brn",             label: "BRN" },
  { key: "ded_license",     label: "DED License" },
  { key: "trn",             label: "TRN" },
  { key: "brand_navy",      label: "Brand Navy (hex)" },
  { key: "brand_gold",      label: "Brand Gold (hex)" },
];

const ASSETS = [
  { key: "logo",      label: "Company Logo",  urlKey: "logo_url",      b64Key: "logo_base64" },
  { key: "signature", label: "Signature",      urlKey: "signature_url", b64Key: "signature_base64" },
  { key: "stamp",     label: "Official Stamp", urlKey: "stamp_url",     b64Key: "stamp_base64" },
];

async function urlToBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export default function CompanySettingsPage() {
  const [record, setRecord]     = useState(null);
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState({});
  const fileRefs                = { logo: useRef(), signature: useRef(), stamp: useRef() };

  useEffect(() => {
    base44.entities.CompanySettings.list().then((rows) => {
      const row = rows[0] || {};
      setRecord(row);
      setForm(row);
    });
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleAssetUpload = async (asset, file) => {
    setUploading((u) => ({ ...u, [asset.key]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const b64 = await urlToBase64(file_url);
      setForm((f) => ({ ...f, [asset.urlKey]: file_url, [asset.b64Key]: b64 }));
      toast.success(`${asset.label} uploaded`);
    } catch {
      toast.error(`Upload failed for ${asset.label}`);
    } finally {
      setUploading((u) => ({ ...u, [asset.key]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (record?.id) {
        await base44.entities.CompanySettings.update(record.id, form);
      } else {
        const created = await base44.entities.CompanySettings.create(form);
        setRecord(created);
      }
      toast.success("Company settings saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-root max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="page-title text-xl">Company Settings</h1>
          <p className="page-subtitle">Single source of truth for identity & brand assets</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Identity Fields */}
        <section className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-widest mb-4">Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  className="glass-input text-sm"
                  value={form[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Brand Assets */}
        <section className="glass-card p-6 space-y-6">
          <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-widest">Brand Assets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {ASSETS.map((asset) => (
              <div key={asset.key} className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">{asset.label}</p>
                <div className="aspect-video rounded-lg border border-border bg-secondary/30 flex items-center justify-center overflow-hidden">
                  {form[asset.urlKey]
                    ? <img src={form[asset.urlKey]} alt={asset.label} className="max-h-full max-w-full object-contain p-2" />
                    : <span className="text-xs text-muted-foreground">No image</span>
                  }
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRefs[asset.key]}
                  className="hidden"
                  onChange={(e) => e.target.files[0] && handleAssetUpload(asset, e.target.files[0])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={uploading[asset.key]}
                  onClick={() => fileRefs[asset.key].current?.click()}
                >
                  {uploading[asset.key]
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                    : <><Upload className="w-3 h-3" /> Replace</>
                  }
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}