import React, { useState } from 'react';
import PlanGate from '../components/PlanGate/PlanGate';
import { usePlan } from '../hooks/usePlan';
import { useI18n } from '../i18n';
import { useAuth } from '../utils/AuthContext';
import FileUpload from '../components/FileUpload/FileUpload';
import FileManager from '../components/FileManager/FileManager';
import ErrorMessage from '../components/ErrorMessage';
import styles from './FilesPage.module.css';

import { useEffect } from 'react';
import { useTheme } from '../utils/ThemeContext';
import { getFileShares } from '../utils/api';

const FilesPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { planData, isAtLimit } = usePlan();
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [refreshFiles, setRefreshFiles] = useState(0);

  const [sharedFiles, setSharedFiles] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const { theme } = useTheme();
  
  // Check if user is at storage limit
  const isStorageAtLimit = isAtLimit('storage_gb');
  const storageUsage = planData?.usage?.storage_gb || 0;
  const storageLimit = planData?.limits?.storage_gb || 5;

  useEffect(() => {
    async function fetchShares() {
      setLoadingShares(true);
      try {
        // Fetch all shares for the current user
        const result = await getFileShares();
        setSharedFiles(result || []);
      } catch (e) {
        setSharedFiles([]);
      } finally {
        setLoadingShares(false);
      }
    }
    fetchShares();
  }, [refreshFiles]);

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
                {sharedFiles.map((share) => (
                  <tr key={share.id}>
                    <td>{share.fileName || share.original_name || share.name}</td>
                    <td>
                      <a href={share.shareUrl} target="_blank" rel="noopener noreferrer" className={styles.shareLink}>
                        {share.shareUrl}
                      </a>
                    </td>
                    <td>{share.permissions || share.permission || 'view'}</td>
                    <td>
                      <button
                        className={styles.copyBtn}
                        onClick={() => {
                          navigator.clipboard.writeText(share.shareUrl);
                        }}
                        title={t('files.copy_link', 'Copy link')}
                      >
                        Copy
                      </button>
                      {/* Add revoke/delete action if needed */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
  );
};

export default FilesPage;