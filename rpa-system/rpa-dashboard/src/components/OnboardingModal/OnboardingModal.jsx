import { useState } from 'react';
import { triggerCampaign } from '../../utils/api';
import styles from './OnboardingModal.module.css';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';

const OnboardingModal = ({ isOpen, onClose, userEmail }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const { t } = useI18n();
  const steps = [
    {
      title: t('onboarding.step1.title','Welcome to EasyFlow!'),
      description: t('onboarding.step1.description','Let\'s get you set up with automated business processes.'),
      icon: '🚀',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step1.body','EasyFlow helps you automate repetitive business tasks, saving you time and reducing errors.')}</p>
          <ul className={styles.benefitsList}>
            <li>🔄 {t('onboarding.step1.benefit1','Automate data entry and processing')}</li>
            <li>📊 {t('onboarding.step1.benefit2','Generate reports automatically')}</li>
            <li>⏰ {t('onboarding.step1.benefit3','Schedule tasks to run when you need them')}</li>
            <li>📧 {t('onboarding.step1.benefit4','Get notifications when tasks complete')}</li>
          </ul>
        </div>
      )
    },
    {
      title: t('onboarding.step2.title','Create Your First Task'),
      description: t('onboarding.step2.description','Tasks are the core of EasyFlow - let\'s explore what they can do.'),
      icon: '📋',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step2.intro','You can create tasks for:')}</p>
          <div className={styles.taskTypes}>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>🌐</span>
              <div>
                <h4>{t('onboarding.step2.type_web_title','Web Automation')}</h4>
                <p>{t('onboarding.step2.type_web_text','Extract data from websites, fill forms, monitor changes')}</p>
              </div>
            </div>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>📄</span>
              <div>
                <h4>{t('onboarding.step2.type_doc_title','Document Processing')}</h4>
                <p>{t('onboarding.step2.type_doc_text','Process PDFs, extract text, generate reports')}</p>
              </div>
            </div>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>🔗</span>
              <div>
                <h4>{t('onboarding.step2.type_api_title','API Integration')}</h4>
                <p>{t('onboarding.step2.type_api_text','Connect different services and sync data')}</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: t('onboarding.step3.title','Set Up Your Preferences'),
      description: t('onboarding.step3.description','Customize EasyFlow to work best for your business.'),
      icon: '⚙️',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step3.intro','We recommend setting up:')}</p>
          <div className={styles.preferencesList}>
            <label className={styles.preference}>
              <input type="checkbox" defaultChecked />
              <span>{t('onboarding.step3.pref_email','Email notifications for completed tasks')}</span>
            </label>
            <label className={styles.preference}>
              <input type="checkbox" defaultChecked />
              <span>{t('onboarding.step3.pref_weekly','Weekly summary reports')}</span>
            </label>
            <label className={styles.preference}>
              <input type="checkbox" />
              <span>{t('onboarding.step3.pref_sms','SMS alerts for failed tasks')}</span>
            </label>
          </div>
        </div>
      )
    },
    {
      title: t('onboarding.step4.title','You\'re All Set!'),
      description: t('onboarding.step4.description','Welcome emails are on their way to help you get started.'),
      icon: '🎉',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step4.congrats','Congratulations! You\'ve completed the onboarding process.')}</p>
          <div className={styles.completionContent}>
            <div className={styles.nextSteps}>
              <h4>{t('onboarding.step4.whats_next','What\'s next?')}</h4>
              <ul>
                <li>{t('onboarding.step4.next_email','Check your email ({email}) for getting started guides').replace('{email}', userEmail)}</li>
                <li>{t('onboarding.step4.next_create','Create your first automation task')}</li>
                <li>{t('onboarding.step4.next_explore','Explore our documentation and tutorials')}</li>
                <li>{t('onboarding.step4.next_join','Join our community for tips and best practices')}</li>
              </ul>
            </div>
            <div className={styles.supportInfo}>
              <h4>{t('onboarding.step4.need_help_title','Need help?')}</h4>
              <p>{t('onboarding.step4.need_help_text','Our support team is here to help you succeed. Reach out anytime!')}</p>
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
            {t('onboarding.skip','Skip Tour')}
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
            {t('onboarding.step_indicator','Step {current} of {total}')
              .replace('{current}', currentStep + 1)
              .replace('{total}', steps.length)}
          </div>
          
          <div className={styles.buttonGroup}>
            {currentStep > 0 && (
              <button 
                className={styles.previousButton} 
                onClick={handlePrevious}
                disabled={isLoading}
              >
                {t('onboarding.previous','Previous')}
              </button>
            )}
            
            {!isLastStep ? (
              <button 
                className={styles.nextButton} 
                onClick={handleNext}
                disabled={isLoading}
              >
                {t('onboarding.next','Next')}
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
                    {t('onboarding.completing','Completing...')}
                  </>
                ) : (
                  t('onboarding.complete','Complete Onboarding')
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