// Document preview modal — styled per the design reference image.
// Dark navy (#131620) container, muted gold (#D9A05C) accents, dashed-border preview area.
// Previews PDFs (iframe) and images (img). Other file types get a download fallback.

import React, { useState } from 'react';
import { FileText, X, Download, Upload } from 'lucide-react';

const GOLD = '#D9A05C';
const BG = '#131620';
const MUTED = '#85899A';

const TYPE_LABELS = {
  form_a: 'Form A',
  form_b: 'Form B',
  form_f: 'Form F',
  passport: 'Passport',
  emirates_id: 'Emirates ID',
  noc: 'NOC',
  noc_landlord: 'NOC (Landlord)',
  ownership_proof: 'Ownership Proof',
  other: 'Document',
};

export default function DocumentPreviewModal({ doc, onClose }) {
  const [loading, setLoading] = useState(true);
  if (!doc) return null;

  const label = TYPE_LABELS[doc.document_type] || TYPE_LABELS.other;
  const fileName = doc.file_name || `${label} file`;
  const url = doc.file_url;
  const isPdf = /\.pdf$/i.test(url || '') || doc.document_type?.startsWith('form_');
  const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(url || '');

  const handleReplace = () => {
    // Placeholder — the parent can wire a replace-upload flow if desired
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}
      />
      {/* Modal container */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 9999, width: 'min(680px, 92vw)', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          background: BG, borderRadius: 14,
          border: `1px solid ${GOLD}55`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          fontFamily: "'Inter',sans-serif", color: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${GOLD}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 10,
              background: `${GOLD}1a`, border: `1px solid ${GOLD}44`,
            }}>
              <FileText size={18} color={GOLD} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{label}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{fileName}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
              background: 'transparent', border: `1px solid ${GOLD}55`,
            }}
          >
            <X size={15} color={GOLD} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', overflow: 'auto', flex: 1, minHeight: 0 }}>
          {/* Preview area — dashed gold border, per the reference image */}
          <div style={{
            borderRadius: 12,
            border: `1.5px dashed ${GOLD}77`,
            background: `${GOLD}08`,
            minHeight: 320,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {loading && isPdf && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: MUTED }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${GOLD}33`, borderTopColor: GOLD, animation: 'docSpin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12 }}>Loading preview…</span>
                <style>{`@keyframes docSpin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            {isPdf && (
              <iframe
                src={url}
                title={fileName}
                onLoad={() => setLoading(false)}
                style={{ width: '100%', height: '60vh', border: 'none', background: 'transparent' }}
              />
            )}
            {isImage && (
              <img
                src={url}
                alt={fileName}
                onLoad={() => setLoading(false)}
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 8 }}
              />
            )}
            {!isPdf && !isImage && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52, borderRadius: 12,
                  background: `${GOLD}1a`, border: `1px solid ${GOLD}44`,
                }}>
                  <Upload size={22} color={GOLD} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{fileName}</div>
                <div style={{ fontSize: 11, color: MUTED }}>Preview not available for this file type</div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                    background: `${GOLD}1a`, border: `1px solid ${GOLD}55`, color: GOLD,
                    textDecoration: 'none',
                  }}
                >
                  <Download size={14} /> Download file
                </a>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontSize: 11, color: MUTED }}>
              {doc.status ? `Status: ${doc.status}` : ''}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                background: `${GOLD}1a`, border: `1px solid ${GOLD}55`, color: GOLD,
                textDecoration: 'none', cursor: 'pointer',
              }}
            >
              <Download size={14} /> Open full screen
            </a>
          </div>
        </div>
      </div>
    </>
  );
}