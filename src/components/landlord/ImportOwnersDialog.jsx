import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2, MapPin, Phone, Mail, Building } from 'lucide-react';
import { toast } from 'sonner';

// Simple column matching by header name
function fallbackColumnMapping(columns) {
  const mappings = {
    owner_name: null,
    phone_primary: null,
    phone_secondary: [],
    email: null,
    unit_reference: null,
    project_name: null,
    location: null,
    bedrooms: null,
    size: null,
    country: null,
    notes: [],
  };

  const namePatterns = /^(owner\s*name|full\s*name|name|contact\s*name|owner)$/i;
  const phonePatterns = /^(mobile1|mobile|phone|phone1|tel|telephone|contact\s*number|phone\s*primary)$/i;
  const phone2Patterns = /^(mobile2|phone2|alt\s*phone|alternate\s*phone)$/i;
  const phone3Patterns = /^(mobile3|phone3)$/i;
  const emailPatterns = /^(email|e-mail|email\s*address)$/i;
  const unitPatterns = /^(unit\s*number|unit|apt|apartment|flat|room\s*number)$/i;
  const projectPatterns = /^(project\s*name|project|building|development|community)$/i;
  const locationPatterns = /^(location|area|community|location\s*name)$/i;
  const bedroomPatterns = /^(rooms|bedrooms|beds|br|unit\s*type)$/i;
  const sizePatterns = /^(size|area|sqft|sqm|square\s*feet|square\s*meters)$/i;
  const countryPatterns = /^(owner\s*country|nationality|country|residence\s*country)$/i;

  columns.forEach((col) => {
    const lower = col.toLowerCase().trim();
    
    if (namePatterns.test(lower)) mappings.owner_name = col;
    else if (phonePatterns.test(lower)) mappings.phone_primary = col;
    else if (phone2Patterns.test(lower)) mappings.phone_secondary.push(col);
    else if (phone3Patterns.test(lower)) mappings.phone_secondary.push(col);
    else if (emailPatterns.test(lower)) mappings.email = col;
    else if (unitPatterns.test(lower)) mappings.unit_reference = col;
    else if (projectPatterns.test(lower)) mappings.project_name = col;
    else if (locationPatterns.test(lower)) mappings.location = col;
    else if (bedroomPatterns.test(lower)) mappings.bedrooms = col;
    else if (sizePatterns.test(lower)) mappings.size = col;
    else if (countryPatterns.test(lower)) mappings.country = col;
    else mappings.notes.push(col);
  });

  return {
    mappings,
    confidence: 'high',
    notes: 'Columns detected by header-name matching.',
  };
}

// Phone cleaning: handle various formats
function cleanPhone(raw) {
  if (!raw) return null;
  let cleaned = raw.toString().trim();
  // Remove separators
  cleaned = cleaned.replace(/[|\-.\s()]/g, '');
  // Handle UAE numbers
  if (cleaned.startsWith('971')) {
    cleaned = cleaned.replace(/^9710+/, '971');
  } else if (cleaned.startsWith('00971')) {
    cleaned = cleaned.replace(/^009710+/, '971');
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Local UAE number like 0501234567
    cleaned = '971' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

// Convert one raw spreadsheet row into a cleaned/mapped record. Single source of
// truth used by BOTH the preview sample and the actual import, so what you see
// in the preview is exactly what gets created (no 10-row vs all-rows drift).
function buildCleanedRow(row, mappings) {
  const rawPhone = mappings.phone_primary ? row[mappings.phone_primary] : null;
  const rawSecondaryPhones = mappings.phone_secondary
    ? mappings.phone_secondary.map((col) => row[col]).filter(Boolean)
    : [];
  const cleanedPhone = cleanPhone(rawPhone);
  const cleanedSecondaryPhones = rawSecondaryPhones.map(cleanPhone).filter(Boolean);

  const notesParts = [];
  if (mappings.bedrooms && row[mappings.bedrooms]) notesParts.push(`Rooms: ${row[mappings.bedrooms]}`);
  if (mappings.size && row[mappings.size]) notesParts.push(`Size: ${row[mappings.size]}`);
  if (mappings.notes) {
    mappings.notes.forEach((col) => {
      if (row[col]) notesParts.push(`${col}: ${row[col]}`);
    });
  }

  return {
    fullName: mappings.owner_name ? row[mappings.owner_name] : 'Unknown',
    phone: cleanedPhone,
    altPhones: cleanedSecondaryPhones,
    email: mappings.email ? row[mappings.email] : null,
    unitReference: mappings.unit_reference ? row[mappings.unit_reference] : null,
    projectRaw: mappings.project_name ? row[mappings.project_name] : null,
    location: mappings.location ? row[mappings.location] : null,
    country: mappings.country ? row[mappings.country] : null,
    notes: notesParts.join(' | '),
    raw: row,
  };
}

export default function ImportOwnersDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [aiMapping, setAiMapping] = useState(null);
  const [preview, setPreview] = useState([]);
  const [step, setStep] = useState('upload'); // upload | analyzing | preview | processing | done | error
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setStep('analyzing');
    
    let analysisResult = null;

    try {
      // Parse the spreadsheet directly in-browser with SheetJS. Synchronous and
      // fast (milliseconds for thousands of rows) — no upload, no AI extraction,
      // no 15s timeout. Replaces the old UploadFile + ExtractDataFromUploadedFile
      // + InvokeLLM pipeline that was timing out.
      let rows;
      let columns;
      try {
        const buf = await uploadedFile.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('the file has no sheets');
        const ws = wb.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        columns = rows.length ? Object.keys(rows[0]) : [];
      } catch (err) {
        throw new Error('Failed to read the spreadsheet: ' + err.message);
      }

      if (!rows.length) {
        throw new Error('No data rows found in the first sheet');
      }

      setRawData({ rows, columns, fileUrl: null });

      // Deterministic column mapping (no AI) — instant, no timeout risk.
      analysisResult = fallbackColumnMapping(columns);
      setAiMapping(analysisResult);

      // Step 3: Build a preview SAMPLE (first 10 rows) for display only.
      // The actual import re-derives records from ALL rows at commit time.
      const cleanedPreview = rows.slice(0, 10).map((row) => buildCleanedRow(row, analysisResult.mappings));

      setPreview(cleanedPreview);
      setStep('preview');
    } catch (err) {
      console.error('Import error:', err);
      const errorMsg = err.message || 'Unknown error occurred';
      setError(errorMsg);
      setStep('error');
    }
  };

  const handleFileSelect = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) handleFileChange(uploadedFile);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const uploadedFile = e.dataTransfer.files[0];
    if (uploadedFile && (uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.csv'))) {
      handleFileChange(uploadedFile);
    }
  };

  // Step 5: Import on confirm
  const importMutation = useMutation({
    mutationFn: async () => {
      const stats = { created: 0, skipped: 0, errored: 0, errors: [], createdIds: [] };
      
      // Fetch existing landlords for duplicate check
      const existingLandlords = await base44.entities.Landlord.list();
      const existingProjects = await base44.entities.Project.list();
      
      // Build lookup maps
      const phoneMap = new Map();
      const unitProjectMap = new Map();
      existingLandlords.forEach(l => {
        if (l.phone) phoneMap.set(l.phone, l.id);
        if (l.unit_reference && l.project_id) {
          unitProjectMap.set(`${l.unit_reference}|${l.project_id}`, l.id);
        }
      });
      
      // Project name to ID map (with fuzzy matching)
      const projectMap = new Map();
      existingProjects.forEach(p => {
        const normalizedName = p.name.toLowerCase().trim();
        projectMap.set(normalizedName, p.id);
        // Add common variations
        if (p.name.includes('Peninsula')) {
          const num = p.name.match(/\d+/);
          if (num) {
            projectMap.set(`peninsula ${num[0]}`, p.id);
            const words = ['one','two','three','four','five','six','seven','eight','nine','ten'];
            const wordIdx = parseInt(num[0]) - 1;
            if (wordIdx >= 0 && wordIdx < words.length) {
              projectMap.set(`peninsula ${words[wordIdx]}`, p.id);
            }
          }
        }
      });

      const currentUser = await base44.auth.me();

      // Re-derive cleaned records from ALL rows (not just the 10-row preview) so
      // the full file is imported, not a sample.
      const allRows = (rawData?.rows || []).map((row) => buildCleanedRow(row, aiMapping.mappings));

      for (const row of allRows) {
        try {
          if (!row.phone || !row.fullName) {
            stats.errored++;
            stats.errors.push({ row: row.fullName || 'Unknown', reason: 'Missing name or phone' });
            continue;
          }

          // Check phone duplicate
          if (phoneMap.has(row.phone)) {
            stats.skipped++;
            continue;
          }

          // Match project name
          let projectId = null;
          if (row.projectRaw) {
            const normalizedProject = row.projectRaw.toLowerCase().trim();
            projectId = projectMap.get(normalizedProject);
          }

          // Check unit+project duplicate
          if (projectId && row.unitReference) {
            const key = `${row.unitReference}|${projectId}`;
            if (unitProjectMap.has(key)) {
              stats.skipped++;
              continue;
            }
          }

          // Create landlord
          const landlordData = {
            full_name_en: row.fullName,
            phone: row.phone,
            whatsapp: row.phone,
            email: row.email,
            source: 'owner_import',
            stage: 'initial_contact',
            assigned_agent_email: currentUser.email,
            unit_reference: row.unitReference,
            project_name: row.projectRaw,
            project_id: projectId,
            location: row.location,
            residence_country: row.country,
            notes: row.notes || `Imported from spreadsheet`,
            lead_type: 'landlord_both',
          };

          const created = await base44.entities.Landlord.create(landlordData);
          stats.created++;
          stats.createdIds.push(created.id);
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
      toast.success(`Import complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errored} errors`);
    },
    onError: (err) => {
      toast.error('Import failed: ' + err.message);
    },
  });

  const handleImport = () => {
    importMutation.mutate();
  };

  const handleClose = () => {
    setFile(null);
    setRawData(null);
    setAiMapping(null);
    setPreview([]);
    setResults(null);
    setError(null);
    setStep('upload');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" />
            Smart Import Owners
          </DialogTitle>
          <DialogDescription>
            Upload an .xlsx or CSV owner list. It's parsed instantly in your browser and columns are auto-detected.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-accent/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-2">Excel (.xlsx) or CSV files</p>
              <p className="text-xs text-muted-foreground mt-1">Columns are auto-detected by header name</p>
              <Input
                ref={fileInputRef}
                id="owner-file"
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">How it works:</p>
              <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>Upload your spreadsheet (.xlsx or CSV)</li>
                <li>Columns are auto-detected and mapped to fields</li>
                <li>Review the preview with cleaned data</li>
                <li>Confirm to import as Landlord leads</li>
              </ol>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-lg font-medium">Reading your file...</p>
            <p className="text-sm text-muted-foreground mt-2">Parsing rows and detecting columns</p>
          </div>
        )}

        {step === 'preview' && aiMapping && (
          <div>
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Detected {rawData?.columns?.length} columns
                  </p>
                  {aiMapping.notes && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{aiMapping.notes}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Column Mapping:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(aiMapping.mappings).map(([field, column]) => (
                  column && (
                    <div key={field} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] w-32 justify-start">
                        {field.replace('_', ' ')}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono">{Array.isArray(column) ? column.join(', ') : column}</span>
                    </div>
                  )
                ))}
              </div>
            </div>

            <div className="mb-3 text-xs text-muted-foreground">
              Showing first {preview.length} rows for preview. All {rawData?.rows?.length || 0} rows will be imported.
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Unit</TableHead>
                    <TableHead className="text-xs">Project</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{row.fullName}</p>
                          {row.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {row.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs font-mono">{row.phone || '—'}</p>
                        </div>
                        {row.altPhones.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">+{row.altPhones.length} alt</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{row.unitReference || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs">{row.projectRaw || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs">{row.location || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">New</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button 
                onClick={handleImport} 
                disabled={importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Import All {rawData?.rows?.length || 0} Rows
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'error' && (
          <div className="py-6">
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-800 dark:text-red-200">Import Failed</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2">{error}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && results && (
          <div className="py-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{results.created}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Created</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{results.skipped}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Skipped (duplicates)</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{results.errored}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Errors</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded-lg p-3 mb-4">
                <p className="text-sm font-medium mb-2">Errors:</p>
                <ul className="text-xs space-y-1">
                  {results.errors.map((err, idx) => (
                    <li key={idx} className="text-red-600 dark:text-red-400">
                      <span className="font-medium">{err.row}:</span> {err.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.createdIds.length > 0 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg mb-4">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                  ✓ {results.createdIds.length} landlords created successfully
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  All records are in "Initial Contact" stage with source = "owner_import"
                </p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}