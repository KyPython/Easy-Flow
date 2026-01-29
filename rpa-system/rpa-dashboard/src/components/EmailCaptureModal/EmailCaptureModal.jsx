import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';
const logger = createLogger('EmailCaptureModal');
import { FiX, FiMail, FiArrowRight } from 'react-icons/fi';
import { usePlan } from '../../hooks/usePlan';
import conversionTracker from '../../utils/conversionTracking';
import PropTypes from 'prop-types';
import styles from './EmailCaptureModal.module.css';

/**
 * EmailCaptureModal - Lightweight email capture for lead nurturing
 * Appears after multiple sessions without conversion
 */
const EmailCaptureModal = ({ 
 isOpen,
 onClose,
 sessionCount = 0
}) => {
 const { planData } = usePlan();
 const [email, setEmail] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [showSuccess, setShowSuccess] = useState(false);
 const [error, setError] = useState('');

 // Track modal shown
 useEffect(() => {
 if (isOpen) {
 conversionTracker.trackEvent('email_capture_shown', {
 session_count: sessionCount,
 user_plan: planData?.plan?.name || 'hobbyist'
 });
 }
 }, [isOpen, sessionCount, planData?.plan?.name]);

 const validateEmail = (email) => {
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 
 if (!validateEmail(email)) {
 setError('Please enter a valid email address');
 return;
 }

 setIsSubmitting(true);
 setError('');

 try {
 // Track email capture
 conversionTracker.trackEvent('email_captured', {
 source: 'session_modal',
 user_plan: planData?.plan?.name || 'hobbyist'
 });

 // Submit to backend via centralized api client
 const { api } = require('../../utils/api');
 await api.post('/api/capture-email', {
 email,
 source: 'session_modal',
 sessionCount,
 userPlan: planData?.plan?.name || 'hobbyist',
 timestamp: new Date().toISOString()
 });

 // Show success
 setShowSuccess(true);
 
 // Mark as captured in localStorage
 localStorage.setItem('email_captured', 'true');
 localStorage.setItem('email_captured_date', Date.now().toString());
 
 // Close modal after 2 seconds
 setTimeout(() => {
 handleClose();
 }, 2000);

 } catch (error) {
 logger.error('[EmailCaptureModal] Submission failed:', error);

 // Provide user-friendly error messages based on error type
 let userMessage = 'Failed to save email. Please try again.';

 // Check for network/connection errors
 if (error.code === 'ECONNABORTED' ||
 error.message?.includes('timeout') ||
 error.message?.includes('Network Error') ||
 error.message?.includes('network') ||
 !navigator.onLine) {
 userMessage = 'Unable to connect. Please check your internet connection and try again.';
 } else if (error.response?.status >= 500) {
 userMessage = 'Our servers are temporarily unavailable. Please try again in a moment.';
 } else if (error.response?.status === 400) {
 userMessage = error.response?.data?.message || 'Invalid email format. Please check and try again.';
 } else if (error.response?.status === 429) {
 userMessage = 'Too many requests. Please wait a moment and try again.';
 }

 setError(userMessage);
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleDismiss = () => {
 // Track dismissal
 conversionTracker.trackEvent('email_capture_dismissed', {
 session_count: sessionCount
 });
 
 // Set dismissal flag for 7 days
 const sevenDaysFromNow = Date.now() + (7 * 24 * 60 * 60 * 1000);
 localStorage.setItem('email_capture_dismissed_until', sevenDaysFromNow.toString());
 
 handleClose();
 };

 const handleClose = () => {
 setShowSuccess(false);
 setEmail('');
 setError('');
 onClose();
 };

 if (!isOpen) return null;

 return (
 <div className={styles.overlay} onClick={handleDismiss}>
 <div className={styles.modal} onClick={e => e.stopPropagation()}>
 <button
 onClick={handleDismiss}
 className={styles.closeButton}
 aria-label="Close modal"
 >
 <FiX />
 </button>

 {showSuccess ? (
 <div className={styles.successContent}>
 <div className={styles.successIcon}>✅</div>
 <h3 className={styles.successTitle}>You&apos;re all set!</h3>
 <p className={styles.successMessage}>
 Check your inbox for automation tips and updates.
 </p>
 </div>
 ) : (
 <div className={styles.content}>
 <div className={styles.header}>
 <div className={styles.icon}>
 <FiMail />
 </div>
 <h2 className={styles.title}>Get Free Automation Tips</h2>
 <p className={styles.subtitle}>
 Join 100+ users automating their workflows
 </p>
 </div>

 <form onSubmit={handleSubmit} className={styles.form}>
 <div className={styles.inputGroup}>
 <input
 type="email"
 value={email}
 onChange={(e) => {
 setEmail(e.target.value);
 if (error) setError('');
 }}
 placeholder="your@email.com"
 className={`${styles.emailInput} ${error ? styles.inputError : ''}`}
 disabled={isSubmitting}
 required
 />
 <button
 type="submit"
 disabled={isSubmitting || !email.trim()}
 className={styles.submitButton}
 >
 {isSubmitting ? (
 <span className={styles.spinner} />
 ) : (
 <>
 Send Me Tips
 <FiArrowRight className={styles.arrowIcon} />
 </>
 )}
 </button>
 </div>
 
 {error && (
 <div className={styles.errorText}>{error}</div>
 )}
 </form>

 <div className={styles.footer}>
 <button
 onClick={handleDismiss}
 className={styles.dismissLink}
 >
 No thanks
 </button>
 <div className={styles.privacy}>
 We respect your privacy. Unsubscribe anytime.
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

EmailCaptureModal.propTypes = {
 isOpen: PropTypes.bool.isRequired,
 onClose: PropTypes.func.isRequired,
 sessionCount: PropTypes.number
};

export default EmailCaptureModal;