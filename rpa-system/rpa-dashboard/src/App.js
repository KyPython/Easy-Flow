// Use the Kombai-generated dashboard app (router + pages)
import React from 'react';
import DashboardApp from './App.dashboard';
import { performanceTracker } from './utils/telemetry';
import './App.css';

export default function App() {
  React.useEffect(() => {
    document.title = "EasyFlow";
    // Initialize application-level performance tracking (deferred)
    // Ensure telemetry initialization does not block the main thread.
    let appLoadTracker = null;
    try {
      // Lazy-init real tracker after mount. This avoids heavy synchronous
      // work during module import which can freeze the UI.
      // eslint-disable-next-line no-unused-vars
      const { initPerformanceTracker } = require('./utils/telemetry');
      const perf = initPerformanceTracker();
      if (perf && perf.trackPageLoad) {
        appLoadTracker = perf.trackPageLoad('app_init', {
      'app.version': process.env.REACT_APP_VERSION || '1.0.0',
      'app.environment': process.env.NODE_ENV || 'development'
    });
      } else {
        appLoadTracker = { addMetric: () => {}, end: () => {} };
      }
    } catch (e) {
      // If lazy init fails, fall back to a no-op tracker so app can continue.
      // eslint-disable-next-line no-console
      console.warn('[App] initPerformanceTracker failed:', e && e.message ? e.message : e);
      appLoadTracker = { addMetric: () => {}, end: () => {} };
    }

    // Track initial app load metrics
    const handleAppLoad = () => {
      appLoadTracker.addMetric('app.components_mounted', 1);
      appLoadTracker.addMetric('app.initial_render_complete', true);
      appLoadTracker.end();
    };

    // Use setTimeout to ensure DOM is ready
    setTimeout(handleAppLoad, 100);

    // Global error boundary for unhandled errors
    const handleGlobalError = (event) => {
      const errorTracker = performanceTracker.trackUserInteraction('error', 'global', {
        'error.type': 'unhandled_error',
        'error.message': event.error?.message || 'Unknown error',
        'error.stack': event.error?.stack || 'No stack trace'
      });
      errorTracker.recordError(event.error);
      errorTracker.end();
    };

    // Global promise rejection handler
    const handleUnhandledRejection = (event) => {
      const errorTracker = performanceTracker.trackUserInteraction('error', 'global', {
        'error.type': 'unhandled_promise_rejection',
        'error.reason': typeof event.reason === 'string' ? event.reason : 'Promise rejected'
      });
      errorTracker.recordError(new Error(event.reason));
      errorTracker.end();
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      <DashboardApp />
    </>
  );
}