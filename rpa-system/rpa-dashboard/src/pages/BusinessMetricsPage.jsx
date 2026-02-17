import React, { useState, useEffect } from 'react';
import { useTheme } from '../utils/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { api } from '../utils/api';
import MetricCard from '../components/MetricCard/MetricCard';
import styles from './BusinessMetricsPage.module.css';

/**
 * Business Metrics Page (PRIVATE - Owner Only)
 * Mobile-friendly view of business metrics from easyflow-metrics
 * Automatically reads from /api/business-metrics/overview (which uses cached metrics)
 * Only accessible to owner (kyjahntsmith@gmail.com)
 */
const BusinessMetricsPage = () => {
 const { theme } = useTheme();
 const { user } = useAuth();
 const [metrics, setMetrics] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [lastUpdated, setLastUpdated] = useState(null);

 // Owner-only access check
 const OWNER_EMAILS = ['kyjahntsmith@gmail.com', 'kyjahnsmith36@gmail.com'];
 const isOwner = user?.email && OWNER_EMAILS.some(email => 
 user.email.toLowerCase() === email.toLowerCase()
 );

 // Show access denied if not owner
 if (!loading && user && !isOwner) {
 return (
 <div className={styles.page} data-theme={theme}>
 <div className={styles.error}>
 <h2>🔒 Access Denied</h2>
 <p>This page is only accessible to the owner.</p>
 </div>
 </div>
 );
 }

 useEffect(() => {
 loadMetrics();
 // Auto-refresh every 5 minutes
 const interval = setInterval(loadMetrics, 5 * 60 * 1000);
 return () => clearInterval(interval);
 }, []);

 const loadMetrics = async () => {
 try {
 setLoading(true);
 setError(null);
 const { data } = await api.get('/api/business-metrics/overview');
 if (data.metrics) {
 setMetrics(data.metrics);
 setLastUpdated(new Date(data.timestamp || Date.now()));
 } else {
 setError('No metrics data available');
 }
 } catch (err) {
 console.error('Failed to load metrics:', err);
 setError(err.message || 'Failed to load metrics');
 } finally {
 setLoading(false);
 }
 };

 const formatNumber = (num) => {
 if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
 if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
 return num?.toLocaleString() || '0';
 };

 const formatCurrency = (num) => {
 return new Intl.NumberFormat('en-US', {
 style: 'currency',
 currency: 'USD',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0
 }).format(num || 0);
 };

 // Show loading state
 if (loading && !metrics) {
 return (
 <div className={styles.page} data-theme={theme}>
 <div className={styles.loading}>
 <div className={styles.spinner}></div>
 <p>Loading metrics...</p>
 </div>
 </div>
 );
 }

 // Show error state
 if (error && !metrics) {
 return (
 <div className={styles.page} data-theme={theme}>
 <div className={styles.error}>
 <h2>⚠️ Error Loading Metrics</h2>
 <p>{error}</p>
 <button onClick={loadMetrics} className={styles.button}>
 Retry
 </button>
 </div>
 </div>
 );
 }

 // Build metric cards using existing MetricCard component
 const metricCards = [];
 if (metrics) {
 metricCards.push(
 <MetricCard
 key="users"
 title="Total Users"
 value={formatNumber(metrics.totalUsers)}
 icon="👥"
 trend="up"
 subtitle={metrics.activeUsers > 0 ? `${formatNumber(metrics.activeUsers)} active` : undefined}
 />
 );

 metricCards.push(
 <MetricCard
 key="signups"
 title="New Signups"
 value={formatNumber(metrics.newSignups)}
 icon="📈"
 trend="up"
 subtitle={metrics.activationRate > 0 ? `${metrics.activationRate.toFixed(1)}% activated` : undefined}
 />
 );

 metricCards.push(
 <MetricCard
 key="workflows"
 title="Workflows Created"
 value={formatNumber(metrics.workflowsCreated)}
 icon="⚡"
 trend="up"
 subtitle={metrics.workflowsRun > 0 ? `${formatNumber(metrics.workflowsRun)} runs` : undefined}
 />
 );

 if (metrics.mrr > 0) {
 metricCards.push(
 <MetricCard
 key="mrr"
 title="Monthly Recurring Revenue"
 value={formatCurrency(metrics.mrr)}
 icon="💰"
 trend="up"
 />
 );
 }

 if (metrics.conversionRate > 0) {
 metricCards.push(
 <MetricCard
 key="conversion"
 title="Conversion Rate"
 value={`${metrics.conversionRate.toFixed(1)}%`}
 icon="🎯"
 trend="up"
	subtitle="Visit → Signup"
 />
 );
 }

 if (metrics.avgWorkflowsPerUser > 0) {
 metricCards.push(
 <MetricCard
 key="engagement"
 title="Avg Workflows/User"
 value={metrics.avgWorkflowsPerUser.toFixed(1)}
 icon="📊"
 trend="up"
 subtitle={metrics.avgRunsPerUser > 0 ? `${metrics.avgRunsPerUser.toFixed(1)} runs/user` : undefined}
 />
 );
 }
 }

 return (
 <div className={styles.page} data-theme={theme}>
 <div className={styles.header}>
 <h1 className={styles.title}>Business Metrics</h1>
 {lastUpdated && (
 <p className={styles.subtitle}>
 Last updated: {lastUpdated.toLocaleTimeString()}
 {metrics?.source === 'cached' && ' (from daily batch)'}
 </p>
 )}
 <button onClick={loadMetrics} className={styles.button}>
 🔄 Refresh
 </button>
 </div>

 {metrics && (
 <div className={styles.metricsGrid}>
 {metricCards}
 </div>
 )}

 {metrics && (
 <div className={styles.footer}>
 <p className={styles.footerText}>
 Auto-updates every 5 min * 
 {metrics.source === 'cached' 
 ? ' Data from daily batch (easyflow-metrics)' 
 : ' Real-time data'}
 </p>
 </div>
 )}
 </div>
 );
};

export default BusinessMetricsPage;

