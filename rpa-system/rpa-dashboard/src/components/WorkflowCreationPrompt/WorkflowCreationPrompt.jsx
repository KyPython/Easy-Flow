import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { trackEvent } from '../../utils/api';
import styles from './WorkflowCreationPrompt.module.css';

/**
 * WorkflowCreationPrompt - Prompts users to create their first workflow
 * Shows when user has no workflows and helps guide them to value
 */
const WorkflowCreationPrompt = ({ workflowsCount = 0, onDismiss }) => {
 const navigate = useNavigate();
 const { user } = useAuth();
 const [dismissed, setDismissed] = useState(false);

 useEffect(() => {
 // Check if user has dismissed this prompt before
 const dismissedKey = `workflow_prompt_dismissed_${user?.id || 'anonymous'}`;
 const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
 setDismissed(wasDismissed);
 }, [user]);

 const handleCreateWorkflow = () => {
 // Track event
 try {
 trackEvent({
 user_id: user?.id,
 event_name: 'workflow_creation_prompt_clicked',
 properties: { source: 'dashboard_prompt', workflows_count: workflowsCount }
 });
 } catch (e) {
 console.debug('trackEvent failed', e);
 }

 navigate('/app/workflows/builder/new');
 };

 const handleDismiss = () => {
 const dismissedKey = `workflow_prompt_dismissed_${user?.id || 'anonymous'}`;
 localStorage.setItem(dismissedKey, 'true');
 setDismissed(true);
 if (onDismiss) onDismiss();
 };

 // Don't show if user has workflows or has dismissed
 if (workflowsCount > 0 || dismissed) {
 return null;
 }

 return (
 <div className={styles.promptContainer}>
 <div className={styles.promptContent}>
 <div className={styles.icon}>🚀</div>
 <div className={styles.text}>
 <h3>Create Your First Workflow</h3>
 <p>Start automating your repetitive tasks in minutes. No coding required!</p>
 <div className={styles.examples}>
 <span>✨ Extract data from websites</span>
 <span>📧 Send automated emails</span>
 <span>📊 Update spreadsheets</span>
 </div>
 </div>
 <div className={styles.actions}>
 <button 
 className={styles.primaryButton}
 onClick={handleCreateWorkflow}
 >
 Create Workflow
 </button>
 <button 
 className={styles.dismissButton}
 onClick={handleDismiss}
 >
 Maybe Later
 </button>
 </div>
 </div>
 </div>
 );
};

export default WorkflowCreationPrompt;

