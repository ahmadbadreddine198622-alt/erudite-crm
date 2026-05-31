import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import AuroraPipeline from '@/pages/AuroraPipeline';
import Pipeline from '@/pages/Pipeline';
import Leads from '@/pages/Leads';

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
import WhatsAppHub from '@/pages/WhatsAppHub';
import InstagramLeads from '@/pages/InstagramLeads';
import DuplicateDetector from '@/pages/DuplicateDetector';
import ClaudeAI from '@/pages/ClaudeAI';
import PropertyFinderSync from '@/pages/PropertyFinderSync';
import Landlords from '@/pages/Landlords';
import EmailAutomations from '@/pages/EmailAutomations';
import Projects from '@/pages/Projects';
import FormAReferral from '@/pages/FormAReferral';
import KeyHandover from '@/pages/KeyHandover';
import TransferFeeCalculator from '@/pages/TransferFeeCalculator';
import FormIGenerator from '@/pages/FormIGenerator';
import DubaiIntelligence from '@/pages/DubaiIntelligence';
import EliteDesk from '@/pages/EliteDesk';
import WhatsAppScheduler from '@/pages/WhatsAppScheduler';
import Leaderboard from '@/pages/Leaderboard';
import LeadScoringDashboard from '@/pages/LeadScoringDashboard';
import DealRiskMonitor from '@/pages/DealRiskMonitor';
import TaskCenter from '@/pages/TaskCenter';
import WhatsAppAnalytics from '@/pages/WhatsAppAnalytics';
import AISyncHub from '@/pages/AISyncHub';
import IOSRemindersSync from '@/pages/iOSRemindersSync';
import TeamManagement from '@/pages/TeamManagement';
import LeaseAgreement from '@/pages/LeaseAgreement';
import TenancyContracts from '@/pages/TenancyContracts';
import Profile from '@/pages/Profile';
import VapiDashboard from '@/pages/VapiDashboard';
import VapiWorkflow from '@/pages/VapiWorkflow';
import GoogleDrive from '@/pages/GoogleDrive';
import Notes from '@/pages/Notes';

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
        <Route path="/aurora-pipeline" element={<AuroraPipeline />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/contacts" element={<Contacts />} />

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
        <Route path="/landlords" element={<Landlords />} />
        <Route path="/meta-ads-leads" element={<MetaAdsLeads />} />
        <Route path="/whatsapp-hub" element={<WhatsAppHub />} />
        <Route path="/instagram" element={<InstagramLeads />} />
        <Route path="/claude-ai" element={<ClaudeAI />} />
        <Route path="/property-finder" element={<PropertyFinderSync />} />
        <Route path="/duplicates" element={<DuplicateDetector />} />
        <Route path="/email-automations" element={<EmailAutomations />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/form-a-referral" element={<FormAReferral />} />
        <Route path="/key-handover" element={<KeyHandover />} />
        <Route path="/transfer-calculator" element={<TransferFeeCalculator />} />
        <Route path="/form-i-generator" element={<FormIGenerator />} />
        <Route path="/dubai-intelligence" element={<DubaiIntelligence />} />
        <Route path="/elite-desk" element={<EliteDesk />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/whatsapp-scheduler" element={<WhatsAppScheduler />} />
        <Route path="/lead-scoring" element={<LeadScoringDashboard />} />
        <Route path="/deal-risk" element={<DealRiskMonitor />} />
        <Route path="/task-center" element={<TaskCenter />} />
        <Route path="/whatsapp-analytics" element={<WhatsAppAnalytics />} />
        <Route path="/ai-sync-hub" element={<AISyncHub />} />
        <Route path="/ios-reminders" element={<IOSRemindersSync />} />
        <Route path="/team-management" element={<TeamManagement />} />
        <Route path="/lease-agreement" element={<LeaseAgreement />} />
        <Route path="/tenancy-contracts" element={<TenancyContracts />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/vapi" element={<VapiDashboard />} />
        <Route path="/vapi-workflow" element={<VapiWorkflow />} />
        <Route path="/google-drive" element={<GoogleDrive />} />
        <Route path="/notes" element={<Notes />} />
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