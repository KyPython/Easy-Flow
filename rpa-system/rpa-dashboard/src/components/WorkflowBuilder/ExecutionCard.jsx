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

  // Helper to detect false "completed" status (0 steps executed = actually failed)
  const getActualStatus = (execution) => {
    // ✅ DYNAMIC: Calculate steps_total from multiple sources with fallbacks
    const stepsTotal = execution.steps_total || 
                     (execution.step_executions?.length) ||
                     0;
    const stepsExecuted = execution.steps_executed || 
                        (execution.step_executions?.filter(s => s.status === 'completed').length) ||
                        0;
    // If marked completed but no steps executed, treat as failed
    if (execution.status === 'completed' && 
        stepsTotal > 0 && 
        (stepsExecuted === 0 || !stepsExecuted)) {
      return 'failed';
    }
    return execution.status;
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
    // ✅ DYNAMIC: Calculate steps_total from multiple sources with fallbacks
    const stepsTotal = execution.steps_total || 
                     (execution.step_executions?.length) ||
                     0;
    const stepsExecuted = execution.steps_executed || 
                        (execution.step_executions?.filter(s => s.status === 'completed').length) ||
                        0;
    if (!stepsTotal) return 0;
    return Math.round((stepsExecuted / stepsTotal) * 100);
  };

  // Get actual status (detect false "completed")
  const actualStatus = getActualStatus(execution);
  const statusColor = getStatusColor(actualStatus);
  
  // Generate user-friendly error message
  const getFailureMessage = () => {
    if (actualStatus === 'failed' && execution.status === 'completed') {
      return 'Your workflow completed but no steps were executed. Please try running the workflow again, or contact support if the problem persists.';
    }
    return execution.error_message;
  };

  return (
    <div className={`${styles.executionCard} ${styles[statusColor]}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <span className={styles.statusIcon}>
            {getStatusIcon(actualStatus)}
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
            {/* Only show Cancel for cancellable statuses */}
            {['running', 'pending', 'scheduled'].includes(actualStatus) && onCancel && (
              <ActionButton
                variant="ghost"
                size="small"
                icon={<FaStop />}
                onClick={() => onCancel(execution.id)}
                title="Cancel execution"
              />
            )}
            {(actualStatus === 'failed' || (execution.status === 'completed' && actualStatus === 'failed')) && onRetry && (
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
            {actualStatus}
          </span>
          {actualStatus === 'failed' && execution.status === 'completed' && (
            <span className={styles.warningBadge} title="Marked as completed but actually failed">
              ⚠️
            </span>
          )}
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
                {(() => {
                  // ✅ DYNAMIC: Calculate steps_total from multiple sources with fallbacks
                  // 1. Use execution.steps_total (set at execution creation time)
                  // 2. Fallback to step_executions.length (actual steps that were created)
                  // 3. Fallback to 0 if neither available
                  const stepsTotal = execution.steps_total || 
                                   (execution.step_executions?.length) ||
                                   0;
                  const stepsExecuted = execution.steps_executed || 
                                      (execution.step_executions?.filter(s => s.status === 'completed').length) ||
                                      0;
                  return `${stepsExecuted}/${stepsTotal} steps`;
                })()}
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
          {(getFailureMessage() || execution.error_message) && (
            <div className={styles.errorMessage}>
              <strong>Error:</strong> {getFailureMessage() || execution.error_message}
              {actualStatus === 'failed' && (
                <div className={styles.userHelpTips}>
                  <strong>What you can do:</strong>
                  <ul>
                    <li>Try running the workflow again - this may be a temporary issue</li>
                    <li>Check if your workflow steps are properly configured</li>
                    <li>If the problem continues, please contact support for assistance</li>
                  </ul>
                </div>
              )}
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