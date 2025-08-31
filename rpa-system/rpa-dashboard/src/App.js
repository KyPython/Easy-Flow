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