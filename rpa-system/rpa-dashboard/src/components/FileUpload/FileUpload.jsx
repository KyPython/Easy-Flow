import React, { useState, useCallback, useRef } from 'react';
import { uploadFile } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import { useI18n } from '../../i18n';
import styles from './FileUpload.module.css';
import PropTypes from 'prop-types';

const FileUpload = ({ 
  onUploadComplete, 
  onUploadError, 
  accept = '', 
  maxSizeBytes = 100 * 1024 * 1024, // 100MB default
  multiple = false,
  folder = '/',
  className = '' 
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { theme } = useTheme();
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const validateFile = useCallback((file) => {
    if (file.size > maxSizeBytes) {
      throw new Error(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSizeBytes)})`);
    }
    
    if (accept && !accept.split(',').some(type => {
      const cleanType = type.trim();
      if (cleanType.startsWith('.')) {
        return file.name.toLowerCase().endsWith(cleanType.toLowerCase());
      }
      return file.type.match(cleanType.replace('*', '.*'));
    })) {
      throw new Error(`File type "${file.type}" is not supported. Allowed types: ${accept}`);
    }
  }, [accept, maxSizeBytes, formatFileSize]);

  const handleFiles = useCallback(async (files) => {
    if (!files.length) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const filesToUpload = Array.from(files).slice(0, multiple ? 10 : 1); // Limit to 10 files max
      const uploadPromises = filesToUpload.map(async (file, index) => {
        validateFile(file);
        
        const options = {
          folder_path: folder,
          tags: []
        };
        
        const result = await uploadFile(file, options);
        
        // Update progress
        setUploadProgress(Math.round(((index + 1) / filesToUpload.length) * 100));
        
        return result;
      });

      const results = await Promise.all(uploadPromises);
      
      onUploadComplete?.(multiple ? results : results[0]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      onUploadError?.(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [folder, multiple, onUploadComplete, onUploadError, validateFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    handleFiles(files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    // Only remove drag over if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const files = e.target.files;
    handleFiles(files);
  }, [handleFiles]);

  const openFileDialog = useCallback(() => {
    if (fileInputRef.current && !uploading) {
      fileInputRef.current.click();
    }
  }, [uploading]);

  const getMaxSizeDisplay = () => formatFileSize(maxSizeBytes);

  return (
    <div className={`${styles.uploadContainer} ${className}`}>
      <div
        className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''} ${uploading ? styles.uploading : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
        role="button"
        tabIndex={0}
        aria-label={uploading ? t('files.uploading', 'Uploading...') : t('files.upload_area', 'Click or drag files to upload')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFileDialog();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className={styles.hiddenInput}
          disabled={uploading}
        />
        
        <div className={styles.dropzoneContent}>
          {uploading ? (
            <div className={styles.uploadingState}>
              <div className={styles.uploadIcon}>📤</div>
              <div className={styles.uploadText}>
                <h3>{t('files.uploading', 'Uploading...')}</h3>
                <p>{uploadProgress}% {t('files.complete', 'complete')}</p>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className={styles.defaultState}>
              <div className={styles.uploadIcon}>
                {dragOver ? '📁' : '📎'}
              </div>
              <div className={styles.uploadText}>
                <h3>
                  {dragOver 
                    ? t('files.drop_here', 'Drop files here') 
                    : t('files.drag_or_click', 'Drag files here or click to browse')
                  }
                </h3>
                <p className={styles.uploadHint}>
                  {multiple 
                    ? t('files.multiple_files', 'Upload multiple files up to') 
                    : t('files.single_file', 'Upload a file up to')
                  } {getMaxSizeDisplay()}
                  {accept && (
                    <span className={styles.acceptedTypes}>
                      <br />
                      {t('files.accepted_types', 'Accepted types')}: {accept}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

FileUpload.propTypes = {
  onUploadComplete: PropTypes.func,
  onUploadError: PropTypes.func,
  accept: PropTypes.string,
  maxSizeBytes: PropTypes.number,
  multiple: PropTypes.bool,
  folder: PropTypes.string,
  className: PropTypes.string
};

export default FileUpload;