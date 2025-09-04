import React from 'react';
import styles from './ErrorMessage.module.css';
import PropTypes from 'prop-types';

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

ErrorMessage.propTypes = {
  message: PropTypes.string,
};

ErrorMessage.defaultProps = {
  message: '',
};

export default ErrorMessage;
