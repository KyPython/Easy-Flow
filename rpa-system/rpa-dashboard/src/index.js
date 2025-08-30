import React from 'react';
import ReactDOM from 'react-dom/client';
import ReactGA from 'react-ga4';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Initialize Google Analytics if a measurement ID is provided
const gaMeasurementId = process.env.REACT_APP_GA_MEASUREMENT_ID;
if (gaMeasurementId) {
  ReactGA.initialize(gaMeasurementId);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// In index.js, after other requires:
const { getPolarSubscription } = require('./polar_utils');
const express = require('express');
const app = express();

// ...

// Add a new API route
app.get('/api/my-subscription', async (req, res) => {
  // 1. Get the user's subscription from your database
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('external_payment_id') // Assuming you store the Polar sub ID here
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (!sub || !sub.external_payment_id) {
    return res.status(404).json({ error: 'No subscription found' });
  }

  // 2. Fetch the latest status from Polar
  const polarSub = await getPolarSubscription(sub.external_payment_id);

  if (!polarSub) {
    return res.status(502).json({ error: 'Could not retrieve subscription details' });
  }

  // 3. Return the fresh data
  res.json(polarSub);
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();