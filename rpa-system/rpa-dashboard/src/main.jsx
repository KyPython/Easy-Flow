import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.dashboard';
import { ToastProvider } from './components/WorkflowBuilder/Toast';

// Global console log sampling - wrap console.log to reduce log flooding
// Apply in all environments to prevent log flooding
if (typeof window !== 'undefined') {
  const getConsoleSampleRate = () => {
    try {
      const stored = localStorage.getItem('CONSOLE_LOG_SAMPLE_RATE');
      if (stored) {
        const rate = parseInt(stored, 10);
        if (rate > 0) return rate;
      }
    } catch (e) {
      // localStorage may not be available
    }
    // Default: sample 1% of console.log calls (1 in 100) - more aggressive
    return 100;
  };

  const CONSOLE_SAMPLE_RATE = getConsoleSampleRate();
  let consoleLogCounter = 0;

  if (CONSOLE_SAMPLE_RATE > 1) {
    const originalLog = console.log;
    console.log = function(...args) {
      consoleLogCounter++;
      if (consoleLogCounter % CONSOLE_SAMPLE_RATE === 0) {
        // Add sampling indicator
        const sampledArgs = args.length > 0 && typeof args[0] === 'string' 
          ? [`[sampled 1/${CONSOLE_SAMPLE_RATE}] ${args[0]}`, ...args.slice(1)]
          : [`[sampled 1/${CONSOLE_SAMPLE_RATE}]`, ...args];
        originalLog.apply(console, sampledArgs);
      }
      // Always allow console.warn and console.error through
    };

    // Show info message once
    if (!window._consoleSamplingNotified) {
      console.info(`[console] Log sampling active: 1/${CONSOLE_SAMPLE_RATE} console.log calls will be shown. Set localStorage.setItem('CONSOLE_LOG_SAMPLE_RATE', '1') to disable.`);
      window._consoleSamplingNotified = true;
    }
  }
}

// Try to initialize telemetry asynchronously. In development we enable
// frontend telemetry by default so engineers get observability without
// requiring runtime env injection. Initialization is non-blocking and
// uses dynamic imports inside `initPerformanceTracker` to avoid adding
// heavy SDKs to the main bundle.
try {
  const env = (window && window._env) || {};
  const runtimeFlag = String(env.VITE_ENABLE_BROWSER_OTLP || env.REACT_APP_ENABLE_BROWSER_OTLP || '').toLowerCase() === 'true';
  const devMode = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');
  const enableOtlp = devMode || runtimeFlag;

  if (enableOtlp) {
    // Dynamic import and init — fire-and-forget. `initPerformanceTracker`
    // itself decides whether to load exporter libs based on NODE_ENV
    // and build-time flags, so this call is safe and non-blocking.
    import('./utils/telemetry').then(mod => {
      try { mod.initPerformanceTracker(); } catch (e) { console.warn('[main] initPerformanceTracker failed', e && e.message ? e.message : e); }
    }).catch(e => console.warn('[main] dynamic import telemetry failed', e && e.message ? e.message : e));
  }
} catch (e) {
  console.warn('[main] telemetry gate check failed', e && e.message ? e.message : e);
}

// Supabase initialization is intentionally deferred until the app needs it
// (AuthContext, Shell, or analyticsGate). This avoids fetching/initializing
// the Supabase chunk during first paint, reducing main-thread work.

const root = ReactDOM.createRoot(document.getElementById('root'));

// CRITICAL: Disable StrictMode in development to prevent double-invocation of
// useEffect hooks that establish external stateful connections (Supabase Realtime).
// StrictMode's double-invocation is intentional for detecting side-effects, but
// it breaks WebSocket subscriptions by creating duplicate channels and race conditions.
// Keep StrictMode enabled in production for compatibility checks.
const isDevelopment = process.env.NODE_ENV === 'development';

root.render(
  isDevelopment ? (
    <ToastProvider>
      <App />
    </ToastProvider>
  ) : (
    <React.StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </React.StrictMode>
  )
);