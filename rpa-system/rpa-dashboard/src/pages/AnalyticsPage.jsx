
import React from 'react';
import { useNavigate } from 'react-router-dom';
import UsageCharts from '../components/Analytics/UsageCharts';
import PerformanceMetrics from '../components/Analytics/PerformanceMetrics';
import ReportsGenerator from '../components/Analytics/ReportsGenerator';
import { useAnalyticsDashboard } from '../hooks/useAnalyticsDashboard';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import styles from '../components/Analytics/AnalyticsPage.module.css';


const AnalyticsPage = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { data, loading, error } = useAnalyticsDashboard();
  
  return (
    <PlanGate 
      requiredPlan="Professional"
      feature="advanced_analytics"
      upgradeMessage="Advanced Analytics provides detailed insights into your automation performance, usage trends, and ROI metrics. Upgrade to Professional or Enterprise plan to unlock comprehensive reporting."
      onPaywallClose={() => {
        console.log('[AnalyticsPage] Paywall dismissed, navigating back');
        navigate(-1);
      }}
    >
      <div className={styles.analyticsPage + ' theme-' + theme}>
        <header className={styles.header}>
          <h1 className={styles.title}>Analytics Dashboard</h1>
        </header>
        {loading && <div>Loading analytics...</div>}
  {error && <div className={styles.error}>Error loading analytics: {error.message || 'Unknown error'}</div>}
        {!loading && !error && (
          <>
            <UsageCharts data={data} />
            <PerformanceMetrics data={data} />
            <ReportsGenerator data={data} />
          </>
        )}
      </div>
    </PlanGate>
  );
};

export default AnalyticsPage;
