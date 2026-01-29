import React, { useState } from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('DemoBookingModal');
import { FiX, FiCalendar, FiUser, FiMail, FiBuilding, FiClock, FiMessageSquare } from 'react-icons/fi';
import { usePlan } from '../../hooks/usePlan';
import conversionTracker from '../../utils/conversionTracking';
import PropTypes from 'prop-types';
import styles from './DemoBookingModal.module.css';

/**
 * DemoBookingModal - Custom modal for collecting demo request information
 * Alternative to Calendly integration
 */
const DemoBookingModal = ({ 
 isOpen,
 onClose,
 source = "unknown"
}) => {
 const { planData } = usePlan();
 const [formData, setFormData] = useState({
 name: '',
 email: '',
 company: '',
 message: '',
 preferredTime: 'morning'
 });
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [showSuccess, setShowSuccess] = useState(false);
 const [errors, setErrors] = useState({});

 const timeOptions = [
 { value: 'morning', label: 'Morning (9 AM - 12 PM)' },
 { value: 'afternoon', label: 'Afternoon (12 PM - 5 PM)' },
 { value: 'evening', label: 'Evening (5 PM - 8 PM)' }
 ];

 const handleInputChange = (field, value) => {
 setFormData(prev => ({ ...prev, [field]: value }));
 // Clear error when user starts typing
 if (errors[field]) {
 setErrors(prev => ({ ...prev, [field]: '' }));
 }
 };

 const validateForm = () => {
 const newErrors = {};

 if (!formData.name.trim()) {
 newErrors.name = 'Name is required';
 }

 if (!formData.email.trim()) {
 newErrors.email = 'Email is required';
 } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
 newErrors.email = 'Please enter a valid email address';
 }

 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 
 if (!validateForm()) {
 return;
 }

 setIsSubmitting(true);

 try {
 // Track form submission
 conversionTracker.trackEvent('demo_form_submitted', {
 source,
 user_plan: planData?.plan?.name || 'hobbyist',
 has_company: Boolean(formData.company.trim())
 });

 // Submit to backend via centralized api client
 const { api } = require('../../utils/api');
 await api.post('/api/book-demo', {
 ...formData,
 source,
 userPlan: planData?.plan?.name || 'hobbyist',
 timestamp: new Date().toISOString()
 });

 // Show success message
 setShowSuccess(true);
 
 // Close modal after 2 seconds
 setTimeout(() => {
 setShowSuccess(false);
 onClose();
 // Reset form
 setFormData({
 name: '',
 email: '',
 company: '',
 message: '',
 preferredTime: 'morning'
 });
 }, 2000);

 } catch (error) {
 logger.error('Demo booking submission failed:', error);
 setErrors({ submit: 'Failed to submit request. Please try again.' });
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleClose = () => {
 // Track modal close
 conversionTracker.trackEvent('demo_modal_closed', {
 completed: showSuccess,
 source
 });
 onClose();
 };

 if (!isOpen) return null;

 return (
 <div className={styles.overlay} onClick={handleClose}>
 <div className={styles.modal} onClick={e => e.stopPropagation()}>
 <div className={styles.header}>
 <div className={styles.headerContent}>
 <FiCalendar className={styles.headerIcon} />
 <div>
 <h2 className={styles.title}>Book Your Free Demo</h2>
 <p className={styles.subtitle}>
 15-minute call to see EasyFlow in action
 </p>
 </div>
 </div>
 <button
 onClick={handleClose}
 className={styles.closeButton}
 aria-label="Close modal"
 >
 <FiX />
 </button>
 </div>

 {showSuccess ? (
 <div className={styles.successContent}>
 <div className={styles.successIcon}>✅</div>
 <h3 className={styles.successTitle}>Demo Request Received!</h3>
 <p className={styles.successMessage}>
 We'll email you within 24 hours to schedule your personalized demo.
 </p>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className={styles.form}>
 <div className={styles.formGrid}>
 {/* Name Field */}
 <div className={styles.formGroup}>
 <label className={styles.label} htmlFor="demo-name">
 <FiUser className={styles.fieldIcon} />
 Name *
 </label>
 <input
 id="demo-name"
 type="text"
 value={formData.name}
 onChange={(e) => handleInputChange('name', e.target.value)}
 className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
 placeholder="Your full name"
 required
 />
 {errors.name && <div className={styles.errorText}>{errors.name}</div>}
 </div>

 {/* Email Field */}
 <div className={styles.formGroup}>
 <label className={styles.label} htmlFor="demo-email">
 <FiMail className={styles.fieldIcon} />
 Email *
 </label>
 <input
 id="demo-email"
 type="email"
 value={formData.email}
 onChange={(e) => handleInputChange('email', e.target.value)}
 className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
 placeholder="your@email.com"
 required
 />
 {errors.email && <div className={styles.errorText}>{errors.email}</div>}
 </div>

 {/* Company Field */}
 <div className={styles.formGroup}>
 <label className={styles.label} htmlFor="demo-company">
 <FiBuilding className={styles.fieldIcon} />
 Company (optional)
 </label>
 <input
 id="demo-company"
 type="text"
 value={formData.company}
 onChange={(e) => handleInputChange('company', e.target.value)}
 className={styles.input}
 placeholder="Your company name"
 />
 </div>

 {/* Preferred Time */}
 <div className={styles.formGroup}>
 <label className={styles.label} htmlFor="demo-time">
 <FiClock className={styles.fieldIcon} />
 Preferred Time
 </label>
 <select
 id="demo-time"
 value={formData.preferredTime}
 onChange={(e) => handleInputChange('preferredTime', e.target.value)}
 className={styles.select}
 >
 {timeOptions.map(option => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </div>

 {/* Message Field */}
 <div className={`${styles.formGroup} ${styles.fullWidth}`}>
 <label className={styles.label} htmlFor="demo-message">
 <FiMessageSquare className={styles.fieldIcon} />
 What would you like to automate? (optional)
 </label>
 <textarea
 id="demo-message"
 value={formData.message}
 onChange={(e) => handleInputChange('message', e.target.value)}
 className={styles.textarea}
 placeholder="Tell us about your automation needs..."
 rows="3"
 />
 </div>
 </div>

 {errors.submit && (
 <div className={styles.submitError}>{errors.submit}</div>
 )}

 <div className={styles.actions}>
 <button
 type="button"
 onClick={handleClose}
 className={styles.cancelButton}
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isSubmitting}
 className={styles.submitButton}
 >
 {isSubmitting ? (
 <>
 <span className={styles.spinner} />
 Submitting...
 </>
 ) : (
 <>
 <FiCalendar />
 Book Demo
 </>
 )}
 </button>
 </div>
 </form>
 )}
 </div>
 </div>
 );
};

DemoBookingModal.propTypes = {
 isOpen: PropTypes.bool.isRequired,
 onClose: PropTypes.func.isRequired,
 source: PropTypes.string
};

export default DemoBookingModal;