import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './WorkflowVersionHistory.module.css';
import {
 FaHistory,
 FaCodeBranch,
 FaDownload,
 FaUndo,
 FaEye,
 FaCompressArrowsAlt,
 FaExclamationTriangle,
 FaClock,
 FaUser,
 FaComment,
 FaTag,
 FaChartLine,
 FaFilter,
 FaSync
} from 'react-icons/fa';
import supabase, { initSupabase } from '../../utils/supabaseClient';
import { api } from '../../utils/api';
import { createLogger } from '../../utils/logger';
const logger = createLogger('WorkflowVersionHistory');
import PlanGate from '../PlanGate/PlanGate';
import { useTheme } from '../../utils/ThemeContext';

const WorkflowVersionHistory = ({ workflowId, workflowName, onClose }) => {
 const { theme } = useTheme();
 const [versions, setVersions] = useState([]);
 const [statistics, setStatistics] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [selectedVersions, setSelectedVersions] = useState([]);
 const [compareMode, setCompareMode] = useState(false);
 const [comparisonData, setComparisonData] = useState(null);
 const [rollbackPreview, setRollbackPreview] = useState(null);
 const [activeTab, setActiveTab] = useState('history');

 useEffect(() => {
 if (workflowId) {
 loadVersionData();
 }
 }, [workflowId]);

 const loadVersionData = async () => {
 try {
 setLoading(true);
 setError(null);

 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;

 if (!token) {
 throw new Error('Authentication required');
 }

 // Load versions and statistics in parallel using centralized api
 // Use Promise.allSettled to handle partial failures gracefully
 const [versionsResult, statsResult] = await Promise.allSettled([
 api.get(`/api/workflows/${workflowId}/versions?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
 api.get(`/api/workflows/${workflowId}/versions/statistics`, { headers: { Authorization: `Bearer ${token}` } })
 ]);

 // Handle versions response
 if (versionsResult.status === 'fulfilled') {
 setVersions(versionsResult.value?.data?.data?.versions || versionsResult.value?.data?.versions || []);
 } else {
 const versionsErr = versionsResult.reason;
 // ✅ UX: Handle 404 gracefully - feature may not be implemented yet
 if (versionsErr.response?.status === 404) {
 logger.warn('Workflow versioning endpoint not available:', versionsErr.response?.status);
 setVersions([]); // Set empty array instead of showing error
 } else {
 throw versionsErr; // Re-throw non-404 errors
 }
 }

 // Handle statistics response
 if (statsResult.status === 'fulfilled') {
 setStatistics(statsResult.value?.data?.data || statsResult.value?.data || null);
 } else {
 const statsErr = statsResult.reason;
 // ✅ UX: Handle 404 gracefully - feature may not be implemented yet
 if (statsErr.response?.status === 404) {
 logger.warn('Workflow version statistics endpoint not available:', statsErr.response?.status);
 setStatistics(null); // Set null instead of showing error
 } else {
 // Only set error if versions also failed (to avoid duplicate error messages)
 if (versionsResult.status === 'rejected' && versionsResult.reason.response?.status !== 404) {
 throw statsErr;
 }
 }
 }

 // Only show error if both requests failed with non-404 errors
 if (versionsResult.status === 'rejected' && statsResult.status === 'rejected') {
 const versionsErr = versionsResult.reason;
 const statsErr = statsResult.reason;
 
 if (versionsErr.response?.status !== 404 && statsErr.response?.status !== 404) {
 // Both failed with non-404 errors - show error message
 if (versionsErr.response?.status === 403 || statsErr.response?.status === 403) {
 setError('Version history is not available on your current plan. Please upgrade to access this feature.');
 } else if (versionsErr.response?.status === 401 || statsErr.response?.status === 401) {
 setError('Please sign in to view version history.');
 } else {
 setError(versionsErr.response?.data?.error || versionsErr.message || 'Failed to load version history. Please try again.');
 }
 }
 // If both are 404, silently handle (feature not implemented)
 }

 } catch (err) {
 logger.error('Failed to load version data:', err);
 
 // ✅ UX: Handle 403 errors with user-friendly message
 if (err.response?.status === 403 || err.message?.includes('403')) {
 setError('Version history is not available on your current plan. Please upgrade to access this feature.');
 } else if (err.response?.status === 401) {
 setError('Please sign in to view version history.');
 } else if (err.response?.status === 404) {
 // ✅ UX: Handle 404 gracefully - feature may not be implemented yet
 setVersions([]);
 setStatistics(null);
 // Don't set error message for 404 - feature may not be available
 } else {
 setError(err.response?.data?.error || err.message || 'Failed to load version history. Please try again.');
 }
 } finally {
 setLoading(false);
 }
 };

 const handleVersionSelect = (version) => {
 if (compareMode) {
 setSelectedVersions(prev => {
 const isSelected = prev.find(v => v.version_number === version.version_number);
 if (isSelected) {
 return prev.filter(v => v.version_number !== version.version_number);
 } else if (prev.length < 2) {
 return [...prev, version];
 } else {
 return [prev[1], version]; // Replace first selection
 }
 });
 }
 };

 const compareVersions = async () => {
 if (selectedVersions.length !== 2) return;

 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;

 const [v1, v2] = selectedVersions.sort((a, b) => a.version_number - b.version_number);

 const resp = await api.get(`/api/workflows/${workflowId}/versions/${v1.version_number}/compare/${v2.version_number}`, { headers: { Authorization: `Bearer ${token}` } });
 setComparisonData(resp?.data?.data || null);

 } catch (err) {
 logger.error('Failed to compare versions:', err);
 
 // ✅ UX: Handle 403 errors with user-friendly message
 if (err.response?.status === 403 || err.message?.includes('403')) {
 setError('Version comparison is not available on your current plan. Please upgrade to access this feature.');
 } else {
 setError(err.response?.data?.error || err.message || 'Failed to compare versions. Please try again.');
 }
 }
 };

 const previewRollback = async (version) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;

 const resp = await api.get(`/api/workflows/${workflowId}/versions/${version.version_number}/preview`, { headers: { Authorization: `Bearer ${token}` } });
 setRollbackPreview(resp?.data?.data || null);

 } catch (err) {
 logger.error('Failed to preview rollback:', err);
 
 // ✅ UX: Handle 403 errors with user-friendly message
 if (err.response?.status === 403 || err.message?.includes('403')) {
 setError('Version rollback is not available on your current plan. Please upgrade to access this feature.');
 } else {
 setError(err.response?.data?.error || err.message || 'Failed to preview rollback. Please try again.');
 }
 }
 };

 const rollbackToVersion = async (version, comment) => {
 if (!window.confirm(`Are you sure you want to rollback to version ${version.version_number}? This action cannot be undone.`)) {
 return;
 }

 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;

 await api.post(`/api/workflows/${workflowId}/versions/${version.version_number}/rollback`, { rollbackComment: comment }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
 // Reload data and show success
 await loadVersionData();
 setRollbackPreview(null);
 alert(`Successfully rolled back to version ${version.version_number}`);

 } catch (err) {
 logger.error('Failed to rollback version:', err);
 
 // ✅ UX: Handle 403 errors with user-friendly message
 if (err.response?.status === 403 || err.message?.includes('403')) {
 setError('Version rollback is not available on your current plan. Please upgrade to access this feature.');
 alert('Version rollback is not available on your current plan. Please upgrade to access this feature.');
 } else {
 const errorMsg = err.response?.data?.error || err.message || 'Failed to rollback version. Please try again.';
 setError(errorMsg);
 alert(errorMsg);
 }
 }
 };

 const exportVersion = async (version) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;

 const resp = await api.post(`/api/workflows/${workflowId}/versions/${version.version_number}/export`, null, { headers: { Authorization: `Bearer ${token}` } });
 const exportData = resp?.data;
 // Trigger download
 const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `workflow-${workflowId}-v${version.version_number}.json`;
 a.click();
 URL.revokeObjectURL(url);

 } catch (err) {
 logger.error('Failed to export version:', err);
 
 // ✅ UX: Handle 403 errors with user-friendly message
 if (err.response?.status === 403 || err.message?.includes('403')) {
 setError('Version export is not available on your current plan. Please upgrade to access this feature.');
 } else {
 setError(err.response?.data?.error || err.message || 'Failed to export version. Please try again.');
 }
 }
 };

 const formatDate = (dateString) => {
 return new Date(dateString).toLocaleString();
 };

 const getChangeTypeIcon = (changeType) => {
 switch (changeType) {
 case 'manual': return <FaUser />;
 case 'auto': return <FaSync />;
 case 'rollback': return <FaUndo />;
 case 'import': return <FaDownload />;
 default: return <FaTag />;
 }
 };

 const getChangeTypeColor = (changeType) => {
 switch (changeType) {
 case 'manual': return 'blue';
 case 'auto': return 'gray';
 case 'rollback': return 'orange';
 case 'import': return 'purple';
 default: return 'gray';
 }
 };

 return (
 <PlanGate 
 feature="workflow_versioning"
 upgradeMessage="Workflow versioning and rollback requires a Professional or Enterprise plan for advanced workflow management."
 onPaywallClose={() => {
 logger.info('WorkflowVersionHistory paywall dismissed, closing modal');
 onClose();
 }}
 >
 {loading ? (
 <div className={styles.modal}>
 <div className={styles.modalContent}>
 <div className={styles.loading}>
 <div className={styles.spinner} />
 <p>Loading version history...</p>
 </div>
 </div>
 </div>
 ) : (
 <div className={styles.modal}>
 <div className={styles.modalContent}>
 <div className={styles.header}>
 <div className={styles.titleSection}>
 <FaHistory className={styles.titleIcon} />
 <div>
 <h2>Version History</h2>
 <p>"{workflowName}" - {versions.length} versions</p>
 </div>
 </div>
 
 <div className={styles.headerActions}>
 <button
 className={`${styles.toggleButton} ${compareMode ? styles.active : ''}`}
 onClick={() => {
 setCompareMode(!compareMode);
 setSelectedVersions([]);
 setComparisonData(null);
 }}
 >
 <FaCompressArrowsAlt />
 {compareMode ? 'Exit Compare' : 'Compare Versions'}
 </button>
 
 <button className={styles.closeButton} onClick={onClose}>
 ×
 </button>
 </div>
 </div>

 {error && (
 <div className={styles.errorMessage}>
 <FaExclamationTriangle />
 <span>{error}</span>
 {error.includes('not available on your current plan') ? (
 <button 
 onClick={() => {
 // Navigate to pricing page
 window.location.href = '/pricing';
 }} 
 className={styles.upgradeButton}
 >
 Upgrade Plan
 </button>
 ) : (
 <button onClick={loadVersionData} className={styles.retryButton}>
 <FaSync />
 Retry
 </button>
 )}
 </div>
 )}

 <div className={styles.tabs}>
 <button
 className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
 onClick={() => setActiveTab('history')}
 >
 <FaHistory />
 Version History
 </button>
 {statistics && (
 <button
 className={`${styles.tab} ${activeTab === 'statistics' ? styles.active : ''}`}
 onClick={() => setActiveTab('statistics')}
 >
 <FaChartLine />
 Statistics
 </button>
 )}
 </div>

 <div className={styles.content}>
 {activeTab === 'history' && (
 <div className={styles.historyTab}>
 {compareMode && (
 <div className={styles.compareSection}>
 <div className={styles.compareHeader}>
 <h3>
 <FaCompressArrowsAlt />
 Compare Versions ({selectedVersions.length}/2 selected)
 </h3>
 {selectedVersions.length === 2 && (
 <button
 className={styles.compareButton}
 onClick={compareVersions}
 >
 Compare Selected
 </button>
 )}
 </div>
 
 {selectedVersions.length > 0 && (
 <div className={styles.selectedVersions}>
 {selectedVersions.map(version => (
 <div key={version.version_number} className={styles.selectedVersion}>
 <span>Version {version.version_number}</span>
 <span>{formatDate(version.created_at)}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 <div className={styles.versionsList}>
 {versions.map((version) => (
 <div
 key={version.version_number}
 className={`${styles.versionCard} ${
 compareMode && selectedVersions.find(v => v.version_number === version.version_number)
 ? styles.selected
 : ''
 }`}
 onClick={() => compareMode && handleVersionSelect(version)}
 >
 <div className={styles.versionHeader}>
 <div className={styles.versionInfo}>
 <div className={styles.versionNumber}>
 <FaCodeBranch />
 Version {version.version_number}
 </div>
 <div className={`${styles.changeType} ${styles[getChangeTypeColor(version.change_type)]}`}>
 {getChangeTypeIcon(version.change_type)}
 {version.change_type}
 </div>
 </div>
 
 <div className={styles.versionMeta}>
 <span className={styles.timestamp}>
 <FaClock />
 {formatDate(version.created_at)}
 </span>
 </div>
 </div>

 {version.change_comment && (
 <div className={styles.changeComment}>
 <FaComment />
 {version.change_comment}
 </div>
 )}

 {version.metadata && (
 <div className={styles.metadata}>
 <span>Steps: {version.metadata.steps_count}</span>
 <span>Connections: {version.metadata.connections_count}</span>
 {version.metadata.workflow_complexity && (
 <span>Complexity: {version.metadata.workflow_complexity}</span>
 )}
 </div>
 )}

 {!compareMode && (
 <div className={styles.versionActions}>
 <button
 className={styles.actionButton}
 onClick={(e) => {
 e.stopPropagation();
 previewRollback(version);
 }}
 title="Preview rollback"
 >
 <FaEye />
 </button>
 
 <button
 className={styles.actionButton}
 onClick={(e) => {
 e.stopPropagation();
 exportVersion(version);
 }}
 title="Export version"
 >
 <FaDownload />
 </button>
 
 {version.version_number < statistics?.latest_version && (
 <button
 className={`${styles.actionButton} ${styles.rollback}`}
 onClick={(e) => {
 e.stopPropagation();
 const comment = prompt('Enter rollback comment (optional):');
 if (comment !== null) {
 rollbackToVersion(version, comment);
 }
 }}
 title="Rollback to this version"
 >
 <FaUndo />
 </button>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'statistics' && statistics && (
 <div className={styles.statisticsTab}>
 <div className={styles.statsGrid}>
 <div className={styles.statCard}>
 <h3>Total Versions</h3>
 <div className={styles.statValue}>{statistics.total_versions}</div>
 </div>
 
 <div className={styles.statCard}>
 <h3>Latest Version</h3>
 <div className={styles.statValue}>{statistics.latest_version}</div>
 </div>
 
 <div className={styles.statCard}>
 <h3>Version Frequency</h3>
 <div className={styles.frequencyChart}>
 {Object.entries(statistics.version_frequency).map(([month, count]) => (
 <div key={month} className={styles.frequencyItem}>
 <span>{month}</span>
 <span>{count}</span>
 </div>
 ))}
 </div>
 </div>
 
 <div className={styles.statCard}>
 <h3>By Change Type</h3>
 <div className={styles.changeTypeStats}>
 {Object.entries(statistics.by_change_type).map(([type, count]) => (
 <div key={type} className={styles.changeTypeStat}>
 <span className={`${styles.typeIndicator} ${styles[getChangeTypeColor(type)]}`}>
 {getChangeTypeIcon(type)}
 </span>
 <span>{type}</span>
 <span>{count}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Comparison Modal */}
 {comparisonData && (
 <div className={styles.comparisonModal}>
 <div className={styles.comparisonContent}>
 <div className={styles.comparisonHeader}>
 <h3>Version Comparison</h3>
 <button
 className={styles.closeButton}
 onClick={() => setComparisonData(null)}
 >
 ×
 </button>
 </div>
 
 <div className={styles.comparisonBody}>
 <div className={styles.comparisonSummary}>
 <span>Version {comparisonData.from_version}</span>
 <span>→</span>
 <span>Version {comparisonData.to_version}</span>
 </div>
 
 {/* Display changes here */}
 <div className={styles.changesSection}>
 {Object.keys(comparisonData.changes.workflow).length > 0 && (
 <div className={styles.changeCategory}>
 <h4>Workflow Changes</h4>
 {Object.entries(comparisonData.changes.workflow).map(([field, change]) => (
 <div key={field} className={styles.change}>
 <strong>{field}:</strong> {change.from} → {change.to}
 </div>
 ))}
 </div>
 )}
 
 {comparisonData.changes.steps.added.length > 0 && (
 <div className={styles.changeCategory}>
 <h4>Added Steps ({comparisonData.changes.steps.added.length})</h4>
 {comparisonData.changes.steps.added.map((step, idx) => (
 <div key={idx} className={styles.addedStep}>
 + {step.name || step.step_type}
 </div>
 ))}
 </div>
 )}
 
 {comparisonData.changes.steps.removed.length > 0 && (
 <div className={styles.changeCategory}>
 <h4>Removed Steps ({comparisonData.changes.steps.removed.length})</h4>
 {comparisonData.changes.steps.removed.map((step, idx) => (
 <div key={idx} className={styles.removedStep}>
 - {step.name || step.step_type}
 </div>
 ))}
 </div>
 )}
 
 {comparisonData.changes.steps.modified.length > 0 && (
 <div className={styles.changeCategory}>
 <h4>Modified Steps ({comparisonData.changes.steps.modified.length})</h4>
 {comparisonData.changes.steps.modified.map((step, idx) => (
 <div key={idx} className={styles.modifiedStep}>
 ~ {step.to.name || step.to.step_type}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Rollback Preview Modal */}
 {rollbackPreview && (
 <div className={styles.rollbackModal}>
 <div className={styles.rollbackContent}>
 <div className={styles.rollbackHeader}>
 <h3>
 <FaExclamationTriangle />
 Rollback Preview
 </h3>
 <button
 className={styles.closeButton}
 onClick={() => setRollbackPreview(null)}
 >
 ×
 </button>
 </div>
 
 <div className={styles.rollbackBody}>
 <div className={styles.rollbackWarning}>
 <p>{rollbackPreview.warning}</p>
 </div>
 
 <div className={styles.rollbackSummary}>
 <p>
 Rolling back from version {rollbackPreview.current_version} to version {rollbackPreview.target_version}
 </p>
 </div>
 
 {/* Show preview changes similar to comparison */}
 <div className={styles.rollbackActions}>
 <button
 className={styles.cancelButton}
 onClick={() => setRollbackPreview(null)}
 >
 Cancel
 </button>
 <button
 className={styles.confirmButton}
 onClick={() => {
 const comment = prompt('Enter rollback comment (optional):');
 if (comment !== null) {
 const targetVersion = versions.find(v => v.version_number === rollbackPreview.target_version);
 rollbackToVersion(targetVersion, comment);
 }
 }}
 >
 <FaUndo />
 Confirm Rollback
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </PlanGate>
 );
};

WorkflowVersionHistory.propTypes = {
 workflowId: PropTypes.string.isRequired,
 workflowName: PropTypes.string.isRequired,
 onClose: PropTypes.func.isRequired
};

export default WorkflowVersionHistory;
