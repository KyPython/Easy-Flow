import React from 'react';
import styles from './StatusBadge.module.css';
import { formatTaskStatus } from '../../utils/formatters';
import PropTypes from 'prop-types';

/**
 * StatusBadge - Semiotic status indicator
 * Following Visual Design Principles Section 2:
 * - Icons: Universal symbols (checkmark for completion)
 * - Indexes: Evidence of state (spinner for active, timestamp context)
 * - Symbols: Abstract meaning (colors)
 */
const StatusBadge = ({ status, timestamp, showTimestamp = false }) => {
  const getStatusConfig = (status) => {
    const configs = {
      completed: {
        className: styles.success,
        icon: '✓', // Icon: resembles completion
        label: formatTaskStatus(status)
      },
      failed: {
        className: styles.error,
        icon: '✕', // Icon: universal failure symbol
        label: formatTaskStatus(status)
      },
      running: {
        className: styles.running,
        icon: '⟳', // Index: evidence of active process
        label: formatTaskStatus(status),
        animate: true
      },
      in_progress: {
        className: styles.running,
        icon: '⟳', // Index: evidence of active process
        label: formatTaskStatus(status),
        animate: true
      },
      queued: {
        className: styles.neutral,
        icon: '○', // Symbol: waiting state
        label: formatTaskStatus(status)
      },
      pending: {
        className: styles.neutral,
        icon: '○', // Symbol: waiting state
        label: formatTaskStatus(status)
      }
    };

    return configs[status] || {
      className: styles.neutral,
      icon: '○',
      label: formatTaskStatus(status)
    };
  };

  const config = getStatusConfig(status);
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString() : null;

  return (
    <span className={`${styles.badge} ${config.className}`}>
      <span className={`${styles.icon} ${config.animate ? styles.spinner : ''}`}>
        {config.icon}
      </span>
      {config.label}
      {showTimestamp && formattedTime && (
        <span className={styles.timestamp}>· {formattedTime}</span>
      )}
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  showTimestamp: PropTypes.bool,
};

StatusBadge.defaultProps = {
  showTimestamp: false,
};

export default StatusBadge;