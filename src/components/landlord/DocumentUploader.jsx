// Categorized document uploader for the landlord sidebar.
// Four categories: Form A, Form B, Form F, Others (passport, ID, any customer docs).
// Form A opens the existing FormAUploadDialog (auto-parses). The other three use a
// simple file picker → UploadFile → LandlordDocument record.

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, CheckCircle2, ExternalLink, X } from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';
import { useCurrentUser } from '@/lib/useCurrentUser';

const GOLD = 'hsl(38 92% 50%)';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

const CATEGORIES = [
  { key: 'form_a', label: 'Form A', icon: '📋', color: GOLD },
  { key: 'form_b', label: 'Form B', icon: '📋', color: '#93c5fd' },
  { key: 'form_f', label: 'Form F', icon: '📋', color: '#c4b5fd' },
  { key: 'other', label: 'Others', icon: '📎', color: '#34d399' },
];

const OTHER_LABELS = {
  passport: 'Passport',
  emirates_id: 'Emirates ID',
  noc: 'NOC',
  noc_landlord: 'NOC (Landlord)',
  ownership_proof: 'Ownership Proof',
  other: 'Other Document',
};

export default function DocumentUploader({ landlordId, landlordName, onUploadFormA }) {
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [uploading, setUploading] = useState(null); // category key currently uploading
  const [otherLabel, setOtherLabel] = useState('passport');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const fileRef = useRef(null);
  const [pendingCategory, setPendingCategory] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Fetch existing documents for this landlord
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['landlord-documents', landlordId],
    queryFn: async () => {
      if (!landlordId) return [];
      const res = await base44.entities.LandlordDocument.filter({ landlord_id: landlordId });
      return res || [];
    },
    enabled: !!landlordId,
  });

  const docsByCategory = (cat) => {
    if (cat === 'other') {
      return docs.filter((d) => !['form_a', 'form_b', 'form_f'].includes(d.document_type));
    }
    return docs.filter((d) => d.document_type === cat);
  };

  const handleCategoryClick = (cat) => {
    if (cat === 'form_a') {
      // Form A uses the dedicated parse dialog
      onUploadFormA?.();
      return;
    }
    // For "other", show the label picker first
    if (cat === 'other' && !showOtherInput) {
      setShowOtherInput(true);
      setPendingCategory(cat);
      return;
    }
    setPendingCategory(cat);
    setShowOtherInput(cat === 'other');
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingCategory) return;
    const cat = pendingCategory;

    setUploading(cat);
    try {
      // 1. Upload the file
      const upRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = upRes?.file_url || upRes?.data?.file_url;
      if (!fileUrl) throw new Error('Upload failed — no file URL returned');

      // 2. Determine document_type
      let docType = cat;
      if (cat === 'other') {
        docType = otherLabel;
      }

      // 3. Create the LandlordDocument record
      await base44.entities.LandlordDocument.create({
        landlord_id: landlordId,
        document_type: docType,
        status: 'received',
        file_url: fileUrl,
        file_name: file.name,
      });

      queryClient.invalidateQueries({ queryKey: ['landlord-documents', landlordId] });
      toast.success(`${CATEGORIES.find((c) => c.key === cat)?.label || 'Document'} uploaded ✓`);
      setShowOtherInput(false);
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || 'unknown error'));
    } finally {
      setUploading(null);
      setPendingCategory(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (docId) => {
    try {
      await base44.entities.LandlordDocument.delete(docId);
      queryClient.invalidateQueries({ queryKey: ['landlord-documents', landlordId] });
      toast.success('Document removed ✓');
    } catch (err) {
      toast.error('Failed to remove: ' + (err?.message || 'unknown error'));
    }
  };

  return (
    <div style={css("margin-top:16px;")}>
      {/* Section header */}
      <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
        <FileText size={14} style={{ color: GOLD }} />
        <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Documents</span>
      </div>

      {/* Category upload buttons — inline single row */}
      <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:12px; overflow-x:auto; padding-bottom:2px;")}>
        {CATEGORIES.map((cat) => {
          const isUp = uploading === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              disabled={isUp}
              style={css("flex:none; display:inline-flex; align-items:center; gap:7px; padding:9px 12px; border-radius:10px; border:1px solid " + cat.color + " / 0.4; background:" + cat.color + " / 0.1; color:" + cat.color + "; font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap; opacity:" + (isUp ? 0.6 : 1) + ";")}
            >
              {isUp ? <Loader2 size={13} className="animate-spin" /> : <span style={{ fontSize: 14 }}>{cat.icon}</span>}
              {isUp ? 'Uploading…' : `Upload ${cat.label}`}
            </button>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* "Other" sub-category picker */}
      {showOtherInput && (
        <div style={css("margin-bottom:12px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);")}>
          <div style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.45); margin-bottom:7px;")}>Document type</div>
          <div style={css("display:flex; flex-wrap:wrap; gap:6px;")}>
            {Object.entries(OTHER_LABELS).map(([val, lbl]) => {
              const active = otherLabel === val;
              return (
                <button
                  key={val}
                  onClick={() => setOtherLabel(val)}
                  style={css("padding:5px 10px; border-radius:7px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; border:1px solid " + (active ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.1)') + "; background:" + (active ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)') + "; color:" + (active ? '#34d399' : 'rgba(255,255,255,0.6)') + ";")}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { setPendingCategory('other'); fileRef.current?.click(); }}
            style={css("margin-top:8px; display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid rgba(52,211,153,0.4); background:rgba(52,211,153,0.12); color:#34d399;")}
          >
            <Upload size={12} /> Select file & upload
          </button>
        </div>
      )}

      {/* Existing documents grouped by category */}
      {isLoading ? (
        <div style={css("display:flex; justify-content:center; padding:16px;")}>
          <Loader2 size={16} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      ) : docs.length === 0 ? (
        <div style={css("font-size:11.5px; color:rgba(255,255,255,0.35); text-align:center; padding:14px 0;")}>No documents uploaded yet</div>
      ) : (
        <div style={css("display:flex; flex-direction:column; gap:10px;")}>
          {CATEGORIES.map((cat) => {
            const catDocs = docsByCategory(cat.key);
            if (catDocs.length === 0) return null;
            return (
              <div key={cat.key}>
                <div style={css("font-size:9.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:" + cat.color + "; margin-bottom:6px; opacity:0.8;")}>
                  {cat.icon} {cat.label}
                </div>
                <div style={css("display:flex; flex-direction:column; gap:5px;")}>
                  {catDocs.map((doc) => (
                    <div key={doc.id} style={css("display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                      <div
                        onClick={() => doc.file_url && setPreviewDoc(doc)}
                        style={css("display:flex; align-items:center; gap:7px; min-width:0; cursor:" + (doc.file_url ? 'pointer' : 'default') + "; flex:1;")}
                        title={doc.file_url ? 'Click to preview' : undefined}
                      >
                        <CheckCircle2 size={13} style={{ color: '#34d399', flex: 'none' }} />
                        <div style={css("min-width:0;")}>
                          <div style={css("font-size:11.5px; font-weight:500; color:" + (doc.file_url ? 'hsl(38 92% 70%)' : 'rgba(255,255,255,0.85)') + "; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>
                            {doc.file_name || OTHER_LABELS[doc.document_type] || doc.document_type}
                          </div>
                          <div style={css("font-size:9px; color:rgba(255,255,255,0.4); margin-top:1px;")}>
                            {OTHER_LABELS[doc.document_type] || doc.document_type}
                          </div>
                        </div>
                      </div>
                      <div style={css("display:flex; align-items:center; gap:5px; flex:none;")}>
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Open in new tab" style={css("display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; color:hsl(38 92% 62%); background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3);")}>
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(doc.id)} title="Remove document (admin only)" style={css("display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); cursor:pointer;")}>
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}