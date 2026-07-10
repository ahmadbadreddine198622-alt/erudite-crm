import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Upload, Wrench } from "lucide-react";

const DEFAULTS = {
  company_name_en: "ERUDITE REAL ESTATE",
  company_name_ar: "اﻹرودايت للعقارات",
  establishment: "Erudite Property (Erudite Real Estate)",
  address: "Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, U.A.E.",
  po_box: "121828",
  phone: "+971 58 180 6000",
  email: "info@erudite-estate.com",
  website: "www.eruditeproperty.com",
  orn: "29322", brn: "34625", ded_license: "1032973", trn: "104029757200003",
  logo_base64: "", signature_base64: "", stamp_base64: "",
};

const TEXT_FIELDS = [
  ["company_name_en", "Company Name (EN)"], ["company_name_ar", "Company Name (AR)"],
  ["establishment", "Establishment"], ["address", "Address"],
  ["po_box", "P.O. Box"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"],
  ["orn", "ORN"], ["brn", "BRN"], ["ded_license", "DED License"], ["trn", "TRN"],
];
const ASSETS = [["logo_base64", "Logo"], ["signature_base64", "Signature"], ["stamp_base64", "Stamp"]];

const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

export default function CompanySettingsPage() {
  const [form, setForm] = useState(DEFAULTS);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [fixRunning, setFixRunning] = useState(false);
  const [fixTotals, setFixTotals] = useState(null);
  const [fixComplete, setFixComplete] = useState(false);
  const fixStopRef = useRef(false);
  const fixCursorRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function runFixOrphans() {
    setFixRunning(true);
    setFixComplete(false);
    fixStopRef.current = false;
    fixCursorRef.current = null;
    setFixTotals({ matched: 0, channel_fixed: 0, noise_removed: 0, duplicates_removed: 0 });
    setMsg(null);
    try {
      while (!fixStopRef.current) {
        const res = await base44.functions.invoke("fixOrphanMessages", { cursor: fixCursorRef.current });
        const data = res?.data ?? res;
        const p = data?.processed || {};
        setFixTotals((t) => ({
          matched: (t.matched || 0) + (p.matched || 0),
          channel_fixed: (t.channel_fixed || 0) + (p.channel_fixed || 0),
          noise_removed: (t.noise_removed || 0) + (p.noise_removed || 0),
          duplicates_removed: (t.duplicates_removed || 0) + (p.duplicates_removed || 0),
        }));
        if (data?.cursor) fixCursorRef.current = data.cursor;
        if (!data?.remaining) break;
      }
      if (fixStopRef.current) {
        setMsg({ type: "info", text: "Stopped — partial progress saved." });
      } else {
        setFixComplete(true);
        setMsg({ type: "success", text: "Orphan message cleanup complete." });
      }
    } catch (e) {
      setMsg({ type: "error", text: "Fix failed: " + (e?.message ?? e) });
    } finally { setFixRunning(false); }
  }

  function stopFixOrphans() { fixStopRef.current = true; }

  async function load() {
    setLoading(true);
    try {
      const rows = await base44.entities.CompanySettings.list();
      if (rows && rows.length) {
        setRecordId(rows[0].id);
        setForm({ ...DEFAULTS, ...rows[0] });
      } else {
        const created = await base44.entities.CompanySettings.create(DEFAULTS);
        setRecordId(created.id);
        setForm({ ...DEFAULTS, ...created });
      }
    } catch (e) {
      setMsg({ type: "error", text: "Failed to load: " + (e?.message ?? e) });
    } finally { setLoading(false); }
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onPick(k, file) {
    if (!file) return;
    try {
      setField(k, await fileToBase64(file));
      setMsg({ type: "info", text: "Image loaded — click Save to store it." });
    } catch {
      setMsg({ type: "error", text: "Could not read that image." });
    }
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      let id = recordId;
      if (!id) { const rows = await base44.entities.CompanySettings.list(); id = rows?.[0]?.id ?? null; }
      if (id) await base44.entities.CompanySettings.update(id, form);
      else { const c = await base44.entities.CompanySettings.create(form); id = c.id; }
      setRecordId(id);
      setMsg({ type: "success", text: "Saved." });
    } catch (e) {
      setMsg({ type: "error", text: "Save failed: " + (e?.message ?? e) });
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-12 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
        <p className="text-sm text-muted-foreground">Single source of truth for company identity and brand assets used across all document PDFs.</p>
      </div>

      {msg && (
        <div className={`mb-4 rounded-md px-4 py-2 text-sm ${
          msg.type === "success" ? "bg-primary/10 text-primary border border-primary/20"
          : msg.type === "error"   ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-muted text-muted-foreground border border-border"}`}>{msg.text}</div>
      )}

      <Card className="border-border mb-6">
        <CardHeader className="border-b border-border"><CardTitle className="text-foreground">Company Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          {TEXT_FIELDS.map(([k, label]) => (
            <div key={k} className={k === "address" ? "md:col-span-2" : ""}>
              <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
              {k === "address"
                ? <Textarea value={form[k] || ""} onChange={(e) => setField(k, e.target.value)} rows={2} className="mt-1" />
                : <Input value={form[k] || ""} onChange={(e) => setField(k, e.target.value)} className="mt-1" dir={k === "company_name_ar" ? "rtl" : "ltr"} />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border mb-6">
        <CardHeader className="border-b border-border"><CardTitle className="text-foreground">Brand Assets</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          {ASSETS.map(([k, label]) => (
            <div key={k} className="flex flex-col items-center text-center">
              <Label className="text-xs font-semibold text-muted-foreground mb-2">{label}</Label>
              <div className="w-full h-32 rounded-md border border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden mb-2">
                {form[k] ? <img src={form[k]} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}
              </div>
              <label className="inline-flex items-center gap-1 text-sm text-primary cursor-pointer hover:text-primary/80">
                <Upload className="w-4 h-4" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(k, e.target.files?.[0])} />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border mb-6">
        <CardHeader className="border-b border-border"><CardTitle className="text-foreground">Data Maintenance</CardTitle></CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Re-links orphaned WhatsApp messages to landlords, fixes invalid channel values, removes duplicates, and filters noise (own line numbers, shortcodes, landlines). Runs in batches of 300.
            </p>
            <div className="flex items-center gap-3">
              {!fixRunning ? (
                <Button onClick={runFixOrphans}>
                  <Wrench className="w-4 h-4 mr-2" />{fixComplete ? "Run Again" : "Fix Orphan Messages"}
                </Button>
              ) : (
                <Button onClick={stopFixOrphans} variant="destructive">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />Stop
                </Button>
              )}
              {fixRunning && <span className="text-xs text-muted-foreground">Processing batch… (cursor-based)</span>}
              {fixComplete && <span className="text-xs font-semibold text-primary">Complete</span>}
            </div>
          </div>
          {fixTotals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-md bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Linked to landlord/lead</div><div className="text-lg font-bold text-foreground">{fixTotals.matched ?? 0}</div></div>
              <div className="rounded-md bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Channels fixed</div><div className="text-lg font-bold text-foreground">{fixTotals.channel_fixed ?? 0}</div></div>
              <div className="rounded-md bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Duplicates removed</div><div className="text-lg font-bold text-foreground">{fixTotals.duplicates_removed ?? 0}</div></div>
              <div className="rounded-md bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Noise removed</div><div className="text-lg font-bold text-foreground">{fixTotals.noise_removed ?? 0}</div></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save Settings</>}
        </Button>
      </div>
    </div>
  );
}