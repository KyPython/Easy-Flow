import { useState } from 'react';
import { triggerCampaign } from '../../utils/api';
import styles from './OnboardingModal.module.css';
import PropTypes from 'prop-types';

const OnboardingModal = ({ isOpen, onClose, userEmail }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    {
      title: 'Welcome to EasyFlow!',
      description: 'Let\'s get you set up with automated business processes.',
      icon: '🚀',
      content: (
        <div className={styles.stepContent}>
          <p>EasyFlow helps you automate repetitive business tasks, saving you time and reducing errors.</p>
          <ul className={styles.benefitsList}>
            <li>🔄 Automate data entry and processing</li>
            <li>📊 Generate reports automatically</li>
            <li>⏰ Schedule tasks to run when you need them</li>
            <li>📧 Get notifications when tasks complete</li>
          </ul>
        </div>
      )
    },
    {
      title: 'Create Your First Task',
      description: 'Tasks are the core of EasyFlow - let\'s explore what they can do.',
      icon: '📋',
      content: (
        <div className={styles.stepContent}>
          <p>You can create tasks for:</p>
          <div className={styles.taskTypes}>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>🌐</span>
              <div>
                <h4>Web Automation</h4>
                <p>Extract data from websites, fill forms, monitor changes</p>
              </div>
            </div>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>📄</span>
              <div>
                <h4>Document Processing</h4>
                <p>Process PDFs, extract text, generate reports</p>
              </div>
            </div>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>🔗</span>
              <div>
                <h4>API Integration</h4>
                <p>Connect different services and sync data</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Set Up Your Preferences',
      description: 'Customize EasyFlow to work best for your business.',
      icon: '⚙️',
      content: (
        <div className={styles.stepContent}>
          <p>We recommend setting up:</p>
          <div className={styles.preferencesList}>
            <label className={styles.preference}>
              <input type="checkbox" defaultChecked />
              <span>Email notifications for completed tasks</span>
            </label>
            <label className={styles.preference}>
              <input type="checkbox" defaultChecked />
              <span>Weekly summary reports</span>
            </label>
            <label className={styles.preference}>
              <input type="checkbox" />
              <span>SMS alerts for failed tasks</span>
            </label>
          </div>
        </div>
      )
    },
    {
      title: 'You\'re All Set!',
      description: 'Welcome emails are on their way to help you get started.',
      icon: '🎉',
      content: (
        <div className={styles.stepContent}>
          <p>Congratulations! You&#39;ve completed the onboarding process.</p>
          <div className={styles.completionContent}>
            <div className={styles.nextSteps}>
              <h4>What&#39;s next?</h4>
              <ul>
                <li>Check your email ({userEmail}) for getting started guides</li>
                <li>Create your first automation task</li>
                <li>Explore our documentation and tutorials</li>
                <li>Join our community for tips and best practices</li>
              </ul>
            </div>
            <div className={styles.supportInfo}>
              <h4>Need help?</h4>
              <p>Our support team is here to help you succeed. Reach out anytime!</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      console.log('Triggering welcome campaign...');
      
      // Make sure we're sending the campaign parameter correctly
      const response = await triggerCampaign({ 
        campaign: 'welcome'
        // The backend will automatically use the authenticated user's email
      });
      
      console.log('Campaign triggered successfully:', response);
      
      // Close modal after a brief delay to show completion
      setTimeout(() => {
        onClose();
        alert('🎉 Onboarding complete! Welcome emails are on their way.');
      }, 1000);
    } catch (error) {
      console.error('Failed to trigger welcome campaign:', error);
      // Still complete onboarding even if email fails
      alert('Onboarding complete! You can start using EasyFlow now.');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <button className={styles.skipButton} onClick={handleSkip}>
            Skip Tour
          </button>
        </div>

        <div className={styles.stepContainer}>
          <div className={styles.stepHeader}>
            <div className={styles.stepIcon}>{currentStepData.icon}</div>
            <div className={styles.stepInfo}>
              <h2 className={styles.stepTitle}>{currentStepData.title}</h2>
              <p className={styles.stepDescription}>{currentStepData.description}</p>
            </div>
          </div>

          <div className={styles.stepBody}>
            {currentStepData.content}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.stepIndicator}>
            Step {currentStep + 1} of {steps.length}
          </div>
          
          <div className={styles.buttonGroup}>
            {currentStep > 0 && (
              <button 
                className={styles.previousButton} 
                onClick={handlePrevious}
                disabled={isLoading}
              >
                Previous
              </button>
            )}
            
            {!isLastStep ? (
              <button 
                className={styles.nextButton} 
                onClick={handleNext}
                disabled={isLoading}
              >
                Next
              </button>
            ) : (
              <button 
                className={styles.completeButton} 
                onClick={handleComplete}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Completing...
                  </>
                ) : (
                  'Complete Onboarding'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

OnboardingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  userEmail: PropTypes.string,
};

export default OnboardingModal;