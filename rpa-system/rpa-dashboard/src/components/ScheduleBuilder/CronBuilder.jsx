import React, { useState, useEffect, useMemo } from 'react';
import { FiClock, FiCalendar, FiRepeat, FiInfo } from 'react-icons/fi';
import PropTypes from 'prop-types';
import './CronBuilder.module.css';

/**
 * CronBuilder - Visual cron expression builder with preset options
 * Features: Preset schedules, custom cron input, real-time preview
 */
const CronBuilder = React.memo(({ 
  value = '0 9 * * 1', 
  onChange, 
  timezone = 'UTC',
  showAdvanced = false 
}) => {
  const [mode, setMode] = useState('preset'); // preset, custom, advanced
  const [customCron, setCustomCron] = useState(value);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Common preset schedules
  const presets = [
    { 
      id: 'daily-9am', 
      label: 'Daily at 9:00 AM', 
      cron: '0 9 * * *',
      description: 'Runs every day at 9:00 AM'
    },
    { 
      id: 'weekdays-9am', 
      label: 'Weekdays at 9:00 AM', 
      cron: '0 9 * * 1-5',
      description: 'Runs Monday through Friday at 9:00 AM'
    },
    { 
      id: 'weekly-monday', 
      label: 'Weekly (Mondays at 9:00 AM)', 
      cron: '0 9 * * 1',
      description: 'Runs every Monday at 9:00 AM'
    },
    { 
      id: 'monthly-1st', 
      label: 'Monthly (1st at 9:00 AM)', 
      cron: '0 9 1 * *',
      description: 'Runs on the 1st day of each month at 9:00 AM'
    },
    { 
      id: 'hourly', 
      label: 'Every hour', 
      cron: '0 * * * *',
      description: 'Runs at the top of every hour'
    },
    { 
      id: 'every-15min', 
      label: 'Every 15 minutes', 
      cron: '*/15 * * * *',
      description: 'Runs every 15 minutes'
    },
    { 
      id: 'twice-daily', 
      label: 'Twice daily (9 AM & 5 PM)', 
      cron: '0 9,17 * * *',
      description: 'Runs at 9:00 AM and 5:00 PM every day'
    }
  ];

  // Advanced cron builder fields
  const [advancedFields, setAdvancedFields] = useState({
    minute: '0',
    hour: '9', 
    dayOfMonth: '*',
    month: '*',
    dayOfWeek: '*'
  });

  // Parse current cron expression for advanced mode
  useEffect(() => {
    const parts = value.split(' ');
    if (parts.length >= 5) {
      setAdvancedFields({
        minute: parts[0] || '0',
        hour: parts[1] || '9',
        dayOfMonth: parts[2] || '*',
        month: parts[3] || '*',
        dayOfWeek: parts[4] || '*'
      });
    }
  }, [value]);

  // Find matching preset for current value
  useEffect(() => {
    const matchingPreset = presets.find(p => p.cron === value);
    setSelectedPreset(matchingPreset?.id || '');
    setCustomCron(value);
  }, [value]);

  // Generate cron from advanced fields
  const advancedCron = useMemo(() => {
    return [
      advancedFields.minute,
      advancedFields.hour,
      advancedFields.dayOfMonth,
      advancedFields.month,
      advancedFields.dayOfWeek
    ].join(' ');
  }, [advancedFields]);

  // Human readable description of cron expression
  const cronDescription = useMemo(() => {
    return getCronDescription(mode === 'advanced' ? advancedCron : customCron);
  }, [customCron, advancedCron, mode]);

  // Next 3 execution times preview
  const nextExecutions = useMemo(() => {
    return getNextExecutions(mode === 'advanced' ? advancedCron : customCron, 3);
  }, [customCron, advancedCron, mode]);

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.id);
    setCustomCron(preset.cron);
    onChange(preset.cron);
  };

  const handleCustomCronChange = (cronValue) => {
    setCustomCron(cronValue);
    setSelectedPreset(''); // Clear preset selection
    onChange(cronValue);
  };

  const handleAdvancedFieldChange = (field, fieldValue) => {
    const newFields = { ...advancedFields, [field]: fieldValue };
    setAdvancedFields(newFields);
    const newCron = [
      newFields.minute,
      newFields.hour,
      newFields.dayOfMonth,
      newFields.month,
      newFields.dayOfWeek
    ].join(' ');
    onChange(newCron);
  };

  return (
    <div className="cron-builder">
      <div className="cron-header">
        <h3>Schedule Configuration</h3>
        <div className="mode-selector">
          <button
            className={`mode-btn ${mode === 'preset' ? 'active' : ''}`}
            onClick={() => setMode('preset')}
          >
            <FiClock /> Presets
          </button>
          <button
            className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            <FiRepeat /> Custom
          </button>
          {showAdvanced && (
            <button
              className={`mode-btn ${mode === 'advanced' ? 'active' : ''}`}
              onClick={() => setMode('advanced')}
            >
              Advanced
            </button>
          )}
        </div>
      </div>

      <div className="cron-content">
        {mode === 'preset' && (
          <div className="preset-mode">
            <p className="mode-description">
              Choose from common scheduling patterns:
            </p>
            <div className="preset-grid">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`preset-card ${selectedPreset === preset.id ? 'selected' : ''}`}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="preset-label">{preset.label}</div>
                  <div className="preset-description">{preset.description}</div>
                  <code className="preset-cron">{preset.cron}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <div className="custom-mode">
            <p className="mode-description">
              Enter a custom cron expression:
            </p>
            <div className="custom-input-group">
              <input
                type="text"
                value={customCron}
                onChange={(e) => handleCustomCronChange(e.target.value)}
                placeholder="0 9 * * 1"
                className="custom-cron-input"
              />
              <div className="cron-help">
                <FiInfo />
                <span>Format: minute hour day month weekday</span>
              </div>
            </div>
            
            <div className="cron-reference">
              <h4>Cron Expression Reference:</h4>
              <div className="reference-grid">
                <div className="reference-item">
                  <strong>Minute:</strong> 0-59
                </div>
                <div className="reference-item">
                  <strong>Hour:</strong> 0-23 (24hr format)
                </div>
                <div className="reference-item">
                  <strong>Day:</strong> 1-31
                </div>
                <div className="reference-item">
                  <strong>Month:</strong> 1-12
                </div>
                <div className="reference-item">
                  <strong>Weekday:</strong> 0-7 (Sun=0,7)
                </div>
                <div className="reference-item">
                  <strong>Wildcards:</strong> * (any), ? (any), / (step)
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'advanced' && (
          <div className="advanced-mode">
            <p className="mode-description">
              Build your cron expression field by field:
            </p>
            <div className="advanced-grid">
              <div className="field-group">
                <label>Minute</label>
                <input
                  type="text"
                  value={advancedFields.minute}
                  onChange={(e) => handleAdvancedFieldChange('minute', e.target.value)}
                  placeholder="0"
                />
                <small>0-59, *, */5</small>
              </div>
              
              <div className="field-group">
                <label>Hour</label>
                <input
                  type="text"
                  value={advancedFields.hour}
                  onChange={(e) => handleAdvancedFieldChange('hour', e.target.value)}
                  placeholder="9"
                />
                <small>0-23, *, */2</small>
              </div>
              
              <div className="field-group">
                <label>Day of Month</label>
                <input
                  type="text"
                  value={advancedFields.dayOfMonth}
                  onChange={(e) => handleAdvancedFieldChange('dayOfMonth', e.target.value)}
                  placeholder="*"
                />
                <small>1-31, *, L</small>
              </div>
              
              <div className="field-group">
                <label>Month</label>
                <input
                  type="text"
                  value={advancedFields.month}
                  onChange={(e) => handleAdvancedFieldChange('month', e.target.value)}
                  placeholder="*"
                />
                <small>1-12, *, JAN-DEC</small>
              </div>
              
              <div className="field-group">
                <label>Day of Week</label>
                <input
                  type="text"
                  value={advancedFields.dayOfWeek}
                  onChange={(e) => handleAdvancedFieldChange('dayOfWeek', e.target.value)}
                  placeholder="*"
                />
                <small>0-7, *, MON-SUN</small>
              </div>
            </div>
            
            <div className="advanced-result">
              <strong>Generated Expression:</strong>
              <code>{advancedCron}</code>
            </div>
          </div>
        )}
      </div>

      <div className="cron-preview">
        <div className="preview-section">
          <h4>
            <FiCalendar />
            Schedule Preview
          </h4>
          <div className="current-expression">
            <strong>Expression:</strong> 
            <code>{mode === 'advanced' ? advancedCron : customCron}</code>
            <span className="timezone">({timezone})</span>
          </div>
          <div className="expression-description">
            {cronDescription}
          </div>
        </div>

        <div className="next-runs">
          <h4>Next Executions:</h4>
          <div className="execution-list">
            {nextExecutions.map((execution, index) => (
              <div key={index} className="execution-item">
                <span className="execution-date">{execution.date}</span>
                <span className="execution-time">{execution.time}</span>
                <span className="execution-relative">{execution.relative}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to generate human-readable cron description
function getCronDescription(cronExpression) {
  try {
    const parts = cronExpression.trim().split(' ');
    if (parts.length < 5) return 'Invalid cron expression';

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Simple pattern matching for common expressions
    if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Runs daily at ${hour}:00`;
    }
    
    if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      const days = dayOfWeek === '1-5' ? 'weekdays' : 
                   dayOfWeek === '1' ? 'Mondays' :
                   dayOfWeek === '0,6' ? 'weekends' : `day ${dayOfWeek}`;
      return `Runs on ${days} at ${hour}:00`;
    }

    if (minute.startsWith('*/')) {
      const interval = minute.substring(2);
      return `Runs every ${interval} minutes`;
    }

    if (hour.startsWith('*/')) {
      const interval = hour.substring(2);
      return `Runs every ${interval} hours`;
    }

    return `Runs at ${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  } catch (error) {
    return 'Invalid cron expression';
  }
}

// Helper function to calculate next execution times (simplified)
function getNextExecutions(cronExpression, count = 3) {
  // This is a simplified version - in production, use a proper cron parser library
  const executions = [];
  const now = new Date();

  try {
    const parts = cronExpression.trim().split(' ');
    if (parts.length < 5) return [{ date: 'Invalid', time: 'expression', relative: '' }];

    const [minute, hour] = parts;
    
    // Simple calculation for basic patterns
    const minuteNum = parseInt(minute) || 0;
    const hourNum = parseInt(hour) || 9;
    
    for (let i = 0; i < count; i++) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + i);
      nextDate.setHours(hourNum, minuteNum, 0, 0);
      
      if (nextDate <= now && i === 0) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      executions.push({
        date: nextDate.toDateString(),
        time: nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relative: i === 0 ? 'Next run' : `In ${i + 1} days`
      });
    }
  } catch (error) {
    return [{ date: 'Error', time: 'calculating', relative: 'execution times' }];
  }

  return executions;
}

CronBuilder.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  timezone: PropTypes.string,
  showAdvanced: PropTypes.bool,
});

export default CronBuilder;
