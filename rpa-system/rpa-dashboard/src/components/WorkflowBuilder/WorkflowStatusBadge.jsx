import React from 'react';
import PropTypes from 'prop-types';
import styles from './WorkflowStatusBadge.module.css';
import { 
  FaPlay, 
  FaPause, 
  FaStop, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaClock,
  FaEdit
} from 'react-icons/fa';

const WorkflowStatusBadge = ({ 
  status, 
  size = 'medium',
  showIcon = true,
  className = ''
}) => {
  const getStatusConfig = (status) => {
    const configs = {
      draft: {
        label: 'Draft',
        icon: <FaEdit />,
        color: 'gray'
      },
      active: {
        label: 'Active',
        icon: <FaPlay />,
        color: 'success'
      },
      paused: {
        label: 'Paused',
        icon: <FaPause />,
        color: 'warning'
      },
      stopped: {
        label: 'Stopped',
        icon: <FaStop />,
        color: 'error'
      },
      running: {
        label: 'Running',
        icon: <FaClock />,
        color: 'primary'
      },
      completed: {
        label: 'Completed',
        icon: <FaCheckCircle />,
        color: 'success'
      },
      failed: {
        label: 'Failed',
        icon: <FaExclamationTriangle />,
        color: 'error'
      },
      cancelled: {
        label: 'Cancelled',
        icon: <FaStop />,
        color: 'gray'
      }
    };

    return configs[status] || {
      label: status || 'Unknown',
      icon: <FaExclamationTriangle />,
      color: 'gray'
    };
  };

  const config = getStatusConfig(status);
  
  const badgeClasses = [
    styles.statusBadge,
    styles[config.color],
    styles[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={badgeClasses}>
      {showIcon && (
        <span className={styles.badgeIcon}>
          {config.icon}
        </span>
      )}
      <span className={styles.badgeLabel}>
        {config.label}
      </span>
    </span>
  );
};

WorkflowStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  showIcon: PropTypes.bool,
  className: PropTypes.string
};

export default WorkflowStatusBadge;