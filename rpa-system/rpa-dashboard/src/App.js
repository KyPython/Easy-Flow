// Use the Kombai-generated dashboard app (router + pages)
import React from 'react';
import DashboardApp from './App.dashboard';
import './App.css';

export default function App() {
  React.useEffect(() => {
    document.title = "EasyFlow";
  }, []);

  return (
    <>
      <DashboardApp />
    </>
  );
}


//src/SettingsPage.jsx (for better error handling in the UI)
//Add error handling to your backend code to gracefully handle API failures
//Implement a fallback for when the payment service is unavailable