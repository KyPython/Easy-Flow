import React from 'react';
import styles from './StatusBadge.module.css';
import { formatTaskStatus } from '../../utils/formatters';
import PropTypes from 'prop-types';

const StatusBadge = ({ status }) => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return styles.success;
      case 'failed':
        return styles.error;
      case 'running':
      case 'in_progress':
        return styles.warning;
      case 'queued':
      case 'pending':
        return styles.neutral;
      default:
        return styles.neutral;
    }
  };

  return (
    <span className={`${styles.badge} ${getStatusClass(status)}`}>
      {formatTaskStatus(status)}
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

StatusBadge.defaultProps = {};

export default StatusBadge;