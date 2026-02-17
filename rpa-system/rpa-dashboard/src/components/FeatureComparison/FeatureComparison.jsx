import React, { useEffect } from 'react';
import { FiCheck, FiX, FiZap } from 'react-icons/fi';
import { usePlan } from '../../hooks/usePlan';
import conversionTracker from '../../utils/conversionTracking';
import styles from './FeatureComparison.module.css';

/**
 * FeatureComparison - Shows what free vs pro includes
 * For dashboard sidebar or settings page
 */
const FeatureComparison = ({ compact = false }) => {
 const { planData } = usePlan();
 const userPlan = planData?.plan?.name?.toLowerCase() || 'hobbyist';

 // Track feature comparison view
 useEffect(() => {
 conversionTracker.trackFeatureComparisonViewed(userPlan);
 }, [userPlan]);

 const handleUpgradeClick = () => {
 conversionTracker.trackUpgradeClicked(
 'feature_comparison',
 'Upgrade to Pro - 50% Off →',
 userPlan
 );
 window.location.href = '/pricing';
 };

 const features = [
 {
 name: 'Basic Workflows',
 free: '3 workflows',
 pro: 'Unlimited'
 },
 {
 name: 'Advanced Automation',
 free: false,
 pro: true
 },
 {
 name: 'Integrations',
 free: '2 integrations',
 pro: '50+ integrations'
 },
 {
 name: 'Priority Support',
 free: false,
 pro: true
 },
 {
 name: 'Team Collaboration',
 free: false,
 pro: 'Up to 10 members'
 }
 ];

 const renderFeatureValue = (value) => {
 if (typeof value === 'boolean') {
 return value ? (
 <FiCheck className={styles.checkIcon} />
 ) : (
 <FiX className={styles.crossIcon} />
 );
 }
 return <span className={styles.featureText}>{value}</span>;
 };

 return (
 <div className={`${styles.comparison} ${compact ? styles.compact : ''}`}>
 <div className={styles.header}>
 <h3 className={styles.title}>
 {compact ? 'Compare Plans' : 'Free vs Pro Comparison'}
 </h3>
 {!compact && (
 <p className={styles.subtitle}>
 See what you unlock with ModeLogic Pro
 </p>
 )}
 </div>

 <div className={styles.table}>
 {/* Header Row */}
 <div className={styles.headerRow}>
 <div className={styles.featureHeader}>Feature</div>
 <div className={styles.planHeader}>
 <div className={styles.planName}>
 Free
 {(userPlan === 'hobbyist' || userPlan === 'free') && (
 <span className={styles.currentPlanBadge}>You</span>
 )}
 </div>
 </div>
 <div className={styles.planHeader}>
 <div className={styles.planName}>
 Pro
 {userPlan !== 'hobbyist' && userPlan !== 'free' && (
 <span className={styles.currentPlanBadge}>You</span>
 )}
 </div>
 </div>
 </div>

 {/* Feature Rows */}
 {features.map((feature, index) => (
 <div key={index} className={styles.featureRow}>
 <div className={styles.featureName}>{feature.name}</div>
 <div className={styles.featureValue}>
 {renderFeatureValue(feature.free)}
 </div>
 <div className={styles.featureValue}>
 {renderFeatureValue(feature.pro)}
 </div>
 </div>
 ))}
 </div>

 {/* CTA Section */}
 {(userPlan === 'hobbyist' || userPlan === 'free') && (
 <div className={styles.cta}>
 <button
 onClick={handleUpgradeClick}
 className={styles.upgradeButton}
 >
 <FiZap />
 Upgrade to Pro - 50% Off →
 </button>
 <div className={styles.ctaSubtext}>
 🔥 Limited time: First 10 customers only
 </div>
 </div>
 )}
 </div>
 );
};

export default FeatureComparison;