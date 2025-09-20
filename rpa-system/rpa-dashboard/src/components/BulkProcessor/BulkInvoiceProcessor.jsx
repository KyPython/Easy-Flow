import React, { useState, useEffect } from 'react';
import { 
  FaPlus, 
  FaTrash, 
  FaPlay, 
  FaStop, 
  FaCog, 
  FaFileInvoiceDollar,
  FaUpload,
  FaDownload
} from 'react-icons/fa';
import styles from './BulkProcessor.module.css';
import { useAuth } from '../../utils/AuthContext';
import { useTheme } from '../../utils/ThemeContext';
import { useI18n } from '../../i18n';
import { supabase } from '../../utils/supabaseClient';
import { useToast } from '../WorkflowBuilder/Toast';
import PlanGate from '../PlanGate/PlanGate';

const BulkInvoiceProcessor = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { error: showError, warning: showWarning, success: showSuccess } = useToast();
  const [vendors, setVendors] = useState([]);
  const [batchJobs, setBatchJobs] = useState([]);
  const [currentJob, setCurrentJob] = useState(null);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newVendor, setNewVendor] = useState({
    vendor_name: '',
    login_url: '',
    username: '',
    password: '',
    invoice_selector: '.invoice-link',
    naming_pattern: '{vendor}_{date}_{invoice_number}.pdf',
    automation_config: {
      login_steps: [],
      navigation_steps: [],
      download_steps: []
    }
  });

  const [batchConfig, setBatchConfig] = useState({
    date_range: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    output_path: '/invoices',
    parallel_jobs: 3,
    retry_attempts: 3,
    integrations: {
      quickbooks: false,
      dropbox: false,
      google_drive: false
    }
  });

  useEffect(() => {
    loadVendors();
    loadBatchJobs();
  }, [user]);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('vendor_name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadBatchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_executions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'bulk_invoice_download')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setBatchJobs(data || []);
    } catch (error) {
      console.error('Error loading batch jobs:', error);
    }
  };

  const saveVendor = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('vendor_configs')
        .insert({
          user_id: user.id,
          ...newVendor,
          username_encrypted: btoa(newVendor.username), // Simple encoding - use proper encryption in production
          password_encrypted: btoa(newVendor.password)
        });

      if (error) throw error;

      setNewVendor({
        vendor_name: '',
        login_url: '',
        username: '',
        password: '',
        invoice_selector: '.invoice-link',
        naming_pattern: '{vendor}_{date}_{invoice_number}.pdf',
        automation_config: { login_steps: [], navigation_steps: [], download_steps: [] }
      });
      
      setShowVendorForm(false);
      await loadVendors();
    } catch (error) {
      console.error('Error saving vendor:', error);
      showError('Failed to save vendor configuration');
    } finally {
      setLoading(false);
    }
  };

  const startBulkProcessing = async () => {
    if (vendors.length === 0) {
      showWarning('Please add at least one vendor configuration');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/bulk-process/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`
        },
        body: JSON.stringify({
          userId: user.id,
          vendors: vendors,
          ...batchConfig
        })
      });

      if (!response.ok) throw new Error('Failed to start bulk processing');

      const result = await response.json();
      setCurrentJob(result);
      
      // Start polling for progress
      pollJobProgress(result.batchId);
      
    } catch (error) {
      console.error('Error starting bulk processing:', error);
      showError('Failed to start bulk processing');
    } finally {
      setLoading(false);
    }
  };

  const pollJobProgress = (batchId) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('batch_executions')
          .select('*')
          .eq('id', batchId)
          .single();

        if (error) throw error;

        setCurrentJob(data);

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          await loadBatchJobs();
        }
      } catch (error) {
        console.error('Error polling job progress:', error);
        clearInterval(interval);
      }
    }, 3000);

    return interval;
  };

  const deleteVendor = async (vendorId) => {
    try {
      const { error } = await supabase
        .from('vendor_configs')
        .update({ is_active: false })
        .eq('id', vendorId);

      if (error) throw error;
      await loadVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
    }
  };

  // Handler to route to dashboard tab when paywall is closed
  const handlePaywallClose = () => {
    window.location.href = '/dashboard?tab=bulk';
  };

  return (
    <PlanGate 
      requiredPlan="professional"
      upgradeMessage="Bulk processing is available on Professional and Enterprise plans. Process hundreds of invoices simultaneously with AI-powered automation."
      onPaywallClose={handlePaywallClose}
    >
      <div className={`${styles.bulkProcessor} ${theme === 'dark' ? styles.darkTheme : ''}`}>
      <div className={styles.header}>
        <h2>🧾 Bulk Invoice Processing</h2>
        <p>Automate invoice downloads from multiple vendors simultaneously</p>
      </div>

      {/* Vendor Configuration Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Vendor Configurations</h3>
          <button 
            className={styles.addButton}
            onClick={() => setShowVendorForm(true)}
          >
            <FaPlus /> Add Vendor
          </button>
        </div>

        {vendors.length > 0 ? (
          <div className={styles.vendorGrid}>
            {vendors.map(vendor => (
              <div key={vendor.id} className={styles.vendorCard}>
                <div className={styles.vendorHeader}>
                  <h4>{vendor.vendor_name}</h4>
                  <button 
                    className={styles.deleteButton}
                    onClick={() => deleteVendor(vendor.id)}
                  >
                    <FaTrash />
                  </button>
                </div>
                <div className={styles.vendorDetails}>
                  <p><strong>URL:</strong> {vendor.login_url}</p>
                  <p><strong>Selector:</strong> {vendor.invoice_selector}</p>
                  <p><strong>Last Run:</strong> {vendor.last_successful_run ? 
                    new Date(vendor.last_successful_run).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <FaFileInvoiceDollar size={48} />
            <p>No vendor configurations yet</p>
            <button onClick={() => setShowVendorForm(true)}>
              Add Your First Vendor
            </button>
          </div>
        )}
      </div>

      {/* Batch Configuration Section */}
      <div className={styles.section}>
        <h3>Batch Processing Configuration</h3>
        <div className={styles.configGrid}>
          <div className={styles.configItem}>
            <label>Date Range</label>
            <div className={styles.dateRange}>
              <input
                type="date"
                value={batchConfig.date_range.start}
                onChange={(e) => setBatchConfig({
                  ...batchConfig,
                  date_range: { ...batchConfig.date_range, start: e.target.value }
                })}
              />
              <span>to</span>
              <input
                type="date"
                value={batchConfig.date_range.end}
                onChange={(e) => setBatchConfig({
                  ...batchConfig,
                  date_range: { ...batchConfig.date_range, end: e.target.value }
                })}
              />
            </div>
          </div>

          <div className={styles.configItem}>
            <label>Output Path</label>
            <input
              type="text"
              value={batchConfig.output_path}
              onChange={(e) => setBatchConfig({
                ...batchConfig,
                output_path: e.target.value
              })}
              placeholder="/invoices/2024"
            />
          </div>

          <div className={styles.configItem}>
            <label>Parallel Jobs</label>
            <select
              value={batchConfig.parallel_jobs}
              onChange={(e) => setBatchConfig({
                ...batchConfig,
                parallel_jobs: parseInt(e.target.value)
              })}
            >
              <option value={1}>1 (Sequential)</option>
              <option value={2}>2 (Moderate)</option>
              <option value={3}>3 (Balanced)</option>
              <option value={5}>5 (Aggressive)</option>
            </select>
          </div>

          <div className={styles.configItem}>
            <label>Integrations</label>
            <div className={styles.integrationToggles}>
              <label>
                <input
                  type="checkbox"
                  checked={batchConfig.integrations.quickbooks}
                  onChange={(e) => setBatchConfig({
                    ...batchConfig,
                    integrations: {
                      ...batchConfig.integrations,
                      quickbooks: e.target.checked
                    }
                  })}
                />
                QuickBooks
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={batchConfig.integrations.dropbox}
                  onChange={(e) => setBatchConfig({
                    ...batchConfig,
                    integrations: {
                      ...batchConfig.integrations,
                      dropbox: e.target.checked
                    }
                  })}
                />
                Dropbox
              </label>
            </div>
          </div>
        </div>

        <div className={styles.actionButtons}>
          <button 
            className={styles.primaryButton}
            onClick={startBulkProcessing}
            disabled={loading || vendors.length === 0}
          >
            {loading ? <FaStop /> : <FaPlay />}
            {loading ? 'Processing...' : 'Start Bulk Processing'}
          </button>
          
          <button className={styles.secondaryButton}>
            <FaCog /> Configure
          </button>
        </div>
      </div>

      {/* Current Job Progress */}
      {currentJob && (
        <div className={styles.section}>
          <h3>Current Job Progress</h3>
          <div className={styles.progressCard}>
            <div className={styles.progressHeader}>
              <h4>Batch #{currentJob.id?.slice(-8)}</h4>
              <span className={`${styles.status} ${styles[currentJob.status]}`}>
                {currentJob.status}
              </span>
            </div>
            
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${currentJob.progress_percent}%` }}
              />
            </div>
            
            <div className={styles.progressStats}>
              <span>Progress: {currentJob.progress_percent}%</span>
              <span>Completed: {currentJob.completed_items}/{currentJob.total_items}</span>
              <span>Failed: {currentJob.failed_items}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div className={styles.section}>
        <h3>Recent Batch Jobs</h3>
        {batchJobs.length > 0 ? (
          <div className={styles.jobsList}>
            {batchJobs.map(job => (
              <div key={job.id} className={styles.jobCard}>
                <div className={styles.jobHeader}>
                  <span>#{job.id.slice(-8)}</span>
                  <span className={`${styles.status} ${styles[job.status]}`}>
                    {job.status}
                  </span>
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                <div className={styles.jobStats}>
                  <span>Total: {job.total_items}</span>
                  <span>Success: {job.completed_items}</span>
                  <span>Failed: {job.failed_items}</span>
                  {job.status === 'completed' && (
                    <button className={styles.downloadButton}>
                      <FaDownload /> Download Results
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No batch jobs yet</p>
        )}
      </div>

      {/* Vendor Form Modal */}
      {showVendorForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Add Vendor Configuration</h3>
              <button onClick={() => setShowVendorForm(false)}>×</button>
            </div>
            
            <div className={styles.form}>
              <div className={styles.formRow}>
                <label>Vendor Name</label>
                <input
                  type="text"
                  value={newVendor.vendor_name}
                  onChange={(e) => setNewVendor({
                    ...newVendor,
                    vendor_name: e.target.value
                  })}
                  placeholder="e.g., Acme Supplies Inc"
                />
              </div>

              <div className={styles.formRow}>
                <label>Login URL</label>
                <input
                  type="url"
                  value={newVendor.login_url}
                  onChange={(e) => setNewVendor({
                    ...newVendor,
                    login_url: e.target.value
                  })}
                  placeholder="https://vendor.com/login"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formSplit}>
                  <div>
                    <label>Username</label>
                    <input
                      type="text"
                      value={newVendor.username}
                      onChange={(e) => setNewVendor({
                        ...newVendor,
                        username: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <label>Password</label>
                    <input
                      type="password"
                      value={newVendor.password}
                      onChange={(e) => setNewVendor({
                        ...newVendor,
                        password: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <label>Invoice Selector (CSS)</label>
                <input
                  type="text"
                  value={newVendor.invoice_selector}
                  onChange={(e) => setNewVendor({
                    ...newVendor,
                    invoice_selector: e.target.value
                  })}
                  placeholder=".invoice-link, [href*='invoice']"
                />
              </div>

              <div className={styles.formRow}>
                <label>File Naming Pattern</label>
                <input
                  type="text"
                  value={newVendor.naming_pattern}
                  onChange={(e) => setNewVendor({
                    ...newVendor,
                    naming_pattern: e.target.value
                  })}
                  placeholder="{vendor}_{date}_{invoice_number}.pdf"
                />
                <small>Available variables: {'{vendor}'}, {'{date}'}, {'{invoice_number}'}, {'{amount}'}</small>
              </div>

              <div className={styles.formActions}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowVendorForm(false)}
                >
                  Cancel
                </button>
                <button 
                  className={styles.saveButton}
                  onClick={saveVendor}
                  disabled={loading || !newVendor.vendor_name || !newVendor.login_url}
                >
                  {loading ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PlanGate>
  );
};

export default BulkInvoiceProcessor;