import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Phone cleaning: "971|52-3828133" or "971|0502916788" → "+971523828133"
function cleanPhone(raw) {
  if (!raw) return null;
  let cleaned = raw.toString().replace(/[|\-]/g, '');
  if (cleaned.startsWith('971')) {
    cleaned = cleaned.replace(/^9710+/, '971');
  }
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

// Match project name variations to canonical project
function matchProjectName(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  const mappings = {
    'peninsula one': 'Peninsula 1',
    'peninsula 1': 'Peninsula 1',
    'peninsula two': 'Peninsula 2',
    'peninsula 2': 'Peninsula 2',
    'peninsula three': 'Peninsula 3',
    'peninsula 3': 'Peninsula 3',
    'peninsula four': 'Peninsula 4',
    'peninsula 4': 'Peninsula 4',
    'peninsula five': 'Peninsula 5',
    'peninsula 5': 'Peninsula 5',
    'jumeirah living': 'Jumeirah Living',
    'six senses': 'Six Senses',
    'six senses palm jumeirah': 'Six Senses',
    'marina gate': 'Marina Gate',
    'the edge a': 'The Edge A',
    'the edge b': 'The Edge B',
  };
  return mappings[normalized] || name;
}

export default function ImportOwnersDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [step, setStep] = useState('upload'); // upload | preview | processing | done
  const [results, setResults] = useState(null);

  const parseFile = useCallback(async (uploadedFile) => {
    const fileUrl = await base44.integrations.Core.UploadFile({ file: uploadedFile });
    const jsonSchema = {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              Location: { type: 'string' },
              'Project Name': { type: 'string' },
              'Unit Number': { type: 'string' },
              Rooms: { type: 'string' },
              Size: { type: 'string' },
              'Owner Name': { type: 'string' },
              Mobile1: { type: 'string' },
              Mobile2: { type: 'string' },
              Mobile3: { type: 'string' },
              Email: { type: 'string' },
              'Owner Country': { type: 'string' },
            },
          },
        },
      },
    };
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl.file_url,
      json_schema: jsonSchema,
    });
    if (result.status === 'success' && result.output?.rows) {
      return result.output.rows;
    }
    throw new Error('Failed to parse file');
  }, []);

  const handleFileChange = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    try {
      const rows = await parseFile(uploadedFile);
      const mapped = rows.slice(0, 10).map((row, idx) => {
        const primaryPhone = cleanPhone(row.Mobile1);
        const altPhones = [row.Mobile2, row.Mobile3].filter(Boolean).map(cleanPhone).filter(Boolean);
        const projectName = matchProjectName(row['Project Name']);
        return {
          rowIdx: idx,
          fullName: row['Owner Name'] || 'Unknown',
          phone: primaryPhone,
          altPhones,
          email: row.Email,
          unitReference: row['Unit Number'],
          projectRaw: row['Project Name'],
          projectMatched: projectName,
          location: row.Location,
          rooms: row.Rooms,
          size: row.Size,
          country: row['Owner Country'],
          raw: row,
        };
      });
      setPreview(mapped);
      setStep('preview');
    } catch (err) {
      toast.error('Failed to parse file: ' + err.message);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const allRows = await parseFile(file);
      const stats = { created: 0, skipped: 0, errored: 0, errors: [] };
      
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
      
      // Project name to ID map
      const projectMap = new Map();
      existingProjects.forEach(p => {
        projectMap.set(p.name.toLowerCase(), p.id);
        // Also add common variations
        if (p.name.includes('Peninsula')) {
          const num = p.name.match(/\d+/);
          if (num) {
            projectMap.set(`peninsula ${num[0]}`, p.id);
            projectMap.set(`peninsula ${['one','two','three','four','five'][parseInt(num[0])-1]}`, p.id);
          }
        }
      });

      for (const row of allRows) {
        try {
          const primaryPhone = cleanPhone(row.Mobile1);
          const altPhones = [row.Mobile2, row.Mobile3].filter(Boolean).map(cleanPhone).filter(Boolean);
          const projectName = matchProjectName(row['Project Name']);
          
          if (!primaryPhone || !row['Owner Name']) {
            stats.errored++;
            stats.errors.push({ row: row['Owner Name'] || 'Unknown', reason: 'Missing name or phone' });
            continue;
          }

          // Check duplicates
          if (phoneMap.has(primaryPhone)) {
            stats.skipped++;
            continue;
          }

          // Get project ID
          const projectId = projectMap.get(projectName?.toLowerCase());
          if (projectId) {
            const key = `${row['Unit Number']}|${projectId}`;
            if (unitProjectMap.has(key)) {
              stats.skipped++;
              continue;
            }
          }

          // Create landlord
          const landlordData = {
            full_name_en: row['Owner Name'],
            phone: primaryPhone,
            whatsapp: primaryPhone,
            email: row.Email,
            source: 'owner_import',
            stage: 'initial_contact',
            assigned_agent_email: (await base44.auth.me()).email,
            unit_reference: row['Unit Number'],
            project_name: row['Project Name'],
            project_id: projectId,
            location: row.Location,
            residence_country: row['Owner Country'],
            notes: `Rooms: ${row.Rooms || 'N/A'} | Size: ${row.Size || 'N/A'} | Alt phones: ${altPhones.join(', ') || 'None'}`,
            lead_type: 'landlord_both',
          };

          await base44.entities.Landlord.create(landlordData);
          stats.created++;
        } catch (err) {
          stats.errored++;
          stats.errors.push({ row: row['Owner Name'] || 'Unknown', reason: err.message });
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
    setPreview([]);
    setResults(null);
    setStep('upload');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" />
            Import Property Owners
          </DialogTitle>
          <DialogDescription>
            Upload Excel/CSV with owner data. Creates Landlord leads in Initial Contact stage.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="owner-file" className="cursor-pointer">
                <span className="text-sm font-medium">Click to upload or drag and drop</span>
                <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) or CSV files</p>
                <Input
                  id="owner-file"
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <p className="font-medium">Expected columns:</p>
              <p>Location, Project Name, Unit Number, Rooms, Size, Owner Name, Mobile1, Mobile2, Mobile3, Email, Owner Country</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Preview showing first {preview.length} rows. Phones will be cleaned to international format.
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto border rounded-lg">
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
                          {row.email && <p className="text-xs text-muted-foreground">{row.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-mono">{row.phone || '—'}</p>
                        {row.altPhones.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">+{row.altPhones.length} alt</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{row.unitReference || '—'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs">{row.projectMatched || row.projectRaw}</p>
                          {row.projectRaw !== row.projectMatched && (
                            <Badge variant="outline" className="text-[10px] mt-0.5">matched</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{row.location || '—'}</TableCell>
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
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? 'Importing...' : `Import All ${preview.length} Rows`}
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
              <div className="max-h-48 overflow-y-auto border rounded-lg p-3">
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

            <DialogFooter className="mt-6">
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}