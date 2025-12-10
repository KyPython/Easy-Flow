import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './DataRetentionDashboard.module.css';
import {
  FaDatabase,
  FaTrashAlt,
  FaCog,
  FaPlay,
  FaStop,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCheckCircle,
  FaEye,
  FaEdit,
  FaCalendarAlt,
  FaChartBar
} from 'react-icons/fa';
import supabase, { initSupabase } from '../../utils/supabaseClient';
import PlanGate from '../PlanGate/PlanGate';
import { useTheme } from '../../utils/ThemeContext';

const DataRetentionDashboard = ({ user }) => {
  const { theme } = useTheme();
  const [retentionStatus, setRetentionStatus] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [cleanupResults, setCleanupResults] = useState(null);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    
    try {
      setLoading(true);
      setError(null);

      const client = await initSupabase();
      const { data: session } = await client.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        throw new Error('Authentication required');
      }

      const { api } = require('../../utils/api');
      const [statusRes, statsRes, policiesRes] = await Promise.all([
        api.get('/api/data-retention/status'),
        api.get('/api/data-retention/statistics'),
        api.get('/api/data-retention/policies')
      ]);

      setRetentionStatus(statusRes.data?.data || statusRes.data || null);
      setStatistics(statsRes.data?.data || statsRes.data || null);
      setPolicies(policiesRes.data?.data || policiesRes.data || null);

    } catch (err) {
      console.error('Failed to load data retention dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async (type = 'all') => {

    try {
      setIsRunningCleanup(true);
      setError(null);

      const client = await initSupabase();
      const { data: session } = await client.auth.getSession();
      const token = session?.session?.access_token;

      const { api } = require('../../utils/api');
      const { data: result } = await api.post('/api/data-retention/cleanup', { type });
      setCleanupResults(result?.data || result || null);
      
      // Reload statistics to reflect changes
      setTimeout(loadDashboardData, 1000);

    } catch (err) {
      console.error('Cleanup failed:', err);
      setError(err.message);
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const toggleScheduler = async (start) => {

    try {
      const client = await initSupabase();
      const { data: session } = await client.auth.getSession();
      const token = session?.session?.access_token;

      const { api } = require('../../utils/api');
      await api.post(`/api/data-retention/${start ? 'start' : 'stop'}`);

      // Reload status
      loadDashboardData();

    } catch (err) {
      console.error('Failed to toggle scheduler:', err);
      setError(err.message);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <PlanGate 
      feature="data_retention"
      upgradeMessage="Data retention management requires a Professional or Enterprise plan to ensure compliance and automated data cleanup."
      onPaywallClose={() => window.location.href = '/app'}
    >
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading data retention dashboard...</p>
        </div>
      ) : (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <FaDatabase className={styles.titleIcon} />
            <div>
              <h2>Data Retention Management</h2>
              <p>Monitor and manage automated data cleanup policies</p>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            {retentionStatus && (
              <div className={styles.statusIndicator}>
                <span className={`${styles.statusDot} ${retentionStatus.is_running ? styles.running : styles.stopped}`} />
                Scheduler: {retentionStatus.is_running ? 'Running' : 'Stopped'}
              </div>
            )}
            
            <button
              className={`${styles.toggleButton} ${retentionStatus?.is_running ? styles.stop : styles.start}`}
              onClick={() => toggleScheduler(!retentionStatus?.is_running)}
            >
              {retentionStatus?.is_running ? <FaStop /> : <FaPlay />}
              {retentionStatus?.is_running ? 'Stop Scheduler' : 'Start Scheduler'}
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <FaExclamationTriangle />
            {error}
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaChartBar />
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'policies' ? styles.active : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <FaCog />
          Policies
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'cleanup' ? styles.active : ''}`}
          onClick={() => setActiveTab('cleanup')}
        >
          <FaTrashAlt />
          Manual Cleanup
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            {statistics && (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                      <FaDatabase className={styles.statIcon} />
                      <h3>Audit Logs</h3>
                    </div>
                    <div className={styles.statContent}>
                      <div className={styles.statNumber}>{statistics.audit_logs.total?.toLocaleString() || 0}</div>
                      <div className={styles.statLabel}>Total Records</div>
                      {statistics.audit_logs.expired > 0 && (
                        <div className={styles.statWarning}>
                          <FaExclamationTriangle />
                          {statistics.audit_logs.expired} eligible for cleanup
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                      <FaPlay className={styles.statIcon} />
                      <h3>Workflow Executions</h3>
                    </div>
                    <div className={styles.statContent}>
                      <div className={styles.statNumber}>{statistics.workflow_executions.total?.toLocaleString() || 0}</div>
                      <div className={styles.statLabel}>Total Executions</div>
                      {statistics.workflow_executions.with_expired_sensitive_data > 0 && (
                        <div className={styles.statWarning}>
                          <FaExclamationTriangle />
                          {statistics.workflow_executions.with_expired_sensitive_data} with expired sensitive data
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                      <FaCog className={styles.statIcon} />
                      <h3>Step Executions</h3>
                    </div>
                    <div className={styles.statContent}>
                      <div className={styles.statNumber}>{statistics.step_executions.total?.toLocaleString() || 0}</div>
                      <div className={styles.statLabel}>Total Steps</div>
                    </div>
                  </div>
                </div>

                {retentionStatus && (
                  <div className={styles.scheduleInfo}>
                    <h3>
                      <FaCalendarAlt />
                      Scheduled Cleanup Times
                    </h3>
                    <div className={styles.scheduleGrid}>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>Audit Logs:</span>
                        <span className={styles.scheduleTime}>
                          {formatDate(retentionStatus.next_cleanup_times.audit_logs)}
                        </span>
                      </div>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>Executions:</span>
                        <span className={styles.scheduleTime}>
                          {formatDate(retentionStatus.next_cleanup_times.executions)}
                        </span>
                      </div>
                      <div className={styles.scheduleItem}>
                        <span className={styles.scheduleLabel}>Temp Files:</span>
                        <span className={styles.scheduleTime}>
                          {formatDate(retentionStatus.next_cleanup_times.temp_files)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'policies' && policies && (
          <div className={styles.policiesTab}>
            <div className={styles.policiesGrid}>
              {Object.entries(policies.policies).map(([dataType, policy]) => (
                <div key={dataType} className={styles.policyCard}>
                  <h3>{dataType.replace(/_/g, ' ').toUpperCase()}</h3>
                  <div className={styles.policyItems}>
                    {Object.entries(policy).map(([subType, days]) => (
                      <div key={subType} className={styles.policyItem}>
                        <span className={styles.policyLabel}>
                          {policies.descriptions[dataType]?.[subType] || subType}:
                        </span>
                        <span className={styles.policyValue}>
                          {days} {subType.includes('hours') ? 'hours' : 'days'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cleanup' && (
          <div className={styles.cleanupTab}>
            <div className={styles.cleanupSection}>
              <h3>Manual Data Cleanup</h3>
              <p>Run data cleanup operations manually. Use with caution as this will permanently delete data.</p>
              
              <div className={styles.cleanupButtons}>
                <button
                  className={`${styles.cleanupButton} ${styles.full}`}
                  onClick={() => runCleanup('all')}
                  disabled={isRunningCleanup}
                >
                  <FaTrashAlt />
                  {isRunningCleanup ? 'Running...' : 'Run Full Cleanup'}
                </button>
                
                <button
                  className={`${styles.cleanupButton} ${styles.specific}`}
                  onClick={() => runCleanup('audit_logs')}
                  disabled={isRunningCleanup}
                >
                  <FaDatabase />
                  Cleanup Audit Logs
                </button>
                
                <button
                  className={`${styles.cleanupButton} ${styles.specific}`}
                  onClick={() => runCleanup('workflow_executions')}
                  disabled={isRunningCleanup}
                >
                  <FaPlay />
                  Cleanup Executions
                </button>
              </div>

              {cleanupResults && (
                <div className={styles.cleanupResults}>
                  <h4>
                    <FaCheckCircle />
                    Last Cleanup Results
                  </h4>
                  <div className={styles.resultsGrid}>
                    <div className={styles.resultItem}>
                      <span>Total Records Cleaned:</span>
                      <span>{cleanupResults.total_cleaned?.toLocaleString() || 0}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span>Duration:</span>
                      <span>{cleanupResults.duration_ms ? `${cleanupResults.duration_ms}ms` : 'N/A'}</span>
                    </div>
                    {cleanupResults.payloads_cleared && (
                      <div className={styles.resultItem}>
                        <span>Sensitive Payloads Cleared:</span>
                        <span>{cleanupResults.payloads_cleared}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
      )}
    </PlanGate>
  );
};

DataRetentionDashboard.propTypes = {
  user: PropTypes.object.isRequired
};

export default DataRetentionDashboard;