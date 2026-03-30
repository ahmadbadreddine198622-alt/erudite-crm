import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

// ── Parser ──────────────────────────────────────────────────────────────────

function parsePhone(raw) {
  // Strip everything except digits and leading +
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.length < 7) return null;
  // Ensure international format for UAE numbers
  if (cleaned.startsWith('05') && cleaned.length === 10) return '+971' + cleaned.slice(1);
  if (cleaned.startsWith('5') && cleaned.length === 9) return '+971' + cleaned;
  if (!cleaned.startsWith('+') && cleaned.length >= 10) return '+' + cleaned;
  return cleaned;
}

function extractPhones(text) {
  const matches = text.match(/[\+\d][\d\s\-\(\)\.]{6,18}[\d]/g) || [];
  const cleaned = matches.map(parsePhone).filter(Boolean);
  return [...new Set(cleaned)];
}

function extractEmails(text) {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.map(e => e.toLowerCase()))];
}

function extractUnitNumber(text) {
  // Patterns like P3-3402, A-101, 12B, unit 305, etc.
  const match = text.match(/\b([A-Z]{0,3}[-\/]?\d{3,5}[A-Z]?)\b/i)
    || text.match(/unit\s+([^\s,]+)/i)
    || text.match(/apt\.?\s+([^\s,]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractNationality(text) {
  const countries = [
    'UAE', 'Saudi', 'British', 'UK', 'Russian', 'Chinese', 'Indian', 'Pakistani',
    'Egyptian', 'Jordanian', 'Lebanese', 'American', 'Canadian', 'French', 'German',
    'Italian', 'Australian', 'Emirati', 'Kuwaiti', 'Qatari', 'Bahraini', 'Omani',
  ];
  for (const c of countries) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(text)) return c;
  }
  return null;
}

function extractProject(text) {
  // Common Dubai project keywords
  const known = [
    'Marina Gate', 'Address', 'Burj Khalifa', 'DIFC', 'Damac', 'Emaar', 'Sobha',
    'Binghatti', 'Azizi', 'Meraas', 'Nakheel', 'Palm', 'Creek', 'Hills', 'Harbour',
    'Bluewaters', 'Downtown', 'JBR', 'JVC', 'Business Bay', 'MBR City',
  ];
  for (const p of known) {
    if (new RegExp(`\\b${p}\\b`, 'i').test(text)) {
      const match = text.match(new RegExp(`([A-Za-z ]*${p}[A-Za-z ]*)`, 'i'));
      return match ? match[1].trim() : p;
    }
  }
  // Fallback: first capitalized word sequence before unit
  const m = text.match(/^([A-Z][a-zA-Z\s]{2,30?})\s+(?:[A-Z]?\d|Unit)/);
  return m ? m[1].trim() : null;
}

function parseName(text, project, unit, emails, phones) {
  // Remove known non-name tokens
  let clean = text;
  if (project) clean = clean.replace(new RegExp(project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  if (unit) clean = clean.replace(new RegExp(unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  emails.forEach(e => { clean = clean.replace(e, ''); });
  phones.forEach(p => { clean = clean.replace(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ''); });
  // Remove leftover noise
  clean = clean.replace(/[\+\d\-\(\)@\.\/\\,;:]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Extract name-like tokens (2-3 words, capitalised)
  const words = clean.split(/\s+/).filter(w => /^[A-Za-z]{2,}$/.test(w));
  const nameWords = words.slice(0, 3);
  return nameWords.join(' ') || 'Unknown';
}

export function parseRawOwnerData(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    if (line.length < 5) continue;

    const phones = extractPhones(line);
    const emails = extractEmails(line);
    const unit = extractUnitNumber(line);
    const nationality = extractNationality(line);
    const project = extractProject(line);
    const name = parseName(line, project, unit, emails, phones);

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const notes = [
      project ? `Property: ${project}` : null,
      unit ? `Unit: ${unit}` : null,
      'Owner Type: Individual',
      'Source: Owner Database',
    ].filter(Boolean).join('\n');

    results.push({
      name,
      firstName,
      lastName,
      unit,
      project,
      phone: phones[0] || null,
      email: emails[0] || null,
      nationality,
      notes,
      tags: ['owner_database', ...(project ? [project.toLowerCase().replace(/\s+/g, '_').slice(0, 20)] : [])],
      source: 'other',
      stage: 'new_lead',
      type: 'landlord',
      lead_score: 60,
      _raw: line,
      _phones: phones,
      _emails: emails,
    });
  }

  return results;
}

// ── UI ───────────────────────────────────────────────────────────────────────

function ParsedPreview({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{item.name}</span>
        <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.project && <Badge variant="secondary" className="text-[10px]">{item.project}</Badge>}
        {item.unit && <Badge variant="outline" className="text-[10px]">Unit {item.unit}</Badge>}
        {item.nationality && <Badge variant="outline" className="text-[10px]">{item.nationality}</Badge>}
        {item._phones.map(p => <Badge key={p} className="text-[10px] bg-accent/10 text-accent border-0">{p}</Badge>)}
        {item._emails.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}
      </div>
      {expanded && (
        <pre className="text-[10px] text-muted-foreground bg-background rounded p-2 whitespace-pre-wrap">{item.notes}</pre>
      )}
    </div>
  );
}

export default function RawDataIngestion({ open, onClose }) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [step, setStep] = useState('input'); // input | preview | done
  const [savedCount, setSavedCount] = useState(0);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (items) => {
      const results = await Promise.all(
        items.map(item =>
          base44.entities.Lead.create({
            name: item.name,
            phone: item.phone,
            email: item.email,
            nationality: item.nationality,
            notes: item.notes,
            tags: item.tags,
            source: item.source,
            stage: item.stage,
            type: item.type,
            lead_score: item.lead_score,
          })
        )
      );
      return results;
    },
    onSuccess: (results) => {
      setSavedCount(results.length);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleParse = () => {
    if (!rawText.trim()) return;
    const result = parseRawOwnerData(rawText);
    setParsed(result);
    setStep('preview');
  };

  const handleReset = () => {
    setRawText('');
    setParsed([]);
    setStep('input');
    setSavedCount(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-accent" />
            Raw Data Ingestion
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste raw property owner data below — one owner per line.<br />
              Format: <code className="bg-muted px-1 rounded text-xs">[Project] [Unit] [Full Name] [Phones] [Emails] [Nationality]</code>
            </p>
            <Textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Marina Gate P3-3402 Robin George +971501234567 robin@email.com British\nPalm Jumeirah V-12 Sara Al Rashidi +971509876543 sara@gmail.com UAE`}
              className="min-h-[200px] font-mono text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Wand2 className="w-4 h-4 mr-1" /> Parse Data
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{parsed.length} lead{parsed.length !== 1 ? 's' : ''} detected</p>
              <Button variant="ghost" size="sm" onClick={() => setStep('input')}>← Edit</Button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {parsed.map((item, i) => (
                <ParsedPreview key={i} item={item} index={i} />
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate(parsed)}
                disabled={saveMutation.isPending || parsed.length === 0}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                ) : (
                  <>Save {parsed.length} Lead{parsed.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-8 gap-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">{savedCount} Lead{savedCount !== 1 ? 's' : ''} Created</p>
              <p className="text-sm text-muted-foreground mt-1">All records have been saved to the Leads database.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Import More</Button>
              <Button onClick={handleClose} className="bg-accent text-accent-foreground hover:bg-accent/90">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}