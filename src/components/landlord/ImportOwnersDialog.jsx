import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Target fields a source column can map to ─────────────────────────────────
const TARGET_FIELDS = ['name', 'phone', 'email', 'unit', 'project', 'country', 'size', 'rooms', 'location', 'notes', 'ignore'];
const TARGET_LABELS = {
  name: 'Name', phone: 'Phone', email: 'Email', unit: 'Unit', project: 'Project',
  country: 'Country', size: 'Size', rooms: 'Rooms', location: 'Location', notes: 'Notes', ignore: 'Ignore',
};

// ─── Layer 1: deterministic header dictionary (case/punctuation-insensitive) ───
const VARIANTS = {
  name: ['ownername', 'name', 'fullname', 'contactname', 'owner'],
  phone: ['mobileno', 'mobilenumber', 'mobile', 'mobile1', 'mobile2', 'mobile3', 'phone', 'phone1', 'phone2', 'phone3', 'contactno', 'contactnumber', 'cell', 'officeno', 'homeno', 'tel', 'telephone', 'phoneprimary'],
  email: ['email', 'owneremail', 'alternateemail', 'altemail', 'emailaddress', 'mail'],
  unit: ['unitcode', 'unitno', 'unitnumber', 'unit', 'apt', 'apartment', 'flat'],
  project: ['projectname', 'propertyname', 'development', 'project', 'building'],
  country: ['ownercountry', 'nationality', 'country', 'residencecountry'],
  size: ['size', 'area', 'bua', 'sqft', 'sqm', 'builtuparea'],
  rooms: ['rooms', 'bedrooms', 'beds', 'br', 'bed'],
  location: ['location', 'community', 'district', 'tower'],
};

function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function deterministicMatch(columns) {
  const map = {};
  for (const col of columns) {
    const norm = normalizeHeader(col);
    for (const field of Object.keys(VARIANTS)) {
      if (VARIANTS[field].includes(norm)) { map[col] = field; break; }
    }
  }
  return map;
}

// ─── Header-row detection (owner files often have title/subtitle preamble) ─────
// Score a row by how many cells match the known field-variant dictionary.
function headerScore(cells) {
  let score = 0;
  for (const cell of cells || []) {
    const norm = normalizeHeader(cell);
    if (!norm) continue;
    for (const field of Object.keys(VARIANTS)) {
      if (VARIANTS[field].includes(norm)) { score++; break; }
    }
  }
  return score;
}

// Scan the first ~10 rows of the raw matrix and pick the best-matching header row.
function detectHeaderRow(matrix) {
  const limit = Math.min(10, matrix.length);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i++) {
    const score = headerScore(matrix[i]);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

// Build { rows, columns } from a raw matrix using the detected header row.
// Empty header cells get a placeholder; duplicate headers are de-duped; rows
// above the header and fully-empty rows are skipped.
function rowsFromMatrix(matrix, headerIdx) {
  const headerCells = matrix[headerIdx] || [];
  const seen = {};
  const columns = headerCells.map((c, i) => {
    let h = String(c == null ? '' : c).trim() || `Column ${i + 1}`;
    if (seen[h] === undefined) { seen[h] = 0; } else { seen[h] += 1; h = `${h} (${seen[h]})`; }
    return h;
  });
  const rows = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] || [];
    if (!cells.some((c) => c !== '' && c != null)) continue; // skip fully-empty rows
    const obj = {};
    columns.forEach((col, i) => { obj[col] = cells[i] == null ? '' : cells[i]; });
    rows.push(obj);
  }
  return { rows, columns };
}

// ─── Layer 2: AI fallback for columns Layer 1 couldn't map ─────────────────────
// Tiny payload (unmapped headers + up to 2 sample values), 10s timeout, optional.
async function aiMapColumns(unmappedCols, sampleRows) {
  if (!unmappedCols.length) return {};
  const payload = unmappedCols.map((col) => ({
    column: col,
    samples: sampleRows.slice(0, 2).map((r) => r[col]).filter((v) => v !== '' && v != null),
  }));
  const prompt =
    'You are mapping spreadsheet columns for a Dubai real-estate owner import.\n' +
    'For each column, choose the single best target field from this EXACT list:\n' +
    'name, phone, email, unit, project, country, size, rooms, location, notes, ignore.\n' +
    'Use "notes" if useful but fits none; "ignore" if junk/empty.\n\n' +
    'Columns (with up to 2 sample values):\n' + JSON.stringify(payload) + '\n\n' +
    'Respond ONLY as JSON: { "mappings": { "<exact column name>": "<target>" } }';

  const result = await Promise.race([
    base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: { mappings: { type: 'object', additionalProperties: { type: 'string' } } },
        required: ['mappings'],
      },
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI mapping timed out after 10s')), 10000)),
  ]);

  const raw = (result && result.mappings) || {};
  const clean = {};
  for (const col of unmappedCols) {
    const t = raw[col];
    if (t && TARGET_FIELDS.includes(t)) clean[col] = t;
  }
  return clean;
}

// ─── UAE phone cleaner ─────────────────────────────────────────────────────────
// Each source cell holds ONE number. Strip everything except digits (| - spaces
// parentheses dots), normalize to E.164, and validate as a UAE mobile: +971 then
// exactly 9 digits. Anything that doesn't match after cleaning is DISCARDED
// (returns null) so we never store garbage (e.g. fused multi-number strings).
//   "971|52-3828133" → "+971523828133"
//   "0523828133"     → "+971523828133"   (drop leading 0)
//   "523828133"      → "+971523828133"   (bare 9-digit mobile)
export function cleanPhone(raw) {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, ''); // keep digits only — drops +, |, -, spaces, parens, dots
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2); // intl 00 dialing prefix → bare country code

  let national;
  if (digits.startsWith('971')) national = digits.slice(3);              // explicit UAE country code
  else if (digits.startsWith('0')) national = digits.replace(/^0+/, ''); // local format, leading 0
  else national = digits;                                                // bare national number

  // Valid UAE mobile = exactly 9 national digits. Discard anything else.
  if (national.length !== 9) return null;
  return '+971' + national;
}

// ─── Row → cleaned record, driven by the (editable) column map ─────────────────
function buildCleanedRow(row, columnMap, columns) {
  const phones = [];
  const seenPhones = new Set(); // dedupe identical numbers across Mobile1/2/3
  const emails = [];
  let fullName = '';
  let unit = '';
  let projectRaw = '';
  let country = '';
  let location = '';
  const notesParts = [];

  for (const col of columns) {
    const target = columnMap[col];
    if (!target || target === 'ignore') continue;
    const val = row[col];
    if (val === '' || val === null || val === undefined) continue;
    const str = String(val).trim();
    if (!str) continue;
    switch (target) {
      case 'name': if (!fullName) fullName = str; break;
      // Each phone column is cleaned on its own — never joined. Dedupe identical
      // numbers that appear across Mobile1/Mobile2/Mobile3.
      case 'phone': {
        const p = cleanPhone(str);
        if (p && !seenPhones.has(p)) { seenPhones.add(p); phones.push(p); }
        break;
      }
      case 'email': emails.push(str); break;
      case 'unit': if (!unit) unit = str; break;
      case 'project': if (!projectRaw) projectRaw = str; break;
      case 'country': if (!country) country = str; break;
      case 'location': if (!location) location = str; break;
      case 'size': notesParts.push(`Size: ${str}`); break;
      case 'rooms': notesParts.push(`Rooms: ${str}`); break;
      case 'notes': notesParts.push(`${col}: ${str}`); break;
      default: break;
    }
  }

  // First valid number → primary phone. Extra valid numbers (deduped above) are
  // returned as altPhones and stored on the Landlord's additional_phones array.
  const primaryPhone = phones[0] || null;
  const altPhones = phones.slice(1);
  const email = emails[0] || null;
  if (emails.length > 1) notesParts.push(`Alt emails: ${emails.slice(1).join(', ')}`);

  return {
    fullName: fullName || 'Unknown',
    primaryPhone,
    altPhones,
    email,
    unit,
    projectRaw,
    country,
    location,
    notes: notesParts.join(' | '),
    raw: row,
  };
}

export default function ImportOwnersDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  // Preload the logged-in user as soon as the dialog mounts, so the import never
  // races ahead of an unresolved user lookup (assigned_agent_email is required).
  const { data: loadedUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });
  const [selectedTrack, setSelectedTrack] = useState('landlord');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('track_project'); // track_project | upload | analyzing | sheet_selection | preview | done | error
  const [rawData, setRawData] = useState(null); // { rows, columns }
  const [columnMap, setColumnMap] = useState({}); // { sourceColumn: targetField }
  const [existingPhones, setExistingPhones] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const existingPhoneSet = useMemo(() => new Set(existingPhones), [existingPhones]);

  const previewRows = useMemo(() => {
    if (!rawData) return [];
    const seen = new Set();
    return rawData.rows.slice(0, 10).map((r) => {
      const c = buildCleanedRow(r, columnMap, rawData.columns);
      let status = 'new';
      if (!c.primaryPhone) status = 'no_phone';
      else if (existingPhoneSet.has(c.primaryPhone) || seen.has(c.primaryPhone)) status = 'duplicate';
      if (c.primaryPhone) seen.add(c.primaryPhone);
      return { ...c, status };
    });
  }, [rawData, columnMap, existingPhoneSet]);

  // Shared pipeline: rows+columns → Layer1 + Layer2 + existing phones → preview.
  async function runMappingPipeline(rows, columns, headerRowIndex = 0) {
    const layer1 = deterministicMatch(columns);
    const unmapped = columns.filter((c) => !layer1[c]);
    let layer2 = {};
    try {
      layer2 = await aiMapColumns(unmapped, rows.slice(0, 2));
    } catch (aiErr) {
      console.warn('AI column mapping skipped:', aiErr.message);
    }
    const merged = {};
    for (const col of columns) merged[col] = layer1[col] || layer2[col] || 'notes';

    let existing = [];
    try {
      const landlords = await base44.entities.Landlord.list('-created_date', 5000);
      existing = landlords.map((l) => cleanPhone(l.phone)).filter(Boolean);
    } catch (e) {
      console.warn('Could not load existing landlords for dupe check:', e.message);
    }

    setRawData({ rows, columns, headerRowIndex });
    setColumnMap(merged);
    setExistingPhones(existing);
    setStep('preview');
  }

  function parseSheet(workbook, sheetName) {
    const ws = workbook.Sheets[sheetName];
    // Read as a raw matrix so we can find the real header row (files often have
    // title/subtitle preamble rows above the actual column headers).
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!matrix.length) return { rows: [], columns: [], headerRowIndex: 0 };
    const headerRowIndex = detectHeaderRow(matrix);
    const { rows, columns } = rowsFromMatrix(matrix, headerRowIndex);
    return { rows, columns, headerRowIndex };
  }

  async function handleFileChange(uploadedFile) {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setError(null);
    setStep('analyzing');
    try {
      const buf = await uploadedFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      if (!wb.SheetNames.length) throw new Error('the file has no sheets');

      // Multiple sheets → let the user pick which one.
      if (wb.SheetNames.length > 1) {
        setAvailableSheets(wb.SheetNames);
        setSelectedSheet(wb.SheetNames[0]);
        setStep('sheet_selection');
        return;
      }

      const { rows, columns, headerRowIndex } = parseSheet(wb, wb.SheetNames[0]);
      if (!rows.length) throw new Error('No data rows found in the sheet');
      await runMappingPipeline(rows, columns, headerRowIndex);
    } catch (err) {
      console.error('Import parse error:', err);
      setError(err.message || 'Unknown error reading the file');
      setStep('error');
    }
  }

  async function handleSheetSelect() {
    if (!selectedSheet || !file) return;
    setStep('analyzing');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const { rows, columns, headerRowIndex } = parseSheet(wb, selectedSheet);
      if (!rows.length) throw new Error('No data rows found in the selected sheet');
      await runMappingPipeline(rows, columns, headerRowIndex);
    } catch (err) {
      console.error('Sheet selection error:', err);
      setError(err.message || 'Error processing sheet');
      setStep('error');
    }
  }

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFileChange(f);
  };
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) handleFileChange(f);
  };

  const setColumnTarget = (col, target) => setColumnMap((m) => ({ ...m, [col]: target }));

  // ─── Import ALL rows (duplicates create too, just badged) ────────────────────
  const importMutation = useMutation({
    mutationFn: async () => {
      const stats = { created: 0, duplicates: 0, errored: 0, errors: [], createdIds: [] };
      const existingLandlords = await base44.entities.Landlord.list('-created_date', 5000);
      const existingProjects = await base44.entities.Project.list().catch(() => []);

      const phoneSet = new Set(existingLandlords.map((l) => cleanPhone(l.phone)).filter(Boolean));

      const projectMap = new Map();
      existingProjects.forEach((p) => {
        if (!p.name) return;
        projectMap.set(p.name.toLowerCase().trim(), p.id);
        if (p.name.includes('Peninsula')) {
          const num = p.name.match(/\d+/);
          if (num) {
            projectMap.set(`peninsula ${num[0]}`, p.id);
            const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
            const wi = parseInt(num[0], 10) - 1;
            if (wi >= 0 && wi < words.length) projectMap.set(`peninsula ${words[wi]}`, p.id);
          }
        }
      });

      // assigned_agent_email is REQUIRED on Landlord. Resolve it robustly so it
      // is NEVER omitted: prefer the value preloaded when the dialog opened
      // (avoids racing an unresolved user), re-fetch as a backup, and finally
      // fall back to a placeholder so the import never fails on this field.
      let agentEmail = loadedUser?.email;
      if (!agentEmail) {
        try { agentEmail = (await base44.auth.me())?.email; } catch (_) { /* fall through to default */ }
      }
      if (!agentEmail) agentEmail = 'unassigned@erudite.ae';

      const allRows = rawData.rows.map((r) => buildCleanedRow(r, columnMap, rawData.columns));
      const seenInFile = new Set();

      for (const row of allRows) {
        if (!row.primaryPhone) {
          stats.errored++;
          stats.errors.push({ row: row.fullName || 'Unknown', reason: 'No usable phone number' });
          continue;
        }
        const isDuplicate = phoneSet.has(row.primaryPhone) || seenInFile.has(row.primaryPhone);
        seenInFile.add(row.primaryPhone);

        let projectId = null;
        if (row.projectRaw) projectId = projectMap.get(row.projectRaw.toLowerCase().trim()) || null;

        const selectedProject = projects.find(p => p.id === selectedProjectId);

        try {
          let created;
          if (selectedTrack === 'landlord') {
            const landlordData = {
              full_name_en: row.fullName,
              full_name: row.fullName,
              phone: row.primaryPhone,
              whatsapp: row.primaryPhone,
              source: 'other',
              stage: 'initial_contact',
              assigned_agent_email: agentEmail,
              lead_type: 'landlord_both',
              notes: row.notes || 'Imported from spreadsheet',
              tags: isDuplicate ? ['imported_owner', 'possible_duplicate'] : ['imported_owner'],
            };
            if (row.altPhones.length) landlordData.additional_phones = row.altPhones;
            if (row.email) landlordData.email = row.email;
            if (row.unit) landlordData.unit_reference = row.unit;
            if (row.projectRaw) landlordData.project_name = row.projectRaw;
            const resolvedProjectId = projectId || selectedProjectId || null;
            if (resolvedProjectId) landlordData.project_id = resolvedProjectId;
            if (selectedProject && !row.projectRaw) landlordData.project_name = selectedProject.name;
            if (row.location) landlordData.location = row.location;
            if (row.country) landlordData.residence_country = row.country;
            created = await base44.entities.Landlord.create(landlordData);
          } else {
            const intent = selectedTrack === 'buyer' ? 'buyer' : 'tenant';
            const stage = selectedTrack === 'buyer' ? 'contact_identity' : 'new_tenant_lead';
            const leadData = {
              full_name: row.fullName,
              phone: row.primaryPhone,
              email: row.email || undefined,
              source: 'other',
              stage,
              intent,
              assigned_agent_email: agentEmail,
              notes: row.notes || 'Imported from spreadsheet',
              tags: isDuplicate ? ['imported', 'possible_duplicate'] : ['imported'],
              project_id: projectId || selectedProjectId || undefined,
              nationality: row.country || undefined,
            };
            created = await base44.entities.Lead.create(leadData);
          }
          stats.created++;
          if (isDuplicate) stats.duplicates++;
          if (created?.id) stats.createdIds.push(created.id);
        } catch (err) {
          stats.errored++;
          stats.errors.push({ row: row.fullName || 'Unknown', reason: err.message });
        }
      }
      return stats;
    },
    onSuccess: (stats) => {
      setResults(stats);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      if (stats.errored > 0) toast.warning(`Imported ${stats.created}, ${stats.errored} failed.`);
      else toast.success(`Imported ${stats.created} owner${stats.created !== 1 ? 's' : ''}.`);
    },
    onError: (err) => {
      // Surface the failure; keep the dialog open so it's visible.
      toast.error('Import failed: ' + (err?.message || 'unknown error'));
      console.error('Import failed:', err);
    },
  });

  const handleClose = () => {
    setFile(null);
    setStep('track_project');
    setSelectedTrack('landlord');
    setSelectedProjectId('');
    setRawData(null);
    setColumnMap({});
    setExistingPhones([]);
    setAvailableSheets([]);
    setSelectedSheet(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const resetToUpload = () => {
    setStep('upload');
    setAvailableSheets([]);
    setSelectedSheet(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalRows = rawData?.rows?.length || 0;
  const counts = previewRows.reduce(
    (a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; },
    { new: 0, duplicate: 0, no_phone: 0 },
  );

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[640px] sm:max-w-[640px] flex flex-col overflow-hidden p-4">
        <SheetHeader className="space-y-1 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-4 h-4 text-accent" /> Smart Import Owners
          </SheetTitle>
          <SheetDescription className="text-xs">
            {step === 'track_project'
              ? 'Choose the pipeline track and project before uploading your file.'
              : `Importing as: ${selectedTrack.charAt(0).toUpperCase() + selectedTrack.slice(1)} · ${projects.find(p => p.id === selectedProjectId)?.name || 'No project'}`}
          </SheetDescription>
        </SheetHeader>

        {step === 'track_project' && (
          <div className="py-6 space-y-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Track *</label>
              <div className="grid grid-cols-3 gap-2">
                {[{id:'landlord',label:'🏠 Landlord'},{id:'buyer',label:'🛒 Buyer'},{id:'rent',label:'🔑 Rent'}].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTrack(t.id)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      selectedTrack === t.id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Project *</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
              >
                <option value="">— Select a project —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
              }`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) or CSV — any column layout</p>
              <Input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-accent" />
            <p className="text-sm font-medium">Reading {file?.name || 'file'}…</p>
            <p className="text-xs text-muted-foreground mt-1">Parsing rows and detecting columns</p>
          </div>
        )}

        {step === 'sheet_selection' && availableSheets.length > 0 && (
          <div className="py-4">
            <p className="text-sm font-medium mb-3">This file has multiple sheets — pick one to import:</p>
            <div className="space-y-1.5 mb-2 max-h-60 overflow-y-auto">
              {availableSheets.map((name) => (
                <label key={name} className="flex items-center gap-3 p-2.5 border rounded-md cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="radio" name="sheet" value={name}
                    checked={selectedSheet === name}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 'preview' && rawData && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Layer 3: editable column mapping */}
            <div>
              <p className="text-xs font-medium mb-1.5">Column mapping ({rawData.columns.length}) — adjust any if auto-detect is wrong:</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                {rawData.columns.map((col) => (
                  <div key={col} className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono truncate flex-1" title={col}>{col}</span>
                    <select
                      value={columnMap[col] || 'ignore'}
                      onChange={(e) => setColumnTarget(col, e.target.value)}
                      className="text-[11px] border border-input rounded px-1 py-0.5 bg-background"
                    >
                      {TARGET_FIELDS.map((t) => <option key={t} value={t}>{TARGET_LABELS[t]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Detected header row (confirm preamble was skipped correctly) */}
            <p className="text-[11px] text-muted-foreground">
              Header row detected at row {(rawData.headerRowIndex ?? 0) + 1}
              {rawData.headerRowIndex > 0
                ? ` — ${rawData.headerRowIndex} preamble row${rawData.headerRowIndex > 1 ? 's' : ''} skipped above it.`
                : '.'}
            </p>

            {/* Counts */}
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-muted-foreground">Preview (first {previewRows.length} of {totalRows}):</span>
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">{counts.new} new</Badge>
              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">{counts.duplicate} duplicate</Badge>
              <Badge className="bg-red-500/10 text-red-700 border-red-500/20">{counts.no_phone} no phone</Badge>
            </div>

            {/* Preview table — tight padding */}
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px] py-1.5">Owner</TableHead>
                    <TableHead className="text-[11px] py-1.5">Phone</TableHead>
                    <TableHead className="text-[11px] py-1.5">Project / Unit</TableHead>
                    <TableHead className="text-[11px] py-1.5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-1">
                        <p className="text-xs font-medium leading-tight">{row.fullName}</p>
                        {row.email && <p className="text-[10px] text-muted-foreground leading-tight">{row.email}</p>}
                      </TableCell>
                      <TableCell className="py-1">
                        <p className="text-[11px] font-mono">{row.primaryPhone || '—'}</p>
                        {row.altPhones.length > 0 && <p className="text-[10px] text-muted-foreground">+{row.altPhones.length} alt</p>}
                      </TableCell>
                      <TableCell className="py-1 text-[11px]">
                        {row.projectRaw || '—'}{row.unit ? ` · ${row.unit}` : ''}
                      </TableCell>
                      <TableCell className="py-1">
                        {row.status === 'new' && <span className="text-[10px] text-emerald-600 font-medium">New</span>}
                        {row.status === 'duplicate' && <span className="text-[10px] text-amber-600 font-medium">Duplicate</span>}
                        {row.status === 'no_phone' && <span className="text-[10px] text-red-600 font-medium">No phone</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Duplicates are imported too (badged "possible_duplicate") — nothing is skipped. Rows with no phone can't be created.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="py-6">
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Couldn't read the file</p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && results && (
          <div className="py-3 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{results.created}</p>
                <p className="text-[10px] text-emerald-600">Created</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{results.duplicates}</p>
                <p className="text-[10px] text-amber-600">Created as duplicates</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-700 dark:text-red-300">{results.errored}</p>
                <p className="text-[10px] text-red-600">Errors</p>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                <p className="text-xs font-medium mb-1">Errors:</p>
                <ul className="text-[11px] space-y-0.5">
                  {results.errors.slice(0, 100).map((e, i) => (
                    <li key={i} className="text-red-600"><span className="font-medium">{e.row}:</span> {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 shrink-0 flex justify-end gap-2">
          {step === 'track_project' && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button
                size="sm"
                disabled={!selectedProjectId}
                onClick={() => setStep('upload')}
              >
                Continue
              </Button>
            </>
          )}
          {step === 'sheet_selection' && (
            <>
              <Button variant="outline" size="sm" onClick={resetToUpload}>Back</Button>
              <Button size="sm" onClick={handleSheetSelect} disabled={!selectedSheet}>Continue</Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" size="sm" onClick={resetToUpload}>← Change file</Button>
              <Button size="sm" onClick={() => importMutation.mutate()} disabled={importMutation.isPending} className="gap-1.5">
                {importMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Import all {totalRows} rows</>}
              </Button>
            </>
          )}
          {step === 'upload' && (
            <Button variant="outline" size="sm" onClick={() => setStep('track_project')}>← Back</Button>
          )}
          {step === 'error' && <Button variant="outline" size="sm" onClick={resetToUpload}>Try again</Button>}
          {step === 'done' && <Button size="sm" onClick={handleClose}>Done</Button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}