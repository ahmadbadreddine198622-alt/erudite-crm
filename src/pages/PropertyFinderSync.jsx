import React, { useState, useEffect } from 'react';
import PFListingsGrid from '@/components/properties/PFListingsGrid';
import PFSettingsPanel from '@/components/propertyfinder/PFSettingsPanel';
import PFLeadTestPanel from '@/components/propertyfinder/PFLeadTestPanel';
import EruditePage from '@/components/erudite/EruditePage';
import { base44 } from '@/api/base44Client';
import { LayoutGrid, Settings, FlaskConical } from 'lucide-react';

const TABS = [
  { id: 'listings', label: 'My Listings', icon: LayoutGrid },
  { id: 'leads', label: 'Lead Sync Test', icon: FlaskConical },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function PropertyFinderSync() {
  const [tab, setTab] = useState('listings');
  const [environment, setEnvironment] = useState('sandbox');

  useEffect(() => {
    base44.functions.invoke('getPFCredentials', {}).then(res => {
      if (res?.data?.active_environment) setEnvironment(res.data.active_environment);
    }).catch(() => {});
  }, []);

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