import React, { useState, useEffect, useCallback } from 'react';

// Canonical feature order (shared with PricingPage and PaywallModal)
const featureOrder = [
 'automation_runs',
 'storage_gb',
 'full_logging_days',
 'audit_logs',
 'team_members',
 'automation_workflows',
 'scheduled_automations',
 'webhook_management',
 'webhook_integrations',
 'custom_integrations',
 'integrations_builder',
 'business_rules',
 'advanced_analytics',
 'basic_analytics',
 'advanced_templates',
 'unlimited_custom_templates',
 'priority_support',
 'email_support',
 'full_api_access',
 'dedicated_support',
 'advanced_security',
 'sla_guarantees',
 'white_label_options',
 'custom_development',
 'enterprise_automation',
 'enterprise_features',
 'error_handling',
 'sso_ldap',
 'contact_sales',
 'requires_sales_team'
];
import PropTypes from 'prop-types';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../utils/ThemeContext';
import { FiZap, FiHardDrive, FiGitBranch, FiArrowUp, FiCalendar, FiActivity } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import supabase, { initSupabase } from '../../utils/supabaseClient';
import styles from './UsageTracker.module.css';

function UsageTracker({ showUpgrade = true, compact = false }) {
 const { planData, loading, getUsagePercent, isAtLimit, refresh, updateUserPlan } = usePlan();
 const { theme } = useTheme();
 const navigate = useNavigate();
 const [refreshInterval, setRefreshInterval] = useState(null);
 const [featureLabels, setFeatureLabels] = useState({});

 // Fetch feature labels from Supabase (same as PricingPage)
 const fetchFeatureLabels = useCallback(async () => {
 try {
 const client = await initSupabase();
 const { data, error } = await client
 .from('plan_feature_labels')
 .select('feature_key, feature_label');
 if (error) throw error;
 const mapping = {};
 data?.forEach(f => {
 mapping[f.feature_key] = f.feature_label;
 });
 setFeatureLabels(mapping);
 } catch (err) {
 // fallback: use keys as labels
 }
 }, []);

 useEffect(() => {
 fetchFeatureLabels();
 }, [fetchFeatureLabels]);

 useEffect(() => {
 const interval = setInterval(() => {
 refresh();
 }, 30000);
 setRefreshInterval(interval);
 return () => {
 if (interval) {
 clearInterval(interval);
 }
 };
 }, [refresh]);

 if (loading) {
 return (
 <div className={styles.container}>
 <div className={styles.loading}>
 <div className={styles.spinner} />
 <span>Loading usage data...</span>
 </div>
 </div>
 );
 }

 if (!planData) {
 return null;
 }

 // (removed duplicate destructuring)

 const calculateDaysRemaining = () => {
 if (!planData?.renewal_info?.renewal_date) {
 return null;
 }
 
 const renewalDate = new Date(planData.renewal_info.renewal_date);
 const today = new Date();
 const diffTime = renewalDate - today;
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 return Math.max(0, diffDays);
 };

 const formatRenewalDate = () => {
 if (!planData?.renewal_info?.renewal_date) {
 return 'No expiry';
 }
 
 const date = new Date(planData.renewal_info.renewal_date);
 return date.toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric', 
 year: 'numeric'
 });
 };


 // Canonical usage items based on PricingPage logic
 const iconMap = {
 automation_runs: <FiActivity />,
 storage_gb: <FiHardDrive />,
 automation_workflows: <FiGitBranch />,
 workflows: <FiGitBranch />,
 // Add more icons as needed
 };
 const unitMap = {
 automation_runs: 'runs',
 storage_gb: 'GB',
 automation_workflows: 'workflows',
 workflows: 'workflows',
 };
 const descMap = {
 automation_runs: 'This month',
 storage_gb: 'Total files',
 automation_workflows: 'Currently active',
 workflows: 'Currently active',
 };

 const { plan = {}, usage = {}, limits = {} } = planData || {};
 
 // Debug logging (can be removed in production)
 if (process.env.NODE_ENV === 'development') {
 console.log('UsageTracker - planData:', planData);
 console.log('UsageTracker - extracted plan:', plan);
 console.log('UsageTracker - plan.name:', plan.name);
 console.log('UsageTracker - limits:', limits);
 console.log('UsageTracker - usage:', usage);
 }
 
 // Build usageItems dynamically from available limits and usage data
 const getUsageItems = () => {
 // Get all relevant keys from limits
 const availableKeys = Object.keys(limits).filter(key => {
 const limitValue = limits[key];
 // Include numeric limits and show disabled features (0) as well
 return typeof limitValue === 'number' && key !== 'has_workflows';
 });
 
 // Build items for each available metric
 return availableKeys.map(key => {
 const current = usage[key] || 0;
 const limit = limits[key];
 
 // Handle special display cases
 let displayLimit = limit;
 let displayDescription = descMap[key] || 'Current usage';
 
 if (limit === -1) {
 displayLimit = '∞';
 displayDescription = 'Unlimited';
 } else if (limit === 0) {
 displayDescription = 'Not available on current plan';
 }
 
 return {
 key,
 icon: iconMap[key] || <FiActivity />,
 label: featureLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
 current,
 limit: displayLimit,
 unit: unitMap[key] || '',
 description: displayDescription,
 color: getProgressColor(current, limit),
 isDisabled: limit === 0,
 };
 });
 };
 
 // Get color based on usage percentage - uses CSS variables for theme consistency
 const getProgressColor = (current, limit) => {
 if (limit === -1 || limit === 0) {
 // Use CSS variable for success color
 return getComputedStyle(document.documentElement).getPropertyValue('--color-success-500').trim() || '#22c55e';
 }
 const percentage = (current / limit) * 100;
 const root = document.documentElement;
 if (percentage >= 90) {
 // Use CSS variable for error color
 return getComputedStyle(root).getPropertyValue('--color-error-500').trim() || '#ef4444';
 }
 if (percentage >= 70) {
 // Use CSS variable for warning color
 return getComputedStyle(root).getPropertyValue('--color-warning-500').trim() || '#f59e0b';
 }
 // Use CSS variable for primary color
 return getComputedStyle(root).getPropertyValue('--color-primary-500').trim() || '#3b82f6';
 };
 
 const usageItems = getUsageItems();

 const handleUpgrade = () => {
 navigate('/pricing');
 };

 const daysRemaining = calculateDaysRemaining();
 
 // Dynamic plan classification based on limits instead of hardcoded names
 const getplanTier = () => {
 if (!limits) return 'basic';
 
 // Determine tier based on limits - more dynamic approach
 const monthlyRuns = limits.monthly_runs || 0;
 const storageGB = limits.storage_gb || 0;
 const workflows = limits.workflows || 0;
 
 // High-tier plans typically have unlimited features (-1) or very high limits
 if (monthlyRuns >= 10000 || storageGB >= 100 || workflows >= 20 || 
 monthlyRuns === -1 || storageGB === -1 || workflows === -1) {
 return 'pro';
 }
 
 // Mid-tier plans have substantial but limited resources
 if (monthlyRuns >= 1000 || storageGB >= 50 || workflows >= 10) {
 return 'professional';
 }
 
 // Entry-level paid plans
 if (monthlyRuns >= 100 || storageGB >= 5 || workflows >= 3) {
 return 'starter';
 }
 
 // Free/basic plans
 return 'basic';
 };
 
 // Use PricingPage logic for plan name/status
 const planTier = (() => {
 if (!limits) return 'basic';
 const monthlyRuns = limits.monthly_runs || 0;
 const storageGB = limits.storage_gb || 0;
 const workflows = limits.workflows || 0;
 if (monthlyRuns >= 10000 || storageGB >= 100 || workflows >= 20 || monthlyRuns === -1 || storageGB === -1 || workflows === -1) {
 return 'pro';
 }
 if (monthlyRuns >= 1000 || storageGB >= 50 || workflows >= 10) {
 return 'professional';
 }
 if (monthlyRuns >= 100 || storageGB >= 5 || workflows >= 3) {
 return 'starter';
 }
 return 'basic';
 })();
 const isPro = planTier === 'pro' || planTier === 'professional';

 if (compact) {
 return (
 <div className={`${styles.container} ${styles.compact}`}>
 <div className={styles.planHeader}>
 <div className={styles.planInfo}>
 <span className={`${styles.planBadge} ${isPro ? styles.pro : styles.free}`}>
 {isPro && <FiZap />}
 {plan?.name || 'Hobbyist'}
 </span>
 {plan?.is_trial && <span className={styles.trialBadge}>Trial</span>}
 </div>
 {!isPro && (
 <button onClick={handleUpgrade} className={styles.upgradeBtn}>
 <FiArrowUp />
 Upgrade
 </button>
 )}
 </div>
 <div className={styles.compactUsage}>
 {usageItems.slice(0, 2).map((item) => (
 <div key={item.key} className={styles.compactUsageItem}>
 <span className={styles.compactLabel}>{item.label}</span>
 <span className={styles.compactValue}>
 {typeof item.current === 'number' ? item.current.toLocaleString() : item.current}
 {item.limit !== -1 && (
 <span className={styles.compactLimit}>
 /{item.limit.toLocaleString()}
 </span>
 )}
 {item.limit === -1 && <span className={styles.unlimited}>∞</span>}
 </span>
 </div>
 ))}
 </div>
 </div>
 );
 }


 return (
 <div className={styles.container}>
 <div className={styles.header}>
 <h3>Current Usage</h3>
 <div className={styles.planBadge}>
 <span className={`${styles.planName} ${isPro ? styles.pro : styles.free}`}>
 {isPro && <FiZap />}
 {plan?.name || 'Hobbyist'}
 </span>
 {plan?.is_trial && <span className={styles.trialBadge}>Trial</span>}
 </div>
 </div>

 <div className={styles.renewalInfo}>
 <FiCalendar className={styles.calendarIcon} />
 <div className={styles.renewalText}>
 <span className={styles.renewalLabel}>
 {plan?.name ? `${plan.name} Plan` : 'Current Plan'}
 </span>
 <span className={styles.renewalDate}>
 {plan?.expires_at ? formatRenewalDate() : 'No expiry'}
 </span>
 {/* Optionally add days left logic here if needed */}
 </div>
 </div>

 <div className={styles.usageGrid}>
 {usageItems.map((item) => {
 const percent = getUsagePercent(item.key);
 const atLimit = isAtLimit(item.key);
 const isUnlimited = item.limit === -1;

 return (
 <div 
 key={item.key} 
 className={`${styles.usageItem} ${atLimit ? styles.atLimit : ''} ${item.isDisabled ? styles.disabled : ''}`}
 >
 <div className={styles.usageHeader}>
 <div 
 className={styles.iconWrapper} 
 style={{ 
 color: item.isDisabled 
 ? getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7280'
 : item.color 
 }}
 >
 {item.icon}
 </div>
 <div className={styles.usageInfo}>
 <span className={styles.usageLabel}>{item.label}</span>
 <span className={styles.usageDescription}>{item.description}</span>
 <span className={styles.usageValue}>
 {item.isDisabled ? (
 <span className={styles.disabledText}>Not available</span>
 ) : (
 <>
 {typeof item.current === 'number' ? item.current.toLocaleString() : item.current}
 {!isUnlimited && (
 <span className={styles.usageLimit}>
 / {typeof item.limit === 'number' ? item.limit.toLocaleString() : item.limit} {item.unit}
 </span>
 )}
 {isUnlimited && (
 <span className={styles.unlimited}>Unlimited</span>
 )}
 </>
 )}
 </span>
 </div>
 </div>

 {!isUnlimited && !item.isDisabled && (
 <div className={styles.progressBar}>
 <div 
 className={styles.progressFill}
 style={{ 
 width: `${Math.min(percent, 100)}%`,
 backgroundColor: atLimit 
 ? getComputedStyle(document.documentElement).getPropertyValue('--color-error-500').trim() || '#ef4444'
 : item.color
 }}
 />
 </div>
 )}

 {atLimit && (
 <div className={styles.limitWarning}>
 Limit reached
 </div>
 )}
 </div>
 );
 })}
 </div>

 {showUpgrade && (planTier === 'basic' || planTier === 'starter') && (
 <div className={styles.upgradeSection}>
 <div className={styles.upgradeContent}>
 <div>
 <h4>Need more capacity?</h4>
 <p>Upgrade to get higher limits and advanced features</p>
 </div>
 <button onClick={handleUpgrade} className={styles.upgradeBtn}>
 <FiArrowUp />
 Upgrade Plan
 </button>
 </div>
 </div>
 )}

 {plan?.expires_at && new Date(plan.expires_at) > new Date() && (
 <div className={styles.expiryNotice}>
 Plan expires on {new Date(plan.expires_at).toLocaleDateString()}
 </div>
 )}

 </div>
 );

}

export default UsageTracker;

UsageTracker.propTypes = {
 showUpgrade: PropTypes.bool,
 compact: PropTypes.bool,
};