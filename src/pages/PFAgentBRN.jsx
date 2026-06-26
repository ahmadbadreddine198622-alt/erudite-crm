import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function PFAgentBRN() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [brnValues, setBrnValues] = useState({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['pf-agent-brn-users'],
    queryFn: async () => {
      const res = await base44.entities.User.list('-created_date', 100);
      return res || [];
    },
  });

  // Initialize BRN values from fetched users
  useEffect(() => {
    const map = {};
    users.forEach(u => { if (!brnValues[u.id]) map[u.id] = u.brn || ''; });
    setBrnValues(prev => ({ ...map, ...prev }));
  }, [users]);

  const saveMutation = useMutation({
    mutationFn: async ({ userId, brn }) => {
      await base44.entities.User.update(userId, { brn: brn.trim() });
    },
    onSuccess: () => {
      toast.success('BRN saved');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['pf-agent-brn-users'] });
    },
    onError: (err) => toast.error('Failed to save: ' + err.message),
  });

  const activeAgents = users.filter(u => u.is_active !== false);
  const missingBrn = activeAgents.filter(u => !u.brn || !u.brn.trim());

  if (isLoading) {
    return (
      <div className="page-root flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title text-2xl font-semibold mb-1 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-accent" />
          Agent BRN Management
        </h1>
        <p className="page-subtitle">
          Each agent's RERA BRN is required by Property Finder for every published listing.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 55%)' }}>{activeAgents.length}</p>
            <p className="text-xs text-muted-foreground">Active Agents</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-emerald-400">{activeAgents.length - missingBrn.length}</p>
            <p className="text-xs text-muted-foreground">BRN Set</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-red-400">{missingBrn.length}</p>
            <p className="text-xs text-muted-foreground">Missing BRN</p>
          </CardContent>
        </Card>
      </div>

      {missingBrn.length > 0 && (
        <div className="mb-4 rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">
            {missingBrn.length} active agent{missingBrn.length !== 1 ? 's' : ''} missing BRN — listings cannot be published to Property Finder until set.
          </p>
        </div>
      )}

      {/* Agent list */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map(user => {
            const isEditing = editingId === user.id;
            const hasBrn = !!(user.brn && user.brn.trim());
            const isActive = user.is_active !== false;
            const isSaving = saveMutation.isPending && saveMutation.variables?.userId === user.id;

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: hasBrn ? 'rgba(34,197,94,0.15)' : 'rgba(244,63,94,0.12)', color: hasBrn ? '#4ade80' : '#fda4af' }}>
                  {(user.full_name || user.email || '?')[0]?.toUpperCase()}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate text-white/90">{user.full_name || user.email}</p>
                    {!isActive && <Badge variant="outline" className="text-[9px] opacity-50">inactive</Badge>}
                    {user.role === 'admin' && <Badge variant="outline" className="text-[9px]" style={{ color: 'hsl(38 92% 55%)', borderColor: 'hsl(38 92% 50% / 0.3)' }}>admin</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>

                {/* BRN field */}
                <div className="flex items-center gap-2 shrink-0">
                  {hasBrn && !isEditing ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-mono text-white/80">{user.brn}</span>
                      <button
                        onClick={() => { setEditingId(user.id); setBrnValues(prev => ({ ...prev, [user.id]: user.brn || '' })); }}
                        className="text-xs text-accent hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  ) : isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={brnValues[user.id] || ''}
                        onChange={e => setBrnValues(prev => ({ ...prev, [user.id]: e.target.value }))}
                        placeholder="e.g. 12345"
                        className="w-32 h-8 font-mono text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => saveMutation.mutate({ userId: user.id, brn: brnValues[user.id] || '' })}
                        disabled={isSaving}
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ background: 'hsl(38 92% 50% / 0.18)', border: '1px solid hsl(38 92% 50% / 0.35)', color: 'hsl(38 92% 60%)' }}
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-muted-foreground hover:text-white/70"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(user.id); setBrnValues(prev => ({ ...prev, [user.id]: user.brn || '' })); }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md"
                      style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af' }}
                    >
                      <AlertTriangle className="w-3 h-3" /> Set BRN
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}