import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { CheckCircle2, Circle, Loader2, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';

const MOTIVATION_OPTIONS = [
  'Relocating for work',
  'Cashing out investment',
  'Upgrading to larger property',
  'Downsizing',
  'Financial need / distressed',
  'Inherited property',
  'Poor rental returns',
  'Just testing the market',
  'Moving overseas',
  'Divorce / separation',
];

const TIMELINE_OPTIONS = [
  'ASAP / Urgent (within 2 weeks)',
  '1-3 months',
  '3-6 months',
  '6-12 months',
  'No rush / Just testing',
  'Not discussed yet',
];

const MANDATE_OPTIONS = [
  'Open to exclusive mandate',
  'Non-exclusive only',
  'Already with other brokers',
  'Wants to self-sell',
  'Undecided',
  'Not discussed yet',
];

export default function QualifyPanel({ landlord }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [selectedMotivation, setSelectedMotivation] = useState('');
  const [selectedTimeline, setSelectedTimeline] = useState('');
  const [selectedMandate, setSelectedMandate] = useState('');

  // Fetch latest qualification for this landlord
  const { data: qualifications = [], isLoading } = useQuery({
    queryKey: ['call-qualifications', landlord.id],
    queryFn: async () => {
      const rows = await base44.entities.CallQualification.filter(
        { landlord_id: landlord.id },
        '-call_date',
        10
      );
      return rows || [];
    },
    enabled: !!landlord.id,
  });

  const latestQual = qualifications[0];

  const saveMutation = useMutation({
    mutationFn: async (qualificationData) => {
      const now = new Date().toISOString();
      const data = {
        landlord_id: landlord.id,
        landlord_name: landlord.full_name_en || landlord.full_name,
        agent_email: user.email,
        call_date: now,
        ...qualificationData,
      };

      return await base44.entities.CallQualification.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-qualifications', landlord.id] });
      toast.success('Qualification saved');
      // Reset form
      setSelectedMotivation('');
      setSelectedTimeline('');
      setSelectedMandate('');
      setNotes('');
    },
    onError: (e) => toast.error('Failed to save: ' + e.message),
  });

  const handleSave = () => {
    if (!selectedMotivation && !selectedTimeline && !selectedMandate && !notes) {
      toast.error('Please fill in at least one field');
      return;
    }

    saveMutation.mutate({
      motivation: selectedMotivation ? selectedMotivation.toLowerCase().replace(/\s+/g, '_') : null,
      motivation_notes: selectedMotivation,
      timeline_urgency: selectedTimeline ? selectedTimeline.toLowerCase().replace(/\s+/g, '_') : null,
      mandate_openness: selectedMandate ? selectedMandate.toLowerCase().replace(/\s+/g, '_') : null,
      agent_notes: notes,
      call_outcome: 'interested_proceeding',
      rapport_after_call: landlord.rapport_level || 'warming',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>
            Landlord Qualification
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {qualifications.length} qualification{qualifications.length !== 1 ? 's' : ''} logged
          </p>
        </div>
        {latestQual && (
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground">Last qualified</span>
            <p className="text-xs font-medium" style={{ color: 'hsl(38 92% 55%)' }}>
              {new Date(latestQual.call_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        )}
      </div>

      {/* Auto-suggestion fields */}
      <div className="space-y-3">
        {/* Motivation */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Motivation
          </label>
          <div className="relative">
            <select
              value={selectedMotivation}
              onChange={(e) => setSelectedMotivation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <option value="">Select motivation...</option>
              {MOTIVATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt} style={{ background: '#1a1f2e' }}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Timeline / Urgency
          </label>
          <select
            value={selectedTimeline}
            onChange={(e) => setSelectedTimeline(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <option value="">Select timeline...</option>
            {TIMELINE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} style={{ background: '#1a1f2e' }}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Mandate */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Mandate Openness
          </label>
          <select
            value={selectedMandate}
            onChange={(e) => setSelectedMandate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <option value="">Select mandate status...</option>
            {MANDATE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} style={{ background: '#1a1f2e' }}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add qualification notes..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium resize-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.9)',
            }}
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs transition-all"
          style={{
            background: 'hsl(38 92% 50%)',
            color: '#1a1205',
          }}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Save Qualification
            </>
          )}
        </button>
      </div>

      {/* Historical qualifications */}
      {qualifications.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
              History
            </span>
          </div>
          <div className="space-y-2">
            {qualifications.slice(0, 5).map((qual) => (
              <div
                key={qual.id}
                className="p-2.5 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" style={{ color: 'hsl(38 92% 55%)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {qual.motivation_notes || 'Qualification logged'}
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(qual.call_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {qual.agent_notes && (
                  <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {qual.agent_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}