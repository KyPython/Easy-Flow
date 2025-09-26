import React from 'react';
import ReactDOM from 'react-dom/client';
import ReactGA from 'react-ga4';
import './index.css';
import App from './App';
import ErrorBoundary from './components/Diagnostics/ErrorBoundary';
import reportWebVitals from './reportWebVitals';
// Vercel Analytics
import { Analytics } from '@vercel/analytics/react';
import { ToastProvider } from './components/WorkflowBuilder/Toast';

// Explicit imports to prevent tree-shaking from dropping global exposures
import './utils/supabaseClient';
import './utils/api';
// Dev-only network logger to surface failing POST URLs/status codes
if (process.env.NODE_ENV === 'development') {
  require('./utils/devNetLogger');
}

// Initialize Google Analytics if a measurement ID is provided
const gaMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;
if (gaMeasurementId) {
  ReactGA.initialize(gaMeasurementId, {
    // Configure for production domain
    gaOptions: {
      // Set the domain for your deployed site
  // Use auto so GA works on preview, custom and production domains
  cookieDomain: 'auto',
      siteSpeedSampleRate: 100
    },
    gtagOptions: {
      // Configure gtag for the deployed domain
      send_page_view: false // We'll handle page views manually in the router
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Global runtime error diagnostics (helps when mobile shows blank screen)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    // eslint-disable-next-line no-console
    console.error('[GlobalError]', e.message, e.filename, e.lineno, e.colno, e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    // eslint-disable-next-line no-console
    console.error('[GlobalUnhandledRejection]', e.reason);
  });
}
root.render(
  <React.StrictMode>
    <ToastProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ToastProvider>
    <Analytics />
  </React.StrictMode>
);
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();