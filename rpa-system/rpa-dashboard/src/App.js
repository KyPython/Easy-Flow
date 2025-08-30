// Use the Kombai-generated dashboard app (router + pages)
import React from 'react';
import DashboardApp from './App.dashboard';
import './App.css';
import { Helmet } from 'react-helmet';

export default function App() {
  return (
    <>
      <Helmet>
        <title>EasyFlow</title>
        <meta name="description" content="EasyFlow - Your automation solution" />
      </Helmet>
      <DashboardApp />
    </>
  );
}
