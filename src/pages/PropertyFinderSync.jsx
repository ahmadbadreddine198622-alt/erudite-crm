import React, { useState, useEffect } from 'react';
import PFListingsGrid from '@/components/properties/PFListingsGrid';
import PFSettingsPanel from '@/components/propertyfinder/PFSettingsPanel';
import PFLeadTestPanel from '@/components/propertyfinder/PFLeadTestPanel';
import EruditePage from '@/components/erudite/EruditePage';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { LayoutGrid, Settings, FlaskConical, Lock } from 'lucide-react';

// Property Finder listings are restricted to Malik Ahmad Francis Ajwa only.
const PF_ACCESS_EMAILS = ['malik@erudite-estate.com'];

const TABS = [
  { id: 'listings', label: 'My Listings', icon: LayoutGrid },
  { id: 'leads', label: 'Lead Sync Test', icon: FlaskConical },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function PropertyFinderSync() {
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState('listings');
  const [environment, setEnvironment] = useState('sandbox');

  const allowed = !!(user?.email && PF_ACCESS_EMAILS.includes(user.email.toLowerCase()));

  useEffect(() => {
    if (!allowed) return;
    base44.functions.invoke('getPFCredentials', {}).then(res => {
      if (res?.data?.active_environment) setEnvironment(res.data.active_environment);
    }).catch(() => {});
  }, [allowed]);

  useEffect(() => {
    base44.functions.invoke('getPFCredentials', {}).then(res => {
      if (res?.data?.active_environment) setEnvironment(res.data.active_environment);
    }).catch(() => {});
  }, []);

  if (loading) {
    return (
      <EruditePage title="Property Finder" subtitle="…">
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Checking access…</div>
      </EruditePage>
    );
  }

  if (!allowed) {
    return (
      <EruditePage title="Property Finder" subtitle="Restricted">
        <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500/10 border border-amber-500/30 mb-4">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Access restricted</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Property Finder listings are only visible to Malik Ahmad Francis Ajwa. Contact an administrator if you believe this is an error.
          </p>
        </div>
      </EruditePage>
    );
  }

  return (
    <EruditePage
      title="Property Finder"
      subtitle={environment === 'sandbox' ? '🧪 Sandbox mode active' : '🟢 Production'}
    >
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/20 border border-border mb-6 max-w-md">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              tab === id
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'listings' && <PFListingsGrid />}
      {tab === 'leads' && (
        <div className="max-w-xl">
          <PFLeadTestPanel environment={environment} />
        </div>
      )}
      {tab === 'settings' && (
        <PFSettingsPanel />
      )}
    </EruditePage>
  );
}