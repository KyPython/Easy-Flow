import React from 'react';
import styles from './ErrorMessage.module.css';

const ErrorMessage = ({ message }) => {
  if (!message) {
    return null;
  }

  return (
    <div className={styles.errorContainer}>
      <span className={styles.errorIcon}>📡</span>
      <span className={styles.errorMessage}>{message}</span>
    </div>
  );
};

export default ErrorMessage;

