import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { ReadAloudProvider } from '@/lib/ReadAloudContext';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import BlockedAccount from '@/components/BlockedAccount';
import ProtectedRoute from '@/components/ProtectedRoute';

// ── Eager imports — the critical path only ──────────────────────────────────
// Auth pages (tiny, needed before anything else), the app shell, and the
// Dashboard (post-login landing page → instant first paint, no chunk wait).
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ShortLinkRedirect from '@/pages/ShortLinkRedirect';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';

// ── Lazy routes — code splitting ─────────────────────────────────────────────
// PERFORMANCE-CRITICAL: every page below is its own chunk, downloaded only
// when the user navigates to it. Previously ALL ~110 pages were imported
// eagerly, so the browser had to download + parse the ENTIRE app (multiple MB,
// incl. a 170KB landlord detail page) before the first screen rendered — the
// root cause of slow initial loads. Do NOT convert these back to static
// imports. New pages should be added here as lazy() too.
const AuroraPipeline = lazy(() => import('@/pages/AuroraPipeline'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));
const LeadCommandCenter = lazy(() => import('@/pages/LeadCommandCenter'));
const Leads = lazy(() => import('@/pages/Leads'));
const MapView = lazy(() => import('@/pages/MapView'));
const Commissions = lazy(() => import('@/pages/Commissions'));
const Reminders = lazy(() => import('./pages/Reminders'));
const WhatsAppInbox = lazy(() => import('@/pages/WhatsAppInbox'));
const Inbox = lazy(() => import('@/pages/Inbox'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Team = lazy(() => import('@/pages/Team'));
const Contacts = lazy(() => import('@/pages/Contacts'));
const Offers = lazy(() => import('@/pages/Offers'));
const TeamOS = lazy(() => import('@/pages/TeamOS'));
const Finance = lazy(() => import('@/pages/Finance'));
const TeamDashboard = lazy(() => import('@/pages/TeamDashboard'));
const MyDashboard = lazy(() => import('@/pages/MyDashboard'));
const SalesAnalytics = lazy(() => import('@/pages/SalesAnalytics'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const MetaAdsLeads = lazy(() => import('@/pages/MetaAdsLeads'));
const WhatsAppHub = lazy(() => import('@/pages/WhatsAppHub'));
const InstagramLeads = lazy(() => import('@/pages/InstagramLeads'));
const DuplicateDetector = lazy(() => import('@/pages/DuplicateDetector'));
const ClaudeAI = lazy(() => import('@/pages/ClaudeAI'));
const PropertyFinderSync = lazy(() => import('@/pages/PropertyFinderSync'));
const PFAgentBRN = lazy(() => import('@/pages/PFAgentBRN'));
const PropertyFinderDashboard = lazy(() => import('@/pages/PropertyFinderDashboard'));
const PropertyFinderLeads = lazy(() => import('@/pages/PropertyFinderLeads'));
const Landlords = lazy(() => import('@/pages/Landlords'));
const LandlordDetailPage = lazy(() => import('@/pages/LandlordDetailPage'));
const Messages = lazy(() => import('@/pages/Messages'));
const EmailAutomations = lazy(() => import('@/pages/EmailAutomations'));
const Projects = lazy(() => import('@/pages/Projects'));
const FormAReferral = lazy(() => import('@/pages/FormAReferral'));
const FormAInbox = lazy(() => import('@/pages/FormAInbox'));
const KeyHandover = lazy(() => import('@/pages/KeyHandover'));
const TransferFeeCalculator = lazy(() => import('@/pages/TransferFeeCalculator'));
const FormIGenerator = lazy(() => import('@/pages/FormIGenerator'));
const DubaiIntelligence = lazy(() => import('@/pages/DubaiIntelligence'));
const EliteDesk = lazy(() => import('@/pages/EliteDesk'));
const WhatsAppScheduler = lazy(() => import('@/pages/WhatsAppScheduler'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const LeadScoringDashboard = lazy(() => import('@/pages/LeadScoringDashboard'));
const DealRiskMonitor = lazy(() => import('@/pages/DealRiskMonitor'));
const TaskCenter = lazy(() => import('@/pages/TaskCenter'));
const WhatsAppAnalytics = lazy(() => import('@/pages/WhatsAppAnalytics'));
const AISyncHub = lazy(() => import('@/pages/AISyncHub'));
const IOSRemindersSync = lazy(() => import('@/pages/iOSRemindersSync'));
const TeamManagement = lazy(() => import('@/pages/TeamManagement'));
const LeaseAgreement = lazy(() => import('@/pages/LeaseAgreement'));
const TenancyContracts = lazy(() => import('@/pages/TenancyContracts'));
const Profile = lazy(() => import('@/pages/Profile'));
const VapiDashboard = lazy(() => import('@/pages/VapiDashboard'));
const VapiWorkflow = lazy(() => import('@/pages/VapiWorkflow'));
const GoogleDrive = lazy(() => import('@/pages/GoogleDrive'));
const Notes = lazy(() => import('@/pages/Notes'));
const Negotiations = lazy(() => import('@/pages/Negotiations'));
const FollowUps = lazy(() => import('@/pages/FollowUps'));
const Viewings = lazy(() => import('@/pages/Viewings'));
const EmailTemplates = lazy(() => import('@/pages/EmailTemplates'));
const Broadcasts = lazy(() => import('@/pages/Broadcasts'));
const PropertyIntel = lazy(() => import('@/pages/PropertyIntel'));
const MarketIntelligence = lazy(() => import('@/pages/MarketIntelligence'));
const BuyerMatchAI = lazy(() => import('@/pages/BuyerMatchAI'));
const ClosingAI = lazy(() => import('@/pages/ClosingAI'));
const BrandSettings = lazy(() => import('@/pages/BrandSettings'));
const TeamActivityLog = lazy(() => import('@/pages/TeamActivityLog'));
const InviteAgents = lazy(() => import('@/pages/InviteAgents'));
const Photography = lazy(() => import('@/pages/Photography'));
const ListingProduction = lazy(() => import('@/pages/ListingProduction'));
const CommandCenter = lazy(() => import('@/pages/CommandCenter'));
const Closing = lazy(() => import('@/pages/Closing'));
const TwilioHub = lazy(() => import('@/pages/TwilioHub'));
const AircallHub = lazy(() => import('@/pages/AircallHub'));
const MatterportSync = lazy(() => import('@/pages/MatterportSync'));
const Policies = lazy(() => import('@/pages/Policies'));
const ApiInbox = lazy(() => import('@/pages/ApiInbox'));
const Acknowledgements = lazy(() => import('@/pages/Acknowledgements'));
const DesignSystem = lazy(() => import('@/pages/DesignSystem'));
const CompanySettings = lazy(() => import('@/pages/CompanySettings'));
const Cheques = lazy(() => import('@/pages/Cheques'));
const ClosingHub = lazy(() => import('@/pages/ClosingHub'));
const ChequeRegister = lazy(() => import('@/pages/ChequeRegister'));
const OutreachLeaderboard = lazy(() => import('@/pages/OutreachLeaderboard'));
const MyLeadsToday = lazy(() => import('@/pages/MyLeadsToday'));
const TeamPerformance = lazy(() => import('@/pages/TeamPerformance'));
const AgentIntelligence = lazy(() => import('@/pages/AgentIntelligence'));
const Appointments = lazy(() => import('@/pages/Appointments'));
const AutomationsHub = lazy(() => import('@/pages/AutomationsHub'));
const Flow = lazy(() => import('@/pages/Flow'));
const AcademyHome = lazy(() => import('@/pages/AcademyHome'));
const TheHall = lazy(() => import('@/pages/TheHall'));
const TheMirror = lazy(() => import('@/pages/TheMirror'));
const TheDojo = lazy(() => import('@/pages/TheDojo'));
const TheField = lazy(() => import('@/pages/TheField'));
const TheCouncil = lazy(() => import('@/pages/TheCouncil'));
const TheMentor = lazy(() => import('@/pages/TheMentor'));
const TelegramSettings = lazy(() => import('@/pages/TelegramSettings'));
const OwnerRegistryImport = lazy(() => import('@/pages/OwnerRegistryImport'));
const TrainingVideos = lazy(() => import('@/pages/TrainingVideos'));

// Lightweight fallback shown while a route chunk downloads (usually <300ms).
const PageLoader = () => (
  <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
    <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const location = useLocation();
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

  if (authError?.type === 'domain_not_allowed') {
    return <BlockedAccount email={authError.email} />;
  }

  return (
    <ReadAloudProvider>
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/u/:slug" element={<ShortLinkRedirect />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/lead/:id" element={<LeadCommandCenter />} />
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
        <Route path="/pf-agent-brn" element={<PFAgentBRN />} />
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
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/automations-hub" element={<AutomationsHub />} />
        <Route path="/flow" element={<Flow />} />
        <Route path="/academy" element={<AcademyHome />} />
        <Route path="/academy/hall" element={<TheHall />} />
        <Route path="/academy/mirror" element={<TheMirror />} />
        <Route path="/academy/dojo" element={<TheDojo />} />
        <Route path="/academy/field" element={<TheField />} />
        <Route path="/academy/council" element={<TheCouncil />} />
        <Route path="/academy/mentor" element={<TheMentor />} />
        <Route path="/telegram-settings" element={<TelegramSettings />} />
        <Route path="/owner-registry-import" element={<OwnerRegistryImport />} />
        <Route path="/training-videos" element={<TrainingVideos />} />
        </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
    </AnimatePresence>
    </ReadAloudProvider>
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