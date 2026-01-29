import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase, { initSupabase } from '../../utils/supabaseClient';
import { useAuth } from '../../utils/AuthContext';
import { usePerformanceTracking } from '../../utils/telemetry';
import styles from './WorkflowsList.module.css';
import LoadingSpinner from './LoadingSpinner';
import ActionButton from './ActionButton';
import ConfirmDialog from './ConfirmDialog';
import {
  FaPlus,
  FaEdit,
  FaPlay,
  FaTrash,
  FaClock,
  FaCheckCircle,
  FaPauseCircle,
  FaArchive,
  FaLayerGroup,
  FaHistory,
  FaRobot
} from 'react-icons/fa';
import PropTypes from 'prop-types';
import { useTheme } from '../../utils/ThemeContext';

const WorkflowsList = () => {
 const navigate = useNavigate();
 const { theme } = useTheme();
 const { user, loading: authLoading } = useAuth();
 const { trackApiCall } = usePerformanceTracking('WorkflowsList');
 const [workflows, setWorkflows] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [confirmOpen, setConfirmOpen] = useState(false);
 const [deletingId, setDeletingId] = useState(null);
 const [deleting, setDeleting] = useState(false);
 const retryCountRef = useRef(0);
 const maxRetries = 3;
 const retryDelay = 1000; // 1 second

 // Observability: Track component lifecycle
 useEffect(() => {
 const startTime = performance.now();
 logger.debug('WorkflowsList component mounted, authLoading:', authLoading, 'user:', user?.email || 'none');
 
 return () => {
 const duration = performance.now() - startTime;
 logger.debug('WorkflowsList component unmounted after', duration.toFixed(2), 'ms');
 };
 }, [authLoading, user]);

 // Wait for auth to be ready before loading workflows
 useEffect(() => {
 // Don't load if auth is still loading
 if (authLoading) {
 logger.debug('WorkflowsList waiting for auth to finish loading...');
 return;
 }

 // Don't load if user is not authenticated (will be redirected by parent)
 if (!user) {
 logger.debug('WorkflowsList no user, skipping workflow load');
 setLoading(false);
 return;
 }

 // Load workflows once auth is ready
 logger.debug('WorkflowsList auth ready, loading workflows for user:', user.email);
 loadWorkflows();
 }, [user, authLoading]);

 const loadWorkflows = async (retryAttempt = 0) => {
 const loadStartTime = performance.now();
  logger.debug(`WorkflowsList loadWorkflows called (attempt ${retryAttempt + 1}/${maxRetries + 1})`);
 
 // OpenTelemetry tracing
 const apiTracker = trackApiCall('GET', 'supabase/workflows', {
 userId: user?.id,
 operation: 'load_workflows',
 retryAttempt: retryAttempt + 1
 });
 
 try {
 setLoading(true);
 setError(null);

 // Initialize Supabase with timeout
 const initStartTime = performance.now();
 const client = await Promise.race([
 initSupabase(),
 new Promise((_, reject) => 
 setTimeout(() => reject(new Error('Supabase initialization timeout')), 5000)
 )
 ]);
 const initDuration = performance.now() - initStartTime;
 logger.debug(`WorkflowsList Supabase initialized in ${initDuration.toFixed(2)}ms`);
 apiTracker.addAttribute('supabase.init_duration_ms', initDuration);

 // Check if we got a real client or a stub
 if (!client || !client.from) {
 throw new Error('Supabase client not properly initialized');
 }

 // Query workflows with timeout and user filtering
 // CRITICAL: Filter by user_id to ensure RLS policies work correctly and improve performance
 const queryStartTime = performance.now();
 
 // Get current user ID from auth session
 const { data: { user } } = await client.auth.getUser();
 if (!user || !user.id) {
 throw new Error('User not authenticated');
 }
 
 const { data, error: queryError } = await Promise.race([
 client
 .from('workflows')
 .select(`
 id,
 name,
 description,
 status,
 created_at,
 updated_at,
 total_executions,
 successful_executions,
 failed_executions
 `)
 .eq('user_id', user.id) // CRITICAL: Filter by user_id for RLS and performance
 .order('updated_at', { ascending: false })
 .limit(100), // Add limit to prevent large result sets
 new Promise((_, reject) => 
 setTimeout(() => reject(new Error('Query timeout')), 10000)
 )
 ]);
 const queryDuration = performance.now() - queryStartTime;
 logger.debug(`WorkflowsList query completed in ${queryDuration.toFixed(2)}ms, found ${data?.length || 0} workflows`);
 
 apiTracker.addAttribute('supabase.query_duration_ms', queryDuration);
 apiTracker.addAttribute('workflows.count', data?.length || 0);

 if (queryError) {
 logger.error('WorkflowsList query error:', queryError);
 apiTracker.setError(queryError);
 throw queryError;
 }

 setWorkflows(data || []);
 retryCountRef.current = 0; // Reset retry count on success
 setLoading(false); // ✅ FIX: Explicitly set loading to false on success
 
 const totalDuration = performance.now() - loadStartTime;
 logger.debug(`WorkflowsList successfully loaded ${data?.length || 0} workflows in ${totalDuration.toFixed(2)}ms`);
 
 apiTracker.addAttribute('total_duration_ms', totalDuration);
 apiTracker.setResponseData({ status: 200, workflows: data?.length || 0 });
 apiTracker.end();
 
 } catch (err) {
 const errorMessage = err?.message || err?.toString() || 'Unknown error';
 logger.error(`WorkflowsList error loading workflows: (attempt ${retryAttempt + 1}): ${errorMessage}`, err);
 
 apiTracker.addAttribute('error.message', errorMessage);
 apiTracker.addAttribute('error.retry_attempt', retryAttempt + 1);
 
 // Retry logic for transient errors
 if (retryAttempt < maxRetries && (
 errorMessage.includes('timeout') ||
 errorMessage.includes('network') ||
 errorMessage.includes('fetch') ||
 errorMessage.includes('Supabase not configured') ||
 errorMessage.includes('Supabase initialization timeout')
 )) {
 const delay = retryDelay * (retryAttempt + 1); // Exponential backoff
 logger.debug(`WorkflowsList retrying in ${delay}ms...`);
 apiTracker.addAttribute('retry.delay_ms', delay);
 apiTracker.addAttribute('retry.will_retry', true);
 apiTracker.end();
 
 retryCountRef.current = retryAttempt + 1;
 setTimeout(() => {
 loadWorkflows(retryAttempt + 1);
 }, delay);
 return; // Don't set error state yet, we're retrying
 }

 // Final failure - show error
 apiTracker.setError(err);
 apiTracker.addAttribute('retry.final_failure', true);
 apiTracker.end();
 
 setError(errorMessage);
 setLoading(false);
 retryCountRef.current = 0; // Reset retry count
 
 const totalDuration = performance.now() - loadStartTime;
 logger.error('WorkflowsList failed to load: workflows after ${retryAttempt + 1} attempts in ${totalDuration.toFixed(2)}ms`);
 }
 };

 const requestDelete = (id) => {
 setDeletingId(id);
 setConfirmOpen(true);
 };

 const cancelDelete = () => {
 setConfirmOpen(false);
 setDeletingId(null);
 };

 const confirmDelete = async () => {
 if (!deletingId) return;
 try {
 setDeleting(true);
 const client = await initSupabase();
 const { error } = await client
 .from('workflows')
 .delete()
 .eq('id', deletingId);

 if (error) throw error;

 // Optimistically update list
 setWorkflows((prev) => prev.filter((w) => w.id !== deletingId));
 setConfirmOpen(false);
 setDeletingId(null);
 } catch (err) {
 logger.error('Error deleting workflow:', err);
 alert(`Failed to delete workflow: ${err.message || err}`);
 } finally {
 setDeleting(false);
 }
 };

 const getStatusIcon = (status) => {
 switch (status) {
 case 'active': return <FaCheckCircle style={{ color: 'var(--color-success-600)' }} />;
 case 'paused': return <FaPauseCircle style={{ color: 'var(--color-warning-600)' }} />;
 case 'archived': return <FaArchive style={{ color: 'var(--text-muted)' }} />;
 default: return <FaEdit style={{ color: 'var(--color-primary-600)' }} />;
 }
 };

 const getStatusText = (status) => {
 switch (status) {
 case 'active': return 'Active';
 case 'paused': return 'Paused';
 case 'archived': return 'Archived';
 default: return 'Draft';
 }
 };

 if (loading) {
 return (
 <div className={styles.container}>
 <LoadingSpinner centered message="Loading your workflows..." />
 </div>
 );
 }

 if (error) {
 return (
 <div className={styles.container}>
 <div className={styles.errorState}>
 <h3>Error Loading Workflows</h3>
 <p>{error}</p>
 <ActionButton onClick={loadWorkflows}>Retry</ActionButton>
 </div>
 </div>
 );
 }

 return (
 <div className={styles.container}>
 <div className={styles.header}>
 <div className={styles.headerLeft}>
 <h1>Your Workflows</h1>
 <p>Manage and organize your automation workflows</p>
 </div>
      <div className={styles.headerActions}>
        <ActionButton
          variant="secondary"
          onClick={() => {
            // Trigger AI agent to open with discovery mode
            window.dispatchEvent(new CustomEvent('openAIAgent', { detail: { mode: 'discover' } }));
          }}
        >
          <FaRobot /> Suggest a Workflow
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => navigate('/app/workflows/templates')}
        >
          <FaLayerGroup /> Browse Templates
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={() => navigate('/app/workflows/builder')}
        >
          <FaPlus /> Create New Workflow
        </ActionButton>
      </div>
 </div>

 {workflows.length === 0 ? (
 <div className={styles.emptyState}>
 <div className={styles.emptyIcon}>⚡</div>
 <h3>No Workflows Yet</h3>
 <p>Create your first workflow to automate your tasks</p>
 <div className={styles.emptyActions}>
 <ActionButton
 variant="primary"
 onClick={() => navigate('/app/workflows/builder')}
 >
 <FaPlus /> Create New Workflow
 </ActionButton>
 <ActionButton
 variant="secondary"
 onClick={() => navigate('/app/workflows/templates')}
 >
 <FaLayerGroup /> Browse Templates
 </ActionButton>
 </div>
 </div>
 ) : (
 <div className={styles.workflowsGrid}>
 {workflows.map(workflow => (
 <WorkflowCard
 key={workflow.id}
 workflow={workflow}
 onEdit={() => navigate(`/app/workflows/builder/${workflow.id}`)}
 onRun={() => navigate(`/app/workflows/builder/${workflow.id}`)}
 onDelete={() => requestDelete(workflow.id)}
 />
 ))}
 </div>
 )}
 <ConfirmDialog
 isOpen={confirmOpen}
 onClose={cancelDelete}
 onConfirm={confirmDelete}
 title="Delete workflow"
 message="This will permanently delete the workflow and its data. This action cannot be undone."
 confirmText={deleting ? 'Deleting...' : 'Delete'}
 cancelText="Cancel"
 variant="danger"
 loading={deleting}
 />
 </div>
 );
};

const WorkflowCard = ({ workflow, onEdit, onRun, onDelete }) => {
 // Placeholder: In a real app, version info would be fetched from API or workflow object
 const version = workflow.version || 'v1';
 const getStatusIcon = (status) => {
 switch (status) {
 case 'active': return <FaCheckCircle style={{ color: 'var(--color-success-600)' }} />;
 case 'paused': return <FaPauseCircle style={{ color: 'var(--color-warning-600)' }} />;
 case 'archived': return <FaArchive style={{ color: 'var(--text-muted)' }} />;
 default: return <FaEdit style={{ color: 'var(--color-primary-600)' }} />;
 }
 };

 const getStatusText = (status) => {
 switch (status) {
 case 'active': return 'Active';
 case 'paused': return 'Paused';
 case 'archived': return 'Archived';
 default: return 'Draft';
 }
 };

 return (
 <div className={styles.workflowCard}>
 <div className={styles.cardHeader}>
 <div className={styles.cardTitle}>
 <h3>{workflow.name}</h3>
 <div className={styles.statusBadge}>
 {getStatusIcon(workflow.status)}
 <span>{getStatusText(workflow.status)}</span>
 </div>
 </div>
 <div className={styles.versionIndicator} title="View version history">
 <button
 className={styles.versionButton}
 onClick={() => onEdit && onEdit()}
 style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--color-primary-700)', cursor: 'pointer', fontSize: 14 }}
 >
 <FaHistory style={{ fontSize: 16 }} />
 <span style={{ fontWeight: 500 }}>Version</span>
 </button>
 </div>
 </div>

 <div className={styles.cardContent}>
 <p className={styles.description}>
 {workflow.description || 'No description provided'}
 </p>

 <div className={styles.stats}>
 <div className={styles.statItem}>
 <span className={styles.statLabel}>Total Runs:</span>
 <span className={styles.statValue}>{workflow.total_executions || 0}</span>
 </div>
 <div className={styles.statItem}>
 <span className={styles.statLabel}>Success Rate:</span>
 <span className={styles.statValue}>
 {workflow.total_executions > 0 
 ? Math.round((workflow.successful_executions / workflow.total_executions) * 100)
 : 0}%
 </span>
 </div>
 </div>

 <div className={styles.cardMeta}>
 <div className={styles.metaItem}>
 <FaClock />
 <span>Updated {new Date(workflow.updated_at).toLocaleDateString()}</span>
 </div>
 </div>
 </div>

 <div className={styles.cardActions}>
 <ActionButton
 variant="secondary"
 onClick={onEdit}
 >
 <FaEdit /> Edit
 </ActionButton>
 <ActionButton
 variant="primary"
 onClick={onRun}
 >
 <FaPlay /> Open
 </ActionButton>
 <ActionButton
 variant="danger"
 onClick={onDelete}
 aria-label={`Delete workflow ${workflow.name}`}
 >
 <FaTrash /> Delete
 </ActionButton>
 </div>
 </div>
 );
};

WorkflowCard.propTypes = {
 workflow: PropTypes.shape({
 id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
 name: PropTypes.string.isRequired,
 description: PropTypes.string,
 status: PropTypes.string,
 created_at: PropTypes.string,
 updated_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
 total_executions: PropTypes.number,
 successful_executions: PropTypes.number,
 failed_executions: PropTypes.number,
 }).isRequired,
 onEdit: PropTypes.func.isRequired,
 onRun: PropTypes.func.isRequired,
 onDelete: PropTypes.func.isRequired,
};

export default WorkflowsList;
