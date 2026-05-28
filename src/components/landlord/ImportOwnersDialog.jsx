import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2, MapPin, Phone, Mail, User, Building } from 'lucide-react';
import { toast } from 'sonner';

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

export default function ImportOwnersDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [aiMapping, setAiMapping] = useState(null);
  const [preview, setPreview] = useState([]);
  const [step, setStep] = useState('upload'); // upload | analyzing | preview | processing | done
  const [results, setResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Step 1: Upload and read file
  const handleFileChange = async (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setStep('analyzing');
    
    try {
      // Upload file to get URL
      const fileUrl = await base44.integrations.Core.UploadFile({ file: uploadedFile });
      
      // Extract ALL data from file using AI
      const jsonSchema = {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              description: 'Each row represents one owner/contact record',
              additionalProperties: true,
            },
          },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of all column headers found in the file',
          },
        },
        required: ['rows', 'columns'],
      };

      const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl.file_url,
        json_schema: jsonSchema,
      });

      if (extractionResult.status !== 'success' || !extractionResult.output?.rows) {
        throw new Error('Failed to extract data from file');
      }

      const { rows, columns } = extractionResult.output;
      setRawData({ rows, columns, fileUrl: fileUrl.file_url });

      // Step 2: AI Column Analysis
      const analysisPrompt = `I have a spreadsheet with owner/contact data. The columns are: ${columns.join(', ')}

Analyze these column names and tell me which column maps to each of these target fields:
- owner_name (full name of owner/contact)
- phone_primary (main phone number)
- phone_secondary (additional phone numbers if any)
- email
- unit_reference (unit/apartment number)
- project_name (building/development name)
- location (area/community)
- bedrooms (number of rooms/bedrooms)
- size (area in sqft or sqm)
- country (nationality/residence)
- notes (any other useful info)

For phone_secondary, if there are multiple phone columns, list them as an array.

Respond with a JSON object in this exact format:
{
  "mappings": {
    "owner_name": "exact_column_name_from_file",
    "phone_primary": "exact_column_name_from_file",
    "phone_secondary": ["column1", "column2"],
    "email": "exact_column_name_from_file",
    "unit_reference": "exact_column_name_from_file",
    "project_name": "exact_column_name_from_file",
    "location": "exact_column_name_from_file",
    "bedrooms": "exact_column_name_from_file",
    "size": "exact_column_name_from_file",
    "country": "exact_column_name_from_file",
    "notes": ["any_other_relevant_columns"]
  },
  "confidence": "high|medium|low",
  "notes": "any observations about the data structure"
}

If a field cannot be mapped, set it to null. Be intelligent about column name variations.`;

      const analysisResult = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            mappings: {
              type: 'object',
              properties: {
                owner_name: { type: 'string' },
                phone_primary: { type: 'string' },
                phone_secondary: { type: 'array', items: { type: 'string' } },
                email: { type: 'string' },
                unit_reference: { type: 'string' },
                project_name: { type: 'string' },
                location: { type: 'string' },
                bedrooms: { type: 'string' },
                size: { type: 'string' },
                country: { type: 'string' },
                notes: { type: 'array', items: { type: 'string' } },
              },
            },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            notes: { type: 'string' },
          },
          required: ['mappings', 'confidence'],
        },
      });

      setAiMapping(analysisResult);

      // Step 3: Clean and prepare preview data
      const sampleRows = rows.slice(0, 10);
      const cleanedPreview = sampleRows.map((row, idx) => {
        const mappings = analysisResult.mappings;
        
        // Get raw values
        const rawPhone = mappings.phone_primary ? row[mappings.phone_primary] : null;
        const rawSecondaryPhones = mappings.phone_secondary 
          ? mappings.phone_secondary.map(col => row[col]).filter(Boolean)
          : [];
        
        // Clean phone
        const cleanedPhone = cleanPhone(rawPhone);
        const cleanedSecondaryPhones = rawSecondaryPhones.map(cleanPhone).filter(Boolean);

        // Build notes from unmapped columns
        const notesParts = [];
        if (mappings.bedrooms && row[mappings.bedrooms]) {
          notesParts.push(`Rooms: ${row[mappings.bedrooms]}`);
        }
        if (mappings.size && row[mappings.size]) {
          notesParts.push(`Size: ${row[mappings.size]}`);
        }
        if (mappings.notes) {
          mappings.notes.forEach(col => {
            if (row[col]) notesParts.push(`${col}: ${row[col]}`);
          });
        }

        return {
          rowIdx: idx,
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
      });

      setPreview(cleanedPreview);
      setStep('preview');
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to process file: ' + err.message);
      setStep('upload');
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

      for (const row of preview) {
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
            AI-powered importer that works with ANY spreadsheet format. Upload your file and AI will automatically detect columns.
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
              <p className="text-xs text-muted-foreground mt-1">Works with ANY column layout - AI will auto-detect</p>
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
                <li>Upload your spreadsheet (any format)</li>
                <li>AI analyzes columns and maps them to fields</li>
                <li>Review the preview with cleaned data</li>
                <li>Confirm to import as Landlord leads</li>
              </ol>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-lg font-medium">Analyzing your file...</p>
            <p className="text-sm text-muted-foreground mt-2">AI is detecting columns and cleaning data</p>
          </div>
        )}

        {step === 'preview' && aiMapping && (
          <div>
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    AI detected {rawData?.columns?.length} columns with {aiMapping.confidence} confidence
                  </p>
                  {aiMapping.notes && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{aiMapping.notes}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium mb-2">AI Column Mapping:</p>
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