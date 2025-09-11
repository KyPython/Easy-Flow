import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ExecutionDashboard.module.css';
import { 
  FaPlay, 
  FaStop, 
  FaRedo, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaTimesCircle,
  FaChartLine,
  FaFilter,
  FaDownload,
  FaEye
} from 'react-icons/fa';
import { useWorkflowExecutions } from '../../hooks/useWorkflowExecutions';
import MetricCard from '../MetricCard/MetricCard';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import ExecutionCard from './ExecutionCard';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from './LoadingSpinner';

const ExecutionDashboard = ({ workflowId, workflowName }) => {
  const { 
    executions, 
    loading, 
    error,
    stats, 
    refreshExecutions, 
    getExecutionDetails,
    cancelExecution 
  } = useWorkflowExecutions(workflowId);

  const [selectedExecution, setSelectedExecution] = useState(null);
  const [showExecutionDetails, setShowExecutionDetails] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('started_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (workflowId) {
      refreshExecutions();
      
      // Set up auto-refresh for running executions
      const interval = setInterval(() => {
        refreshExecutions();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [workflowId, refreshExecutions]);

  const handleViewExecution = async (executionId) => {
    try {
      const details = await getExecutionDetails(executionId);
      setSelectedExecution(details);
      setShowExecutionDetails(true);
    } catch (error) {
      console.error('Failed to load execution details:', error);
    }
  };

  const handleCancelExecution = async (executionId) => {
    if (window.confirm('Are you sure you want to cancel this execution?')) {
      try {
        await cancelExecution(executionId);
      } catch (error) {
        console.error('Failed to cancel execution:', error);
      }
    }
  };

  const filteredExecutions = executions
    .filter(execution => {
      if (filter === 'all') return true;
      return execution.status === filter;
    })
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'desc') {
        return new Date(bValue) - new Date(aValue);
      } else {
        return new Date(aValue) - new Date(bValue);
      }
    });

  if (loading && executions.length === 0) {
    return (
      <div className={styles.executionDashboard}>
        <LoadingSpinner centered message="Loading executions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.executionDashboard}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Execution History</h3>
            <p className={styles.subtitle}>Monitor &quot;{workflowName}&quot; executions</p>
          </div>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className={styles.executionDashboard}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Execution History</h3>
          <p className={styles.subtitle}>Monitor &quot;{workflowName}&quot; executions</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshButton} onClick={refreshExecutions}>
            <FaRedo /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className={styles.statsGrid}>
        <MetricCard
          icon={<FaPlay />}
          title="Total Executions"
          value={stats.total || 0}
        />
        <MetricCard
          icon={<FaCheckCircle />}
          title="Successful"
          value={stats.completed || 0}
          subtitle={stats.total ? `${Math.round((stats.completed / stats.total) * 100)}% success rate` : ''}
        />
        <MetricCard
          icon={<FaTimesCircle />}
          title="Failed"
          value={stats.failed || 0}
          subtitle={stats.total ? `${Math.round((stats.failed / stats.total) * 100)}% failure rate` : ''}
        />
        <MetricCard
          icon={<FaClock />}
          title="Running"
          value={stats.running || 0}
        />
      </div>

      {/* Filters and Controls */}
      <div className={styles.controls}>
        <div className={styles.filters}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Executions</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="started_at">Sort by Start Time</option>
            <option value="completed_at">Sort by End Time</option>
            <option value="duration_seconds">Sort by Duration</option>
          </select>

          <button
            className={styles.sortOrder}
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            {sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.exportButton}>
            <FaDownload /> Export
          </button>
        </div>
      </div>

      {/* Execution List */}
      {filteredExecutions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FaChartLine />
          </div>
          <h4>No executions found</h4>
          <p>
            {filter === 'all' 
              ? 'This workflow hasn\'t been executed yet.'
              : `No executions with status "${filter}".`
            }
          </p>
        </div>
      ) : (
        <div className={styles.executionList}>
          {filteredExecutions.map((execution) => (
            <ExecutionCard
              key={execution.id}
              execution={execution}
              onView={() => handleViewExecution(execution.id)}
              onCancel={() => handleCancelExecution(execution.id)}
            />
          ))}
        </div>
      )}

      {/* Execution Details Modal */}
      {showExecutionDetails && selectedExecution && (
        <ExecutionDetailsModal
          execution={selectedExecution}
          onClose={() => setShowExecutionDetails(false)}
        />
      )}
    </div>
  );
};

// Removed duplicate inline ExecutionCard (using imported component instead)

ExecutionDashboard.propTypes = {
  workflowId: PropTypes.string.isRequired,
  workflowName: PropTypes.string.isRequired
};

const ExecutionDetailsModal = ({ execution, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stepExecutions, setStepExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load step executions
    const loadStepExecutions = async () => {
      try {
        setLoading(true);
        
        // Simulate API call - replace with actual API
        // const response = await fetch(`/api/executions/${execution.id}/steps`);
        // const data = await response.json();
        // setStepExecutions(data.steps || []);
        
        // Mock data for now
        setStepExecutions(execution.step_executions || []);
      } catch (error) {
        console.error('Failed to load step executions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStepExecutions();
  }, [execution.id]);

  const formatJSON = (data) => {
    if (!data) return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  const getStepStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <FaCheckCircle className={styles.successIcon} />;
      case 'failed': return <FaTimesCircle className={styles.errorIcon} />;
      case 'running': return <FaClock className={styles.warningIcon} />;
      default: return <FaClock className={styles.grayIcon} />;
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.detailsModal}>
        <div className={styles.modalHeader}>
          <h3>Execution #{execution.execution_number} Details</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalTabs}>
          <button
            className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'steps' ? styles.active : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            Step Details
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'data' ? styles.active : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Input/Output
          </button>
        </div>

        <div className={styles.modalContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewTab}>
              <div className={styles.overviewGrid}>
                <div className={styles.overviewItem}>
                  <label>Status:</label>
                  <span className={`${styles.badge} ${styles[execution.status]}`}>
                    {execution.status}
                  </span>
                </div>
                <div className={styles.overviewItem}>
                  <label>Triggered by:</label>
                  <span>{execution.triggered_by}</span>
                </div>
                <div className={styles.overviewItem}>
                  <label>Started:</label>
                  <span>{new Date(execution.started_at).toLocaleString()}</span>
                </div>
                {execution.completed_at && (
                  <div className={styles.overviewItem}>
                    <label>Completed:</label>
                    <span>{new Date(execution.completed_at).toLocaleString()}</span>
                  </div>
                )}
                <div className={styles.overviewItem}>
                  <label>Duration:</label>
                  <span>{execution.duration_seconds ? `${execution.duration_seconds}s` : 'N/A'}</span>
                </div>
                <div className={styles.overviewItem}>
                  <label>Steps:</label>
                  <span>{execution.steps_executed}/{execution.steps_total}</span>
                </div>
              </div>

              {execution.error_message && (
                <div className={styles.errorSection}>
                  <h4>Error Details</h4>
                  <pre className={styles.errorText}>{execution.error_message}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'steps' && (
            <div className={styles.stepsTab}>
              {loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Loading step details...</p>
                </div>
              ) : stepExecutions.length === 0 ? (
                <p>No step execution details available.</p>
              ) : (
                <div className={styles.stepsList}>
                  {stepExecutions.map((step, index) => (
                    <div key={step.id} className={styles.stepItem}>
                      <div className={styles.stepHeader}>
                        <span className={styles.stepNumber}>#{index + 1}</span>
                        {getStepStatusIcon(step.status)}
                        <span className={styles.stepName}>
                          {step.step_name || `Step ${index + 1}`}
                        </span>
                        <span className={styles.stepDuration}>
                          {step.duration_ms ? `${step.duration_ms}ms` : 'N/A'}
                        </span>
                      </div>
                      {step.error_message && (
                        <div className={styles.stepError}>
                          Error: {step.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className={styles.dataTab}>
              <div className={styles.dataSection}>
                <h4>Input Data</h4>
                <pre className={styles.jsonData}>
                  {formatJSON(execution.input_data)}
                </pre>
              </div>
              <div className={styles.dataSection}>
                <h4>Output Data</h4>
                <pre className={styles.jsonData}>
                  {formatJSON(execution.output_data)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ExecutionDetailsModal.propTypes = {
  execution: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    execution_number: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    status: PropTypes.string,
    triggered_by: PropTypes.string,
    started_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    completed_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    duration_seconds: PropTypes.number,
    steps_executed: PropTypes.number,
    steps_total: PropTypes.number,
    error_message: PropTypes.string,
    input_data: PropTypes.any,
    output_data: PropTypes.any,
    step_executions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      step_name: PropTypes.string,
      status: PropTypes.string,
      duration_ms: PropTypes.number,
      error_message: PropTypes.string
    }))
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

ExecutionDashboard.propTypes = {
  workflowId: PropTypes.string.isRequired,
  workflowName: PropTypes.string.isRequired
};

export default ExecutionDashboard;