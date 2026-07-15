// BuyerMandateDossierCard — read-only view of the Mandate Dossier forged for the
// unit this buyer is interested in. Surfaces the "why deal with Erudite" case
// (the same dossier the landlord received) so the agent can show the buyer the
// credibility + process behind the unit. Matched to the lead by unit_reference
// (primary) or project_name (fallback). Read-only — never edits the dossier.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, ExternalLink, Loader2, ShieldCheck, Award, Clock, Languages, Sparkles } from 'lucide-react';
import { PB } from '@/lib/buyerPipelineTokens';

const HAIR = PB.HAIR, HAIR2 = PB.HAIR2, WELL = PB.WELL, GOLD = PB.GOLD, SLATE = PB.SLATE, NAME = PB.NAME;

function norm(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ''); }

export default function BuyerMandateDossierCard({ unitReference, projectName }) {
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['buyer_mandate_dossiers', unitReference, projectName],
    queryFn: () => base44.entities.MandateDossier.list('-created_date', 100).catch(() => []),
    staleTime: 60000,
  });

  const matched = React.useMemo(() => {
    if (!dossiers?.length) return null;
    const u = norm(unitReference);
    const p = norm(projectName);
    // 1) exact unit match
    let hit = dossiers.find((d) => norm(d?.data_snapshot?.unit?.unit_reference) && norm(d.data_snapshot.unit.unit_reference) === u);
    if (!hit && p) {
      // 2) project match (latest dossier for the same project)
      hit = dossiers.find((d) => norm(d?.data_snapshot?.unit?.project_name) === p);
    }
    return hit || null;
  }, [dossiers, unitReference, projectName]);

  if (isLoading) {
    return (
      <div className="mb-4 flex items-center gap-2 p-2.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: GOLD }} />
        <span style={{ fontSize: 11, color: SLATE }}>Checking for mandate dossier…</span>
      </div>
    );
  }

  if (!matched) {
    // No dossier for this unit — silent (don't clutter the buyer page).
    return null;
  }

  const narrative = matched.narrative || {};
  const unit = matched.data_snapshot?.unit || {};
  const whyErudite = Array.isArray(narrative.why_erudite) ? narrative.why_erudite : [];
  const focus = matched.focus || 'sale';
  const writerName = matched.generated_by_name || 'Erudite Real Estate';

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <FileText className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
        <h3 style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Why Deal With Erudite
        </h3>
        <Chip>{focus}</Chip>
        {matched.version > 0 && <Chip title={`Dossier v${matched.version}`}>v{matched.version}</Chip>}
      </div>

      <div className="p-2.5 rounded-md" style={{ background: 'rgba(198,161,91,0.05)', border: '1px solid rgba(198,161,91,0.22)' }}>
        {/* Unit line */}
        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          <span style={{ fontSize: 11, fontWeight: 700, color: NAME }}>
            {unit.unit_reference || '—'}{unit.project_name ? ` · ${unit.project_name}` : ''}
          </span>
          {unit.unit_layout && <Chip>{unit.unit_layout}</Chip>}
        </div>

        {/* Cover tagline */}
        {narrative.cover_tagline && (
          <p style={{ fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 8 }}>
            “{narrative.cover_tagline}”
          </p>
        )}

        {/* The 5 why-Erudite blocks */}
        {whyErudite.length > 0 && (
          <div className="space-y-1.5">
            {whyErudite.map((w, i) => (
              <div key={i} className="p-2 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                <div className="flex items-start gap-1.5">
                  <WhyIcon index={i} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: NAME, display: 'block', marginBottom: 1 }}>{w.title}</span>
                    {w.body && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, display: 'block' }}>{w.body}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Property position (one-paragraph read) */}
        {narrative.property_position && (
          <div className="mt-2 p-2 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
            <span style={{ fontSize: 9, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Property Position</span>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 3, lineHeight: 1.45 }}>{narrative.property_position}</p>
          </div>
        )}

        {/* PDF link */}
        {matched.pdf_url && (
          <a href={matched.pdf_url} target="_blank" rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-1.5 w-full rounded-md"
            style={{ height: 34, background: 'rgba(198,161,91,0.14)', border: `1px solid ${GOLD}80`, color: GOLD, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
            <ExternalLink size={12} strokeWidth={1.5} />
            Open Full Dossier PDF
          </a>
        )}

        {/* Writer provenance */}
        <div className="mt-1.5 flex items-center gap-1" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          <ShieldCheck size={9} strokeWidth={1.5} />
          <span>Prepared by {writerName}{matched.forged_at ? ` · ${new Date(matched.forged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 999,
      background: 'transparent', border: `1px solid ${HAIR2}`, color: SLATE,
      fontSize: 9, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// Rotating credibility icons so the 5 blocks read visually distinct.
const WHY_ICONS = [Award, ShieldCheck, Clock, Languages, Sparkles];
function WhyIcon({ index }) {
  const Icon = WHY_ICONS[index % WHY_ICONS.length];
  return (
    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(198,161,91,0.08)', border: `1px solid ${HAIR2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon className="w-3 h-3" strokeWidth={1.5} style={{ color: GOLD }} />
    </div>
  );
}