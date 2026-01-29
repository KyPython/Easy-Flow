import React, { useState, useEffect } from 'react';
import { FiX, FiZap } from 'react-icons/fi';
import { usePlan } from '../../hooks/usePlan';
import conversionTracker from '../../utils/conversionTracking';
import DemoBookingButton from '../DemoBookingButton/DemoBookingButton';
import styles from './UpgradeBanner.module.css';

/**
 * UpgradeBanner - Persistent upgrade CTA with urgency for dashboard
 * Shows only to free users, dismissible for 3 days
 */
const UpgradeBanner = () => {
 const { planData } = usePlan();
 const [isVisible, setIsVisible] = useState(false);
 const [isClosing, setIsClosing] = useState(false);

 // Check if banner should be shown
 useEffect(() => {
 const userPlan = planData?.plan?.name?.toLowerCase();
 
 // Only show to free/hobbyist users
 if (!userPlan || userPlan === 'hobbyist' || userPlan === 'free') {
 const dismissedUntil = localStorage.getItem('upgrade_banner_dismissed_until');
 const now = Date.now();
 
 if (!dismissedUntil || now > parseInt(dismissedUntil)) {
 setIsVisible(true);
 }
 }
 }, [planData?.plan?.name]);

 const handleDismiss = () => {
 // Track banner dismissal
 conversionTracker.trackEvent('upgrade_banner_dismissed', {
 'source': 'dashboard_banner',
 'user_plan': planData?.plan?.name || 'hobbyist'
 });
 
 setIsClosing(true);
 
 // Store dismissal for 3 days
 const threeDaysFromNow = Date.now() + (3 * 24 * 60 * 60 * 1000);
 localStorage.setItem('upgrade_banner_dismissed_until', threeDaysFromNow.toString());
 
 setTimeout(() => {
 setIsVisible(false);
 }, 200);
 };

 const handleUpgradeClick = () => {
 // Track upgrade click from banner
 conversionTracker.trackUpgradeClicked(
 'dashboard_banner',
 'Upgrade to Pro ->',
 planData?.plan?.name || 'hobbyist'
 );
 
 // Redirect to pricing
 window.location.href = '/pricing';
 };

 if (!isVisible) {
 return null;
 }

 return (
 <div className={`${styles.banner} ${isClosing ? styles.closing : ''}`}>
 <div className={styles.content}>
 <div className={styles.icon}>
 <FiZap />
 </div>
 
 <div className={styles.message}>
 <div className={styles.title}>
 🚀 Unlock Advanced Workflows
 </div>
 <div className={styles.subtitle}>
 50% off for first 10 customers · Only <span className={styles.urgency}>7 spots left</span>
 </div>
 </div>
 
 <div className={styles.actions}>
 <button 
 onClick={handleUpgradeClick}
 className={styles.upgradeButton}
>
				Upgrade to Pro →
			</button>
 
 <DemoBookingButton
 buttonText="📅 Book Demo"
 subtext=""
 source="dashboard_banner"
 variant="outline"
 size="medium"
 showSubtext={false}
 calendlyUrl="https://calendly.com/your-link/15min"
 className={styles.demoButton}
 />
 </div>
 
 <button 
 onClick={handleDismiss}
 className={styles.dismissButton}
 aria-label="Dismiss banner"
 >
 <FiX />
 </button>
 </div>
 </div>
 );
};

export default UpgradeBanner;