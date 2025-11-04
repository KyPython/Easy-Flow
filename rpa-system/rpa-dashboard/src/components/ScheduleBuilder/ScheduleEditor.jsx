import React, { useState, useEffect } from 'react';
import { FiSave, FiX, FiCalendar, FiPlay, FiPause, FiSettings } from 'react-icons/fi';
import { useTheme } from '../../utils/ThemeContext';
import CronBuilder from './CronBuilder';
import PropTypes from 'prop-types';
import styles from './ScheduleEditor.module.css';

/**
 * ScheduleEditor - Complete schedule creation and editing interface
 * Features: Schedule details, workflow selection, cron configuration, validation
 */
const ScheduleEditor = React.memo(({ 
  schedule = null, 
  workflows = [], 
  onSave, 
  onCancel,
  isLoading = false 
}) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    workflowId: '',
    cronExpression: '0 9 * * 1',
    timezone: 'UTC',
    enabled: true,
    maxRetries: 3,
    retryDelay: 300, // seconds
    timeout: 3600, // seconds
    notifications: {
      onSuccess: true,
      onFailure: true,
      email: '',
      webhook: ''
    }
  });

  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('basic'); // basic, schedule, advanced, notifications

  // Load existing schedule data for editing
  useEffect(() => {
    if (schedule) {
      setFormData({
        name: schedule.name || '',
        description: schedule.description || '',
        workflowId: schedule.workflowId || '',
        cronExpression: schedule.cronExpression || '0 9 * * 1',
        timezone: schedule.timezone || 'UTC',
        enabled: schedule.enabled !== false,
        maxRetries: schedule.maxRetries || 3,
        retryDelay: schedule.retryDelay || 300,
        timeout: schedule.timeout || 3600,
        notifications: {
          onSuccess: schedule.notifications?.onSuccess !== false,
          onFailure: schedule.notifications?.onFailure !== false,
          email: schedule.notifications?.email || '',
          webhook: schedule.notifications?.webhook || ''
        }
      });
    }
  }, [schedule]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Schedule name is required';
    }

    if (!formData.workflowId) {
      newErrors.workflowId = 'Please select a workflow';
    }

    if (!formData.cronExpression.trim()) {
      newErrors.cronExpression = 'Schedule expression is required';
    } else {
      // Basic cron validation
      const cronParts = formData.cronExpression.trim().split(' ');
      if (cronParts.length !== 5) {
        newErrors.cronExpression = 'Invalid cron expression format';
      }
    }

    if (formData.maxRetries < 0 || formData.maxRetries > 10) {
      newErrors.maxRetries = 'Max retries must be between 0 and 10';
    }

    if (formData.retryDelay < 0 || formData.retryDelay > 3600) {
      newErrors.retryDelay = 'Retry delay must be between 0 and 3600 seconds';
    }

    if (formData.timeout < 60 || formData.timeout > 86400) {
      newErrors.timeout = 'Timeout must be between 60 and 86400 seconds';
    }

    if (formData.notifications.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.notifications.email)) {
      newErrors.notificationEmail = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      // Handle nested fields like notifications.email
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const selectedWorkflow = workflows.find(w => w.id === formData.workflowId);

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  return (
    <div className="schedule-editor">
      <div className="editor-header">
        <div className="header-left">
          <h2>
            {schedule ? 'Edit Schedule' : 'Create New Schedule'}
          </h2>
          <p className="header-subtitle">
            {schedule ? `Editing: ${schedule.name}` : 'Configure automation schedule settings'}
          </p>
        </div>
        
        <div className="header-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            <FiX /> Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? (
              <span className="spinner" />
            ) : (
              <>
                <FiSave /> 
                {schedule ? 'Update Schedule' : 'Create Schedule'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Details
          </button>
          <button
            className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <FiCalendar /> Schedule
          </button>
          <button
            className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            <FiSettings /> Advanced
          </button>
          <button
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
        </div>

        <form onSubmit={handleSubmit} className="editor-form">
          {activeTab === 'basic' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Basic Information</h3>
                
                <div className="form-group">
                  <label htmlFor="name">Schedule Name *</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Daily Data Sync"
                    className={errors.name ? 'error' : ''}
                  />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief description of what this schedule does"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="workflow">Workflow *</label>
                  <select
                    id="workflow"
                    value={formData.workflowId}
                    onChange={(e) => handleInputChange('workflowId', e.target.value)}
                    className={errors.workflowId ? 'error' : ''}
                  >
                    <option value="">Select a workflow...</option>
                    {workflows.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name} ({workflow.stepCount} steps)
                      </option>
                    ))}
                  </select>
                  {errors.workflowId && <span className="error-text">{errors.workflowId}</span>}
                </div>

                {selectedWorkflow && (
                  <div className="workflow-preview">
                    <h4>Selected Workflow</h4>
                    <div className="workflow-card">
                      <div className="workflow-info">
                        <strong>{selectedWorkflow.name}</strong>
                        <p>{selectedWorkflow.description}</p>
                        <div className="workflow-stats">
                          <span>{selectedWorkflow.stepCount} steps</span>
                          <span>Est. {selectedWorkflow.estimatedDuration} duration</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => handleInputChange('enabled', e.target.checked)}
                    />
                    <span className="checkbox-text">
                      <FiPlay />
                      Enable this schedule immediately
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Schedule Configuration</h3>
                
                <div className="form-group">
                  <label>Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <CronBuilder
                  value={formData.cronExpression}
                  onChange={(cronValue) => handleInputChange('cronExpression', cronValue)}
                  timezone={formData.timezone}
                  showAdvanced={true}
                />
                
                {errors.cronExpression && (
                  <span className="error-text">{errors.cronExpression}</span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Advanced Settings</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="maxRetries">Max Retries</label>
                    <input
                      id="maxRetries"
                      type="number"
                      min="0"
                      max="10"
                      value={formData.maxRetries}
                      onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value) || 0)}
                      className={errors.maxRetries ? 'error' : ''}
                    />
                    <small>Number of retry attempts if the workflow fails</small>
                    {errors.maxRetries && <span className="error-text">{errors.maxRetries}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="retryDelay">Retry Delay (seconds)</label>
                    <input
                      id="retryDelay"
                      type="number"
                      min="0"
                      max="3600"
                      value={formData.retryDelay}
                      onChange={(e) => handleInputChange('retryDelay', parseInt(e.target.value) || 0)}
                      className={errors.retryDelay ? 'error' : ''}
                    />
                    <small>Delay between retry attempts</small>
                    {errors.retryDelay && <span className="error-text">{errors.retryDelay}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="timeout">Timeout (seconds)</label>
                  <input
                    id="timeout"
                    type="number"
                    min="60"
                    max="86400"
                    value={formData.timeout}
                    onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 60)}
                    className={errors.timeout ? 'error' : ''}
                  />
                  <small>Maximum execution time before canceling the workflow</small>
                  {errors.timeout && <span className="error-text">{errors.timeout}</span>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Notification Settings</h3>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notifications.onSuccess}
                      onChange={(e) => handleInputChange('notifications.onSuccess', e.target.checked)}
                    />
                    <span className="checkbox-text">
                      Notify on successful execution
                    </span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notifications.onFailure}
                      onChange={(e) => handleInputChange('notifications.onFailure', e.target.checked)}
                    />
                    <span className="checkbox-text">
                      Notify on execution failure
                    </span>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="notificationEmail">Email Address</label>
                  <input
                    id="notificationEmail"
                    type="email"
                    value={formData.notifications.email}
                    onChange={(e) => handleInputChange('notifications.email', e.target.value)}
                    placeholder="notifications@example.com"
                    className={errors.notificationEmail ? 'error' : ''}
                  />
                  <small>Send notifications to this email address</small>
                  {errors.notificationEmail && <span className="error-text">{errors.notificationEmail}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="webhook">Webhook URL</label>
                  <input
                    id="webhook"
                    type="url"
                    value={formData.notifications.webhook}
                    onChange={(e) => handleInputChange('notifications.webhook', e.target.value)}
                    placeholder="https://your-app.com/webhooks/schedule"
                  />
                  <small>Optional webhook URL for custom integrations</small>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

ScheduleEditor.propTypes = {
  schedule: PropTypes.object,
  workflows: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    stepCount: PropTypes.number.isRequired,
    estimatedDuration: PropTypes.string,
  })),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
});

export default ScheduleEditor;
