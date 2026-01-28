/**
 * TaskProgressPanel - Real-time side panel showing task execution progress
 * 
 * Displays:
 * - Current action being performed
 * - Progress percentage
 * - Step-by-step actions log
 * - Real-time updates via polling/realtime
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '../../utils/logger';
import { api } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import styles from './TaskProgressPanel.module.css';

const logger = createLogger('TaskProgressPanel');

const TaskProgressPanel = ({ runId, onClose, onComplete }) => {
 const { theme } = useTheme() || { theme: 'light' };
 const [runData, setRunData] = useState(null);
 const [actions, setActions] = useState([]);
 const [progress, setProgress] = useState(0);
 const [status, setStatus] = useState('running');
 const [error, setError] = useState(null);
 const [isMinimized, setIsMinimized] = useState(false);
 const [screenshots, setScreenshots] = useState([]);
 const [currentScreenshot, setCurrentScreenshot] = useState(null);
 const pollIntervalRef = useRef(null);
 const actionsRef = useRef([]);

 // Transform status messages to sovereignty language
 const transformToSovereignty = useCallback((message) => {
 if (!message) return message;
 
 const transformations = {
 'Extracting data from': 'Extracting data from',
 'Processing': 'Applying your custom logic...',
 'Saving': 'Sovereignty Asserted: File saved to your custody',
 'Completed': 'Sovereignty Asserted: File saved to your custody',
 'Loading': 'Extracting data from',
 'Fetching': 'Extracting data from',
 'Writing': 'Sovereignty Asserted: File saved to your custody',
 'Done': 'Sovereignty Asserted: File saved to your custody'
 };
 
 for (const [key, value] of Object.entries(transformations)) {
 if (message.includes(key)) {
 return message.replace(key, value);
 }
 }
 
 return message;
 }, []);

 // Parse status message to extract action
 const parseStatusMessage = useCallback((message) => {
 if (!message) return null;
 
 // Transform to sovereignty language
 const transformedMessage = transformToSovereignty(message);
 
 // Extract emoji and action text
	// eslint-disable-next-line no-misleading-character-class
	const emojiMatch = transformedMessage.match(/^([🔍🌐✅⚠️📥📤⚙️❌🔄⚡📁]+)/u);
	const emoji = emojiMatch ? emojiMatch[1] : '';
	// eslint-disable-next-line no-misleading-character-class
	const text = transformedMessage.replace(/^[🔍🌐✅⚠️📥📤⚙️❌🔄⚡📁]+\s*/u, '').trim();
 
 return { emoji, text, full: transformedMessage };
 }, [transformToSovereignty]);

 // Fetch run status
 const fetchRunStatus = useCallback(async () => {
 if (!runId) return;

 try {
 const response = await api.get(`/api/runs/${runId}`);
 const run = response.data;

 if (run) {
 setRunData(run);
 
 // Parse result for status message and progress
 let result = {};
 try {
 result = typeof run.result === 'string' ? JSON.parse(run.result) : (run.result || {});
 } catch (e) {
 logger.warn('Failed to parse result:', e);
 }

 const currentStatus = run.status || 'running';
 setStatus(currentStatus);

 // Update progress
 const currentProgress = result.progress || (currentStatus === 'completed' ? 100 : (currentStatus === 'failed' ? 0 : progress));
 setProgress(currentProgress);
 setProgress(currentProgress);

 // Update screenshots
 if (result.screenshots && Array.isArray(result.screenshots)) {
 setScreenshots(result.screenshots);
 // Show the most recent screenshot
 if (result.screenshots.length > 0) {
 const latest = result.screenshots[result.screenshots.length - 1];
 setCurrentScreenshot(latest);
 }
 }

 // Update actions log
 // Sovereign Reclamation Copy
 const statusMessage = result.status_message || result.message || 'Reclaiming Task...';
 // Sovereign step messages can be injected by backend or mapped here if needed
 const parsedAction = parseStatusMessage(statusMessage);
 
 if (parsedAction) {
 // Add new action if it's different from the last one
 const lastAction = actionsRef.current[actionsRef.current.length - 1];
 if (!lastAction || lastAction.full !== parsedAction.full) {
 const newAction = {
 ...parsedAction,
 timestamp: new Date().toISOString(),
 progress: currentProgress
 };
 actionsRef.current = [...actionsRef.current, newAction];
 setActions([...actionsRef.current]);
 }
 }

 // Handle completion
 if (currentStatus === 'completed' || currentStatus === 'failed') {
 if (pollIntervalRef.current) {
 clearInterval(pollIntervalRef.current);
 pollIntervalRef.current = null;
 }
 
 if (currentStatus === 'completed' && onComplete) {
 setTimeout(() => onComplete(run), 1000);
 }
 }

 // Handle errors
 if (currentStatus === 'failed') {
 const errorMessage = result.error || result.message || 'Task failed';
 setError(errorMessage);
 }
 }
 } catch (err) {
 logger.error('Failed to fetch run status:', err);
 // Don't show error to user - just log it
 }
 }, [runId, progress, parseStatusMessage, onComplete]);

 // Poll for updates
 useEffect(() => {
 if (!runId) return;

 // Initial fetch
 fetchRunStatus();

 // Poll every 1 second for active tasks
 pollIntervalRef.current = setInterval(() => {
 if (status === 'running' || status === 'queued') {
 fetchRunStatus();
 }
 }, 1000);

 return () => {
 if (pollIntervalRef.current) {
 clearInterval(pollIntervalRef.current);
 pollIntervalRef.current = null;
 }
 };
 }, [runId, status, fetchRunStatus]);

 // Format time
 const formatTime = (timestamp) => {
 if (!timestamp) return '';
 const date = new Date(timestamp);
 return date.toLocaleTimeString();
 };

 // Get status color
 const getStatusColor = () => {
 switch (status) {
 case 'completed':
 return 'var(--color-success, #10b981)';
 case 'failed':
 return 'var(--color-error, #ef4444)';
 case 'running':
 return 'var(--color-primary, #3b82f6)';
 default:
 return 'var(--color-muted, #6b7280)';
 }
 };

 if (!runId) return null;

 return (
 <div className={`${styles.panel} ${isMinimized ? styles.minimized : ''} ${styles[theme]}`}>
 <div className={styles.header}>
 <div className={styles.headerLeft}>
 <h3 className={styles.title}>Reclaiming Task...</h3>
 {runData && (
 <span className={styles.status} style={{ color: getStatusColor() }}>
 {status === 'completed' ? '✅ Sovereignty Asserted' : 
 status === 'failed' ? '❌ Failed' : 
 status === 'running' ? '⚡ Reclaiming...' : 
 '⏳ Queued'}
 </span>
 )}
 </div>
 <div className={styles.headerRight}>
 <button
 className={styles.minimizeButton}
 onClick={() => setIsMinimized(!isMinimized)}
 aria-label={isMinimized ? 'Expand' : 'Minimize'}
 >
 {isMinimized ? '▲' : '▼'}
 </button>
 <button
 className={styles.closeButton}
 onClick={onClose}
 aria-label="Close"
 >
 ×
 </button>
 </div>
 </div>

 {!isMinimized && (
 <div className={styles.content}>
 {/* Browser Screenshot Viewer - PRIMARY FOCUS */}
 {currentScreenshot && currentScreenshot.screenshot ? (
 <div className={styles.screenshotSection}>
 <div className={styles.screenshotHeader}>
 <span className={styles.screenshotTitle}>📸 Browser View</span>
 <span className={styles.screenshotAction}>{currentScreenshot.action}</span>
 </div>
 <div className={styles.screenshotContainer}>
 <img 
 src={currentScreenshot.screenshot} 
 alt={currentScreenshot.action || 'Browser screenshot'}
 className={styles.screenshot}
 />
 {/* Progress overlay - shows at bottom */}
 <div className={styles.screenshotOverlay}>
 <div className={styles.screenshotProgressBar}>
 <div 
 className={styles.screenshotProgressFill}
 style={{ 
 width: `${currentScreenshot.progress || progress}%`,
 backgroundColor: getStatusColor()
 }}
 />
 </div>
 <div className={styles.screenshotInfo}>
 {currentScreenshot.message || currentScreenshot.action}
 </div>
 </div>
 </div>
 {screenshots.length > 1 && (
 <div className={styles.screenshotNav}>
 <button
 className={styles.screenshotNavButton}
 onClick={() => {
 const currentIndex = screenshots.findIndex(s => s.timestamp === currentScreenshot.timestamp);
 if (currentIndex > 0) {
 setCurrentScreenshot(screenshots[currentIndex - 1]);
 }
 }}
 disabled={screenshots.findIndex(s => s.timestamp === currentScreenshot.timestamp) === 0}
 >
 ← Previous
 </button>
 <span className={styles.screenshotCounter}>
 {screenshots.findIndex(s => s.timestamp === currentScreenshot.timestamp) + 1} / {screenshots.length}
 </span>
 <button
 className={styles.screenshotNavButton}
 onClick={() => {
 const currentIndex = screenshots.findIndex(s => s.timestamp === currentScreenshot.timestamp);
 if (currentIndex < screenshots.length - 1) {
 setCurrentScreenshot(screenshots[currentIndex + 1]);
 }
 }}
 disabled={screenshots.findIndex(s => s.timestamp === currentScreenshot.timestamp) === screenshots.length - 1}
 >
 Next ->
 </button>
 </div>
 )}
 </div>
 ) : (
 /* Fallback: Show progress when no screenshot available */
 <>
 {/* Progress Bar */}
 <div className={styles.progressSection}>
 <div className={styles.progressBarContainer}>
 <div 
 className={styles.progressBar}
 style={{ 
 width: `${progress}%`,
 backgroundColor: getStatusColor()
 }}
 />
 </div>
 <div className={styles.progressText}>
 {progress}% Complete
 </div>
 </div>

 {/* Current Action */}
 {actions.length > 0 && (
 <div className={styles.currentAction}>
 <div className={styles.actionEmoji}>
 {actions[actions.length - 1].emoji}
 </div>
 <div className={styles.actionText}>
 {actions[actions.length - 1].text}
 </div>
 </div>
 )}
 </>
 )}

 {/* Error Display */}
 {error && (
 <div className={styles.errorSection}>
 <div className={styles.errorIcon}>❌</div>
 <div className={styles.errorText}>{error}</div>
 </div>
 )}

 {/* Actions Log - Only show if no screenshots (fallback mode) */}
 {(!currentScreenshot || !currentScreenshot.screenshot) && (
 <div className={styles.actionsLog}>
 <h4 className={styles.actionsTitle}>Actions Taken</h4>
 <div className={styles.actionsList}>
 {actions.map((action, index) => (
 <div key={index} className={styles.actionItem}>
 <div className={styles.actionItemEmoji}>{action.emoji}</div>
 <div className={styles.actionItemContent}>
 <div className={styles.actionItemText}>{action.text}</div>
 <div className={styles.actionItemTime}>
 {formatTime(action.timestamp)}
 </div>
 </div>
 <div className={styles.actionItemProgress}>
 {action.progress}%
 </div>
 </div>
 ))}
 {actions.length === 0 && (
 <div className={styles.emptyActions}>
 Waiting for task to start...
 </div>
 )}
 </div>
 </div>
 )}

 {/* Task Info */}
 {runData && (
 <div className={styles.taskInfo}>
 <div className={styles.taskInfoRow}>
 <span className={styles.taskInfoLabel}>Task ID:</span>
 <span className={styles.taskInfoValue}>{runData.id?.substring(0, 8)}...</span>
 </div>
 {runData.started_at && (
 <div className={styles.taskInfoRow}>
 <span className={styles.taskInfoLabel}>Started:</span>
 <span className={styles.taskInfoValue}>
 {new Date(runData.started_at).toLocaleString()}
 </span>
 </div>
 )}
 {runData.ended_at && (
 <div className={styles.taskInfoRow}>
 <span className={styles.taskInfoLabel}>Completed:</span>
 <span className={styles.taskInfoValue}>
 {new Date(runData.ended_at).toLocaleString()}
 </span>
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 );
};

export default TaskProgressPanel;

