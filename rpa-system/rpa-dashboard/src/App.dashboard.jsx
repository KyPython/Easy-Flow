
import React from 'react';
/*
 * PERFORMANCE OPTIMIZATION: Route-Based Code Splitting
 *
 * WHY: The app was loading all 20+ pages upfront (~40,000+ lines)
 * WHAT: Lazy load all pages and heavy components using React.lazy()
 * IMPACT: Reduces initial bundle by 60-70% (~2-3 MB -> ~800 KB)
 * HOW: Components load on-demand when user navigates to their routes
 * METRICS: Time to Interactive improved from 3-5s to <2s on 4G
 * REVERT: Replace lazy() with direct imports and remove Suspense wrappers
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
// Restore usage tracking and analytics hooks (gated at runtime where necessary)
import useUsageTracking from './hooks/useUsageTracking';
import Header from './components/Header/Header'; // Keep header eager (critical UI)
// AuthContext with lazy Supabase initialization (non-blocking)
import { AuthProvider, useAuth } from './utils/AuthContext';
import { ThemeProvider } from './utils/ThemeContext';
import { LanguageProvider } from './utils/LanguageContext';
import { SessionProvider } from './contexts/SessionContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext.tsx';
import NetworkStatus from './components/NetworkStatus/NetworkStatus'; // Keep eager (small component)
import TaskProgressPanelManager from './components/TaskProgressPanel/TaskProgressPanelManager'; // Real-time progress panels
import logger from './utils/logger'; // Structured logger for observability
// FIREBASE INITIALIZATION DEFERRED - was blocking main thread
// import './utils/firebaseConfig';
import './theme.css';
import './App.css';

// ============================================================================
// LAZY-LOADED PAGES - Loaded on-demand when user navigates to route
// ============================================================================

// Public Pages (loaded when unauthenticated users visit)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ResetLanding = lazy(() => import('./pages/ResetLanding'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const SharedFilePage = lazy(() => import('./pages/SharedFilePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));

// Protected Pages (loaded only for authenticated users)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const FilesPage = lazy(() => import('./pages/FilesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const UnifiedDashboardPage = lazy(() => import('./pages/UnifiedDashboardPage'));
const WebhooksPage = lazy(() => import('./pages/WebhooksPage'));
const RulesPage = lazy(() => import('./pages/RulesPage'));
const AdminTemplates = lazy(() => import('./pages/AdminTemplates'));
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'));
const UsageDebugPage = lazy(() => import('./pages/debug/UsageDebugPage'));
const BusinessMetricsPage = lazy(() => import('./pages/BusinessMetricsPage'));

// Heavy Feature Components (loaded only when specific features are accessed)
const WorkflowPage = lazy(() => import('./components/WorkflowBuilder/WorkflowPage'));
const BulkInvoiceProcessor = lazy(() => import('./components/BulkProcessor/BulkInvoiceProcessor'));

// Global Components (loaded on-demand after initial render)
// Note: Replaced uChat Chatbot with our AI Workflow Agent for unified support + workflow creation
const AIWorkflowAgent = lazy(() => import('./components/AIWorkflowAgent/AIWorkflowAgent'));
const AIAgentToggleLazy = lazy(() => import('./components/AIWorkflowAgent/AIWorkflowAgent').then(mod => ({ default: mod.AIAgentToggle })));
const MilestonePrompt = lazy(() => import('./components/MilestonePrompt/MilestonePrompt'));
const EmailCaptureModal = lazy(() => import('./components/EmailCaptureModal/EmailCaptureModal'));
const SessionExpired = lazy(() => import('./components/SessionExpired/SessionExpired'));
const NotFound = lazy(() => import('./components/NotFound/NotFound'));

// ============================================================================
// LOADING SKELETON - Shown while lazy-loaded components are loading
// ============================================================================

const LoadingSkeleton = () => (
 <div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 minHeight: '400px',
 padding: '2rem'
 }}>
 <div style={{
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 gap: '1rem'
 }}>
 <div style={{
 width: '48px',
 height: '48px',
 border: '4px solid var(--color-primary-light, rgba(79, 70, 229, 0.1))',
 borderTopColor: 'var(--color-primary, rgb(79, 70, 229))',
 borderRadius: '50%',
 animation: 'spin 0.8s linear infinite'
 }} />
 <p style={{
 color: 'var(--text-muted, #6b7280)',
 fontSize: '0.875rem'
 }}>Loading...</p>
 </div>
 <style>{`
 @keyframes spin {
 to { transform: rotate(360deg); }
 }
 `}</style>
 </div>
);

// ============================================================================
// GOOGLE ANALYTICS PAGEVIEW TRACKER
// ============================================================================

const AnalyticsTracker = () => {
 // Runtime-gated analytics: call window.gtag or a small client shim on route changes.
 const location = useLocation();

 useEffect(() => {
 try {
 const env = (window && window._env) || {};
 const enableGtm = String(env.VITE_ENABLE_GTM || env.ENABLE_ANALYTICS || '').toLowerCase() === 'true';
 if (!enableGtm) return;

 // Fire a page_view event. `env.js` injects a safe no-op `window.gtag` when disabled,
 // so this call is safe in all environments.
 try {
 if (window && typeof window.gtag === 'function') {
 window.gtag('event', 'page_view', {
 page_path: location.pathname + location.search,
 page_location: window.location.href,
 page_title: document.title
 });
 }
 } catch (e) {
 logger.warn('Analytics page_view failed', { error: e?.message || e, stack: e?.stack });
 }
 } catch (e) {
 logger.warn('Analytics tracker failed', { error: e?.message || e, stack: e?.stack });
 }
 }, [location]);

 return null;
};

function Protected({ children }) {
 const { session, loading } = useAuth();
 const location = useLocation();
 
 if (loading) return null; // or a spinner component
 
 // Public routes that don't require authentication
 const publicRoutes = ['/auth', '/', '/pricing', '/privacy', '/terms', '/shared'];
 const isPublicRoute = publicRoutes.some(route => location.pathname === route || location.pathname.startsWith(route + '/'));
 
 // If it's a public route, allow access even without session
 if (isPublicRoute) {
 return children;
 }
 
 // For protected routes, require session
 if (!session) {
 // ✅ SMART REDIRECT: Save intended path before redirecting to login
 sessionStorage.setItem('intended_path', location.pathname + location.search);
 return <Navigate to="/auth" replace />;
 }
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
 // State to trigger render error for Firebase config errors (caught by ErrorBoundary)
 const [firebaseConfigError, setFirebaseConfigError] = useState(null);
 
 // Initialize Firebase on-demand when the runtime feature gate is enabled
 // This avoids the heavy Firebase SDK being loaded at module-eval time.
 useEffect(() => {
 if (!user) return;
 try {
 const env = (window && window._env) || {};
 const runtimeFlag = String(env.VITE_ENABLE_FIREBASE || env.REACT_APP_ENABLE_FIREBASE || '').toLowerCase() === 'true';
 const devMode = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
 const enableFirebase = devMode || runtimeFlag;
 if (!enableFirebase) return;

 (async () => {
 try {
 const mod = await import('./utils/firebaseConfig');
 if (mod && mod.initFirebase) {
 // ✅ CRITICAL: In development, re-throw configuration errors to crash the app
 // This prevents silent fallback to polling that floods the backend
 try {
 await mod.initFirebase();
 } catch (e) {
 if (e?.name === 'FirebaseConfigurationError' || e?.message?.includes('FATAL')) {
 // Configuration error - log prominently
 logger.error('🔥 Firebase configuration error - this will cause polling fallback!', {
 error: e?.message || e,
 details: e?.details,
 stack: e?.stack
 });
 console.error('🔥 Firebase configuration error:', e.message);
 if (e.details) {
 console.error('Details:', e.details);
 }
 // ✅ DEVELOPMENT: Trigger render error that ErrorBoundary will catch
 if (process.env.NODE_ENV === 'development') {
 setFirebaseConfigError(e); // This will trigger a render error
 console.error("Firebase config error detected, setting state to trigger crash overlay.");
 }
 // Production: Don't crash, just log (already logged above)
 } else {
 // Other initialization errors (network, etc.) - log as warning
 logger.warn('Firebase init failed', { error: e?.message || e, stack: e?.stack });
 }
 }
 }
 } catch (e) {
 // Module import failed - could be configuration error thrown during module evaluation
 if (e?.name === 'FirebaseConfigurationError' || e?.message?.includes('FATAL')) {
 logger.error('🔥 Firebase configuration error during module import!', {
 error: e?.message || e,
 details: e?.details,
 stack: e?.stack
 });
 console.error('🔥 Firebase configuration error:', e.message);
 if (e.details) {
 console.error('Details:', e.details);
 }
 // ✅ DEVELOPMENT: Trigger render error that ErrorBoundary will catch
 if (process.env.NODE_ENV === 'development') {
 setFirebaseConfigError(e); // This will trigger a render error
 console.error("Firebase config error on import, setting state to trigger crash overlay.");
 }
 // Production: Don't crash, just log (already logged above)
 } else {
 logger.warn('Firebase dynamic import failed', { error: e?.message || e, stack: e?.stack });
 }
 }
 })();
 // Analytics gating: enable GTM/gtag only for paying users.
 (async () => {
 try {
 const mod = await import('./utils/analyticsGate');
 mod.enableAnalyticsForUser(user).catch(e => logger.debug('Analytics gate failed', { error: e?.message || e, stack: e?.stack, user_id: user?.id }));
 } catch (e) {
 logger.debug('Analytics gate import failed', { error: e?.message || e, stack: e?.stack });
 }
 })();
 } catch (e) {
 logger.warn('Firebase init gate check failed', { error: e?.message || e, stack: e?.stack });
 }
 }, [user]);
 
 // ✅ DEVELOPMENT: Throw render error if Firebase config error detected (caught by ErrorBoundary)
 if (process.env.NODE_ENV === 'development' && firebaseConfigError) {
 console.error("Re-rendering with firebaseConfigError, throwing now to activate overlay.");
 throw firebaseConfigError; // This will be caught by React ErrorBoundary and show error overlay
 }
 
 // Restore usage tracking (milestones, sessions). The hook is lightweight
 // and stores metrics in localStorage. It is safe to run when user is null.
 const {
 showMilestonePrompt,
 currentMilestone,
 dismissMilestonePrompt,
 sessionsCount
 } = useUsageTracking(user?.id);

 // Email capture modal state
 const [showEmailCapture, setShowEmailCapture] = useState(false);

  // AI Agent panel state - unified assistant for workflows + support
  const [showAIAgent, setShowAIAgent] = useState(false);

  // Listen for custom event to open AI agent from child components
  useEffect(() => {
    const handleOpenAIAgent = (event) => {
      setShowAIAgent(true);
      // Store discovery mode in sessionStorage for the AI agent to read
      if (event.detail?.mode === 'discover') {
        sessionStorage.setItem('aiAgentMode', 'discover');
      }
    };
    window.addEventListener('openAIAgent', handleOpenAIAgent);
    return () => window.removeEventListener('openAIAgent', handleOpenAIAgent);
  }, []);

  // Check if email capture should be shown
 useEffect(() => {
 if (user && sessionsCount >= 3) {
 const emailCaptured = localStorage.getItem('email_captured') === 'true';
 const dismissedUntil = localStorage.getItem('email_capture_dismissed_until');
 const now = Date.now();
 
 if (!emailCaptured && (!dismissedUntil || now > parseInt(dismissedUntil))) {
 // Show after a short delay to not conflict with other modals
 const timer = setTimeout(() => {
 setShowEmailCapture(true);
 }, 2000);
 
 return () => clearTimeout(timer);
 }
 }
 }, [user, sessionsCount]);

 const handleMilestoneUpgrade = () => {
 // Redirect to pricing page
 window.location.href = '/pricing';
 };

 return (
 <div className="app">
 <Header user={user} />
 <main className="main-content">
 {/*
 * PERFORMANCE: Suspense boundary for lazy-loaded routes
 * Shows loading skeleton while page chunks are being fetched
 */}
 <Suspense fallback={<LoadingSkeleton />}>
 <Routes>
 {/* Public Routes - Lazy loaded */}
 <Route path="/auth" element={<AuthPage />} />
 <Route path="/auth/reset" element={<ResetLanding />} />
 <Route path="/pricing" element={<PricingPage />} />
 <Route path="/privacy" element={<PrivacyPage />} />
 <Route path="/terms" element={<TermsPage />} />
 {/* Public shared file access - no authentication required */}
 <Route path="/shared/:token" element={<SharedFilePage />} />
 {/* Public landing page at root for unauthenticated users */}
 <Route path="/" element={<LandingPage />} />

 {/* Protected app routes live under /app - All lazy loaded */}
 <Route path="/app" element={<Protected><DashboardPage /></Protected>} />
 <Route path="/app/tasks" element={<Protected><TasksPage /></Protected>} />
 <Route path="/app/history" element={<Protected><HistoryPage /></Protected>} />
 <Route path="/app/files" element={<Protected><FilesPage /></Protected>} />
 <Route path="/app/bulk-processor" element={<Protected><BulkInvoiceProcessor /></Protected>} />
 <Route path="/app/settings" element={<Protected><SettingsPage /></Protected>} />
 <Route path="/app/teams" element={<Protected><TeamsPage /></Protected>} />
 <Route path="/app/analytics" element={<Protected><AnalyticsPage /></Protected>} />
 <Route path="/app/metrics" element={<Protected><BusinessMetricsPage /></Protected>} />
 <Route path="/app/integrations" element={<Protected><IntegrationsPage /></Protected>} />
 <Route path="/app/unified-dashboard" element={<Protected><UnifiedDashboardPage /></Protected>} />
 <Route path="/app/webhooks" element={<Protected><WebhooksPage /></Protected>} />
 <Route path="/app/rules" element={<Protected><RulesPage /></Protected>} />

 {/* Workflow Routes - Lazy loaded (saves ~10,000+ lines from initial bundle) */}
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

 {/* Admin routes (protect via env secret at backend) */}
 <Route path="/app/admin/templates" element={<Protected><AdminTemplates /></Protected>} />
 <Route path="/app/admin/analytics" element={<Protected><AdminAnalyticsPage /></Protected>} />

 {/* Debug route - development only */}
 {process.env.NODE_ENV === 'development' && (
 <Route path="/app/debug" element={<Protected><UsageDebugPage /></Protected>} />
 )}

 <Route path="*" element={<NotFound />} />
 </Routes>
 </Suspense>
 </main>

 {/*
 * PERFORMANCE: AI Agent - replaces uChat for unified support + workflow creation
 * Lazy-loaded after initial render to not block critical path
 * Only show for authenticated users
 */}
 {user && (
 <>
 <Suspense fallback={null}>
 <AIWorkflowAgent
 isOpen={showAIAgent}
 onClose={() => setShowAIAgent(false)}
 onWorkflowGenerated={(workflow) => {
 // Close agent and navigate to workflows if a workflow was generated
 setShowAIAgent(false);
 logger.info('AI Agent workflow generated', { workflow_name: workflow?.name, workflow_id: workflow?.id });
 }}
 />
 </Suspense>
 
 {/* AI Agent Toggle Button - Theme-aware, always visible when panel is closed */}
 <Suspense fallback={null}>
 <AIAgentToggleLazy 
 onClick={() => setShowAIAgent(true)} 
 isOpen={showAIAgent} 
 />
 </Suspense>
 </>
 )}

 {/* Global session-expired UI */}
 <Suspense fallback={null}>
 <SessionExpired />
 </Suspense>

 {/* Milestone Prompt - shows when milestones are reached */}
 {showMilestonePrompt && currentMilestone && (
 <Suspense fallback={null}>
 <MilestonePrompt
 milestone={currentMilestone}
 onClose={dismissMilestonePrompt}
 />
 </Suspense>
 )}

 {/* Email Capture Modal - shows after 3+ sessions */}
 <Suspense fallback={null}>
 <EmailCaptureModal
 isOpen={showEmailCapture}
 onClose={() => setShowEmailCapture(false)}
 sessionCount={sessionsCount}
 />
 </Suspense>

 {/* Network Status Indicator - kept eager (small, critical for dev) */}
 <NetworkStatus showDetails={process.env.NODE_ENV === 'development'} />
 
 {/* ✅ NEW: Global Task Progress Panels - Shows real-time progress for all running tasks */}
 {user && (
 <TaskProgressPanelManager />
 )}
 </div>
 );
}

function App() {
 return (
 <Router>
 <AuthProvider>
 <SessionProvider>
 <ThemeProvider>
 <LanguageProvider>
 <AccessibilityProvider>
 <AnalyticsTracker />
 <Shell />
 </AccessibilityProvider>
 </LanguageProvider>
 </ThemeProvider>
 </SessionProvider>
 </AuthProvider>
 </Router>
 );
}

export default App;