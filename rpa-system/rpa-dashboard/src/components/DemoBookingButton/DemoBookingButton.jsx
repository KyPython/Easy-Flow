import React, { useState } from 'react';
import { createLogger } from '../../utils/logger';
const logger = createLogger('DemoBookingButtonUDemoBookingButton');
import { FiCalendar, FiExternalLink } from 'react-icons/fi';
import { usePlan } from '../../hooks/usePlan';
import conversionTracker from '../../utils/conversionTracking';
import PropTypes from 'prop-types';
import styles from './DemoBookingButton.module.css';

/**
 * DemoBookingButton - CTA button for booking product demos
 * Integrates with Calendly or opens custom booking modal
 */
const DemoBookingButton = ({
 buttonText = "📅 Book Free Demo",
 subtext = "15-min setup call",
 source = "unknown",
 variant = "secondary",
 size = "medium",
 showSubtext = true,
 calendlyUrl = null, // If provided, opens Calendly popup
 onDemoRequested = null, // Custom handler instead of Calendly
 className = ""
}) => {
 const { planData } = usePlan();
 const [isLoading, setIsLoading] = useState(false);

 const handleDemoClick = async () => {
 // Track demo request
 conversionTracker.trackDemoRequested(source, planData?.plan?.name || 'hobbyist');
 
 setIsLoading(true);
 
 try {
 if (calendlyUrl) {
 // Option A: Calendly integration
 if (window.Calendly) {
 window.Calendly.initPopupWidget({
 url: calendlyUrl
 });
 } else {
 // Fallback: Open in new tab if Calendly widget not loaded
 window.open(calendlyUrl, '_blank', 'noopener,noreferrer');
 }
 } else if (onDemoRequested) {
 // Option B: Custom handler (opens modal, etc.)
 onDemoRequested();
 } else {
 // Option C: Default redirect to a booking page
 window.open('https://calendly.com/your-link/15min', '_blank', 'noopener,noreferrer');
 }
 } catch (error) {
 logger.error('Failed to open demo booking:', error);
 // Fallback: Try direct link
 window.open('https://calendly.com/your-link/15min', '_blank', 'noopener,noreferrer');
 } finally {
 setTimeout(() => setIsLoading(false), 1000); // Reset loading state
 }
 };

 const buttonClasses = [
 styles.demoButton,
 styles[variant],
 styles[size],
 className
 ].filter(Boolean).join(' ');

 return (
 <div className={styles.container}>
 <button
 onClick={handleDemoClick}
 disabled={isLoading}
 className={buttonClasses}
 type="button"
 >
 <span className={styles.buttonContent}>
 {isLoading ? (
 <span className={styles.loadingSpinner} />
 ) : (
 <FiCalendar className={styles.icon} />
 )}
 <span className={styles.text}>{buttonText}</span>
 {variant === 'link' && <FiExternalLink className={styles.externalIcon} />}
 </span>
 </button>
 
 {showSubtext && subtext && (
 <div className={styles.subtext}>{subtext}</div>
 )}
 </div>
 );
};

DemoBookingButton.propTypes = {
 buttonText: PropTypes.string,
 subtext: PropTypes.string,
 source: PropTypes.string.isRequired,
 variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'link']),
 size: PropTypes.oneOf(['small', 'medium', 'large']),
 showSubtext: PropTypes.bool,
 calendlyUrl: PropTypes.string,
 onDemoRequested: PropTypes.func,
 className: PropTypes.string
};

export default DemoBookingButton;