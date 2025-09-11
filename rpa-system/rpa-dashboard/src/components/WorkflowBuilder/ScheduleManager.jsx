import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './ScheduleManager.module.css';
// Added missing icons actually used in this file
import { FaPlus, FaClock, FaPlay, FaEdit, FaTrash, FaHistory, FaGlobe } from 'react-icons/fa';
import { useSchedules } from '../../hooks/useSchedules';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
// Remove unused/duplicate imports: ScheduleCard (we define local), Modal, FormField, ConfirmDialog, ActionButton
import { supabase } from '../../utils/supabase';

const ScheduleManager = ({ workflowId, workflowName }) => {
  const { schedules, loading, error, createSchedule, updateSchedule, deleteSchedule, triggerSchedule, refreshSchedules } = useSchedules(workflowId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showExecutionHistory, setShowExecutionHistory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    refreshSchedules();
  }, [workflowId]);

  const handleCreateSchedule = (scheduleData) => {
    createSchedule({ ...scheduleData, workflowId });
    setShowCreateModal(false);
  };

  const handleEditSchedule = (schedule, updates) => {
    updateSchedule(schedule.id, updates);
    setEditingSchedule(null);
  };

  const handleDeleteSchedule = (schedule) => {
    setDeleteConfirm(schedule);
  };

  const confirmDeleteSchedule = async () => {
    if (!deleteConfirm) return;
    
    try {
      setIsDeleting(true);
      await deleteSchedule(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTriggerSchedule = async (scheduleId) => {
    try {
      await triggerSchedule(scheduleId);
      // Show success message or refresh executions
    } catch (error) {
      console.error('Failed to trigger schedule:', error);
    }
  };

  if (loading) {
    return (
      <div className={styles.scheduleManager}>
        <LoadingSpinner centered message="Loading schedules..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.scheduleManager}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Workflow Schedules</h3>
            <p className={styles.subtitle}>Automate &quot;{workflowName}&quot; execution</p>
          </div>
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className={styles.scheduleManager}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Workflow Schedules</h3>
          <p className={styles.subtitle}>Automate &quot;{workflowName}&quot; execution</p>
        </div>
        <button
          className={styles.createButton}
          onClick={() => setShowCreateModal(true)}
        >
          <FaPlus /> New Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FaClock />
          </div>
          <h4>No schedules configured</h4>
          <p>Create automated schedules to run your workflow at specific times or intervals.</p>
          <button
            className={styles.emptyButton}
            onClick={() => setShowCreateModal(true)}
          >
            <FaPlus /> Create First Schedule
          </button>
        </div>
      ) : (
        <div className={styles.scheduleList}>
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onEdit={() => setEditingSchedule(schedule)}
              // Pass full schedule object so deletion dialog has context
              onDelete={() => handleDeleteSchedule(schedule)}
              onTrigger={() => handleTriggerSchedule(schedule.id)}
              onViewHistory={() => setShowExecutionHistory(schedule)}
            />
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <ScheduleModal
          title="Create New Schedule"
          onSave={handleCreateSchedule}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Schedule Modal */}
      {editingSchedule && (
        <ScheduleModal
          title="Edit Schedule"
          schedule={editingSchedule}
          onSave={(data) => handleEditSchedule(editingSchedule, data)}
          onClose={() => setEditingSchedule(null)}
        />
      )}

      {/* Execution History Modal */}
      {showExecutionHistory && (
        <ExecutionHistoryModal
          schedule={showExecutionHistory}
          onClose={() => setShowExecutionHistory(null)}
        />
      )}
    </div>
  );
};

const ScheduleCard = ({ schedule, onEdit, onDelete, onTrigger, onViewHistory }) => {
  const getScheduleTypeIcon = (type) => {
    switch (type) {
      case 'cron': return <FaClock />;
      case 'interval': return <FaClock />;
      case 'webhook': return <FaGlobe />;
      default: return <FaClock />;
    }
  };

  const getScheduleDescription = (schedule) => {
    switch (schedule.schedule_type) {
      case 'cron':
        return `Cron: ${schedule.cron_expression} (${schedule.timezone || 'UTC'})`;
      case 'interval':
        return `Every ${schedule.interval_seconds} seconds`;
      case 'webhook':
        return 'Triggered by webhook';
      default:
        return 'Unknown schedule type';
    }
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'success' : 'warning';
  };

  const formatLastTrigger = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const formatNextTrigger = (date) => {
    if (!date) return 'Not scheduled';
    const now = new Date();
    const next = new Date(date);
    const diff = next - now;
    
    if (diff < 0) return 'Overdue';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `In ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `In ${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `In ${minutes} minute${minutes > 1 ? 's' : ''}`;
    return 'Soon';
  };

  return (
    <div className={`${styles.scheduleCard} ${!schedule.is_active ? styles.inactive : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <span className={styles.typeIcon}>
            {getScheduleTypeIcon(schedule.schedule_type)}
          </span>
          <div>
            <h4 className={styles.scheduleName}>{schedule.name}</h4>
            <p className={styles.scheduleDescription}>
              {getScheduleDescription(schedule)}
            </p>
          </div>
        </div>
        <div className={styles.cardActions}>
          <button
            className={styles.actionButton}
            onClick={onTrigger}
            title="Run now"
          >
            <FaPlay />
          </button>
          <button
            className={styles.actionButton}
            onClick={onEdit}
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={onDelete}
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.statusRow}>
          <span className={`${styles.statusBadge} ${styles[getStatusColor(schedule.is_active)]}`}>
            {schedule.is_active ? 'Active' : 'Inactive'}
          </span>
          <span className={styles.executionCount}>
            {schedule.execution_count || 0} executions
          </span>
        </div>

        {schedule.webhook_url && (
          <div className={styles.webhookInfo}>
            <label className={styles.webhookLabel}>Webhook URL:</label>
            <div className={styles.webhookUrl}>
              <input
                type="text"
                value={schedule.webhook_url}
                readOnly
                className={styles.webhookInput}
              />
              <button
                className={styles.copyButton}
                onClick={() => navigator.clipboard.writeText(schedule.webhook_url)}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className={styles.scheduleInfo}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Last triggered:</span>
            <span className={styles.infoValue}>
              {formatLastTrigger(schedule.last_triggered_at)}
            </span>
          </div>
          {schedule.next_trigger_at && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Next run:</span>
              <span className={styles.infoValue}>
                {formatNextTrigger(schedule.next_trigger_at)}
              </span>
            </div>
          )}
          {schedule.max_executions && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Limit:</span>
              <span className={styles.infoValue}>
                {schedule.execution_count || 0} / {schedule.max_executions}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cardFooter}>
        <button
          className={styles.historyButton}
          onClick={onViewHistory}
        >
          <FaHistory /> View History
        </button>
      </div>
    </div>
  );
};

ScheduleCard.propTypes = {
  schedule: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    schedule_type: PropTypes.oneOf(['cron', 'interval', 'webhook']).isRequired,
    cron_expression: PropTypes.string,
    interval_seconds: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    timezone: PropTypes.string,
    is_active: PropTypes.bool,
    execution_count: PropTypes.number,
    webhook_url: PropTypes.string,
    last_triggered_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    next_trigger_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    max_executions: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onTrigger: PropTypes.func.isRequired,
  onViewHistory: PropTypes.func.isRequired
};

const ScheduleModal = ({ title, schedule, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: schedule?.name || '',
    scheduleType: schedule?.schedule_type || 'cron',
    cronExpression: schedule?.cron_expression || '0 9 * * 1-5',
    intervalSeconds: schedule?.interval_seconds || 3600,
    timezone: schedule?.timezone || 'UTC',
    maxExecutions: schedule?.max_executions || '',
    webhookSecret: schedule?.webhook_secret || '',
    isActive: schedule?.is_active !== false
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Schedule name is required';
    }

    if (formData.scheduleType === 'cron' && !formData.cronExpression.trim()) {
      newErrors.cronExpression = 'Cron expression is required';
    }

    if (formData.scheduleType === 'interval' && (!formData.intervalSeconds || formData.intervalSeconds < 60)) {
      newErrors.intervalSeconds = 'Interval must be at least 60 seconds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({
        name: formData.name,
        scheduleType: formData.scheduleType,
        cronExpression: formData.scheduleType === 'cron' ? formData.cronExpression : undefined,
        intervalSeconds: formData.scheduleType === 'interval' ? parseInt(formData.intervalSeconds) : undefined,
        timezone: formData.timezone,
        maxExecutions: formData.maxExecutions ? parseInt(formData.maxExecutions) : undefined,
        webhookSecret: formData.scheduleType === 'webhook' ? formData.webhookSecret : undefined,
        isActive: formData.isActive
      });
    }
  };

  const commonCronExpressions = [
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Weekly on Monday 9 AM', value: '0 9 * * 1' },
    { label: 'Monthly on 1st at 9 AM', value: '0 9 1 * *' }
  ];

  const timezones = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 
    'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 
    'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'
  ];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Schedule Name *
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`${styles.input} ${errors.name ? styles.error : ''}`}
                placeholder="Enter schedule name"
              />
              {errors.name && <span className={styles.errorText}>{errors.name}</span>}
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Schedule Type
              <select
                value={formData.scheduleType}
                onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value })}
                className={styles.select}
              >
                <option value="cron">Cron Schedule</option>
                <option value="interval">Interval</option>
                <option value="webhook">Webhook</option>
              </select>
            </label>
          </div>

          {formData.scheduleType === 'cron' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Cron Expression *
                  <input
                    type="text"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    className={`${styles.input} ${errors.cronExpression ? styles.error : ''}`}
                    placeholder="0 9 * * 1-5"
                  />
                  {errors.cronExpression && <span className={styles.errorText}>{errors.cronExpression}</span>}
                </label>
                <div className={styles.cronHelper}>
                  <p className={styles.helperText}>Common expressions:</p>
                  <div className={styles.cronExamples}>
                    {commonCronExpressions.map((expr, index) => (
                      <button
                        key={index}
                        type="button"
                        className={styles.cronExample}
                        onClick={() => setFormData({ ...formData, cronExpression: expr.value })}
                      >
                        {expr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Timezone
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className={styles.select}
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {formData.scheduleType === 'interval' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Interval (seconds) *
                <input
                  type="number"
                  value={formData.intervalSeconds}
                  onChange={(e) => setFormData({ ...formData, intervalSeconds: e.target.value })}
                  className={`${styles.input} ${errors.intervalSeconds ? styles.error : ''}`}
                  min="60"
                  placeholder="3600"
                />
                {errors.intervalSeconds && <span className={styles.errorText}>{errors.intervalSeconds}</span>}
              </label>
            </div>
          )}

          {formData.scheduleType === 'webhook' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Webhook Secret (optional)
                <input
                  type="password"
                  value={formData.webhookSecret}
                  onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
                  className={styles.input}
                  placeholder="Enter secret for webhook validation"
                />
              </label>
              <p className={styles.helperText}>
                If provided, webhook requests must include a valid signature
              </p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Maximum Executions (optional)
              <input
                type="number"
                value={formData.maxExecutions}
                onChange={(e) => setFormData({ ...formData, maxExecutions: e.target.value })}
                className={styles.input}
                min="1"
                placeholder="Leave empty for unlimited"
              />
            </label>
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Enable this schedule
            </label>
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" className={styles.saveButton}>
              {schedule ? 'Update Schedule' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

ScheduleModal.propTypes = {
  title: PropTypes.string.isRequired,
  schedule: PropTypes.shape({
    name: PropTypes.string,
    schedule_type: PropTypes.oneOf(['cron', 'interval', 'webhook']),
    cron_expression: PropTypes.string,
    interval_seconds: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    timezone: PropTypes.string,
    max_executions: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    webhook_secret: PropTypes.string,
    is_active: PropTypes.bool
  }),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

const ExecutionHistoryModal = ({ schedule, onClose }) => {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExecutions = async () => {
      try {
        const response = await fetch(`/api/schedules/${schedule.id}/executions`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        });

        if (!response.ok) throw new Error('Failed to load executions');

        const data = await response.json();
        setExecutions(data.executions || []);
      } catch (error) {
        console.error('Error loading execution history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExecutions();
  }, [schedule.id]);

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      default: return 'gray';
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Execution History - {schedule.name}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalContent}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading execution history...</p>
            </div>
          ) : executions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No execution history available</p>
            </div>
          ) : (
            <div className={styles.executionList}>
              {executions.map((execution) => (
                <div key={execution.id} className={styles.executionItem}>
                  <div className={styles.executionHeader}>
                    <span className={`${styles.statusBadge} ${styles[getStatusColor(execution.status)]}`}>
                      {execution.status}
                    </span>
                    <span className={styles.executionDate}>
                      {new Date(execution.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.executionDetails}>
                    <span>Duration: {formatDuration(execution.duration_seconds)}</span>
                    <span>Steps: {execution.steps_executed}/{execution.steps_total}</span>
                    {execution.triggered_by && (
                      <span>Trigger: {execution.triggered_by}</span>
                    )}
                  </div>
                  {execution.error_message && (
                    <div className={styles.errorMessage}>
                      {execution.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ExecutionHistoryModal.propTypes = {
  schedule: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

ScheduleManager.propTypes = {
  workflowId: PropTypes.string.isRequired,
  workflowName: PropTypes.string.isRequired
};

export default ScheduleManager;