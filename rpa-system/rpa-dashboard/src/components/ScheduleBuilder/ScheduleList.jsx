import React, { useState, useEffect, useMemo } from 'react';
import { FiPlay, FiPause, FiEdit3, FiTrash2, FiClock, FiCalendar, FiMoreHorizontal } from 'react-icons/fi';
import { formatDistance } from 'date-fns';
import { useTheme } from '../../utils/ThemeContext';
import PropTypes from 'prop-types';
import styles from './ScheduleList.module.css';

/**
 * ScheduleList - Complete automation schedule management component
 * Features: View, enable/disable, edit, delete scheduled automations
 */
const ScheduleList = React.memo(({ 
  schedules = [], 
  onToggleSchedule, 
  onEditSchedule, 
  onDeleteSchedule,
  onCreateSchedule,
  isLoading = false 
}) => {
  const { theme } = useTheme();
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, paused
  const [sortBy, setSortBy] = useState('nextRun'); // nextRun, name, created
  const [selectedSchedules, setSelectedSchedules] = useState(new Set());

  // Memoized filtered and sorted schedules
  const filteredSchedules = useMemo(() => {
    let filtered = [...schedules];

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(schedule => 
        filterStatus === 'active' ? schedule.enabled : !schedule.enabled
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nextRun':
          return new Date(a.nextRun) - new Date(b.nextRun);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return 0;
      }
    });

    return filtered;
  }, [schedules, filterStatus, sortBy]);

  const handleSelectAll = () => {
    if (selectedSchedules.size === filteredSchedules.length) {
      setSelectedSchedules(new Set());
    } else {
      setSelectedSchedules(new Set(filteredSchedules.map(s => s.id)));
    }
  };

  const handleSelectSchedule = (scheduleId) => {
    const newSelected = new Set(selectedSchedules);
    if (newSelected.has(scheduleId)) {
      newSelected.delete(scheduleId);
    } else {
      newSelected.add(scheduleId);
    }
    setSelectedSchedules(newSelected);
  };

  const handleBulkAction = (action) => {
    const scheduleIds = Array.from(selectedSchedules);
    switch (action) {
      case 'enable':
        scheduleIds.forEach(id => onToggleSchedule(id, true));
        break;
      case 'disable':
        scheduleIds.forEach(id => onToggleSchedule(id, false));
        break;
      case 'delete':
        if (window.confirm(`Delete ${scheduleIds.length} selected schedules?`)) {
          scheduleIds.forEach(id => onDeleteSchedule(id));
        }
        break;
    }
    setSelectedSchedules(new Set());
  };

  if (isLoading) {
    return (
      <div className="schedule-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading schedules...</p>
      </div>
    );
  }

  return (
    <div className="schedule-list">
      <div className="schedule-list-header">
        <div className="header-left">
          <h2>Scheduled Automations</h2>
          <p className="schedule-count">{schedules.length} total schedules</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={onCreateSchedule}
            className="btn btn-primary"
          >
            <FiClock />
            New Schedule
          </button>
        </div>
      </div>

      <div className="schedule-controls">
        <div className="filters">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Schedules ({schedules.length})</option>
            <option value="active">Active ({schedules.filter(s => s.enabled).length})</option>
            <option value="paused">Paused ({schedules.filter(s => !s.enabled).length})</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="nextRun">Sort by Next Run</option>
            <option value="name">Sort by Name</option>
            <option value="created">Sort by Created Date</option>
          </select>
        </div>

        {selectedSchedules.size > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">
              {selectedSchedules.size} selected
            </span>
            <button 
              onClick={() => handleBulkAction('enable')}
              className="bulk-btn"
            >
              <FiPlay /> Enable
            </button>
            <button 
              onClick={() => handleBulkAction('disable')}
              className="bulk-btn"
            >
              <FiPause /> Disable
            </button>
            <button 
              onClick={() => handleBulkAction('delete')}
              className="bulk-btn bulk-btn-danger"
            >
              <FiTrash2 /> Delete
            </button>
          </div>
        )}
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="empty-state">
          <FiCalendar className="empty-icon" />
          <h3>No scheduled automations</h3>
          <p>Create your first schedule to automate your workflows.</p>
          <button onClick={onCreateSchedule} className="btn btn-primary">
            <FiClock />
            Create Schedule
          </button>
        </div>
      ) : (
        <div className="schedule-table">
          <div className="table-header">
            <div className="header-cell checkbox-cell">
              <input
                type="checkbox"
                checked={selectedSchedules.size === filteredSchedules.length}
                onChange={handleSelectAll}
              />
            </div>
            <div className="header-cell">Schedule Name</div>
            <div className="header-cell">Workflow</div>
            <div className="header-cell">Frequency</div>
            <div className="header-cell">Next Run</div>
            <div className="header-cell">Status</div>
            <div className="header-cell">Actions</div>
          </div>

          <div className="table-body">
            {filteredSchedules.map((schedule) => (
              <ScheduleItem
                key={schedule.id}
                schedule={schedule}
                isSelected={selectedSchedules.has(schedule.id)}
                onSelect={() => handleSelectSchedule(schedule.id)}
                onToggle={(enabled) => onToggleSchedule(schedule.id, enabled)}
                onEdit={() => onEditSchedule(schedule.id)}
                onDelete={() => onDeleteSchedule(schedule.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Individual Schedule Item Component
 */
const ScheduleItem = React.memo(({ 
  schedule, 
  isSelected, 
  onSelect, 
  onToggle, 
  onEdit, 
  onDelete 
}) => {
  const [showActions, setShowActions] = useState(false);

  const getFrequencyDisplay = (cronExpression) => {
    // Simple cron parser for display
    const parts = cronExpression.split(' ');
    if (parts.length >= 5) {
      if (parts[1] === '0' && parts[2] === '0' && parts[4] === '*') return 'Daily';
      if (parts[1] === '0' && parts[2] === '0' && parts[4] === '1') return 'Weekly';
      if (parts[1] === '0' && parts[2] === '1' && parts[3] === '*') return 'Monthly';
      if (parts[0] === '0' && parts[4] === '*') return 'Hourly';
    }
    return cronExpression;
  };

  const nextRunDisplay = useMemo(() => {
    const nextRun = new Date(schedule.nextRun);
    const now = new Date();
    
    if (nextRun < now) {
      return <span className="overdue">Overdue</span>;
    }
    
    return formatDistance(nextRun, now, { addSuffix: true });
  }, [schedule.nextRun]);

  return (
    <div className={`table-row ${schedule.enabled ? 'enabled' : 'disabled'}`}>
      <div className="table-cell checkbox-cell">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
        />
      </div>
      
      <div className="table-cell">
        <div className="schedule-name">
          <strong>{schedule.name}</strong>
          {schedule.description && (
            <p className="schedule-description">{schedule.description}</p>
          )}
        </div>
      </div>
      
      <div className="table-cell">
        <div className="workflow-info">
          <span className="workflow-name">{schedule.workflowName}</span>
          <span className="workflow-steps">{schedule.stepCount} steps</span>
        </div>
      </div>
      
      <div className="table-cell">
        <code className="cron-display">
          {getFrequencyDisplay(schedule.cronExpression)}
        </code>
      </div>
      
      <div className="table-cell">
        {nextRunDisplay}
      </div>
      
      <div className="table-cell">
        <div className="status-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className={`status-label ${schedule.enabled ? 'active' : 'paused'}`}>
            {schedule.enabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>
      
      <div className="table-cell actions-cell">
        <div className="actions-dropdown">
          <button
            onClick={() => setShowActions(!showActions)}
            className="actions-trigger"
          >
            <FiMoreHorizontal />
          </button>
          
          {showActions && (
            <div className="actions-menu">
              <button onClick={onEdit} className="action-item">
                <FiEdit3 /> Edit
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Delete this schedule?')) {
                    onDelete();
                  }
                }} 
                className="action-item action-danger"
              >
                <FiTrash2 /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ScheduleItem.displayName = 'ScheduleItem';

ScheduleList.propTypes = {
  schedules: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    workflowName: PropTypes.string.isRequired,
    stepCount: PropTypes.number.isRequired,
    cronExpression: PropTypes.string.isRequired,
    nextRun: PropTypes.string.isRequired,
    enabled: PropTypes.bool.isRequired,
    createdAt: PropTypes.string.isRequired,
  })),
  onToggleSchedule: PropTypes.func.isRequired,
  onEditSchedule: PropTypes.func.isRequired,
  onDeleteSchedule: PropTypes.func.isRequired,
  onCreateSchedule: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ScheduleItem.propTypes = {
  schedule: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ScheduleList;
