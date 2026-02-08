/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect } from 'react';
import { FiX, FiZap, FiTrendingUp } from 'react-icons/fi';
import { usePlan } from '../../hooks/usePlan';
import conversionTracker from '../../utils/conversionTracking';
import styles from './MilestonePrompt.module.css';

/**
 * MilestonePrompt - Toast/modal that appears when milestone hit
 * Celebrates user progress and prompts upgrade
 */
const MilestonePrompt = ({ milestone, onClose }) => {
 const { planData } = usePlan();
 const [isVisible, setIsVisible] = useState(false);
 const [isClosing, setIsClosing] = useState(false);

 useEffect(() => {
 if (milestone) {
 setIsVisible(true);
 
 // Track milestone reached
 conversionTracker.trackMilestoneReached(
 milestone.type,
 milestone.value,
 planData?.plan?.name || 'hobbyist'
 );
 
 // Auto-dismiss after 10 seconds
 const timer = setTimeout(() => {
 handleClose();
 }, 10000);
 
 return () => clearTimeout(timer);
 }
 }, [milestone, planData?.plan?.name]);

 const handleClose = () => {
 setIsClosing(true);
 setTimeout(() => {
 setIsVisible(false);
 onClose && onClose();
 }, 200);
 };

 const handleUpgradeClick = () => {
 conversionTracker.trackUpgradeClicked(
 'milestone_prompt',
 'Unlock unlimited with Pro',
 planData?.plan?.name || 'hobbyist',
 milestone?.type
 );
 window.location.href = '/pricing';
 };

 if (!isVisible || !milestone) {
 return null;
 }

 const getMilestoneEmoji = (type) => {
 switch (type) {
 case 'tasks_completed':
 return '🎉';
 case 'workflows_created':
 return '🚀';
 case 'integrations_used':
 return '🔗';
 case 'time_saved':
 return '⏰';
 default:
 return '🎯';
 }
 };

 const getMilestoneMessage = () => {
 const emoji = getMilestoneEmoji(milestone.type);
 switch (milestone.type) {
 case 'tasks_completed':
 return `${emoji} You've automated ${milestone.value} tasks!`;
 case 'workflows_created':
 return `${emoji} You've created ${milestone.value} workflows!`;
 case 'integrations_used':
 return `${emoji} You've used ${milestone.value} integrations!`;
 default:
 return `${emoji} Milestone reached: ${milestone.value}!`;
 }
 };

 const userPlan = planData?.plan?.name?.toLowerCase() || 'hobbyist';
 const showUpgradePrompt = userPlan === 'hobbyist' || userPlan === 'free';

 return (
 <div className={styles.overlay}>
 <div className={`${styles.prompt} ${isClosing ? styles.closing : ''}`}>
 <button
 onClick={handleClose}
 className={styles.closeButton}
 aria-label="Close milestone prompt"
 >
 <FiX />
 </button>

 <div className={styles.icon}>
 <FiTrendingUp />
 </div>

 <div className={styles.content}>
 <h3 className={styles.title}>
 {getMilestoneMessage()}
 </h3>
 
 <p className={styles.message}>
 Great progress! You're getting amazing value from EasyFlow automation.
 </p>

 {showUpgradePrompt && (
 <>
 <p className={styles.upgradeMessage}>
 Ready to unlock unlimited potential?
 </p>
 
 <button
 onClick={handleUpgradeClick}
 className={styles.upgradeButton}
 >
 <FiZap />
 Unlock unlimited with Pro
 </button>
 </>
 )}

 {!showUpgradePrompt && (
 <div className={styles.celebration}>
 <p className={styles.proMessage}>
 Keep up the great work with EasyFlow Pro! 🌟
 </p>
 </div>
 )}
 </div>

 <div className={styles.progress}>
 <div className={styles.progressBar}>
 <div 
 className={styles.progressFill}
 style={{ width: `${Math.min((milestone.value / milestone.nextTarget) * 100, 100)}%` }}
 />
 </div>
 <div className={styles.progressText}>
 {milestone.value} / {milestone.nextTarget} to next milestone
 </div>
 </div>
 </div>
 </div>
 );
};

export default MilestonePrompt;