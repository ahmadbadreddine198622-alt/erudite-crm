import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, Loader2, FileCheck, Camera, FileSignature } from 'lucide-react';

const DOC_LABELS = {
  passport: 'Passport',
  emirates_id: 'Emirates ID',
  noc: 'NOC from Developer',
  noc_landlord: 'NOC from Landlord',
  form_a: 'Form A',
  ownership_proof: 'Title Deed / Oqood',
};

export default function ListingReadiness({ landlord, landlordPropertyId, photographyTask }) {
  // 1. Documents
  const { data: docsResponse, isLoading: docsLoading } = useQuery({
    queryKey: ['landlord-docs', landlord.id],
    queryFn: () => base44.functions.invoke('getLandlordDocuments', { landlord_id: landlord.id }),
    enabled: !!landlord.id,
  });

  const docs = docsResponse?.data?.documents || [];
  const verifiedCount = docs.filter((d) => d.status === 'verified').length;
  const totalDocs = 6;
  const docsReady = verifiedCount === totalDocs;
  const unverifiedDocs = docs.filter((d) => d.status !== 'verified').map((d) => DOC_LABELS[d.document_type] || d.document_type);

  // 2. Form A
  const formASigned =
    landlord.mandate_status === 'form_a_signed' ||
    (Array.isArray(landlord.form_a_contracts) &&
      landlord.form_a_contracts.some((c) => c.mandate_status === 'form_a_signed'));

  // 3. Media
  const task = photographyTask;
  const isHandedToListing = task?.task_stage === 'handed_to_listing';
  const has3D = !!task?.tour_3d_link;
  const hasVideo = !!task?.video_link;
  const hasPhotos = !!task?.photos_link;
  const mediaReady = isHandedToListing && has3D && hasVideo && hasPhotos;

  const mediaMissing = [];
  if (task) {
    if (!isHandedToListing) mediaMissing.push('not handed to listing');
    else {
      if (!has3D) mediaMissing.push('3D tour');
      if (!hasVideo) mediaMissing.push('video');
      if (!hasPhotos) mediaMissing.push('photos');
    }
  } else {
    mediaMissing.push('no photography task');
  }

  const allReady = docsReady && formASigned && mediaReady;

  // Build blocking summary
  const blockers = [];
  if (!docsReady) blockers.push(`${totalDocs - verifiedCount} doc${totalDocs - verifiedCount !== 1 ? 's' : ''} unverified`);
  if (!formASigned) blockers.push('Form A not signed');
  if (!mediaReady) blockers.push(mediaMissing.join(', '));

  if (docsLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Checking readiness…</span>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-3 border-b border-border space-y-3"
      style={{ background: allReady ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.04)' }}
    >
      {/* Overall verdict */}
      <div className="flex items-center gap-2">
        {allReady ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span
          className="text-sm font-semibold"
          style={{ color: allReady ? '#34d399' : 'hsl(38 92% 55%)' }}
        >
          {allReady ? '✅ Ready to list' : '⛔ Not ready'}
        </span>
        {!allReady && (
          <span className="text-xs text-muted-foreground truncate">
            — {blockers.join(' · ')}
          </span>
        )}
      </div>

      {/* Three check rows */}
      <div className="space-y-1.5">
        {/* Documents */}
        <div className="flex items-center gap-2">
          <FileCheck className={`w-3.5 h-3.5 shrink-0 ${docsReady ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>Documents</span>
          <span
            className={`text-xs font-semibold ml-auto ${docsReady ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {verifiedCount}/{totalDocs} verified
          </span>
          {docsReady ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          )}
        </div>

        {/* Form A */}
        <div className="flex items-center gap-2">
          <FileSignature className={`w-3.5 h-3.5 shrink-0 ${formASigned ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>Form A</span>
          <span
            className={`text-xs font-semibold ml-auto ${formASigned ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {formASigned ? 'Signed' : 'Not signed'}
          </span>
          {formASigned ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          )}
        </div>

        {/* Media */}
        <div className="flex items-center gap-2">
          <Camera className={`w-3.5 h-3.5 shrink-0 ${mediaReady ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>Media</span>
          <span
            className={`text-xs font-semibold ml-auto ${mediaReady ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {mediaReady ? 'Complete' : `Missing: ${mediaMissing.join(', ')}`}
          </span>
          {mediaReady ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}