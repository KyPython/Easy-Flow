import React, { useState, useMemo, useCallback, Fragment, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './TaskList.module.css';
import StatusBadge from '../StatusBadge/StatusBadge';
import { FiDownload, FiExternalLink } from 'react-icons/fi';
import { formatDateTime, formatTaskType } from '../../utils/formatters';
import { fetchWithAuth } from '../../utils/devNetLogger';
import { validateUrl, sanitizeFilename, safeWindowOpen } from '../../utils/security';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TaskList');

// Queue Status Badge Component
const QueueStatusBadge = ({ taskId, queuedAt, timeSinceStart }) => {
 const [queueInfo, setQueueInfo] = useState(null);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 const fetchQueueStatus = async () => {
 if (timeSinceStart < 5) return; // Don't fetch for very new tasks
 setLoading(true);
 try {
 const response = await fetchWithAuth('/api/queue/status');
 if (response.ok) {
 const data = await response.json();
 const taskInfo = data.tasks?.find(t => t.task_id === taskId);
 setQueueInfo(taskInfo || null);
 }
		} catch (e) {
			// Silently fail - queue info is nice to have but not critical
			logger.debug('[QueueStatusBadge] fetchQueueStatus failed', { error: e?.message || e });
		} finally {
 setLoading(false);
 }
 };

 fetchQueueStatus();
 const { getConfig } = require('../../utils/dynamicConfig');
 const refreshInterval = getConfig('intervals.queueStatus', 10000);
 const interval = setInterval(fetchQueueStatus, refreshInterval);
 return () => clearInterval(interval);
 }, [taskId, timeSinceStart]);

 const { getConfig } = require('../../utils/dynamicConfig');
 const stuckThresholdSeconds = getConfig('thresholds.queueStuckMinutes', 10) * 60;
 const isStuck = timeSinceStart > stuckThresholdSeconds;
 const position = queueInfo?.position;
 const estimatedWait = queueInfo?.estimated_wait_display;

 return (
 <span 
 style={{ 
 fontSize: '11px', 
 color: isStuck ? '#dc3545' : 'var(--text-muted)',
 fontStyle: 'italic',
 fontWeight: isStuck ? 600 : 'normal'
 }}
 title={
 isStuck 
 ? "⚠️ This task appears stuck. It was submitted before system fixes and won't process automatically. Submit a new task instead."
 : position
 ? `Position ${position} in queue. Estimated wait: ${estimatedWait || 'calculating...'}`
 : queueInfo?.queue_health?.worker_healthy === false
 ? "⚠️ Worker may be unavailable. Tasks are queued but not processing."
 : "Tasks are processed by workers. Typical wait time: 1-30 seconds depending on queue length."
 }
 >
 {timeSinceStart < 60 
 ? `Queued ${timeSinceStart}s ago` 
 : `Queued ${Math.floor(timeSinceStart / 60)}m ago`}
 {position && ` * Position ${position}`}
 {estimatedWait && ` * ~${estimatedWait}`}
 {isStuck && ' ⚠️'}
 {queueInfo?.queue_health?.worker_healthy === false && ' 🔴'}
 </span>
 );
};

const TaskList = ({ tasks, onEdit, onDelete, onView }) => {
 const [selectedTasks, setSelectedTasks] = useState(new Set());
 const [sortBy, setSortBy] = useState('created_at');
 const [sortOrder, setSortOrder] = useState('desc');
 const [filterStatus, setFilterStatus] = useState('all');
 const [searchTerm, setSearchTerm] = useState('');
 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 10;
 const [downloadingFiles, setDownloadingFiles] = useState(new Set());
 const [expandedRows, setExpandedRows] = useState(new Set()); // ✅ UX: Inline expandable rows
 const [compactView, setCompactView] = useState(false); // ✅ UX: Compact view option

 const handleFileDownload = async (task) => {
 if (!task.artifact_url) return;
 
 setDownloadingFiles(prev => new Set(prev).add(task.id));
 
 try {
 // Use a safe fetch reference (globalThis) to support polyfilled/mocked environments
 const fnFetch = (typeof globalThis !== 'undefined' && globalThis.fetch) || (typeof window !== 'undefined' && window.fetch);
 if (!fnFetch) throw new Error('Fetch API not available');

 // Create a safe download method that doesn't cause black screen
 const response = await fnFetch(task.artifact_url, {
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
 
 // ✅ SECURITY: Validate URL and sanitize filename to prevent XSS
 const urlValidation = validateUrl(task.artifact_url);
 if (!urlValidation.valid) {
 throw new Error(`Invalid artifact URL: ${urlValidation.error}`);
 }
 
 // Get filename from URL or create a default one
 const urlPath = new URL(task.artifact_url).pathname;
 const filename = sanitizeFilename(urlPath.split('/').pop() || `task-${task.id}-result.pdf`);
 
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
 // ✅ ENV-AWARE: Use logger instead of direct console.error
 logger.error('Download failed', error);
 // ✅ SECURITY: Use safe window.open with URL validation
 safeWindowOpen(task.artifact_url);
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
 
 {/* ✅ UX: Compact view toggle */}
 <button
 onClick={() => setCompactView(!compactView)}
 className={styles.compactToggle}
 title={compactView ? "Switch to detailed view" : "Switch to compact view"}
 >
 {compactView ? '📋' : '📄'}
 </button>
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
 {paginatedTasks.map(task => {
 const isExpanded = expandedRows.has(task.id);
 const toggleExpand = () => {
 const newExpanded = new Set(expandedRows);
 if (isExpanded) {
 newExpanded.delete(task.id);
 } else {
 newExpanded.add(task.id);
 }
 setExpandedRows(newExpanded);
 };
 
 // Parse result for quick preview
 let resultPreview = null;
 try {
 const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
 if (result?.data || result?.message) {
 resultPreview = result;
 }
	} catch (e) {
		logger.debug('Error parsing result', { error: e?.message || e });
	}
 
 return (
 <Fragment key={task.id}>
 <tr 
 className={`${styles.row} ${isExpanded ? styles.expandedRow : ''} ${compactView ? styles.compactRow : ''}`}
 onClick={toggleExpand}
 style={{ cursor: 'pointer' }}
 >
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
 {(() => {
 // ✅ SECURITY: Validate URL before using in href to prevent XSS
 const taskUrl = getTaskUrl(task);
 const urlValidation = validateUrl(taskUrl);
 if (!urlValidation.valid) {
 return <span className={styles.invalidUrl}>Invalid URL</span>;
 }
 return (
 <a href={urlValidation.url} target="_blank" rel="noopener noreferrer">
 {urlValidation.url}
 </a>
 );
 })()}
 </td>
 <td>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 {(() => {
 // ✅ FIX: Check result.status to show accurate status (handles cases where DB status is stale)
 // This ensures consistency between list view and detail view
 // Logic matches TaskResultModal for consistency
 let displayStatus = task.status; // Start with database status
 let isQueued = false;
 
 try {
 const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
 
 // Priority 1: If result has a status field, use that (most accurate - from Kafka)
 // This handles cases where Kafka updated the result but DB status is still 'running'
 if (result?.status && ['completed', 'failed', 'queued'].includes(result.status)) {
 displayStatus = result.status;
 isQueued = result.status === 'queued';
 } 
 // Priority 2: If task is 'running' but result indicates actual outcome, check for failure indicators
 // This matches TaskResultModal logic - check error field (which formatResult uses to determine failure)
 // IMPORTANT: Check result structure that Kafka stores - it can be nested
 else if (task.status === 'running' && result) {
 // Check for error indicators at multiple levels (matches TaskResultModal's formatResult)
 // Kafka stores: { ...resultData, status: result.status }
 // Where resultData can be result.result or result, and may have nested structures
 const hasError = result.error || 
 (typeof result.error === 'string' && result.error.length > 0) ||
 result.result?.error ||
 result.data?.error ||
 result.success === false ||
 (result.success !== undefined && !result.success && result.error !== undefined);
 
 if (hasError) {
 displayStatus = 'failed';
 } 
 // Check if result indicates queued state
 else if (result.status === 'queued' || result.queue_status === 'pending') {
 displayStatus = 'queued';
 isQueued = true;
 }
 }
 } catch (e) {
 // If parsing fails, just use the original status from database
 // ✅ ENV-AWARE: Use logger instead of direct console.warn
 logger.debug('Error parsing result', { error: e?.message || e });
 }
 
 // Calculate time since task was created
 const timeSinceStart = task.started_at 
 ? Math.floor((new Date() - new Date(task.started_at)) / 1000)
 : 0;
 
 // ✅ DYNAMIC: Stuck task threshold from config (non-hardcoded)
 const { getConfig } = require('../../utils/dynamicConfig');
 const STUCK_THRESHOLD_HOURS = getConfig('thresholds.stuckTaskHours', 24);
 const STUCK_THRESHOLD_SECONDS = STUCK_THRESHOLD_HOURS * 60 * 60;
 const isStuck = (displayStatus === 'running' || displayStatus === 'queued' || displayStatus === 'pending') 
 && timeSinceStart > STUCK_THRESHOLD_SECONDS;
 
 // If task is stuck, override status to 'failed' for display
 if (isStuck) {
 displayStatus = 'failed';
 }
 
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <StatusBadge status={displayStatus} />
 {isStuck && (
 <span 
 style={{ 
 fontSize: '11px', 
 color: '#dc3545',
 fontStyle: 'italic',
 fontWeight: 600
 }}
 title="This task has been stuck for over 24 hours. It was likely submitted before system fixes were applied. Please submit a new task instead."
 >
 ⚠️ Stuck
 </span>
 )}
 {isQueued && timeSinceStart > 0 && !isStuck && (
 <QueueStatusBadge 
 taskId={task.id}
 queuedAt={task.started_at}
 timeSinceStart={timeSinceStart}
 />
 )}
 </div>
 );
 })()}
 {useMemo(() => {
 try {
 const r = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
 if (r?.simulated || r?.mode === 'embedded') {
 return <span style={{ fontSize: 12, padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-muted)' }}>Simulated</span>;
 }
		} catch (err) {
			logger.debug('useMemo parse error', { error: err?.message || err });
		}
 return null;
 }, [task.result])}
 </div>
 </td>
 <td>
 {task.artifact_url ? (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
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
 <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
 {/* Files badge removed - database constraint prevents file records */}
 </span>
 </div>
 ) : task.status === 'completed' ? (
 <span className={styles.muted} style={{ fontSize: '12px' }}>
 No file generated
 </span>
 ) : (
 <span className={styles.muted}>--</span>
 )}
 </td>
 <td className={styles.date}>
 {formatDateTime(task.started_at || task.created_at)}
 </td>
 <td onClick={(e) => e.stopPropagation()}>
 <div className={styles.actions}>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onView?.(task);
 }}
 className={styles.actionButton}
 title="View Full Details"
 >
 👁
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onEdit?.(task);
 }}
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
 {/* ✅ UX: Inline expandable preview row */}
 {isExpanded && (
 <tr className={styles.expandedPreviewRow}>
 <td colSpan="7" style={{ padding: '16px', background: '#f8f9fa', borderTop: 'none' }}>
 <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
 <div style={{ flex: 1 }}>
 <strong>Quick Preview:</strong>
 {resultPreview ? (
 <div style={{ marginTop: '8px', fontSize: '14px' }}>
 {resultPreview.message && (
 <p style={{ margin: '4px 0' }}>{resultPreview.message}</p>
 )}
 {resultPreview.data?.title && (
 <p style={{ margin: '4px 0' }}><strong>Title:</strong> {resultPreview.data.title}</p>
 )}
 {task.artifact_url && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleFileDownload(task);
 }}
 style={{
 marginTop: '8px',
 padding: '6px 12px',
 background: '#0066cc',
 color: 'white',
 border: 'none',
 borderRadius: '4px',
 cursor: 'pointer'
 }}
 >
 📥 Download File
 </button>
 )}
 </div>
 ) : (
 <p style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
 {task.status === 'queued' || task.status === 'running' 
 ? 'Task is still processing...' 
 : 'No result data available'}
 </p>
 )}
 </div>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onView?.(task);
 }}
 style={{
 padding: '8px 16px',
 background: '#0066cc',
 color: 'white',
 border: 'none',
 borderRadius: '4px',
 cursor: 'pointer',
 fontWeight: 600
 }}
 >
 View Full Details ->
 </button>
 </div>
 </td>
 </tr>
 )}
 </Fragment>
 )})}
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
