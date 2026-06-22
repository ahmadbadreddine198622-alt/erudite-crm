import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

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
import PropertyFinderDashboard from '@/pages/PropertyFinderDashboard';
import PropertyFinderLeads from '@/pages/PropertyFinderLeads';
import Landlords from '@/pages/Landlords';
import LandlordDetailPage from '@/pages/LandlordDetailPage';
import Messages from '@/pages/Messages';
import EmailAutomations from '@/pages/EmailAutomations';
import Projects from '@/pages/Projects';
import FormAReferral from '@/pages/FormAReferral';
import FormAInbox from '@/pages/FormAInbox';
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
import Negotiations from '@/pages/Negotiations';
import FollowUps from '@/pages/FollowUps';
import Viewings from '@/pages/Viewings';
import EmailTemplates from '@/pages/EmailTemplates';
import Broadcasts from '@/pages/Broadcasts';
import PropertyIntel from '@/pages/PropertyIntel';
import MarketIntelligence from '@/pages/MarketIntelligence';
import BuyerMatchAI from '@/pages/BuyerMatchAI';
import ClosingAI from '@/pages/ClosingAI';
import BrandSettings from '@/pages/BrandSettings';
import TeamActivityLog from '@/pages/TeamActivityLog';
import InviteAgents from '@/pages/InviteAgents';
import Photography from '@/pages/Photography';
import ListingProduction from '@/pages/ListingProduction';
import CommandCenter from '@/pages/CommandCenter';
import Closing from '@/pages/Closing';
import TwilioHub from '@/pages/TwilioHub';
import AircallHub from '@/pages/AircallHub';
import MatterportSync from '@/pages/MatterportSync';
import Policies from '@/pages/Policies';
import ApiInbox from '@/pages/ApiInbox';
import Acknowledgements from '@/pages/Acknowledgements';
import DesignSystem from '@/pages/DesignSystem';
import CompanySettings from '@/pages/CompanySettings';
import Cheques from '@/pages/Cheques';
import ClosingHub from '@/pages/ClosingHub';
import ChequeRegister from '@/pages/ChequeRegister';
import OutreachLeaderboard from '@/pages/OutreachLeaderboard';
import MyLeadsToday from '@/pages/MyLeadsToday';
import TeamPerformance from '@/pages/TeamPerformance';
import AgentIntelligence from '@/pages/AgentIntelligence';

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

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
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
        <Route path="/landlord/:id" element={<LandlordDetailPage />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/meta-ads-leads" element={<MetaAdsLeads />} />
        <Route path="/whatsapp-hub" element={<WhatsAppHub />} />
        <Route path="/instagram" element={<InstagramLeads />} />
        <Route path="/claude-ai" element={<ClaudeAI />} />
        <Route path="/property-finder" element={<PropertyFinderSync />} />
        <Route path="/property-finder-dashboard" element={<PropertyFinderDashboard />} />
        <Route path="/property-finder-leads" element={<PropertyFinderLeads />} />
        <Route path="/duplicates" element={<DuplicateDetector />} />
        <Route path="/email-automations" element={<EmailAutomations />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/form-a-referral" element={<FormAReferral />} />
        <Route path="/form-a-inbox" element={<FormAInbox />} />
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
        <Route path="/negotiations" element={<Negotiations />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/viewings" element={<Viewings />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
        <Route path="/broadcasts" element={<Broadcasts />} />
        <Route path="/property-intel" element={<PropertyIntel />} />
        <Route path="/market-intelligence" element={<MarketIntelligence />} />
        <Route path="/buyer-match-ai" element={<BuyerMatchAI />} />
        <Route path="/closing-ai" element={<ClosingAI />} />
        <Route path="/brand-settings" element={<BrandSettings />} />
        <Route path="/team-activity" element={<TeamActivityLog />} />
        <Route path="/invite-agents" element={<InviteAgents />} />
        <Route path="/photography" element={<Photography />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/listing-production" element={<ListingProduction />} />
        <Route path="/closing" element={<Closing />} />
        <Route path="/twilio" element={<TwilioHub />} />
        <Route path="/aircall" element={<AircallHub />} />
        <Route path="/matterport-sync" element={<MatterportSync />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/api-inbox" element={<ApiInbox />} />
        <Route path="/acknowledgements" element={<Acknowledgements />} />
        <Route path="/design-system" element={<DesignSystem />} />
        <Route path="/company-settings" element={<CompanySettings />} />
        <Route path="/cheques" element={<Cheques />} />
        <Route path="/closing-hub" element={<ClosingHub />} />
        <Route path="/cheque-register" element={<ChequeRegister />} />
        <Route path="/outreach-leaderboard" element={<OutreachLeaderboard />} />
        <Route path="/my-leads-today" element={<MyLeadsToday />} />
        <Route path="/team-performance" element={<TeamPerformance />} />
        <Route path="/agent-intelligence" element={<AgentIntelligence />} />
        <Route path="/closing" element={<Closing />} />
      </Route>
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