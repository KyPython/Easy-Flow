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
      title: t('onboarding.step1.title','Stop Doing Boring Work!'),
      description: t('onboarding.step1.description','Let\'s turn your most annoying daily tasks into one-click actions.'),
      icon: '🚀',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step1.body','Stop wasting hours on boring, repetitive computer tasks. EasyFlow turns them into simple button clicks.')}</p>
          <ul className={styles.benefitsList}>
            <li>📧 {t('onboarding.step1.benefit1','Send welcome emails to new customers instantly')}</li>
            <li>📊 {t('onboarding.step1.benefit2','Create weekly sales reports without copying data')}</li>
            <li>🗂️ {t('onboarding.step1.benefit3','Update your CRM when forms are submitted')}</li>
            <li>💰 {t('onboarding.step1.benefit4','Process invoices from email to accounting software')}</li>
          </ul>
        </div>
      )
    },
    {
      title: t('onboarding.step2.title','Pick Your First Boring Task to Automate'),
      description: t('onboarding.step2.description','Which annoying task would save you the most time if it happened automatically?'),
      icon: '📋',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step2.intro','Here are some popular time-savers our users love:')}</p>
          <div className={styles.taskTypes}>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>🌐</span>
              <div>
                <h4>{t('onboarding.step2.type_web_title','Copy Customer Info From Website to Spreadsheet')}</h4>
                <p>{t('onboarding.step2.type_web_text','Save 30 minutes daily - automatically grab customer details and add them to your tracking sheet')}</p>
              </div>
            </div>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>📄</span>
              <div>
                <h4>{t('onboarding.step2.type_doc_title','Turn Invoice PDFs Into Spreadsheet Rows')}</h4>
                <p>{t('onboarding.step2.type_doc_text','Save 20 minutes per invoice - extract vendor, amount, date, and add to your expense tracking')}</p>
              </div>
            </div>
            <div className={styles.taskType}>
              <span className={styles.taskIcon}>🔗</span>
              <div>
                <h4>{t('onboarding.step2.type_api_title','Send Slack Alerts When Orders Come In')}</h4>
                <p>{t('onboarding.step2.type_api_text','Never miss a sale - get instant team notifications with order details when customers buy')}</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: t('onboarding.step3.title','How Do You Want to Know When Tasks Finish?'),
      description: t('onboarding.step3.description','Choose how you\'d like to stay in the loop when your automations run.'),
      icon: '⚙️',
      content: (
        <div className={styles.stepContent}>
          <p>{t('onboarding.step3.intro','Most people like to get notified when important stuff happens:')}</p>
          <div className={styles.preferencesList}>
            <label className={styles.preference}>
              <input type="checkbox" defaultChecked />
              <span>{t('onboarding.step3.pref_email','Email me when tasks finish (like "Your invoice processing is done")')}</span>
            </label>
            <label className={styles.preference}>
              <input type="checkbox" defaultChecked />
              <span>{t('onboarding.step3.pref_weekly','Send me a weekly "time saved" summary ("You saved 6 hours this week!")')}</span>
            </label>
            <label className={styles.preference}>
              <input type="checkbox" />
              <span>{t('onboarding.step3.pref_sms','Text me if something breaks ("Your morning reports failed - click to fix")')}</span>
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
          <p>{t('onboarding.step4.congrats','Perfect! You\'re ready to start turning boring work into button clicks.')}</p>
          <div className={styles.completionContent}>
            <div className={styles.nextSteps}>
              <h4>{t('onboarding.step4.whats_next','What\'s next?')}</h4>
              <ul>
                <li>{t('onboarding.step4.next_email','Check your email ({email}) for getting started guides').replace('{email}', userEmail)}</li>
                <li>{t('onboarding.step4.next_create','Pick that annoying task you do every day and automate it')}</li>
                <li>{t('onboarding.step4.next_explore','Browse our "most popular automations" for inspiration')}</li>
                <li>{t('onboarding.step4.next_join','Join our community to see what tasks other people automate')}</li>
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