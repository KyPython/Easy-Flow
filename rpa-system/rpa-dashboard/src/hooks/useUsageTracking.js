import { useState, useEffect, useCallback } from 'react';
import conversionTracker from '../utils/conversionTracking';

let logger = null;
const getLogger = () => {
  if (!logger) {
    try {
      const { createLogger } = require('../utils/logger');
      logger = createLogger('useUsageTracking');
    } catch (e) {
      logger = {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      };
    }
  }
  return logger;
};

/**
 * useUsageTracking - Monitors user activity and triggers milestone prompts
 * 
 * Tracks: tasks completed, workflows created, sessions, days active
 * Triggers: Milestone prompts at 5, 10, 20 tasks completed
 * Storage: localStorage with userId isolation
 * 
 * @param {string} userId - Current user ID from auth context
 * @returns {object} Usage metrics and control functions
 */
export const useUsageTracking = (userId) => {
 const [metrics, setMetrics] = useState({
 tasksCompleted: 0,
 workflowsCreated: 0,
 sessionsCount: 0,
 daysActive: 0,
 lastActiveDate: null
 });
 
 const [showMilestonePrompt, setShowMilestonePrompt] = useState(false);
 const [currentMilestone, setCurrentMilestone] = useState(null);

 // Use fallback ID if userId not available - safer for local dev
 const effectiveUserId = userId || 'local-dev-user';

 // Milestone definitions
 const MILESTONES = {
 tasks_completed: [
 { threshold: 5, message: "🎉 You've automated 5 tasks!", nextTarget: 10 },
 { threshold: 10, message: "🚀 10 tasks completed! You're on fire!", nextTarget: 20 },
 { threshold: 20, message: "⚡ You're a power user! 20 tasks automated!", nextTarget: 50 }
 ],
 workflows_created: [
 { threshold: 3, message: "🎯 You've created 3 workflows!", nextTarget: 5 },
 { threshold: 5, message: "🔥 5 workflows created! You're mastering automation!", nextTarget: 10 }
 ]
 };

 // Generate localStorage keys
 const getStorageKey = useCallback((metric) => {
 return `usage_${effectiveUserId}_${metric}`;
 }, [effectiveUserId]);

 const getMilestoneKey = useCallback((type, threshold) => {
 return `milestone_shown_${type}_${threshold}_${effectiveUserId}`;
 }, [effectiveUserId]);

 // Load metrics from localStorage
 const loadMetrics = useCallback(() => {
 try {
 const tasksCompleted = parseInt(localStorage.getItem(getStorageKey('tasks_completed'))) || 0;
 const workflowsCreated = parseInt(localStorage.getItem(getStorageKey('workflows_created'))) || 0;
 const sessionsCount = parseInt(localStorage.getItem(getStorageKey('sessions_count'))) || 0;
 const daysActive = parseInt(localStorage.getItem(getStorageKey('days_active'))) || 0;
 const lastActiveDate = localStorage.getItem(getStorageKey('last_active_date'));

 setMetrics({
 tasksCompleted,
 workflowsCreated,
 sessionsCount,
 daysActive,
 lastActiveDate
 });

 return {
 tasksCompleted,
 workflowsCreated,
 sessionsCount,
 daysActive,
 lastActiveDate
 };
 } catch (error) {
 getLogger().warn('Failed to load usage metrics from localStorage:', error);
 return {
 tasksCompleted: 0,
 workflowsCreated: 0,
 sessionsCount: 0,
 daysActive: 0,
 lastActiveDate: null
 };
 }
 }, [getStorageKey]);

 // Save metric to localStorage
 const saveMetric = useCallback((metric, value) => {
 try {
 localStorage.setItem(getStorageKey(metric), value.toString());
 } catch (error) {
 getLogger().warn('Failed to save usage metric to localStorage:', error);
 // Continue without persistence - tracking still works in memory
 }
 }, [getStorageKey]);

 // Check if milestone already shown
 const isMilestoneShown = useCallback((type, threshold) => {
 try {
 return localStorage.getItem(getMilestoneKey(type, threshold)) === 'true';
 } catch (error) {
 return false; // If can't check, assume not shown (safe default)
 }
 }, [getMilestoneKey]);

 // Mark milestone as shown
 const markMilestoneShown = useCallback((type, threshold) => {
 try {
 localStorage.setItem(getMilestoneKey(type, threshold), 'true');
 } catch (error) {
 getLogger().warn('Failed to mark milestone as shown:', error);
 }
 }, [getMilestoneKey]);

 // Check for milestone and show prompt
 const checkMilestone = useCallback((type, newValue) => {
 const milestones = MILESTONES[type] || [];
 
 // Find the highest milestone reached
 let highestMilestone = null;
 for (const milestone of milestones) {
 if (newValue >= milestone.threshold && !isMilestoneShown(type, milestone.threshold)) {
 highestMilestone = milestone;
 }
 }

 if (highestMilestone) {
 const milestoneData = {
 type,
 value: highestMilestone.threshold,
 nextTarget: highestMilestone.nextTarget,
 message: highestMilestone.message
 };

 // Track milestone reached event
 conversionTracker.trackMilestoneReached(type, highestMilestone.threshold, effectiveUserId);

 // Mark all reached milestones as shown (prevent showing lower ones later)
 milestones.forEach(milestone => {
 if (newValue >= milestone.threshold) {
 markMilestoneShown(type, milestone.threshold);
 }
 });

 // Show milestone prompt
 setCurrentMilestone(milestoneData);
 setShowMilestonePrompt(true);
 }
 }, [isMilestoneShown, markMilestoneShown, effectiveUserId]);

 // Update daily activity
 const updateDailyActivity = useCallback(() => {
 const today = new Date().toDateString();
 const { lastActiveDate, daysActive } = loadMetrics();
 
 if (lastActiveDate !== today) {
 const newDaysActive = daysActive + 1;
 saveMetric('last_active_date', today);
 saveMetric('days_active', newDaysActive);
 
 setMetrics(prev => ({
 ...prev,
 lastActiveDate: today,
 daysActive: newDaysActive
 }));
 }
 }, [loadMetrics, saveMetric]);

 // Increment task count
 const incrementTaskCount = useCallback(() => {
 const currentMetrics = loadMetrics();
 const newCount = currentMetrics.tasksCompleted + 1;
 
 saveMetric('tasks_completed', newCount);
 setMetrics(prev => ({ ...prev, tasksCompleted: newCount }));
 
 // Check for milestone
 checkMilestone('tasks_completed', newCount);
 
 getLogger().info('Task completed Total:', newCount);
 }, [loadMetrics, saveMetric, checkMilestone]);

 // Increment workflow count
 const incrementWorkflowCount = useCallback(() => {
 const currentMetrics = loadMetrics();
 const newCount = currentMetrics.workflowsCreated + 1;
 
 saveMetric('workflows_created', newCount);
 setMetrics(prev => ({ ...prev, workflowsCreated: newCount }));
 
 // Check for milestone
 checkMilestone('workflows_created', newCount);
 
 getLogger().info('Workflow created Total:', newCount);
 }, [loadMetrics, saveMetric, checkMilestone]);

 // Increment session count
 const incrementSessionCount = useCallback(() => {
 const currentMetrics = loadMetrics();
 const newCount = currentMetrics.sessionsCount + 1;
 
 saveMetric('sessions_count', newCount);
 setMetrics(prev => ({ ...prev, sessionsCount: newCount }));
 
 getLogger().info('Session started Total:', newCount);
 }, [loadMetrics, saveMetric]);

 // Dismiss milestone prompt
 const dismissMilestonePrompt = useCallback(() => {
 setShowMilestonePrompt(false);
 setCurrentMilestone(null);
 }, []);

 // Reset metrics (for testing/debugging)
 const resetMetrics = useCallback(() => {
 try {
 // Clear all metrics
 const metricsToRemove = [
 'tasks_completed',
 'workflows_created', 
 'sessions_count',
 'days_active',
 'last_active_date'
 ];
 
 metricsToRemove.forEach(metric => {
 localStorage.removeItem(getStorageKey(metric));
 });

 // Clear milestone flags
 Object.keys(MILESTONES).forEach(type => {
 MILESTONES[type].forEach(milestone => {
 localStorage.removeItem(getMilestoneKey(type, milestone.threshold));
 });
 });

 // Reset state
 setMetrics({
 tasksCompleted: 0,
 workflowsCreated: 0,
 sessionsCount: 0,
 daysActive: 0,
 lastActiveDate: null
 });
 
 setShowMilestonePrompt(false);
 setCurrentMilestone(null);
 
 getLogger().info('Usage metrics reset');
 } catch (error) {
 getLogger().warn('Failed to reset metrics:', error);
 }
 }, [getStorageKey, getMilestoneKey]);

 // Get progress to next milestone
 const getProgressToNextMilestone = useCallback((type) => {
 const currentValue = metrics[type === 'tasks_completed' ? 'tasksCompleted' : 'workflowsCreated'];
 const milestones = MILESTONES[type] || [];
 
 // Find next unachieved milestone
 for (const milestone of milestones) {
 if (currentValue < milestone.threshold) {
 return {
 current: currentValue,
 target: milestone.threshold,
 progress: (currentValue / milestone.threshold) * 100,
 remaining: milestone.threshold - currentValue
 };
 }
 }
 
 // All milestones achieved
 return null;
 }, [metrics]);

 // Initialize on mount and when userId changes
 useEffect(() => {
 if (effectiveUserId) {
 loadMetrics();
 updateDailyActivity();
 }
 }, [effectiveUserId, loadMetrics, updateDailyActivity]);

 // Track session on mount (once per component lifecycle)
 useEffect(() => {
 if (effectiveUserId) {
 incrementSessionCount();
 }
}, [incrementSessionCount]); // Only run once on mount; include stable callback

 return {
 // Current metrics
 ...metrics,
 
 // Increment functions
 incrementTaskCount,
 incrementWorkflowCount,
 incrementSessionCount,
 
 // Milestone prompt state
 showMilestonePrompt,
 currentMilestone,
 dismissMilestonePrompt,
 
 // Utility functions
 resetMetrics, // For testing/debugging
 getProgressToNextMilestone,
 
 // Computed values
 isActive: effectiveUserId !== 'anonymous',
 userId: effectiveUserId
 };
};

export default useUsageTracking;
