import React from 'react';
import PropTypes from 'prop-types';
import styles from './ExecutionCard.module.css';
import { 
  FaPlay, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClock, 
  FaStop,
  FaEye,
  FaRedo
} from 'react-icons/fa';
import ActionButton from './ActionButton';
import ProgressBar from './ProgressBar';

const ExecutionCard = ({ 
  execution, 
  onView, 
  onCancel, 
  onRetry,
  showActions = true 
}) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <FaClock className={styles.spinning} />;
      case 'completed': return <FaCheckCircle />;
      case 'failed': return <FaTimesCircle />;
      case 'cancelled': return <FaStop />;
      default: return <FaClock />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      case 'cancelled': return 'gray';
      default: return 'gray';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getProgress = () => {
    if (!execution.steps_total) return 0;
    return Math.round((execution.steps_executed / execution.steps_total) * 100);
  };

  const statusColor = getStatusColor(execution.status);

  return (
    <div className={`${styles.executionCard} ${styles[statusColor]}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <span className={styles.statusIcon}>
            {getStatusIcon(execution.status)}
          </span>
          <div className={styles.executionInfo}>
            <h4 className={styles.executionId}>
              Execution #{execution.execution_number || execution.id}
            </h4>
            <p className={styles.triggeredBy}>
              Triggered by: {execution.triggered_by || 'Unknown'}
            </p>
          </div>
        </div>
        
        {showActions && (
          <div className={styles.cardActions}>
            <ActionButton
              variant="ghost"
              size="small"
              icon={<FaEye />}
              onClick={() => onView?.(execution.id)}
              title="View details"
            />
            {execution.status === 'running' && onCancel && (
              <ActionButton
                variant="ghost"
                size="small"
                icon={<FaStop />}
                onClick={() => onCancel(execution.id)}
                title="Cancel execution"
              />
            )}
            {execution.status === 'failed' && onRetry && (
              <ActionButton
                variant="ghost"
                size="small"
                icon={<FaRedo />}
                onClick={() => onRetry(execution.id)}
                title="Retry execution"
              />
            )}
          </div>
        )}
      </div>

      <div className={styles.cardContent}>
        <div className={styles.statusBadge}>
          <span className={`${styles.badge} ${styles[statusColor]}`}>
            {execution.status}
          </span>
        </div>

        <div className={styles.executionDetails}>
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Started:</span>
              <span className={styles.detailValue}>
                {formatDateTime(execution.started_at)}
              </span>
            </div>
            
            {execution.completed_at && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Completed:</span>
                <span className={styles.detailValue}>
                  {formatDateTime(execution.completed_at)}
                </span>
              </div>
            )}
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Duration:</span>
              <span className={styles.detailValue}>
                {formatDuration(execution.duration_seconds)}
              </span>
            </div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Progress:</span>
              <span className={styles.detailValue}>
                {execution.steps_executed || 0}/{execution.steps_total || 0} steps
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {execution.steps_total > 0 && (
            <div className={styles.progressSection}>
              <ProgressBar 
                value={getProgress()} 
                variant={statusColor}
                showLabel={true}
              />
            </div>
          )}

          {/* Error Message */}
          {execution.error_message && (
            <div className={styles.errorMessage}>
              <strong>Error:</strong> {execution.error_message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ExecutionCard.propTypes = {
  execution: PropTypes.shape({
    id: PropTypes.string.isRequired,
    execution_number: PropTypes.number,
    status: PropTypes.string.isRequired,
    started_at: PropTypes.string,
    completed_at: PropTypes.string,
    duration_seconds: PropTypes.number,
    steps_executed: PropTypes.number,
    steps_total: PropTypes.number,
    triggered_by: PropTypes.string,
    error_message: PropTypes.string
  }).isRequired,
  onView: PropTypes.func,
  onCancel: PropTypes.func,
  onRetry: PropTypes.func,
  showActions: PropTypes.bool
};

export default ExecutionCard;