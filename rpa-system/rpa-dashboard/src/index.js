import React from 'react';
import ReactDOM from 'react-dom/client';
import ReactGA from 'react-ga4';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

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
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();