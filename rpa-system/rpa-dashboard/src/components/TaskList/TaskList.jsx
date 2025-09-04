import React, { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './TaskList.module.css';
import StatusBadge from '../StatusBadge/StatusBadge';
import { formatDateTime, formatTaskType } from '../../utils/formatters';

const TaskList = ({ tasks, onEdit, onDelete, onView }) => {
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and sort tasks safely
  const filteredTasks = tasks
    .filter(task => {
      // Handle both run history (nested) and task list (flat) data structures
      const taskName = task.automation_tasks?.name || task.type;
      const taskUrl = task.automation_tasks?.url || task.url;

      const matchesSearch =
        (taskUrl?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (task.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (formatTaskType(taskName)?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesFilter = filterStatus === 'all' || task.status === filterStatus;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let aValue, bValue;

      // Handle potentially nested properties for sorting
      if (sortBy === 'type') {
        aValue = a.automation_tasks?.name || a.type;
        bValue = b.automation_tasks?.name || b.type;
      } else if (sortBy === 'url') {
        aValue = a.automation_tasks?.url || a.url;
        bValue = b.automation_tasks?.url || b.url;
      } else if (sortBy === 'created_at') {
        aValue = a.started_at || a.created_at;
        bValue = b.started_at || b.created_at;
      } else {
        aValue = a[sortBy];
        bValue = b[sortBy];
      }

      const multiplier = sortOrder === 'asc' ? 1 : -1;

      if (sortBy === 'created_at') {
        return (new Date(aValue) - new Date(bValue)) * multiplier;
      }

      const aStr = aValue?.toString() || '';
      const bStr = bValue?.toString() || '';
      return aStr.localeCompare(bStr) * multiplier;
    });

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage);

  const handleSelectTask = (taskId) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTasks.size === paginatedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(paginatedTasks.map(task => task.id)));
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Task History</h2>
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxHeader}>
                <input
                  type="checkbox"
                  checked={selectedTasks.size === paginatedTasks.length && paginatedTasks.length > 0}
                  onChange={handleSelectAll}
                  className={styles.checkbox}
                />
              </th>
              <th
                className={styles.sortableHeader}
                onClick={() => handleSort('type')}
              >
                Task Type
                {sortBy === 'type' && (
                  <span className={styles.sortIndicator}>
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th
                className={styles.sortableHeader}
                onClick={() => handleSort('url')}
              >
                URL
                {sortBy === 'url' && (
                  <span className={styles.sortIndicator}>
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th>Status</th>
              <th>Artifact</th>
              <th
                className={styles.sortableHeader}
                onClick={() => handleSort('created_at')}
              >
                Created
                {sortBy === 'created_at' && (
                  <span className={styles.sortIndicator}>
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.map(task => (
              <tr key={task.id} className={styles.row}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task.id)}
                    onChange={() => handleSelectTask(task.id)}
                    className={styles.checkbox}
                  />
                </td>
                <td className={styles.taskType}>
                  {/* Handle both run history (nested) and task list (flat) data structures */}
                  {formatTaskType(task.automation_tasks?.name || task.type)}
                </td>
                <td className={styles.url}>
                  {/* Handle both run history (nested) and task list (flat) data structures */}
                  <a href={task.automation_tasks?.url || task.url} target="_blank" rel="noopener noreferrer">
                    {task.automation_tasks?.url || task.url}
                  </a>
                </td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
                <td>
                  {task.artifact_url ? (
                    <a href={task.artifact_url} target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.date}>
                  {formatDateTime(task.started_at || task.created_at)}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      onClick={() => onView?.(task)}
                      className={styles.actionButton}
                      title="View Details"
                    >
                      👁
                    </button>
                    <button
                      onClick={() => onEdit?.(task)}
                      className={styles.actionButton}
                      title="Edit Task"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete?.(task.id)}
                      className={styles.actionButton}
                      title="Delete Task"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            Previous
          </button>

          <span className={styles.paginationInfo}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={styles.paginationButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

TaskList.propTypes = {
  tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onView: PropTypes.func,
};

TaskList.defaultProps = {
  onEdit: () => {},
  onDelete: () => {},
  onView: () => {},
};

export default TaskList;
