import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertTriangle, Check, Loader2, Palette, Type, Layout, Ruler, BookOpen, Zap } from 'lucide-react';

// ─── Real token values extracted from index.css :root + tailwind.config.js ───
const COLOR_TOKENS = [
  // Backgrounds
  { group: 'Backgrounds', token: '--background',   hsl: '222 47% 7%',  hex: '#0B0E1A', usage: 'Page background — the deepest navy layer' },
  { group: 'Backgrounds', token: '--card',          hsl: '222 47% 11%', hex: '#121629', usage: 'Card / panel surface — 1 stop lighter than bg' },
  { group: 'Backgrounds', token: '--popover',       hsl: '222 47% 11%', hex: '#121629', usage: 'Popover & dropdown surface — same as card' },
  { group: 'Backgrounds', token: '--secondary',     hsl: '222 47% 15%', hex: '#191E38', usage: 'Secondary surface / muted fill areas' },
  { group: 'Backgrounds', token: '--muted',         hsl: '222 47% 15%', hex: '#191E38', usage: 'Muted background (same as secondary)' },
  // Brand
  { group: 'Brand', token: '--primary',    hsl: '38 92% 50%',  hex: '#F5A623', usage: 'Gold — primary CTA, active state, key highlights. Use sparingly.' },
  { group: 'Brand', token: '--accent',     hsl: '38 92% 50%',  hex: '#F5A623', usage: 'Alias of primary — used by shadcn accent variant' },
  // Text
  { group: 'Text', token: '--foreground',          hsl: '220 14% 92%', hex: '#E4E7EF', usage: 'Primary body text' },
  { group: 'Text', token: '--card-foreground',     hsl: '220 14% 92%', hex: '#E4E7EF', usage: 'Text on card surfaces' },
  { group: 'Text', token: '--primary-foreground',  hsl: '222 47% 11%', hex: '#121629', usage: 'Text on gold/primary buttons — dark navy' },
  { group: 'Text', token: '--muted-foreground',    hsl: '220 9% 55%',  hex: '#878B96', usage: 'Subdued/helper text, labels, placeholder' },
  // Borders
  { group: 'Borders & Lines', token: '--border', hsl: '222 47% 18%', hex: '#202748', usage: 'Default border on cards, dividers, table rows' },
  { group: 'Borders & Lines', token: '--input',  hsl: '222 47% 18%', hex: '#202748', usage: 'Input field border — same value as --border' },
  { group: 'Borders & Lines', token: '--ring',   hsl: '38 92% 50%',  hex: '#F5A623', usage: 'Focus ring — gold, matches primary' },
  // Status
  { group: 'Status', token: '--destructive', hsl: '0 62% 30%',    hex: '#8B1A1A', usage: 'Error / destructive actions — deep red' },
  { group: 'Status', token: '--success',     hsl: '152 69% 40%',  hex: '#1F9E5C', usage: 'Confirmed / success states — emerald' },
  { group: 'Status', token: '--warning',     hsl: '38 92% 50%',   hex: '#F5A623', usage: 'Warning — reuses primary gold (same token)' },
  // Sidebar
  { group: 'Sidebar', token: '--sidebar-background', hsl: '222 47% 7%',  hex: '#0B0E1A', usage: 'Sidebar panel bg — same as page background' },
  { group: 'Sidebar', token: '--sidebar-accent',     hsl: '222 47% 13%', hex: '#161C30', usage: 'Sidebar item hover fill' },
  { group: 'Sidebar', token: '--sidebar-border',     hsl: '222 47% 13%', hex: '#161C30', usage: 'Sidebar rail divider' },
];

const INCONSISTENCIES = [
  { location: 'components/layout/Sidebar.jsx line 119', value: 'background: rgba(245,158,11,0.12)', note: 'Active nav item uses hardcoded RGBA — should be bg-primary/12 or a CSS variable.' },
  { location: 'components/layout/Sidebar.jsx line 120', value: "borderLeft: '3px solid hsl(38 92% 50%)'", note: 'Active border uses hardcoded HSL — should use border-primary or hsl(var(--primary)).' },
  { location: 'pages/Acknowledgements.jsx (multiple)', value: "style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}", note: 'Gold buttons hardcoded inline — should use bg-primary text-primary-foreground.' },
  { location: 'pages/Acknowledgements.jsx (multiple)', value: "style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid ...' }}", note: 'Glass surface hardcoded — should use glass-card class or bg-card border-border.' },
  { location: 'pages/Acknowledgements.jsx field-input', value: ".field-input { background: rgba(255,255,255,0.06); }", note: 'Custom CSS class duplicates glass-input — use the .glass-input utility instead.' },
  { location: '--warning vs --primary', value: 'hsl(38 92% 50%) used for both', note: 'Warning and Primary share the same HSL value. No distinct warning color exists — if warning severity needs differentiation, a new token is required.' },
  { location: '--secondary vs --muted', value: 'hsl(222 47% 15%) used for both', note: 'Secondary and Muted share identical token values — functionally equivalent, creates semantic ambiguity.' },
  { location: '--card vs --popover', value: 'hsl(222 47% 11%) used for both', note: 'Card and Popover share identical token values.' },
];

const TYPE_SCALE = [
  { name: 'H1 — Page Title',    font: 'Playfair Display', weight: '600', size: '2rem (32px)',    lh: '1.2', cls: 'font-display text-3xl font-semibold',   sample: 'Landlord Pipeline' },
  { name: 'H2 — Section Title', font: 'Playfair Display', weight: '600', size: '1.5rem (24px)',  lh: '1.25', cls: 'font-display text-2xl font-semibold',  sample: 'Active Listings' },
  { name: 'H3 — Card Title',    font: 'Inter',            weight: '600', size: '1rem (16px)',    lh: '1.4', cls: 'font-sans text-base font-semibold',      sample: 'Deal Overview' },
  { name: 'H4 — Sub-heading',   font: 'Inter',            weight: '600', size: '0.875rem (14px)',lh: '1.4', cls: 'font-sans text-sm font-semibold',        sample: 'Stage Details' },
  { name: 'Body',               font: 'Inter',            weight: '400', size: '0.875rem (14px)',lh: '1.6', cls: 'font-sans text-sm',                      sample: 'The deal is currently in negotiation stage with the counterparty agent awaiting a response.' },
  { name: 'Small / Helper',     font: 'Inter',            weight: '400', size: '0.8125rem (13px)', lh: '1.5', cls: 'font-sans text-[13px]',               sample: 'Last updated 2 hours ago' },
  { name: 'Caption / Label',    font: 'Inter',            weight: '600', size: '0.625rem (10px)', lh: '1.4', cls: 'font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground', sample: 'ASSIGNED AGENT' },
  { name: 'Mono / Reference',   font: 'Inter (tabular)',  weight: '600', size: '0.875rem (14px)', lh: '1.4', cls: 'font-sans font-semibold tabular-nums',  sample: 'ACK-0001 · AED 3,250,000' },
];

const RADIUS_SCALE = [
  { name: '--radius (lg)', value: '0.75rem / 12px', cls: 'rounded-lg', use: 'Cards, panels, modals, large containers' },
  { name: 'md',            value: '0.625rem / 10px', cls: 'rounded-md', use: 'Buttons, inputs, select fields' },
  { name: 'sm',            value: '0.5rem / 8px',    cls: 'rounded-sm', use: 'Small chips, tight badges' },
  { name: 'xl',            value: '0.75rem / 12px',  cls: 'rounded-xl', use: 'Nav items, larger cards (alias of lg in practice)' },
  { name: 'full / pill',   value: '9999px',           cls: 'rounded-full', use: 'Status pills, avatars, percentage badges' },
];

const STATUS_PILLS = [
  { label: 'Payment Received', bg: 'rgba(34,197,94,0.12)',  color: '#4ade80',  border: 'rgba(34,197,94,0.25)' },
  { label: 'Cheque Received',  bg: 'rgba(99,102,241,0.12)', color: '#a5b4fc',  border: 'rgba(99,102,241,0.25)' },
  { label: 'Document Handover',bg: 'rgba(6,182,212,0.12)',  color: '#67e8f9',  border: 'rgba(6,182,212,0.25)' },
  { label: 'Keys Handover',    bg: 'rgba(245,158,11,0.12)', color: '#fbbf24',  border: 'rgba(245,158,11,0.25)' },
  { label: 'General',          bg: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.9)', border: 'rgba(148,163,184,0.2)' },
  { label: 'Issued',           bg: 'rgba(34,197,94,0.12)',  color: '#4ade80',  border: 'rgba(34,197,94,0.25)' },
  { label: 'Draft',            bg: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.9)', border: 'rgba(148,163,184,0.2)' },
  { label: 'Void',             bg: 'rgba(239,68,68,0.12)',  color: '#fca5a5',  border: 'rgba(239,68,68,0.25)' },
];

const JEWEL_PILLS = [
  { cls: 'jewel-emerald', label: 'Active' },
  { cls: 'jewel-amber',   label: 'Pending' },
  { cls: 'jewel-blue',    label: 'Qualified' },
  { cls: 'jewel-purple',  label: 'Under Offer' },
  { cls: 'jewel-rose',    label: 'At Risk' },
  { cls: 'jewel-slate',   label: 'Inactive' },
  { cls: 'jewel-gold',    label: 'Priority' },
];

const groupColors = (tokens) => {
  const groups = {};
  tokens.forEach(t => {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  });
  return groups;
};

function SectionHeading({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-3 border-b border-border">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="font-display text-xl font-semibold text-white">{label}</h2>
    </div>
  );
}

function ColorSwatch({ token, hsl, hex, usage }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`hsl(${hsl})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div
      className="glass-card p-3 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={copy}
      title="Click to copy HSL"
    >
      <div className="h-14 rounded-md mb-3 border border-white/10" style={{ background: `hsl(${hsl})` }} />
      <p className="text-[10px] font-semibold font-mono text-primary mb-0.5">{token}</p>
      <p className="text-[11px] text-white/80 font-mono">hsl({hsl})</p>
      <p className="text-[11px] text-muted-foreground font-mono mb-1">{hex}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{usage}</p>
      {copied && <p className="text-[10px] text-primary mt-1">Copied!</p>}
    </div>
  );
}

export default function DesignSystem() {
  const colorGroups = groupColors(COLOR_TOKENS);
  const [selectVal, setSelectVal] = useState('');
  const [tabVal, setTabVal] = useState('colors');

  return (
    <div className="page-root max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2">Living Style Guide</p>
        <h1 className="page-title text-3xl mb-2">Design System</h1>
        <p className="page-subtitle max-w-2xl">
          Single source of truth for PropCRM's visual language. All values extracted from the live theme tokens
          (<code className="text-primary/80 text-[11px]">index.css :root</code> + <code className="text-primary/80 text-[11px]">tailwind.config.js</code>).
          This page is read-only — it documents the system, it does not define it.
        </p>
      </div>

      {/* ─── Usage Rules banner ────────────────────────────────────────────── */}
      <div className="glass-card p-5 mb-8 border-l-4" style={{ borderLeftColor: 'hsl(38 92% 50%)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-white text-sm">How to build in this system — rules every prompt must follow</h3>
        </div>
        <ol className="space-y-1.5 text-sm text-white/75 list-decimal list-inside">
          <li>Always use theme tokens / CSS variables — <strong className="text-white">never hardcode hex values</strong> in components.</li>
          <li>Gold <code className="text-primary text-[11px]">hsl(38 92% 50%)</code> is the single accent/primary — use <strong className="text-white">sparingly</strong> for primary CTAs and key highlights, not large fills.</li>
          <li>Headings = <strong className="text-white font-display">Playfair Display</strong>; all body/UI text = <strong className="text-white">Inter</strong>. Use <code className="text-primary/80 text-[11px]">font-display</code> / <code className="text-primary/80 text-[11px]">font-sans</code>.</li>
          <li>Use shadcn/ui components with their existing variants — do not introduce new one-off component styles.</li>
          <li>Dark theme only (navy/charcoal). No light-mode variants. Background is always <code className="text-primary/80 text-[11px]">hsl(222 47% 7%)</code>.</li>
          <li>Glass surfaces use the <code className="text-primary/80 text-[11px]">.glass-card</code> utility class; do not replicate its backdrop/blur/border CSS inline.</li>
          <li>Use <code className="text-primary/80 text-[11px]">.page-root</code>, <code className="text-primary/80 text-[11px]">.page-title</code>, <code className="text-primary/80 text-[11px]">.page-subtitle</code> for consistent page layout.</li>
          <li>Status pills follow the jewel-pill pattern (<code className="text-primary/80 text-[11px]">.jewel-pill .jewel-emerald</code> etc.) — do not create ad-hoc color spans.</li>
        </ol>
      </div>

      {/* ─── Inconsistencies ───────────────────────────────────────────────── */}
      <div className="glass-card p-5 mb-8 border border-yellow-500/20">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <h3 className="font-semibold text-yellow-300 text-sm">⚠️ Inconsistencies found — not fixed, documented only</h3>
        </div>
        <div className="space-y-2">
          {INCONSISTENCIES.map((inc, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
              <p className="text-[10px] font-semibold text-yellow-400 font-mono mb-0.5">{inc.location}</p>
              <p className="text-[11px] text-white/60 font-mono mb-1">{inc.value}</p>
              <p className="text-[11px] text-white/75">{inc.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Main tabs ─────────────────────────────────────────────────────── */}
      <Tabs value={tabVal} onValueChange={setTabVal}>
        <TabsList className="mb-8 flex-wrap h-auto gap-1 bg-card border border-border p-1">
          {[
            { val: 'colors',     label: '🎨 Colors',           icon: Palette },
            { val: 'typography', label: '🔤 Typography',        icon: Type },
            { val: 'components', label: '🧩 Components',        icon: Layout },
            { val: 'spacing',    label: '📐 Spacing & Radius',  icon: Ruler },
          ].map(t => (
            <TabsTrigger key={t.val} value={t.val} className="text-xs px-3 py-1.5">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ── COLORS ── */}
        <TabsContent value="colors">
          <SectionHeading icon={Palette} label="Color Tokens" />
          {Object.entries(colorGroups).map(([group, tokens]) => (
            <div key={group} className="mb-8">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">{group}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {tokens.map(t => <ColorSwatch key={t.token} {...t} />)}
              </div>
            </div>
          ))}

          {/* Chart colors */}
          <div className="mb-8">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Chart Palette</h3>
            <div className="flex gap-3 flex-wrap">
              {[
                { n: '--chart-1', h: '38 92% 50%' },
                { n: '--chart-2', h: '173 58% 39%' },
                { n: '--chart-3', h: '197 37% 50%' },
                { n: '--chart-4', h: '12 76% 61%' },
                { n: '--chart-5', h: '280 65% 60%' },
              ].map(c => (
                <div key={c.n} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md border border-white/10" style={{ background: `hsl(${c.h})` }} />
                  <div>
                    <p className="text-[10px] font-mono text-primary">{c.n}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">hsl({c.h})</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── TYPOGRAPHY ── */}
        <TabsContent value="typography">
          <SectionHeading icon={Type} label="Type Scale" />
          <div className="space-y-6">
            {TYPE_SCALE.map(t => (
              <div key={t.name} className="glass-card p-5">
                <div className="flex flex-wrap gap-4 mb-3 text-[10px] font-mono">
                  <span className="text-primary font-semibold">{t.name}</span>
                  <span className="text-muted-foreground">font: <span className="text-white/70">{t.font}</span></span>
                  <span className="text-muted-foreground">weight: <span className="text-white/70">{t.weight}</span></span>
                  <span className="text-muted-foreground">size: <span className="text-white/70">{t.size}</span></span>
                  <span className="text-muted-foreground">line-height: <span className="text-white/70">{t.lh}</span></span>
                  <code className="text-primary/70">.{t.cls.split(' ').slice(0,3).join(' ')}</code>
                </div>
                <div className={t.cls}>{t.sample}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 glass-card p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Font Imports</h3>
            <pre className="text-[11px] text-primary/80 font-mono leading-relaxed overflow-x-auto">
{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap');

--font-sans:    'Inter', sans-serif;     → Tailwind: font-sans   (body, UI)
--font-display: 'Playfair Display', serif; → Tailwind: font-display (headings)`}
            </pre>
          </div>
        </TabsContent>

        {/* ── COMPONENTS ── */}
        <TabsContent value="components">
          <SectionHeading icon={Layout} label="Component Library" />

          {/* Buttons */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Buttons</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <Button variant="default">Primary (Gold)</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="glass">Glass</Button>
              <Button disabled>Disabled</Button>
              <Button disabled><Loader2 className="w-4 h-4 animate-spin" /> Loading…</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="icon"><Check className="w-4 h-4" /></Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Variants are defined in <code className="text-primary/70">buttonVariants</code> in <code className="text-primary/70">components/ui/button</code>. All use <code className="text-primary/70">.liquid-glass</code> base.
              For gold CTAs use <code className="text-primary/70">variant="default"</code> — it is styled as gold via the button config.
            </p>
          </div>

          {/* Inputs */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Form Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Input</label>
                <Input placeholder="Type something…" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Select</label>
                <Select value={selectVal} onValueChange={setSelectVal}>
                  <SelectTrigger><SelectValue placeholder="Choose option" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">Option A</SelectItem>
                    <SelectItem value="b">Option B</SelectItem>
                    <SelectItem value="c">Option C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Textarea</label>
                <Textarea placeholder="Long-form text…" rows={3} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Use <code className="text-primary/70">.glass-input</code> for custom inputs. Focus ring = <code className="text-primary/70">hsl(var(--ring))</code> = gold.
            </p>
          </div>

          {/* Card */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Card (shadcn) — used for rich panels</h3>
            <Card className="max-w-sm">
              <CardHeader>
                <CardTitle>Deal Overview</CardTitle>
                <CardDescription>Marina Vista · Sale · AED 3.2M</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">The deal is currently in negotiation stage awaiting the seller's counter-offer response.</p>
              </CardContent>
            </Card>
            <p className="text-[10px] text-muted-foreground mt-3">
              Uses <code className="text-primary/70">bg-card</code> + <code className="text-primary/70">border-border</code>. For data panels prefer <code className="text-primary/70">.glass-card</code> (adds backdrop-blur). For structured content use the shadcn Card.
            </p>
          </div>

          {/* Badges */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Badges — shadcn variant</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>

            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 mt-4">Jewel-Tone Status Pills (.jewel-pill)</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {JEWEL_PILLS.map(p => (
                <span key={p.cls} className={`jewel-pill ${p.cls}`}>{p.label}</span>
              ))}
            </div>

            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 mt-4">Custom Inline Status Pills (Acknowledgements pattern)</h4>
            <div className="flex flex-wrap gap-2">
              {STATUS_PILLS.map(p => (
                <span key={p.label} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                  style={{ background: p.bg, color: p.color, borderColor: p.border }}>
                  {p.label}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              ⚠️ Inline STATUS_PILLS use hardcoded RGBA — prefer <code className="text-primary/70">.jewel-*</code> classes where possible.
            </p>
          </div>

          {/* Table */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Table (.glass-table)</h3>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full glass-table">
                <thead>
                  <tr>
                    <th className="text-left">ACK #</th>
                    <th className="text-left">Client</th>
                    <th className="text-left">Type</th>
                    <th className="text-right">Amount</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>ACK-0001</td>
                    <td>Ahmad Badreddine</td>
                    <td><span className="jewel-pill jewel-emerald">Payment</span></td>
                    <td className="text-right tabular-nums">AED 325,000</td>
                    <td><span className="jewel-pill jewel-amber">Draft</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>ACK-0002</td>
                    <td>Mohammed Al Rashed</td>
                    <td><span className="jewel-pill jewel-blue">Document</span></td>
                    <td className="text-right tabular-nums">—</td>
                    <td><span className="jewel-pill jewel-emerald">Issued</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Apply <code className="text-primary/70">.glass-table</code> to <code className="text-primary/70">&lt;table&gt;</code>. Row hover uses <code className="text-primary/70">rgba(255,255,255,0.04)</code>. Borders via <code className="text-primary/70">rgba(255,255,255,0.04/0.08)</code>.
            </p>
          </div>

          {/* Tabs */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Tabs</h3>
            <Tabs defaultValue="t1">
              <TabsList>
                <TabsTrigger value="t1">Overview</TabsTrigger>
                <TabsTrigger value="t2">Documents</TabsTrigger>
                <TabsTrigger value="t3">WhatsApp</TabsTrigger>
              </TabsList>
              <TabsContent value="t1" className="pt-4 text-sm text-muted-foreground">Overview content renders here.</TabsContent>
              <TabsContent value="t2" className="pt-4 text-sm text-muted-foreground">Documents content renders here.</TabsContent>
              <TabsContent value="t3" className="pt-4 text-sm text-muted-foreground">WhatsApp thread renders here.</TabsContent>
            </Tabs>
          </div>

          {/* Glass utilities */}
          <div className="glass-card p-5 mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Glass Surface Utilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-4 rounded-xl">
                <p className="text-[10px] font-semibold text-primary mb-1">.glass-card</p>
                <p className="text-xs text-muted-foreground">backdrop-blur(20px) · bg rgba(255,255,255,0.06) · border rgba(255,255,255,0.1)</p>
              </div>
              <div className="liquid-glass p-4 rounded-xl relative overflow-hidden">
                <div className="liquid-glass-gloss" />
                <p className="text-[10px] font-semibold text-primary mb-1">.liquid-glass</p>
                <p className="text-xs text-muted-foreground">backdrop-blur(24px) · saturate(200%) · top border highlight · used for buttons</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── SPACING & RADIUS ── */}
        <TabsContent value="spacing">
          <SectionHeading icon={Ruler} label="Border Radius" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
            {RADIUS_SCALE.map(r => (
              <div key={r.name} className="glass-card p-4 text-center">
                <div className={`w-16 h-16 mx-auto mb-3 bg-primary/15 border border-primary/30 ${r.cls}`} />
                <p className="text-[10px] font-semibold text-primary font-mono mb-0.5">{r.name}</p>
                <p className="text-[10px] text-white/60 font-mono mb-1">{r.value}</p>
                <p className="text-[10px] text-muted-foreground">{r.use}</p>
              </div>
            ))}
          </div>

          <SectionHeading icon={Ruler} label="Spacing Scale (Tailwind default × 4px base)" />
          <div className="glass-card p-5 mb-8">
            <div className="flex items-end gap-2 flex-wrap mb-4">
              {[1,2,3,4,5,6,8,10,12,16,20,24].map(s => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <div className="bg-primary/30 border border-primary/40 rounded" style={{ width: `${s * 4}px`, height: `${s * 4}px` }} />
                  <p className="text-[9px] text-muted-foreground font-mono">{s}</p>
                  <p className="text-[9px] text-white/40 font-mono">{s * 4}px</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Standard Tailwind 4px grid. 1 unit = 4px. Common page padding: <code className="text-primary/70">p-6</code> (24px) inner, <code className="text-primary/70">py-2 px-4</code> for buttons. Page root: <code className="text-primary/70">p-4 md:p-8 pb-24</code>.
            </p>
          </div>

          <SectionHeading icon={Ruler} label="Shadows" />
          <div className="glass-card p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'glass-card shadow',   css: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)', label: 'Used by .glass-card' },
                { name: 'liquid-glass shadow', css: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15)', label: 'Used by .liquid-glass / buttons' },
                { name: 'Gold glow',            css: '0 2px 12px rgba(245,158,11,0.15)', label: 'Active nav item, primary CTAs' },
              ].map(s => (
                <div key={s.name} className="text-center">
                  <div className="w-24 h-24 mx-auto mb-3 rounded-xl bg-card" style={{ boxShadow: s.css }} />
                  <p className="text-[10px] font-semibold text-primary mb-1">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer stamp */}
      <div className="mt-12 pt-6 border-t border-border text-center">
        <p className="text-[10px] text-muted-foreground">
          PropCRM Design System · Extracted from live tokens · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Read-only
        </p>
      </div>
    </div>
  );
}