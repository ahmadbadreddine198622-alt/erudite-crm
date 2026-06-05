import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EruditePage from '@/components/erudite/EruditePage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, ChevronRight, CheckCircle2, Clock, ArrowLeft, Users, AlertTriangle, FileText, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

const CATEGORY_COLORS = {
  'Listing & Commission': { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  'HR':                   { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
  'Compliance':           { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  'Operations':           { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf', border: 'rgba(20,184,166,0.3)' },
};

const STATUS_COLORS = {
  Active:   { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  Draft:    { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
  Archived: { bg: 'rgba(100,116,139,0.1)', text: '#64748b', border: 'rgba(100,116,139,0.3)' },
};

function ColorBadge({ label, colors }) {
  if (!colors) return <span className="text-xs text-white/40">{label}</span>;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
      {label}
    </span>
  );
}

function PolicyCard({ policy, onClick, isAcknowledged }) {
  const catColors = CATEGORY_COLORS[policy.category];
  const statusColors = STATUS_COLORS[policy.status];
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <ColorBadge label={policy.category} colors={catColors} />
            <ColorBadge label={policy.status} colors={statusColors} />
            {policy.version && (
              <span className="text-[10px] text-white/30 font-mono">{policy.version}</span>
            )}
          </div>
          <p className="font-semibold text-sm text-white/90 truncate">{policy.title}</p>
          {policy.effective_date && (
            <p className="text-xs text-white/35 mt-1">Effective: {format(new Date(policy.effective_date), 'dd MMM yyyy')}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {policy.requires_acknowledgment && (
            isAcknowledged
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <Clock className="w-4 h-4 text-amber-400" />
          )}
          <ChevronRight className="w-4 h-4 text-white/30" />
        </div>
      </div>
    </button>
  );
}

function PolicyDetail({ policy, onBack, currentUser, acknowledgments, onAcknowledge, isAcknowledging }) {
  const myAck = acknowledgments.find(a => a.policy_id === policy.id && a.agent_email === currentUser?.email);
  const [brn, setBrn] = useState(currentUser?.brn || '');

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Policies
      </button>

      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <ColorBadge label={policy.category} colors={CATEGORY_COLORS[policy.category]} />
          <ColorBadge label={policy.status} colors={STATUS_COLORS[policy.status]} />
          {policy.version && <span className="text-xs font-mono text-white/40">{policy.version}</span>}
        </div>

        <h1 className="text-2xl font-display font-semibold text-white/95">{policy.title}</h1>

        {policy.effective_date && (
          <p className="text-sm text-white/40">Effective: {format(new Date(policy.effective_date), 'dd MMMM yyyy')}</p>
        )}

        <div className="gold-divider" />

        <div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed">
          <ReactMarkdown>{policy.body || '*No content yet.*'}</ReactMarkdown>
        </div>
      </div>

      {policy.requires_acknowledgment && (
        <div className="rounded-2xl p-5" style={{ background: myAck ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${myAck ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
          {myAck ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-400">Acknowledged</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Signed {format(new Date(myAck.acknowledged_at), 'dd MMM yyyy, HH:mm')}
                  {myAck.agent_brn ? ` · BRN: ${myAck.agent_brn}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-semibold text-amber-400">Acknowledgment Required</p>
              </div>
              <p className="text-xs text-white/50">Please read the full policy above, then confirm your agreement below.</p>
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  placeholder="Your BRN (optional)"
                  value={brn}
                  onChange={e => setBrn(e.target.value)}
                  className="w-44 h-8 text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
                <Button
                  onClick={() => onAcknowledge(policy, brn)}
                  disabled={isAcknowledging}
                  className="h-8 text-xs px-4"
                  style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  {isAcknowledging ? 'Saving…' : 'I have read and agree'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AckTracker({ policies, acknowledgments, users }) {
  const activePolicies = policies.filter(p => p.status === 'Active' && p.requires_acknowledgment);

  if (activePolicies.length === 0) {
    return <p className="text-sm text-white/40 py-8 text-center">No active policies requiring acknowledgment.</p>;
  }

  return (
    <div className="space-y-6">
      {activePolicies.map(policy => {
        const policyAcks = acknowledgments.filter(a => a.policy_id === policy.id);
        const ackedEmails = new Set(policyAcks.map(a => a.agent_email));
        const pending = users.filter(u => !ackedEmails.has(u.email));

        return (
          <div key={policy.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-sm font-semibold text-white/90">{policy.title}</p>
                <p className="text-xs text-white/40">{policy.version} · {policy.category}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-semibold">{policyAcks.length} signed</span>
                {pending.length > 0 && <span className="text-amber-400 font-semibold">{pending.length} pending</span>}
              </div>
            </div>

            <div className="divide-y" style={{ divideColor: 'rgba(255,255,255,0.05)' }}>
              {policyAcks.map(ack => (
                <div key={ack.id} className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-white/80">{ack.agent_name || ack.agent_email}</span>
                    {ack.agent_brn && <span className="text-xs text-white/35 font-mono">BRN: {ack.agent_brn}</span>}
                  </div>
                  <span className="text-xs text-white/35">{format(new Date(ack.acknowledged_at), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              ))}
              {pending.map(user => (
                <div key={user.id} className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(245,158,11,0.03)' }}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
                    <span className="text-sm text-white/50">{user.full_name || user.email}</span>
                  </div>
                  <span className="text-xs text-amber-400/50">Pending</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Policies() {
  const queryClient = useQueryClient();
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [activeTab, setActiveTab] = useState('policies');
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const { data: policies = [] } = useQuery({
    queryKey: ['company-policies'],
    queryFn: () => base44.entities.CompanyPolicy.list('-effective_date', 200),
  });

  const { data: acknowledgments = [] } = useQuery({
    queryKey: ['policy-acknowledgments'],
    queryFn: () => base44.entities.PolicyAcknowledgment.list('-acknowledged_at', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin && activeTab === 'tracker',
  });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ policy, brn }) => base44.entities.PolicyAcknowledgment.create({
      agent_email: currentUser.email,
      agent_name: currentUser.full_name || currentUser.email,
      policy_id: policy.id,
      policy_title: policy.title,
      policy_version: policy.version,
      acknowledged_at: new Date().toISOString(),
      agent_brn: brn || '',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policy-acknowledgments'] }),
  });

  const visiblePolicies = useMemo(() => {
    return policies.filter(p => {
      if (p.status === 'Archived' && !isAdmin) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [policies, isAdmin, search]);

  const grouped = useMemo(() => {
    const order = ['Listing & Commission', 'HR', 'Compliance', 'Operations'];
    const map = {};
    visiblePolicies.forEach(p => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return order.filter(cat => map[cat]).map(cat => ({ category: cat, items: map[cat] }));
  }, [visiblePolicies]);

  const myAckSet = useMemo(() =>
    new Set(acknowledgments.filter(a => a.agent_email === currentUser?.email).map(a => a.policy_id)),
    [acknowledgments, currentUser]
  );

  const pendingCount = useMemo(() =>
    policies.filter(p => p.status === 'Active' && p.requires_acknowledgment && !myAckSet.has(p.id)).length,
    [policies, myAckSet]
  );

  if (selectedPolicy) {
    return (
      <EruditePage>
        <PolicyDetail
          policy={selectedPolicy}
          onBack={() => setSelectedPolicy(null)}
          currentUser={currentUser}
          acknowledgments={acknowledgments}
          onAcknowledge={(policy, brn) => acknowledgeMutation.mutate({ policy, brn })}
          isAcknowledging={acknowledgeMutation.isPending}
        />
      </EruditePage>
    );
  }

  return (
    <EruditePage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-semibold text-white/95 flex items-center gap-3">
              <Shield className="w-7 h-7 text-amber-400" />
              Policies & HR
            </h1>
            <p className="text-sm text-white/40 mt-1">Company policies, compliance documents, and HR guidelines</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
              <AlertTriangle className="w-4 h-4" />
              {pendingCount} policy{pendingCount > 1 ? 'ies' : ''} require your signature
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setActiveTab('policies')}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: activeTab === 'policies' ? '#c9a85c' : 'transparent', color: activeTab === 'policies' ? '#0a1320' : 'rgba(255,255,255,0.55)' }}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1.5" />
            Policies
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('tracker')}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: activeTab === 'tracker' ? '#c9a85c' : 'transparent', color: activeTab === 'tracker' ? '#0a1320' : 'rgba(255,255,255,0.55)' }}
            >
              <Users className="w-3.5 h-3.5 inline mr-1.5" />
              Acknowledgment Tracker
            </button>
          )}
        </div>

        {activeTab === 'policies' && (
          <div className="space-y-6">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search policies…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>

            {grouped.length === 0 && (
              <p className="text-center text-white/40 py-16">No policies found.</p>
            )}

            {grouped.map(({ category, items }) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: CATEGORY_COLORS[category]?.text || 'rgba(255,255,255,0.4)' }}>
                    {category}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <span className="text-xs text-white/25">{items.length}</span>
                </div>
                {items.map(policy => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onClick={() => setSelectedPolicy(policy)}
                    isAcknowledged={myAckSet.has(policy.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tracker' && isAdmin && (
          <AckTracker
            policies={policies}
            acknowledgments={acknowledgments}
            users={users}
          />
        )}
      </div>
    </EruditePage>
  );
}