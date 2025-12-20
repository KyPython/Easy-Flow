import React from 'react';
import styles from './ErrorMessage.module.css';
import PropTypes from 'prop-types';
import { sanitizeErrorMessage } from '../utils/errorMessages';

const ErrorMessage = ({ message }) => {
  if (!message) {
    return null;
  }

  // Sanitize error message based on environment
  const sanitizedMessage = sanitizeErrorMessage(message);

  return (
    <div className={styles.errorContainer}>
      <span className={styles.errorIcon}>📡</span>
      <span className={styles.errorMessage}>{sanitizedMessage}</span>
    </div>
  );
};

ErrorMessage.propTypes = {
  message: PropTypes.string,
};

ErrorMessage.defaultProps = {
  message: '',
};

export default ErrorMessage;
