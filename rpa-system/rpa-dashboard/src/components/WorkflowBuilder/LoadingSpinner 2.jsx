import React from 'react';
import PropTypes from 'prop-types';
import styles from './LoadingSpinner.module.css';

const LoadingSpinner = ({ 
  size = 'medium', 
  message = '', 
  centered = false,
  overlay = false,
  color = 'primary'
}) => {
  const spinnerClasses = [
    styles.spinner,
    styles[size],
    styles[color],
    centered && styles.centered,
    overlay && styles.overlay
  ].filter(Boolean).join(' ');

  const content = (
    <div className={spinnerClasses}>
      <div className={styles.spinnerCircle}>
        <div className={styles.spinnerInner} />
      </div>
      {message && (
        <div className={styles.spinnerMessage}>
          {message}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className={styles.overlayContainer}>
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;

LoadingSpinner.propTypes = {
  size: PropTypes.string,
  message: PropTypes.string,
  centered: PropTypes.bool,
  overlay: PropTypes.bool,
  color: PropTypes.string
};