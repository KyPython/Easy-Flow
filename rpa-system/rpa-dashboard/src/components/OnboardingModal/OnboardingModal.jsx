import { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';
const logger = createLogger('OnboardingModalUOnboardingModal');
import { triggerCampaign } from '../../utils/api';
import { trackOnboardingStep } from '../../utils/onboardingTracking';
import React from 'react';
import styles from './OnboardingModal.module.css';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';

const OnboardingModal = ({ isOpen, onClose, userEmail }) => {
 const [currentStep, setCurrentStep] = useState(0);
 const [isLoading, setIsLoading] = useState(false);
 const [hasTrackedStart, setHasTrackedStart] = useState(false);

 const { t } = useI18n();

 // Track tutorial_started when modal opens
 useEffect(() => {
 if (isOpen && !hasTrackedStart) {
 trackOnboardingStep('tutorial_started', { modal_opened: true }).catch(e => 
 logger.debug('Failed to track tutorial_started:', e)
 );
 setHasTrackedStart(true);
 }
 }, [isOpen, hasTrackedStart]);
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
 title: t('onboarding.step4.title','Sovereign Onboarding Complete!'),
 description: t('onboarding.sovereign_welcome','Welcome to EasyFlow. You\'re no longer a tenant of your software. You\'re the Architect. Let\'s build your first sovereign workflow.'),
 icon: '🎉',
 content: (
 <div className={styles.stepContent}>
 <p>{t('onboarding.step4.congrats','Perfect! You\'re ready to start turning boring work into button clicks.')}</p>
 
 {/* ✅ NEW FEATURE: Execution Modes Highlight */}
 <div style={{
 background: 'linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-success-50) 100%)',
 border: '2px solid var(--color-primary-200)',
 borderRadius: 'var(--radius-lg)',
 padding: 'var(--spacing-md)',
 margin: 'var(--spacing-md) 0',
 textAlign: 'center'
 }}>
 <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-xs)' }}>⚡💰</div>
 <h4 style={{ 
 fontSize: 'var(--font-size-base)', 
 fontWeight: 'var(--font-weight-bold)',
 marginBottom: 'var(--spacing-xs)',
 color: 'var(--text-primary)'
 }}>
 💰 Save Up to 25% on Workflow Costs
 </h4>
 <p style={{ 
 fontSize: 'var(--font-size-sm)', 
 color: 'var(--text-muted)',
 marginBottom: 0,
 lineHeight: 1.5
 }}>
 When creating workflows, choose <strong>Instant</strong> for urgent tasks, <strong>Balanced</strong> for standard runs, 
 or <strong>Scheduled</strong> for batch jobs. Smart scheduling automatically optimizes costs!
 </p>
 </div>
 
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
 const nextStep = currentStep + 1;
 setCurrentStep(nextStep);
 
 // Track step progression (optional - can be used for analytics)
 trackOnboardingStep('tutorial_step_viewed', {
 step_number: nextStep + 1,
 step_name: steps[nextStep]?.title || `step_${nextStep + 1}`,
 total_steps: steps.length
 }).catch(e => logger.debug('Failed to track tutorial step:', e));
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
 // Track tutorial_completed onboarding step
 await trackOnboardingStep('tutorial_completed', {
 total_steps: steps.length,
 completed_at: new Date().toISOString()
 }).catch(e => logger.debug('Failed to track tutorial_completed:', e));
 
 logger.info('Triggering welcome campaign...');
 
 // Make sure we're sending the campaign parameter correctly
 const response = await triggerCampaign({ 
 campaign: 'welcome'
 // The backend will automatically use the authenticated user's email
 });
 
 logger.info('Campaign triggered successfully:', response);
 
 // Close modal after a brief delay to show completion
 setTimeout(() => {
 onClose();
 alert('🎉 Onboarding complete! Welcome emails are on their way.');
 }, 1000);
 } catch (error) {
 logger.error('Failed to trigger welcome campaign:', error);
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
