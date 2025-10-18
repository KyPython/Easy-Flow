import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import ReactGA from 'react-ga4';
import useAnalytics from './hooks/useAnalytics';
import useUsageTracking from './hooks/useUsageTracking';
import Header from './components/Header/Header';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import HistoryPage from './pages/HistoryPage';
import FilesPage from './pages/FilesPage';
import AuthPage from './pages/AuthPage';
import PricingPage from './pages/PricingPage';
import LandingPage from './pages/LandingPage';
import ResetLanding from './pages/ResetLanding';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { ThemeProvider } from './utils/ThemeContext';
import { LanguageProvider } from './utils/LanguageContext';
import SettingsPage from './pages/SettingsPage';
import TeamsPage from './pages/TeamsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import WebhooksPage from './pages/WebhooksPage';
import AdminTemplates from './pages/AdminTemplates';
import WorkflowPage from './components/WorkflowBuilder/WorkflowPage';
import SharedFilePage from './pages/SharedFilePage';
import BulkInvoiceProcessor from './components/BulkProcessor/BulkInvoiceProcessor';
import Chatbot from './components/Chatbot/Chatbot';
import MilestonePrompt from './components/MilestonePrompt/MilestonePrompt';
import UsageDebugPage from './pages/debug/UsageDebugPage';
import './utils/firebaseConfig';
import './theme.css';
import './App.css';

// --- Google Analytics Pageview Tracker ---
// This component tracks pageviews whenever the route changes.
const AnalyticsTracker = () => {
  const location = useLocation();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    const gaMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;
    if (gaMeasurementId) {
      // Use the custom analytics hook for domain-aware tracking
      trackPageView(location.pathname, location.search);
    }
  }, [location, trackPageView]);

  return null; // This component does not render anything
};

function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) return null; // or a spinner component
  if (!session) return <Navigate to="/" replace />;
  return children;
}

Protected.propTypes = {
  children: PropTypes.node.isRequired,
};

// Local redirect component to avoid duplicating WorkflowPage mounts
function WorkflowIdRedirect() {
  const { workflowId, '*': rest } = useParams();
  const suffix = rest ? `/${rest}` : '';
  return <Navigate to={`/app/workflows/builder/${workflowId}${suffix}`} replace />;
}

function Shell() {
  const { user } = useAuth();
  const { 
    showMilestonePrompt, 
    currentMilestone, 
    dismissMilestonePrompt 
  } = useUsageTracking(user?.id);

  const handleMilestoneUpgrade = () => {
    // Redirect to pricing page
    window.location.href = '/pricing';
  };

  return (
    <div className="app">
      <Header user={user} />
<main className="main-content">
  <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/reset" element={<ResetLanding />} />
          <Route path="/pricing" element={<PricingPage />} />
          {/* Public shared file access - no authentication required */}
          <Route path="/shared/:token" element={<SharedFilePage />} />
          {/* Public landing page at root for unauthenticated users */}
          <Route path="/" element={<LandingPage />} />
          {/* Protected app routes live under /app */}
          <Route path="/app" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/app/tasks" element={<Protected><TasksPage /></Protected>} />
          <Route path="/app/history" element={<Protected><HistoryPage /></Protected>} />
          <Route path="/app/files" element={<Protected><FilesPage /></Protected>} />
          <Route path="/app/bulk-processor" element={<Protected><BulkInvoiceProcessor /></Protected>} />
          <Route path="/app/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="/app/teams" element={<Protected><TeamsPage /></Protected>} />
          <Route path="/app/analytics" element={<Protected><AnalyticsPage /></Protected>} />
          <Route path="/app/integrations" element={<Protected><IntegrationsPage /></Protected>} />
          <Route path="/app/webhooks" element={<Protected><WebhooksPage /></Protected>} />
          <Route path="/app/workflows" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder/templates" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder/schedules" element={<Protected><WorkflowPage /></Protected>} />
          
          {/* Redirect legacy /app/workflows/:workflowId/* to canonical builder path to avoid double mounts */}
          <Route path="/app/workflows/:workflowId/*" element={<WorkflowIdRedirect />} />
          <Route path="/app/workflows/builder/:workflowId" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder/:workflowId/templates" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder/:workflowId/schedules" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder/:workflowId/executions" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/builder/:workflowId/testing" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/templates" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/schedules" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/executions" element={<Protected><WorkflowPage /></Protected>} />
          <Route path="/app/workflows/testing" element={<Protected><WorkflowPage /></Protected>} />
          {/* Minimal Admin route (protect via env secret at backend) */}
          <Route path="/app/admin/templates" element={<Protected><AdminTemplates /></Protected>} />
          {/* Debug route - development only */}
          {process.env.NODE_ENV === 'development' && (
            <Route path="/app/debug" element={<Protected><UsageDebugPage /></Protected>} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* Global Chatbot - appears on all pages */}
      <Chatbot />
      
      {/* Milestone Prompt - shows when milestones are reached */}
      {showMilestonePrompt && currentMilestone && (
        <MilestonePrompt
          milestone={currentMilestone}
          onClose={dismissMilestonePrompt}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AnalyticsTracker />
            <Shell />
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;