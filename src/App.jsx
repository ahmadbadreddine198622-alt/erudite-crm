import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Pipeline from '@/pages/Pipeline';
import Leads from '@/pages/Leads';
import Properties from '@/pages/Properties';
import MapView from '@/pages/MapView';
import Commissions from '@/pages/Commissions';
import Reminders from './pages/Reminders';
import WhatsAppInbox from '@/pages/WhatsAppInbox';
import Inbox from '@/pages/Inbox';
import Analytics from '@/pages/Analytics';
import Team from '@/pages/Team';
import Contacts from '@/pages/Contacts';
import Offers from '@/pages/Offers';
import TeamOS from '@/pages/TeamOS';
import Finance from '@/pages/Finance';
import TeamDashboard from '@/pages/TeamDashboard';
import MyDashboard from '@/pages/MyDashboard';
import SalesAnalytics from '@/pages/SalesAnalytics';
import Calendar from '@/pages/Calendar';
import MetaAdsLeads from '@/pages/MetaAdsLeads';
import WhatsAppSetup from '@/pages/WhatsAppSetup';
import WhatsAppHub from '@/pages/WhatsAppHub';
import InstagramLeads from '@/pages/InstagramLeads';
import ClaudeAI from '@/pages/ClaudeAI';
import PropertyFinderSync from '@/pages/PropertyFinderSync';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground font-medium">Loading PropCRM...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/commissions" element={<Commissions />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/whatsapp" element={<WhatsAppInbox />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/team" element={<Team />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/team-os" element={<TeamOS />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/team-dashboard" element={<TeamDashboard />} />
        <Route path="/my-dashboard" element={<MyDashboard />} />
        <Route path="/sales-analytics" element={<SalesAnalytics />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/meta-ads-leads" element={<MetaAdsLeads />} />
        <Route path="/whatsapp-setup" element={<WhatsAppSetup />} />
        <Route path="/whatsapp-hub" element={<WhatsAppHub />} />
        <Route path="/instagram" element={<InstagramLeads />} />
        <Route path="/claude-ai" element={<ClaudeAI />} />
        <Route path="/property-finder" element={<PropertyFinderSync />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App