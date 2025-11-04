import React from 'react';
import styles from './WorkflowSummary.module.css';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import { 
  FaPlay, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClock,
  FaCalendarAlt,
  FaUser,
  FaTags
} from 'react-icons/fa';

const WorkflowSummary = ({ 
  workflow, 
  showStats = true,
  showMetadata = true,
  className = ''
}) => {
  if (!workflow) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getSuccessRate = () => {
    const total = workflow.total_executions || 0;
    const successful = workflow.successful_executions || 0;
    if (total === 0) return 0;
    return Math.round((successful / total) * 100);
  };

  const summaryClasses = [
    styles.workflowSummary,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={summaryClasses}>
      {/* Header */}
      <div className={styles.summaryHeader}>
        <div className={styles.workflowInfo}>
          <h2 className={styles.workflowName}>{workflow.name}</h2>
          {workflow.description && (
            <p className={styles.workflowDescription}>{workflow.description}</p>
          )}
        </div>
        
        <div className={styles.workflowStatus}>
          <WorkflowStatusBadge status={workflow.status} />
        </div>
      </div>

      {/* Stats Grid */}
      {showStats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <FaPlay />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>
                {workflow.total_executions || 0}
              </div>
              <div className={styles.statLabel}>Total Runs</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <FaCheckCircle />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>
                {workflow.successful_executions || 0}
              </div>
              <div className={styles.statLabel}>Successful</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <FaTimesCircle />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>
                {workflow.failed_executions || 0}
              </div>
              <div className={styles.statLabel}>Failed</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <FaClock />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>
                {getSuccessRate()}%
              </div>
              <div className={styles.statLabel}>Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      {showMetadata && (
        <div className={styles.metadata}>
          <div className={styles.metadataGrid}>
            <div className={styles.metadataItem}>
              <FaCalendarAlt className={styles.metadataIcon} />
              <div className={styles.metadataContent}>
                <div className={styles.metadataLabel}>Created</div>
                <div className={styles.metadataValue}>
                  {formatDate(workflow.created_at)}
                </div>
              </div>
            </div>

            <div className={styles.metadataItem}>
              <FaCalendarAlt className={styles.metadataIcon} />
              <div className={styles.metadataContent}>
                <div className={styles.metadataLabel}>Last Updated</div>
                <div className={styles.metadataValue}>
                  {formatDate(workflow.updated_at)}
                </div>
              </div>
            </div>

            {workflow.last_executed_at && (
              <div className={styles.metadataItem}>
                <FaClock className={styles.metadataIcon} />
                <div className={styles.metadataContent}>
                  <div className={styles.metadataLabel}>Last Run</div>
                  <div className={styles.metadataValue}>
                    {formatDate(workflow.last_executed_at)}
                  </div>
                </div>
              </div>
            )}

            {workflow.average_duration_seconds && (
              <div className={styles.metadataItem}>
                <FaClock className={styles.metadataIcon} />
                <div className={styles.metadataContent}>
                  <div className={styles.metadataLabel}>Avg Duration</div>
                  <div className={styles.metadataValue}>
                    {formatDuration(workflow.average_duration_seconds)}
                  </div>
                </div>
              </div>
            )}

            {workflow.created_by && (
              <div className={styles.metadataItem}>
                <FaUser className={styles.metadataIcon} />
                <div className={styles.metadataContent}>
                  <div className={styles.metadataLabel}>Created By</div>
                  <div className={styles.metadataValue}>
                    {workflow.created_by}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {workflow.tags && workflow.tags.length > 0 && (
            <div className={styles.tagsSection}>
              <div className={styles.tagsHeader}>
                <FaTags className={styles.tagsIcon} />
                <span className={styles.tagsLabel}>Tags</span>
              </div>
              <div className={styles.tags}>
                {workflow.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkflowSummary;