import React from 'react';
import PropTypes from 'prop-types';
import { FaExclamationTriangle } from 'react-icons/fa';
import styles from './ErrorMessage.module.css';

const ErrorMessage = ({ 
  message, 
  title = 'Error', 
  type = 'error', 
  onRetry = null,
  className = '' 
}) => {
  return (
    <div className={`${styles.errorMessage} ${styles[type]} ${className}`}>
      <div className={styles.iconContainer}>
        <FaExclamationTriangle className={styles.icon} />
      </div>
      <div className={styles.content}>
        <h4 className={styles.title}>{title}</h4>
        <p className={styles.message}>
          {typeof message === 'string' ? message : message?.message || 'An error occurred'}
        </p>
        {onRetry && (
          <button className={styles.retryButton} onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

ErrorMessage.propTypes = {
  message: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      message: PropTypes.string
    })
  ]).isRequired,
  title: PropTypes.string,
  type: PropTypes.oneOf(['error', 'warning', 'info']),
  onRetry: PropTypes.func,
  className: PropTypes.string
};

export default ErrorMessage;