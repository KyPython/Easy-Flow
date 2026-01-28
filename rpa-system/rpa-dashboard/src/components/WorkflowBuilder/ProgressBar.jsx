import React from 'react';
import PropTypes from 'prop-types';
import styles from './ProgressBar.module.css';

const ProgressBar = ({ 
 value = 0, 
 max = 100, 
 variant = 'primary',
 size = 'medium',
 showLabel = false,
 label = '',
 animated = false,
 striped = false,
 className = ''
}) => {
 const percentage = Math.min(100, Math.max(0, (value / max) * 100));
 
 const progressClasses = [
 styles.progressBar,
 styles[variant],
 styles[size],
 animated && styles.animated,
 striped && styles.striped,
 className
 ].filter(Boolean).join(' ');

 return (
 <div className={progressClasses}>
 <div className={styles.progressTrack}>
 <div 
 className={styles.progressFill}
 style={{ width: `${percentage}%` }}
 role="progressbar"
 aria-valuenow={value}
 aria-valuemin={0}
 aria-valuemax={max}
 />
 </div>
 
 {(showLabel || label) && (
 <div className={styles.progressLabel}>
 {label || `${Math.round(percentage)}%`}
 </div>
 )}
 </div>
 );
};

ProgressBar.propTypes = {
 value: PropTypes.number,
 max: PropTypes.number,
 variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'warning', 'error']),
 size: PropTypes.oneOf(['small', 'medium', 'large']),
 showLabel: PropTypes.bool,
 label: PropTypes.string,
 animated: PropTypes.bool,
 striped: PropTypes.bool,
 className: PropTypes.string
};

export default ProgressBar;