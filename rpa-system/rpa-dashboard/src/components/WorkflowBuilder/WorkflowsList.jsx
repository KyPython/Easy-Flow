import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase, { initSupabase } from '../../utils/supabaseClient';
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
  FaHistory
} from 'react-icons/fa';
import PropTypes from 'prop-types';

const WorkflowsList = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const client = await initSupabase();
      const { data, error } = await client
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
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
      console.error('Error deleting workflow:', err);
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
        confirmText={deleting ? 'Deleting…' : 'Delete'}
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