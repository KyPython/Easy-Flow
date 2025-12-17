import React, { useState } from 'react';
import PlanGate from '../components/PlanGate/PlanGate';
import { usePlan } from '../hooks/usePlan';
import { useI18n } from '../i18n';
import { useAuth } from '../utils/AuthContext';
import FileUpload from '../components/FileUpload/FileUpload';
// PERFORMANCE OPTIMIZATION: Use lazy-loaded FileManager to reduce initial bundle size  
// This reduces the main bundle by ~705 lines of code and improves page navigation speed
import { FileManager } from '../components/LazyLoader';
import ErrorMessage from '../components/ErrorMessage';
import styles from './FilesPage.module.css';

import { useEffect, useRef } from 'react';
import { useTheme } from '../utils/ThemeContext';
import { getFileShares, api, getShareUrl } from '../utils/api';
import { createLogger } from '../utils/logger';
import { validateUrl } from '../utils/security';

const FilesPage = () => {
  const { user } = useAuth();
  const logger = createLogger('FilesPage');
  const { t } = useI18n();
  const { planData, isAtLimit } = usePlan();
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [refreshFiles, setRefreshFiles] = useState(0);

  // FIX: Initialize as empty array
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [sharesError, setSharesError] = useState(null);
  const { theme } = useTheme();
  const loadingTimeoutRef = useRef(null);
  
  // Check if user is at storage limit
  const isStorageAtLimit = isAtLimit('storage_gb');
  const storageUsage = planData?.usage?.storage_gb || 0;
  const storageLimit = planData?.limits?.storage_gb || 5;

  useEffect(() => {
    async function fetchShares() {
      if (!user) return;
      setLoadingShares(true);
      setSharesError(null);

      // Set timeout to prevent infinite loading (30 seconds)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => {
        logger.error('Shares fetch timeout - taking longer than 30 seconds', {
          user_id: user.id,
          timeout: 30000
        });
        setSharesError('Loading is taking longer than expected. Please refresh the page.');
        setLoadingShares(false);
      }, 30000);

      try {
        logger.info('Fetching file shares', { user_id: user.id });
        
        // FIX: Use the correct endpoint for fetching ALL user's shares
        // Option 1: If you have a dedicated endpoint for all user shares
        // const { data } = await api.get('/api/files/shares');
        // const shares = Array.isArray(data) ? data : (data?.shares || []);
        
        // Option 2: If getFileShares() without fileId returns all shares
        const result = await getFileShares();
        
        // FIX: Safely extract the shares array from the response
        // Handle both { shares: [...] } and direct array responses
        let shares;
        if (Array.isArray(result)) {
          shares = result;
        } else if (result && typeof result === 'object') {
          shares = result.shares || result.data || [];
        } else {
          shares = [];
        }
        
        logger.info('File shares fetched successfully', {
          user_id: user.id,
          count: shares.length
        });
        
        // Ensure we always set an array
        setSharedFiles(Array.isArray(shares) ? shares : []);
      } catch (e) {
        logger.error('Error fetching shared files', {
          error: e?.message || e,
          user_id: user.id,
          stack: e?.stack
        });
        setSharesError(e?.message || 'Failed to load shared files');
        setSharedFiles([]); // Always set to array on error
      } finally {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        setLoadingShares(false);
      }
    }
    fetchShares();
  }, [refreshFiles, user, logger]);

  const handleUploadComplete = (result) => {
    setUploadError('');
    const fileCount = Array.isArray(result) ? result.length : 1;
    setUploadSuccess(
      fileCount > 1 
        ? t('files.upload_success_multiple', `Successfully uploaded ${fileCount} files`)
        : t('files.upload_success_single', 'File uploaded successfully')
    );
    
    // Clear success message after 3 seconds
    setTimeout(() => setUploadSuccess(''), 3000);
    
    // Trigger file list refresh
    setRefreshFiles(prev => prev + 1);
  };

  const handleUploadError = (error) => {
    setUploadSuccess('');
    setUploadError(error);
  };

  // Storage limit paywall only shows when actually at limit
  if (isStorageAtLimit) {
    return (
      <PlanGate 
        requiredPlan="Starter"
        feature="storage_upgrade"
        upgradeMessage={`You've reached your storage limit (${storageUsage.toFixed(2)}/${storageLimit}GB). Upgrade to get more storage space and continue uploading files.`}
        onPaywallClose={() => window.location.href = '/app'}
      >
        <div className={styles.filesPage}>
          <div className={styles.storageFullMessage}>
            <h2>Storage Limit Reached</h2>
            <p>You've used {storageUsage.toFixed(2)}GB of your {storageLimit}GB storage limit.</p>
          </div>
        </div>
      </PlanGate>
    );
  }

  return (
    <div className={styles.filesPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('files.page_title', 'File Management')}</h1>
        <p className={styles.subtitle}>
          {t('files.page_subtitle', 'Upload, organize, and manage your automation files')}
        </p>
        
        {/* Storage usage indicator */}
        <div className={styles.storageIndicator}>
          <div className={styles.storageBar}>
            <div 
              className={styles.storageProgress} 
              style={{ 
                width: `${Math.min((storageUsage / storageLimit) * 100, 100)}%`,
                backgroundColor: storageUsage >= storageLimit * 0.9 ? '#ef4444' : storageUsage >= storageLimit * 0.7 ? '#f59e0b' : '#10b981'
              }}
            />
          </div>
          <span className={styles.storageText}>
            {storageUsage.toFixed(2)} / {storageLimit} GB used
          </span>
        </div>
      </div>

        {/* Upload Section */}
        <div className={styles.uploadSection}>
          <h2 className={styles.sectionTitle}>{t('files.upload_title', 'Upload Files')}</h2>
          <FileUpload
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip"
            maxSizeBytes={100 * 1024 * 1024} // 100MB
            multiple={true}
            folder="/"
            className={styles.fileUpload}
          />
        </div>

        {/* Success/Error Messages */}
        {uploadError && (
          <div className={styles.errorAlert}>
            <span>❌ {uploadError}</span>
            <button onClick={() => setUploadError('')} className={styles.dismissBtn}>×</button>
          </div>
        )}
        
        {uploadSuccess && (
          <div className={styles.successAlert}>
            <span>✅ {uploadSuccess}</span>
            <button onClick={() => setUploadSuccess('')} className={styles.dismissBtn}>×</button>
          </div>
        )}

        {/* File Management Section */}
        <div className={styles.manageSection}>
          <h2 className={styles.sectionTitle}>{t('files.manage_title', 'Your Files')}</h2>
          <FileManager
            folder="/"
            className={styles.fileManager}
            key={refreshFiles} // Force refresh when files are uploaded
          />
        </div>

        {/* Shared Files Section */}
        <div className={styles.sharedSection} data-theme={theme}>
          <h2 className={styles.sectionTitle}>{t('files.shared_title', 'Shared Files')}</h2>
          {loadingShares ? (
            <div className={styles.loadingShares}>{t('files.loading_shares', 'Loading shared files...')}</div>
          ) : sharesError ? (
            <div className={styles.sharesError}>
              <span>⚠️ {sharesError}</span>
              <button 
                onClick={() => setRefreshFiles(prev => prev + 1)} 
                className={styles.retryBtn}
              >
                Retry
              </button>
            </div>
          ) : sharedFiles.length === 0 ? (
            <div className={styles.noShares}>{t('files.no_shared_files', 'No files have been shared yet.')}</div>
          ) : (
            <table className={styles.sharedTable}>
              <thead>
                <tr>
                  <th>{t('files.shared_filename', 'File')}</th>
                  <th>{t('files.shared_link', 'Share Link')}</th>
                  <th>{t('files.shared_permission', 'Permission')}</th>
                  <th>{t('files.shared_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sharedFiles.map((share) => {
                  // Construct share URL if not provided (same logic as FileSharing.jsx)
                  let shareUrl = share.shareUrl || share.share_url;
                  if (!shareUrl && share.share_token) {
                    shareUrl = getShareUrl(share.share_token);
                  }
                  if (!shareUrl && share.id) {
                    // Fallback: construct from share ID
                    shareUrl = `${window.location.origin}/shared/${share.id}`;
                  }
                  
                  // ✅ SECURITY: Validate URL before rendering to prevent XSS
                  const urlValidation = shareUrl ? validateUrl(shareUrl) : { valid: false, url: null };
                  const safeShareUrl = urlValidation.valid ? urlValidation.url : null;
                  
                  return (
                    <tr key={share.id || share.shareUrl}>
                      <td>{share.fileName || share.original_name || share.name || 'Unnamed file'}</td>
                      <td>
                        {safeShareUrl ? (
                          <a href={safeShareUrl} target="_blank" rel="noopener noreferrer" className={styles.shareLink}>
                            {safeShareUrl}
                          </a>
                        ) : (
                          <span className={styles.shareLink}>No share URL available</span>
                        )}
                      </td>
                      <td>{share.permissions || share.permission || 'view'}</td>
                      <td>
                        <button
                          className={styles.copyBtn}
                          onClick={() => {
                            if (shareUrl) {
                              navigator.clipboard.writeText(shareUrl).catch(err => {
                                console.error('Failed to copy link:', err);
                                alert('Failed to copy link to clipboard');
                              });
                            } else {
                              alert('Unable to copy link: Share URL not available');
                            }
                          }}
                          title={t('files.copy_link', 'Copy link')}
                          disabled={!shareUrl}
                        >
                          Copy
                        </button>
                        {/* Add revoke/delete action if needed */}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
  );
};

export default FilesPage;