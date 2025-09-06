import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';
import Header from './components/Header/Header';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import HistoryPage from './pages/HistoryPage';
import AuthPage from './pages/AuthPage';
import PricingPage from './pages/PricingPage';
import LandingPage from './pages/LandingPage';
import ResetLanding from './pages/ResetLanding';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { ThemeProvider } from './utils/ThemeContext';
import SettingsPage from './pages/SettingsPage';
import './utils/firebaseConfig';
import './theme.css';
import './App.css';

// --- Google Analytics Pageview Tracker ---
// This component tracks pageviews whenever the route changes.
const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const gaMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;
    if (gaMeasurementId) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);

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

function Shell() {
  const { user } = useAuth();
  return (
    <div className="app">
      <Header user={user} />
<main className="main-content">
  <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/reset" element={<ResetLanding />} />
          <Route path="/pricing" element={<PricingPage />} />
          {/* Public landing page at root for unauthenticated users */}
          <Route path="/" element={<LandingPage />} />
          {/* Protected app routes live under /app */}
          <Route path="/app" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/app/tasks" element={<Protected><TasksPage /></Protected>} />
          <Route path="/app/history" element={<Protected><HistoryPage /></Protected>} />
          <Route path="/app/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AnalyticsTracker />
          <Shell />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;