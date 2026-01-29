/**
import { createLogger } from '../utils/logger';
const logger = createLogger('FirstWorkflowWizard');
 * First Workflow Wizard
 * Guided workflow creation experience for new users
 * Helps users create their first workflow step-by-step
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { trackEvent } from '../../utils/api';
import { trackOnboardingStep } from '../../utils/onboardingTracking';
import { api } from '../../utils/api';
import styles from './FirstWorkflowWizard.module.css';

const TEMPLATES = [
  {
    id: 'portal-csv',
    name: 'Portal CSV Export',
    description: 'Login to a portal, scrape data, export to CSV',
    icon: '📊',
    category: 'data_extraction',
    popular: true
  },
  {
    id: 'email-notification',
    name: 'Email Notification',
    description: 'Send automated emails when something happens',
    icon: '📧',
    category: 'notifications',
    popular: false
  },
  {
    id: 'web-scrape',
    name: 'Web Scrape',
    description: 'Extract data from any website',
    icon: '🌐',
    category: 'data_extraction',
    popular: true
  },
  {
    id: 'blank',
    name: 'Start from Scratch',
    description: 'Create a custom workflow from blank',
    icon: '✨',
    category: 'custom',
    popular: false
  }
];

const FirstWorkflowWizard = ({ isOpen, onClose, onComplete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  // Track wizard started
  useEffect(() => {
    if (isOpen && !hasTrackedStart) {
      trackOnboardingStep('first_workflow_wizard_started', {}).catch(e => 
        logger.debug('Failed to track wizard start', e)
      );
      setHasTrackedStart(true);
    }
  }, [isOpen, hasTrackedStart]);

  const steps = [
    {
      title: 'Let\'s Create Your First Workflow',
      description: 'Choose a template to get started quickly, or start from scratch',
      content: (
        <div className={styles.templateGrid}>
          {TEMPLATES.map(template => (
            <button
              key={template.id}
              className={`${styles.templateCard} ${selectedTemplate?.id === template.id ? styles.selected : ''}`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div className={styles.templateIcon}>{template.icon}</div>
              <h3 className={styles.templateName}>{template.name}</h3>
              <p className={styles.templateDescription}>{template.description}</p>
              {template.popular && (
                <span className={styles.popularBadge}>Popular</span>
              )}
            </button>
          ))}
        </div>
      )
    },
    {
      title: 'Name Your Workflow',
      description: 'Give your workflow a descriptive name',
      content: (
        <div className={styles.nameStep}>
          <input
            type="text"
            className={styles.nameInput}
            placeholder={selectedTemplate?.name || 'My First Workflow'}
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            autoFocus
          />
          <p className={styles.nameHint}>
            💡 Tip: Use a clear name like "Monthly Report Export" or "Daily Invoice Download"
          </p>
        </div>
      )
    },
    {
      title: 'Almost There!',
      description: 'We\'ll create your workflow and take you to the builder',
      content: (
        <div className={styles.reviewStep}>
          <div className={styles.reviewCard}>
            <h3>Workflow Summary</h3>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Template:</span>
              <span className={styles.reviewValue}>
                {selectedTemplate?.icon} {selectedTemplate?.name}
              </span>
            </div>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Name:</span>
              <span className={styles.reviewValue}>
                {workflowName || selectedTemplate?.name || 'My First Workflow'}
              </span>
            </div>
          </div>
          <p className={styles.reviewHint}>
            🚀 Next, you'll customize your workflow in the builder. It's easy!
          </p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      trackOnboardingStep('first_workflow_wizard_step_viewed', {
        step_number: currentStep + 2,
        total_steps: steps.length
      }).catch(e => logger.debug('Failed to track step', e));
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      const finalName = workflowName || selectedTemplate.name || 'My First Workflow';

      // If template is "blank", navigate to builder
      if (selectedTemplate.id === 'blank') {
        trackOnboardingStep('first_workflow_wizard_completed', {
          template: 'blank',
          workflow_name: finalName
        }).catch(e => logger.debug('Failed to track completion', e));

        navigate('/app/workflows/builder/new');
        if (onComplete) onComplete();
        if (onClose) onClose();
        return;
      }

      // For templates, try to load from template if it exists
      let workflowData = {
        name: finalName,
        description: `Created from ${selectedTemplate.name} template`,
        status: 'active'
      };

      // Try to fetch template if it exists (e.g., Portal CSV template)
      try {
        const templatesResponse = await api.get('/api/workflows/templates', {
          params: { search: selectedTemplate.name }
        });
        
        if (templatesResponse.data && templatesResponse.data.length > 0) {
          const template = templatesResponse.data[0];
          workflowData = {
            ...workflowData,
            canvas_config: template.config?.canvas_config || template.canvas_config
          };
        }
      } catch (e) {
        // Template not found, continue with basic workflow
        logger.debug('Template not found, creating basic workflow', e);
      }

      const response = await api.post('/api/workflows', workflowData);

      if (response.data && response.data.id) {
        // Track workflow creation
        await trackEvent({
          event_name: 'first_workflow_created_via_wizard',
          user_id: user?.id,
          properties: {
            template_id: selectedTemplate.id,
            template_name: selectedTemplate.name,
            workflow_id: response.data.id,
            workflow_name: finalName
          }
        });

        // Track onboarding step
        await trackOnboardingStep('first_workflow_wizard_completed', {
          template: selectedTemplate.id,
          workflow_id: response.data.id,
          workflow_name: finalName
        });

        // Navigate to the new workflow
        navigate(`/app/workflows/builder/${response.data.id}`);
        if (onComplete) onComplete();
        if (onClose) onClose();
      } else {
        throw new Error('Failed to create workflow');
      }
    } catch (error) {
      logger.error('[FirstWorkflowWizard] Failed to create workflow:', error);
      alert('Failed to create workflow. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const canProceed = currentStep === 0 ? selectedTemplate !== null : 
                     currentStep === 1 ? workflowName.trim().length > 0 : true;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.wizard}>
        <div className={styles.header}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>{currentStepData.title}</h2>
            <p className={styles.stepDescription}>{currentStepData.description}</p>
          </div>

          <div className={styles.stepBody}>
            {currentStepData.content}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.stepIndicator}>
            Step {currentStep + 1} of {steps.length}
          </div>
          
          <div className={styles.buttons}>
            {currentStep > 0 && (
              <button 
                className={styles.buttonSecondary}
                onClick={handlePrevious}
                disabled={loading}
              >
                Previous
              </button>
            )}
            
            {!isLastStep ? (
              <button 
                className={styles.buttonPrimary}
                onClick={handleNext}
                disabled={!canProceed || loading}
              >
                Next
              </button>
            ) : (
              <button 
                className={styles.buttonPrimary}
                onClick={handleCreate}
                disabled={loading || !canProceed}
              >
                {loading ? 'Creating...' : 'Create Workflow'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstWorkflowWizard;
