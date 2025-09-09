import React, { useState, useCallback, useRef } from 'react';
import { uploadFile } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import { useI18n } from '../../i18n';
import { getAllCategories, categorizeFile, getSuggestedTags, cleanTags, AUTOMATION_TAGS } from '../../utils/fileCategories';
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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { theme } = useTheme();
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  const categories = getAllCategories();

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

  const addTag = useCallback((tag) => {
    const cleanedTag = tag.trim().toLowerCase();
    if (cleanedTag && !tags.includes(cleanedTag) && tags.length < 10) {
      setTags(prev => [...prev, cleanedTag]);
    }
    setTagInput('');
  }, [tags]);

  const removeTag = useCallback((tagToRemove) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  const handleTagInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }, [tagInput, addTag, removeTag, tags]);

  const autoCategorizeFile = useCallback((file) => {
    const extension = file.name.split('.').pop();
    const autoCategory = categorizeFile(file.type, extension);
    
    if (!selectedCategory && autoCategory) {
      setSelectedCategory(autoCategory.id);
    }

    // Add suggested tags if none exist
    if (tags.length === 0) {
      const suggestions = getSuggestedTags(autoCategory, file.name).slice(0, 3);
      setTags(suggestions);
    }
  }, [selectedCategory, tags.length]);

  const handleFiles = useCallback(async (files) => {
    if (!files.length) return;
    
    // Auto-categorize first file for suggestions
    if (files.length > 0) {
      autoCategorizeFile(files[0]);
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const filesToUpload = Array.from(files).slice(0, multiple ? 10 : 1); // Limit to 10 files max
      const uploadPromises = filesToUpload.map(async (file, index) => {
        validateFile(file);
        
        // Auto-categorize each file
        const extension = file.name.split('.').pop();
        const autoCategory = categorizeFile(file.type, extension);
        const categoryToUse = selectedCategory || autoCategory.id;
        
        const options = {
          folder_path: folder,
          category: categoryToUse,
          tags: cleanTags(tags)
        };
        
        const result = await uploadFile(file, options);
        
        // Update progress
        setUploadProgress(Math.round(((index + 1) / filesToUpload.length) * 100));
        
        return result;
      });

      const results = await Promise.all(uploadPromises);
      
      onUploadComplete?.(multiple ? results : results[0]);
      
      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedCategory('');
      setTags([]);
      setTagInput('');
      setShowAdvanced(false);
      
    } catch (error) {
      console.error('File upload error:', error);
      onUploadError?.(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [folder, multiple, selectedCategory, tags, onUploadComplete, onUploadError, validateFile, autoCategorizeFile]);

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

      {/* Advanced Options */}
      <div className={styles.advancedOptions}>
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={uploading}
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          {t('files.advanced_options', 'Advanced Options')}
        </button>

        {showAdvanced && (
          <div className={styles.advancedContent}>
            {/* Category Selection */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('files.category', 'Category')}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={styles.categorySelect}
                disabled={uploading}
              >
                <option value="">{t('files.auto_detect', 'Auto-detect')}</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              <small className={styles.hint}>
                {selectedCategory
                  ? categories.find(c => c.id === selectedCategory)?.description
                  : t('files.category_hint', 'Category will be automatically detected based on file type')
                }
              </small>
            </div>

            {/* Tag Management */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('files.tags', 'Tags')} ({tags.length}/10)
              </label>
              
              <div className={styles.tagContainer}>
                {/* Existing Tags */}
                {tags.map(tag => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className={styles.tagRemove}
                      disabled={uploading}
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                
                {/* Tag Input */}
                {tags.length < 10 && (
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    onBlur={() => {
                      if (tagInput.trim()) {
                        addTag(tagInput);
                      }
                    }}
                    placeholder={t('files.add_tag', 'Add tag...')}
                    className={styles.tagInput}
                    disabled={uploading}
                  />
                )}
              </div>

              {/* Suggested Tags */}
              <div className={styles.suggestedTags}>
                <small className={styles.suggestedLabel}>
                  {t('files.suggested_tags', 'Suggested:')}
                </small>
                {AUTOMATION_TAGS.slice(0, 6).map(tag => (
                  !tags.includes(tag) && tags.length < 10 && (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className={styles.suggestedTag}
                      disabled={uploading}
                    >
                      + {tag}
                    </button>
                  )
                ))}
              </div>

              <small className={styles.hint}>
                {t('files.tag_hint', 'Press Enter or comma to add tags. Use tags to organize and find files easily.')}
              </small>
            </div>
          </div>
        )}
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