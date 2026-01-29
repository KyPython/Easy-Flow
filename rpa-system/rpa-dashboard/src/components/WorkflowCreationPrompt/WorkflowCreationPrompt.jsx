import React, { useState, useEffect } from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('WorkflowCreationPrompt');
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { trackEvent } from '../../utils/api';
import FirstWorkflowWizard from '../FirstWorkflowWizard/FirstWorkflowWizard';
import styles from './WorkflowCreationPrompt.module.css';

/**
 * WorkflowCreationPrompt - Prompts users to create their first workflow
 * Shows when user has no workflows and helps guide them to value
 */
const WorkflowCreationPrompt = ({ workflowsCount = 0, onDismiss }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

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
        properties: { source: 'dashboard_prompt', workflows_count: workflowsCount, action: 'create_new' }
      });
    } catch (e) {
      logger.debug('trackEvent failed', e);
    }

    // Show wizard for first workflow
    if (workflowsCount === 0) {
      setShowWizard(true);
    } else {
      navigate('/app/workflows/builder/new');
    }
  };

  const handleBrowseTemplates = () => {
    // Track event
    try {
      trackEvent({
        user_id: user?.id,
        event_name: 'workflow_creation_prompt_clicked',
        properties: { source: 'dashboard_prompt', workflows_count: workflowsCount, action: 'browse_templates' }
      });
    } catch (e) {
      logger.debug('trackEvent failed', e);
    }

    // Show wizard for first workflow, otherwise go to templates
    if (workflowsCount === 0) {
      setShowWizard(true);
    } else {
      navigate('/app/workflows?view=templates');
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    if (onDismiss) onDismiss();
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
    <>
      <div className={styles.promptContainer}>
        <div className={styles.promptContent}>
          <div className={styles.icon}>🚀</div>
          <div className={styles.text}>
            <h2>Create Your First Workflow</h2>
            <p>Start automating your repetitive tasks in minutes. No coding required!</p>
            <div className={styles.examples}>
              <span>✨ Portal CSV Export (Login → Scrape → Export)</span>
              <span>📧 Send automated emails</span>
              <span>📊 Update spreadsheets</span>
            </div>
            <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--text-muted)' }}>
              💡 <strong>Quick Start:</strong> Try our pre-built "Portal CSV Export" template to automate login and data extraction from any website.
            </p>
          </div>
          <div className={styles.actions}>
            <button 
              className={styles.primaryButton}
              onClick={handleCreateWorkflow}
            >
              Create Workflow
            </button>
            <button 
              className={styles.secondaryButton}
              onClick={handleBrowseTemplates}
              style={{ marginLeft: '12px' }}
            >
              Browse Templates
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

      {/* First Workflow Wizard */}
      <FirstWorkflowWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />
    </>
  );
};

export default WorkflowCreationPrompt;

