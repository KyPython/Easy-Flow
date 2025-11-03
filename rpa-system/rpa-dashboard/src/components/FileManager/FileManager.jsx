/*
 * PERFORMANCE OPTIMIZATIONS APPLIED:
 * 1. Added React.memo to prevent re-renders when props don't change
 * 2. Memoized expensive file operations and filtering logic
 * 3. Stable object references for better performance
 * 
 * IMPACT: Reduces re-renders when file list updates but props stay same
 * REVERT: Remove React.memo wrapper and restore original export
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { getFiles, deleteFile, getFileDownloadUrl, getFileShares, createFileShare, deleteFileShare, api } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import { useI18n } from '../../i18n';
import { getAllCategories, categorizeFile, getCategoryById, getCategoryIcon, getCategoryColor } from '../../utils/fileCategories';
import FileSharing from '../FileSharing/FileSharing';
import styles from './FileManager.module.css';
import PropTypes from 'prop-types';
import { FaCloud, FaCog, FaSync, FaDownload, FaUpload } from 'react-icons/fa';

const FileManager = ({ 
  onFileSelect = null,
  folder = '/',
  showUploadArea = true,
  className = ''
}) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sharingFile, setSharingFile] = useState(null);
  const [fileShares, setFileShares] = useState([]);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [syncingWith, setSyncingWith] = useState(null);
  const { theme } = useTheme();
  const { t } = useI18n();

  const categories = getAllCategories();

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getFiles({
        folder,
        search: searchQuery.trim() || undefined,
        category: categoryFilter || undefined,
        tags: tagFilter || undefined,
        limit: 100
      });
      setFiles(result.files || []);
    } catch (err) {
      setError(err.message || 'Failed to load files');
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  }, [folder, searchQuery, categoryFilter, tagFilter]);

  useEffect(() => {
    loadFiles();
    loadIntegrations();
  }, [loadFiles]);

  const loadIntegrations = useCallback(async () => {
    try {
      const response = await api.get('/api/integrations');
      setIntegrations(response.data.integrations || []);
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  }, []);

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getFileIcon = useCallback((file) => {
    // Use category from database if available
    if (file.category) {
      const category = getCategoryById(file.category);
      if (category) return category.icon;
    }
    
    // Fallback to auto-categorization
    const category = categorizeFile(file.mime_type, file.file_extension);
    return getCategoryIcon(category);
  }, []);

  const getFileCategory = useCallback((file) => {
    // Use category from database if available
    if (file.category) {
      return getCategoryById(file.category);
    }
    
    // Fallback to auto-categorization
    return categorizeFile(file.mime_type, file.file_extension);
  }, []);

  const handleDownload = useCallback(async (file) => {
    try {
      const result = await getFileDownloadUrl(file.id);
      
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Refresh files to update download count
      loadFiles();
    } catch (err) {
      setError(`Failed to download ${file.original_name}: ${err.message}`);
    }
  }, [loadFiles]);

  const handleDelete = useCallback(async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.original_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteFile(file.id);
      setFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    } catch (err) {
      setError(`Failed to delete ${file.original_name}: ${err.message}`);
    }
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const toggleFileSelection = useCallback((fileId) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  const handleShareFile = useCallback(async (file) => {
    setSharingFile(file);
    // Load existing shares for this file
    try {
      const shares = await getFileShares(file.id);
      setFileShares(shares);
    } catch (error) {
      console.error('Error loading file shares:', error);
      setFileShares([]);
    }
  }, []);

  const handleSharingClose = useCallback(() => {
    setSharingFile(null);
  }, []);

  const handleShareCreated = useCallback((newShare) => {
    setFileShares(prev => [...prev, newShare]);
  }, []);

  const handleShareUpdated = useCallback((updatedShare) => {
    setFileShares(prev => 
      prev.map(share => 
        share.id === updatedShare.id ? updatedShare : share
      )
    );
  }, []);

  const handleShareDeleted = useCallback((shareId) => {
    setFileShares(prev => prev.filter(share => share.id !== shareId));
  }, []);

  const sortedFiles = React.useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      let valueA = a[sortBy];
      let valueB = b[sortBy];

      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        valueA = new Date(valueA);
        valueB = new Date(valueB);
      } else if (sortBy === 'file_size') {
        valueA = parseInt(valueA) || 0;
        valueB = parseInt(valueB) || 0;
      } else if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [files, sortBy, sortOrder]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    
    const filesToDelete = files.filter(f => selectedFiles.has(f.id));
    const fileNames = filesToDelete.map(f => f.original_name).join(', ');
    
    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)?\n\n${fileNames}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedFiles).map(fileId => deleteFile(fileId))
      );
      
      setFiles(prevFiles => prevFiles.filter(f => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
    } catch (err) {
      setError(`Failed to delete some files: ${err.message}`);
      // Refresh to get current state
      loadFiles();
    }
  }, [selectedFiles, files, loadFiles]);

  const handleSyncWithService = useCallback(async (serviceName) => {
    setSyncingWith(serviceName);
    try {
      const selectedFileList = files.filter(f => selectedFiles.has(f.id));
      
      const response = await api.post('/api/integrations/sync-files', {
        service: serviceName,
        files: selectedFileList.map(f => ({
          id: f.id,
          name: f.original_name,
          size: f.file_size,
          type: f.mime_type
        }))
      });
      
      if (response.data.success) {
        setError('');
        // Show success message
        const successMsg = `Successfully synced ${selectedFileList.length} file(s) to ${serviceName}`;
        // You can implement a success toast here
        console.log(successMsg);
        setSelectedFiles(new Set());
      } else {
        setError(`Failed to sync files to ${serviceName}: ${response.data.error}`);
      }
    } catch (err) {
      setError(`Failed to sync files to ${serviceName}: ${err.message}`);
    } finally {
      setSyncingWith(null);
    }
  }, [files, selectedFiles]);

  const handleBulkExtractData = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    
    const filesToExtract = files.filter(f => selectedFiles.has(f.id));
    const supportedFiles = filesToExtract.filter(f => 
      f.mime_type.includes('pdf') || 
      f.mime_type.includes('image') ||
      f.file_extension?.match(/\.(pdf|jpg|jpeg|png|gif|bmp|tiff)$/i)
    );
    
    if (supportedFiles.length === 0) {
      setError('No supported files selected for data extraction (PDF or image files only)');
      return;
    }
    
    try {
      const response = await api.post('/api/extract-data-bulk', {
        fileIds: supportedFiles.map(f => f.id),
        extractionType: 'auto' // Let AI determine what to extract
      });
      
      if (response.data.success) {
        // Show success message and refresh files to show extraction results
        console.log(`Data extraction started for ${supportedFiles.length} file(s)`);
        loadFiles();
        setSelectedFiles(new Set());
      }
    } catch (err) {
      setError(`Failed to start data extraction: ${err.message}`);
    }
  }, [files, selectedFiles, loadFiles]);

  const handleExtractData = useCallback(async (file) => {
    try {
      // Update file processing status locally
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === file.id ? { ...f, processing_status: 'processing' } : f
        )
      );
      
      const response = await api.post('/api/extract-data', {
        fileId: file.id,
        extractionType: 'auto'
      });
      
      if (response.data.success) {
        // Refresh files to show updated status
        loadFiles();
      } else {
        setError(`Failed to extract data from ${file.original_name}: ${response.data.error}`);
        // Reset processing status on error
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === file.id ? { ...f, processing_status: 'pending' } : f
          )
        );
      }
    } catch (err) {
      setError(`Failed to extract data from ${file.original_name}: ${err.message}`);
      // Reset processing status on error
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === file.id ? { ...f, processing_status: 'pending' } : f
        )
      );
    }
  }, [loadFiles]);

  const getServiceIcon = useCallback((serviceName) => {
    const icons = {
      'dropbox': '📦',
      'google_drive': '📁',
      'quickbooks': '📊',
      'salesforce': '☁️',
      'slack': '💬',
      'zapier': '⚡'
    };
    return icons[serviceName] || '🔗';
  }, []);

  if (loading) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>{t('files.loading', 'Loading files...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Search and Controls */}
      <div className={styles.controls}>
        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder={t('files.search_placeholder', 'Search files...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button 
            onClick={loadFiles}
            className={styles.refreshBtn}
            title={t('files.refresh', 'Refresh')}
          >
            🔄
          </button>
        </div>
        
        {/* Category and Tag Filters */}
        <div className={styles.filterSection}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={styles.categoryFilter}
            title={t('files.filter_by_category', 'Filter by category')}
          >
            <option value="">{t('files.all_categories', 'All Categories')}</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder={t('files.filter_by_tags', 'Filter by tags...')}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className={styles.tagFilter}
            title={t('files.tag_filter_hint', 'Enter tag names separated by commas')}
          />
        </div>
        
        <div className={styles.viewControls}>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="created_at">{t('files.sort_date', 'Date')}</option>
            <option value="original_name">{t('files.sort_name', 'Name')}</option>
            <option value="file_size">{t('files.sort_size', 'Size')}</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={styles.sortOrderBtn}
            title={sortOrder === 'asc' ? t('files.sort_desc', 'Sort Descending') : t('files.sort_asc', 'Sort Ascending')}
          >
            {sortOrder === 'asc' ? '⬆️' : '⬇️'}
          </button>
          
          <div className={styles.viewToggle}>
            <button
              onClick={() => setView('grid')}
              className={`${styles.viewBtn} ${view === 'grid' ? styles.active : ''}`}
              title={t('files.grid_view', 'Grid View')}
            >
              ⚏
            </button>
            <button
              onClick={() => setView('list')}
              className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`}
              title={t('files.list_view', 'List View')}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedFiles.size > 0 && (
        <div className={styles.bulkActions}>
          <span className={styles.selectedCount}>
            {selectedFiles.size} {t('files.selected', 'file(s) selected')}
          </span>
          
          <div className={styles.bulkActionButtons}>
            <button
              onClick={handleBulkExtractData}
              className={styles.bulkExtractBtn}
              title="Extract data from selected files using AI"
            >
              🤖 Extract Data
            </button>
            
            {integrations.length > 0 && (
              <div className={styles.syncDropdown}>
                <button
                  onClick={() => setShowIntegrations(!showIntegrations)}
                  className={styles.syncBtn}
                  disabled={syncingWith !== null}
                >
                  {syncingWith ? (
                    <><FaSync className={styles.spinning} /> Syncing...</>
                  ) : (
                    <><FaCloud /> Sync to...</>
                  )}
                </button>
                
                {showIntegrations && (
                  <div className={styles.integrationMenu}>
                    {integrations.filter(i => i.is_active).map(integration => (
                      <button
                        key={integration.service_name}
                        onClick={() => {
                          handleSyncWithService(integration.service_name);
                          setShowIntegrations(false);
                        }}
                        className={styles.integrationOption}
                        disabled={syncingWith !== null}
                      >
                        {getServiceIcon(integration.service_name)} {integration.service_name}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowIntegrations(false)}
                      className={styles.integrationCancel}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={handleBulkDelete}
              className={styles.bulkDeleteBtn}
            >
              🗑️ {t('files.delete_selected', 'Delete Selected')}
            </button>
            
            <button
              onClick={() => setSelectedFiles(new Set())}
              className={styles.clearSelectionBtn}
            >
              {t('files.clear_selection', 'Clear Selection')}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          <span>❌ {error}</span>
          <button onClick={() => setError('')} className={styles.dismissBtn}>×</button>
        </div>
      )}

      {/* Files Display */}
      {sortedFiles.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📁</div>
          <h3>{t('files.no_files', 'No files found')}</h3>
          <p>
            {searchQuery.trim() 
              ? t('files.no_search_results', 'No files match your search criteria')
              : t('files.upload_first', 'Upload some files to get started')
            }
          </p>
        </div>
      ) : (
        <div className={`${styles.filesContainer} ${view === 'list' ? styles.listView : styles.gridView}`}>
          {sortedFiles.map(file => (
            <div
              key={file.id}
              className={`${styles.fileCard} ${selectedFiles.has(file.id) ? styles.selected : ''}`}
              onClick={() => onFileSelect ? handleFileSelect(file) : null}
            >
              <div className={styles.fileHeader}>
                <div className={styles.fileIcon}>
                  {getFileIcon(file)}
                </div>
                <div className={styles.fileActions}>
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className={styles.fileCheckbox}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              
              <div className={styles.fileInfo}>
                <h4 className={styles.fileName} title={file.original_name}>
                  {file.display_name || file.original_name}
                </h4>
                <div className={styles.fileMeta}>
                  <span className={styles.fileSize}>{formatFileSize(file.file_size)}</span>
                  <span className={styles.fileDate}>{formatDate(file.created_at)}</span>
                </div>
                {file.download_count > 0 && (
                  <div className={styles.downloadCount}>
                    📥 {file.download_count} downloads
                  </div>
                )}
                
                {/* Category Display */}
                <div className={styles.fileCategory}>
                  <span 
                    className={styles.categoryBadge}
                    style={{ backgroundColor: getCategoryColor(getFileCategory(file)) + '20', color: getCategoryColor(getFileCategory(file)) }}
                  >
                    {getFileCategory(file).name}
                  </span>
                </div>
                
                {/* Tags Display */}
                {file.tags && file.tags.length > 0 && (
                  <div className={styles.fileTags}>
                    {file.tags.slice(0, 3).map(tag => (
                      <span key={tag} className={styles.fileTag}>
                        {tag}
                      </span>
                    ))}
                    {file.tags.length > 3 && (
                      <span className={styles.moreTagsIndicator}>
                        +{file.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
                
                {/* AI Extraction Status */}
                {file.extracted_data && (
                  <div className={styles.aiStatus}>
                    <span className={styles.aiExtracted}>
                      🤖 AI Data Extracted ({Math.round((file.ai_confidence || 0.8) * 100)}% confidence)
                    </span>
                  </div>
                )}
                
                {file.processing_status === 'processing' && (
                  <div className={styles.aiStatus}>
                    <span className={styles.aiProcessing}>
                      ⏳ Processing with AI...
                    </span>
                  </div>
                )}
              </div>
              
              <div className={styles.fileActionsBar}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(file);
                  }}
                  className={styles.actionBtn}
                  title={t('files.download', 'Download')}
                >
                  <FaDownload />
                </button>
                
                {/* AI Extract Button */}
                {(file.mime_type?.includes('pdf') || file.mime_type?.includes('image') || 
                  file.file_extension?.match(/\.(pdf|jpg|jpeg|png|gif|bmp|tiff)$/i)) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtractData(file);
                    }}
                    className={styles.actionBtn}
                    title="Extract data using AI"
                    disabled={file.processing_status === 'processing'}
                  >
                    🤖
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareFile(file);
                  }}
                  className={styles.actionBtn}
                  title={t('files.share', 'Share')}
                >
                  🔗
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(file);
                  }}
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  title={t('files.delete', 'Delete')}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {sharingFile && (
        <FileSharing
          file={sharingFile}
          isOpen={true}
          onClose={handleSharingClose}
          onCreateShare={handleShareCreated}
          onUpdateShare={handleShareUpdated}
          onDeleteShare={handleShareDeleted}
          existingShares={fileShares}
        />
      )}
    </div>
  );
};

FileManager.propTypes = {
  onFileSelect: PropTypes.func,
  folder: PropTypes.string,
  showUploadArea: PropTypes.bool,
  className: PropTypes.string
};

// PERFORMANCE OPTIMIZATION: Memoize FileManager to prevent re-renders when props don't change
// This is critical for this 705-line component that handles file operations and filtering
export default memo(FileManager, (prevProps, nextProps) => {
  return (
    prevProps.folder === nextProps.folder &&
    prevProps.showUploadArea === nextProps.showUploadArea &&
    prevProps.className === nextProps.className &&
    prevProps.onFileSelect === nextProps.onFileSelect
  );
});