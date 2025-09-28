import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './TaskList.module.css';
import StatusBadge from '../StatusBadge/StatusBadge';
import { FiDownload, FiExternalLink } from 'react-icons/fi';
import { formatDateTime, formatTaskType } from '../../utils/formatters';

const TaskList = ({ tasks, onEdit, onDelete, onView }) => {
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());

  const handleFileDownload = async (task) => {
    if (!task.artifact_url) return;
    
    setDownloadingFiles(prev => new Set(prev).add(task.id));
    
    try {
      // Create a safe download method that doesn't cause black screen
      const response = await fetch(task.artifact_url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf,application/octet-stream,*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Get filename from URL or create a default one
      const urlPath = new URL(task.artifact_url).pathname;
      const filename = urlPath.split('/').pop() || `task-${task.id}-result.pdf`;
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link opening in new tab
      window.open(task.artifact_url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  // Helper to get the task type with fallbacks
  const getTaskType = (task) =>
    task.automation_tasks?.name ||
    task.type ||
    task.task_type ||
    task.taskType ||
    '';

  // Helper to get the task URL with fallback
  const getTaskUrl = (task) =>
    task.automation_tasks?.url || task.url || '';

  // Memoize filtered and sorted tasks to prevent recalculation on every render
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const taskName = getTaskType(task);
        const taskUrl = getTaskUrl(task);

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
          aValue = getTaskType(a);
          bValue = getTaskType(b);
        } else if (sortBy === 'url') {
          aValue = getTaskUrl(a);
          bValue = getTaskUrl(b);
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
  }, [tasks, searchTerm, filterStatus, sortBy, sortOrder]);

  // Memoize pagination calculations
  const { totalPages, paginatedTasks } = useMemo(() => {
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage);
    return { totalPages, paginatedTasks };
  }, [filteredTasks, currentPage, itemsPerPage]);

  const handleSelectTask = useCallback((taskId) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  }, [selectedTasks]);

  const handleSelectAll = useCallback(() => {
    if (selectedTasks.size === paginatedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(paginatedTasks.map(task => task.id)));
    }
  }, [selectedTasks.size, paginatedTasks]);

  const handleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

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
                  {formatTaskType(getTaskType(task))}
                </td>
                <td className={styles.url}>
                  <a href={getTaskUrl(task)} target="_blank" rel="noopener noreferrer">
                    {getTaskUrl(task)}
                  </a>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={task.status} />
                    {useMemo(() => {
                      try {
                        const r = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
                        if (r?.simulated || r?.mode === 'embedded') {
                          return <span style={{ fontSize: 12, padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-muted)' }}>Simulated</span>;
                        }
                      } catch (_) {}
                      return null;
                    }, [task.result])}
                  </div>
                </td>
                <td>
                  {task.artifact_url ? (
                    <button
                      onClick={() => handleFileDownload(task)}
                      className={styles.downloadButton}
                      disabled={downloadingFiles.has(task.id)}
                      title="Download Result File"
                    >
                      {downloadingFiles.has(task.id) ? (
                        <span className={styles.spinner}></span>
                      ) : (
                        <FiDownload />
                      )}
                      {downloadingFiles.has(task.id) ? 'Downloading...' : 'Download'}
                    </button>
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
