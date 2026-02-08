/* eslint-disable react-hooks/exhaustive-deps */

/*
import { createLogger } from '../../utils/logger';
const logger = createLogger('SurveyComponent');
In-App Feedback Survey Component
---

FUNCTIONALITY:
- Collects user feedback on pain points and feature priorities
- Supports Likert scale ratings and qualitative text feedback
- Gracefully handles backend failures with offline storage
- Automatically submits responses to /api/feedback endpoint

ASSUMPTIONS:
- Backend accepts POST /api/feedback with JSON payload
- Users can provide anonymous feedback or authenticated responses
- Survey can be triggered from multiple app locations
- Responses are stored locally if backend is unreachable
*/

import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../utils/AuthContext';
import { api } from '../../utils/api';
import styles from './SurveyComponent.module.css';

const SurveyComponent = memo(({ 
 triggerType = 'modal',
 onComplete = null,
 onClose = null,
 className = '',
 preSelectedCategory = null 
}) => {
 const [currentStep, setCurrentStep] = useState(1);
 const [isVisible, setIsVisible] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [submitStatus, setSubmitStatus] = useState('');
 const [responses, setResponses] = useState({
 // Pain point ratings (1-5 scale)
 painPoints: {
 manual_processes: null,
 integration_complexity: null,
 security_concerns: null,
 deployment_difficulty: null,
 documentation_gaps: null
 },
 // Feature priority ratings (1-5 scale)
 featurePriorities: {
 better_integrations: null,
 security_tools: null,
 deployment_automation: null,
 monitoring_dashboards: null,
 ai_assistance: null
 },
 // Qualitative feedback
 qualitativeFeedback: {
 biggest_challenge: '',
 ideal_solution: '',
 current_tools: '',
 additional_comments: ''
 },
 // Metadata
 metadata: {
 user_role: '',
 company_size: '',
 industry: '',
 experience_level: ''
 }
 });
 
 const { user } = useAuth();

 // Pain point definitions for clear user understanding
 const painPointDefinitions = {
 manual_processes: {
 title: 'Manual & Repetitive Tasks',
 description: 'Time spent on tasks that could be automated'
 },
 integration_complexity: {
 title: 'Tool Integration Challenges', 
 description: 'Difficulty connecting different software systems'
 },
 security_concerns: {
 title: 'Security & Compliance Issues',
 description: 'Worries about data protection and regulatory compliance'
 },
 deployment_difficulty: {
 title: 'Deployment & Infrastructure',
 description: 'Challenges with setting up and maintaining systems'
 },
 documentation_gaps: {
 title: 'Poor Documentation',
 description: 'Lack of clear guides and troubleshooting resources'
 }
 };

 const featureDefinitions = {
 better_integrations: {
 title: 'Easier API Integrations',
 description: 'One-click connections between popular tools'
 },
 security_tools: {
 title: 'Built-in Security Tools',
 description: 'Automated security scanning and compliance checks'
 },
 deployment_automation: {
 title: 'Automated Deployments',
 description: 'Self-service deployment with minimal configuration'
 },
 monitoring_dashboards: {
 title: 'Monitoring & Analytics',
 description: 'Real-time insights into system performance'
 },
 ai_assistance: {
 title: 'AI-Powered Assistance',
 description: 'Smart suggestions and automated problem resolution'
 }
 };

 // Show survey based on trigger conditions
 useEffect(() => {
 if (triggerType === 'auto') {
 // Auto-trigger after user has been active for 2+ minutes
 const timer = setTimeout(() => {
 const lastSurvey = localStorage.getItem('last_survey_date');
 const daysSinceLastSurvey = lastSurvey ? 
 (Date.now() - parseInt(lastSurvey)) / (1000 * 60 * 60 * 24) : 999;
 
 if (daysSinceLastSurvey > 7) { // Only show once per week
 setIsVisible(true);
 }
 }, 120000); // 2 minutes
 
 return () => clearTimeout(timer);
 } else if (triggerType === 'modal') {
 setIsVisible(true);
 }
 }, [triggerType]);

 // Pre-select category if provided
 useEffect(() => {
 if (preSelectedCategory && painPointDefinitions[preSelectedCategory]) {
 setResponses(prev => ({
 ...prev,
 painPoints: {
 ...prev.painPoints,
 [preSelectedCategory]: 5 // Assume high pain if pre-selected
 }
 }));
 }
 }, [preSelectedCategory]);

 const updateRating = (section, key, value) => {
 setResponses(prev => ({
 ...prev,
 [section]: {
 ...prev[section],
 [key]: parseInt(value)
 }
 }));
 };

 const updateTextResponse = (section, key, value) => {
 setResponses(prev => ({
 ...prev,
 [section]: {
 ...prev[section],
 [key]: value
 }
 }));
 };

 const submitFeedback = async () => {
 setIsSubmitting(true);
 setSubmitStatus('');

 const payload = {
 ...responses,
 timestamp: new Date().toISOString(),
 user_id: user?.id || 'anonymous',
 user_email: user?.email || '',
 trigger_type: triggerType,
 pre_selected_category: preSelectedCategory,
 session_info: {
 user_agent: navigator.userAgent,
 referrer: document.referrer,
 current_page: window.location.pathname
 }
 };

 try {
 // Try to submit to backend
 await api.post('/api/feedback', payload);
 
 setSubmitStatus('success');
 localStorage.setItem('last_survey_date', Date.now().toString());
 
 // Close survey after success
 setTimeout(() => {
 handleClose();
 if (onComplete) onComplete(payload);
 }, 2000);
 
 } catch (error) {
 logger.error('Failed to submit feedback:', error);
 
 // Store locally if backend fails
 const offlineResponses = JSON.parse(localStorage.getItem('offline_feedback') || '[]');
 offlineResponses.push({
 ...payload,
 stored_offline: true,
 offline_timestamp: Date.now()
 });
 localStorage.setItem('offline_feedback', JSON.stringify(offlineResponses));
 
 setSubmitStatus('offline');
 
 // Still close survey - offline storage is transparent to user
 setTimeout(() => {
 handleClose();
 if (onComplete) onComplete(payload);
 }, 3000);
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleClose = () => {
 setIsVisible(false);
 if (onClose) onClose();
 };

 const nextStep = () => {
 if (currentStep < 4) {
 setCurrentStep(currentStep + 1);
 } else {
 submitFeedback();
 }
 };

 const prevStep = () => {
 if (currentStep > 1) {
 setCurrentStep(currentStep - 1);
 }
 };

 const renderRatingScale = (section, key, label, description) => (
 <div key={key} className={styles.ratingItem}>
 <div className={styles.ratingLabel}>
 <strong>{label}</strong>
 <p>{description}</p>
 </div>
 <div className={styles.ratingScale}>
 {[1, 2, 3, 4, 5].map(value => (
 <label key={value} className={styles.ratingOption}>
 <input
 type="radio"
 name={`${section}_${key}`}
 value={value}
 checked={responses[section][key] === value}
 onChange={(e) => updateRating(section, key, e.target.value)}
 />
 <span className={styles.ratingNumber}>{value}</span>
 </label>
 ))}
 </div>
 <div className={styles.ratingLabels}>
 <span>Not a problem</span>
 <span>Major issue</span>
 </div>
 </div>
 );

 if (!isVisible) return null;

 return (
 <div className={`${styles.surveyOverlay} ${className}`}>
 <div className={styles.surveyModal}>
 <div className={styles.surveyHeader}>
 <h3>Help Us Improve EasyFlow</h3>
 <p>Your feedback helps us build better automation tools</p>
 <button 
 className={styles.closeButton}
 onClick={handleClose}
 aria-label="Close survey"
 >
 ×
 </button>
 </div>

 <div className={styles.progressBar}>
 <div 
 className={styles.progress}
 style={{ width: `${(currentStep / 4) * 100}%` }}
 />
 </div>

 <div className={styles.surveyContent}>
 {/* Step 1: Pain Points Rating */}
 {currentStep === 1 && (
 <div className={styles.step}>
 <h4>Rate Your Current Challenges</h4>
 <p>How much do these issues affect your daily work?</p>
 
 <div className={styles.ratingsGrid}>
 {Object.entries(painPointDefinitions).map(([key, def]) =>
 renderRatingScale('painPoints', key, def.title, def.description)
 )}
 </div>
 </div>
 )}

 {/* Step 2: Feature Priorities */}
 {currentStep === 2 && (
 <div className={styles.step}>
 <h4>Prioritize New Features</h4>
 <p>Which features would be most valuable to you?</p>
 
 <div className={styles.ratingsGrid}>
 {Object.entries(featureDefinitions).map(([key, def]) =>
 renderRatingScale('featurePriorities', key, def.title, def.description)
 )}
 </div>
 </div>
 )}

 {/* Step 3: Qualitative Feedback */}
 {currentStep === 3 && (
 <div className={styles.step}>
 <h4>Tell Us More</h4>
 <p>Help us understand your specific needs</p>
 
 <div className={styles.textInputs}>
 <div className={styles.inputGroup}>
 <label htmlFor="biggest_challenge">
 What's your biggest automation challenge?
 </label>
 <textarea
 id="biggest_challenge"
 value={responses.qualitativeFeedback.biggest_challenge}
 onChange={(e) => updateTextResponse('qualitativeFeedback', 'biggest_challenge', e.target.value)}
 placeholder="Describe the main obstacle preventing you from automating more processes..."
 rows="3"
 />
 </div>

 <div className={styles.inputGroup}>
 <label htmlFor="ideal_solution">
 Describe your ideal automation solution
 </label>
 <textarea
 id="ideal_solution"
 value={responses.qualitativeFeedback.ideal_solution}
 onChange={(e) => updateTextResponse('qualitativeFeedback', 'ideal_solution', e.target.value)}
 placeholder="If you could wave a magic wand, what would the perfect tool do for you?"
 rows="3"
 />
 </div>

 <div className={styles.inputGroup}>
 <label htmlFor="current_tools">
 What tools do you currently use?
 </label>
 <input
 type="text"
 id="current_tools"
 value={responses.qualitativeFeedback.current_tools}
 onChange={(e) => updateTextResponse('qualitativeFeedback', 'current_tools', e.target.value)}
 placeholder="Zapier, Make, custom scripts, etc."
 />
 </div>
 </div>
 </div>
 )}

 {/* Step 4: Demographics & Metadata */}
 {currentStep === 4 && (
 <div className={styles.step}>
 <h4>About You (Optional)</h4>
 <p>This helps us tailor our solutions</p>
 
 <div className={styles.metadataInputs}>
 <div className={styles.inputRow}>
 <div className={styles.inputGroup}>
 <label htmlFor="user_role">Your Role</label>
 <select
 id="user_role"
 value={responses.metadata.user_role}
 onChange={(e) => updateTextResponse('metadata', 'user_role', e.target.value)}
 >
 <option value="">Select role...</option>
 <option value="business_owner">Business Owner</option>
 <option value="developer">Developer</option>
 <option value="operations">Operations/IT</option>
 <option value="consultant">Consultant</option>
 <option value="other">Other</option>
 </select>
 </div>

 <div className={styles.inputGroup}>
 <label htmlFor="company_size">Company Size</label>
 <select
 id="company_size"
 value={responses.metadata.company_size}
 onChange={(e) => updateTextResponse('metadata', 'company_size', e.target.value)}
 >
 <option value="">Select size...</option>
 <option value="1-10">1-10 employees</option>
 <option value="11-50">11-50 employees</option>
 <option value="51-200">51-200 employees</option>
 <option value="200+">200+ employees</option>
 </select>
 </div>
 </div>

 <div className={styles.inputGroup}>
 <label htmlFor="additional_comments">
 Anything else you'd like to share?
 </label>
 <textarea
 id="additional_comments"
 value={responses.qualitativeFeedback.additional_comments}
 onChange={(e) => updateTextResponse('qualitativeFeedback', 'additional_comments', e.target.value)}
 placeholder="Feature requests, bugs, compliments, complaints - we want to hear it all!"
 rows="3"
 />
 </div>
 </div>
 </div>
 )}

 {/* Submit Status Display */}
 {submitStatus && (
 <div className={`${styles.submitStatus} ${styles[submitStatus]}`}>
 {submitStatus === 'success' && (
 <>
 <span className={styles.statusIcon}>✅</span>
 Thank you! Your feedback has been submitted.
 </>
 )}
 {submitStatus === 'offline' && (
 <>
 <span className={styles.statusIcon}>💾</span>
 Feedback saved locally. We'll sync it when you're back online.
 </>
 )}
 </div>
 )}
 </div>

 <div className={styles.surveyFooter}>
 <div className={styles.stepIndicator}>
 Step {currentStep} of 4
 </div>
 
 <div className={styles.navigationButtons}>
 {currentStep > 1 && (
 <button 
 className={styles.prevButton}
 onClick={prevStep}
 disabled={isSubmitting}
 >
 Previous
 </button>
 )}
 
 <button 
 className={styles.nextButton}
 onClick={nextStep}
 disabled={isSubmitting}
 >
 {isSubmitting ? (
 <>
 <span className={styles.spinner}></span>
 Submitting...
 </>
 ) : currentStep === 4 ? (
 'Submit Feedback'
 ) : (
 'Next'
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
});

SurveyComponent.propTypes = {
 triggerType: PropTypes.oneOf(['modal', 'auto', 'button']),
 onComplete: PropTypes.func,
 onClose: PropTypes.func,
 className: PropTypes.string,
 preSelectedCategory: PropTypes.string
};

export default SurveyComponent;