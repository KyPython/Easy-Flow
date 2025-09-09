import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { useAuth } from '../utils/AuthContext';
import FileUpload from '../components/FileUpload/FileUpload';
import FileManager from '../components/FileManager/FileManager';
import ErrorMessage from '../components/ErrorMessage';
import styles from './FilesPage.module.css';

const FilesPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [refreshFiles, setRefreshFiles] = useState(0);

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

  return (
    <div className={styles.filesPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('files.page_title', 'File Management')}</h1>
        <p className={styles.subtitle}>
          {t('files.page_subtitle', 'Upload, organize, and manage your automation files')}
        </p>
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
    </div>
  );
};

export default FilesPage;