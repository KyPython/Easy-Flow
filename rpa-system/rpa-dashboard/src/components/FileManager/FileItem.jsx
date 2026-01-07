/*
 * PERFORMANCE OPTIMIZATION: Extracted FileItem as memoized component
 * 
 * WHAT: Separate component for individual file items in the file list
 * WHY: Prevents re-rendering all file items when only one file changes
 * HOW: Uses React.memo with deep comparison for file object
 * 
 * IMPACT: Significantly reduces render cycles in large file lists
 * REVERT: Inline this component back into FileManager.jsx
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { getCategoryIcon, getCategoryColor } from '../../utils/fileCategories';
import styles from './FileManager.module.css';

const FileItem = memo(({ 
 file, 
 view, 
 onSelect, 
 onDownload, 
 onDelete, 
 onShare, 
 isSelected,
 t 
}) => {
 const handleClick = () => {
 if (onSelect) {
 onSelect(file);
 }
 };

 const categoryIcon = getCategoryIcon(file.category);
 const categoryColor = getCategoryColor(file.category);

 const formatFileSize = (bytes) => {
 if (!bytes) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
 };

 const formatDate = (dateString) => {
 return new Date(dateString).toLocaleDateString();
 };

 if (view === 'list') {
 return (
 <div 
 className={`${styles.fileItemList} ${isSelected ? styles.selected : ''}`}
 onClick={handleClick}
 >
 <div className={styles.fileIcon} style={{ color: categoryColor }}>
 {categoryIcon}
 </div>
 <div className={styles.fileName}>{file.name}</div>
 <div className={styles.fileSize}>{formatFileSize(file.size)}</div>
 <div className={styles.fileDate}>{formatDate(file.created_at)}</div>
 <div className={styles.fileActions}>
 <button onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
 {t('download')}
 </button>
 <button onClick={(e) => { e.stopPropagation(); onShare(file); }}>
 {t('share')}
 </button>
 <button onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}>
 {t('delete')}
 </button>
 </div>
 </div>
 );
 }

 // Grid view
 return (
 <div 
 className={`${styles.fileItem} ${isSelected ? styles.selected : ''}`}
 onClick={handleClick}
 >
 <div className={styles.fileIcon} style={{ color: categoryColor }}>
 {categoryIcon}
 </div>
 <div className={styles.fileName} title={file.name}>
 {file.name}
 </div>
 <div className={styles.fileInfo}>
 <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
 <span className={styles.fileDate}>{formatDate(file.created_at)}</span>
 </div>
 <div className={styles.fileActions}>
 <button onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
 📥
 </button>
 <button onClick={(e) => { e.stopPropagation(); onShare(file); }}>
 🔗
 </button>
 <button onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}>
 🗑️
 </button>
 </div>
 </div>
 );
}, (prevProps, nextProps) => {
 // Custom comparison - only re-render if file data, selection, or view changes
 return (
 JSON.stringify(prevProps.file) === JSON.stringify(nextProps.file) &&
 prevProps.isSelected === nextProps.isSelected &&
 prevProps.view === nextProps.view &&
 prevProps.onSelect === nextProps.onSelect &&
 prevProps.onDownload === nextProps.onDownload &&
 prevProps.onDelete === nextProps.onDelete &&
 prevProps.onShare === nextProps.onShare
 );
});

FileItem.propTypes = {
 file: PropTypes.object.isRequired,
 view: PropTypes.string.isRequired,
 onSelect: PropTypes.func,
 onDownload: PropTypes.func.isRequired,
 onDelete: PropTypes.func.isRequired,
 onShare: PropTypes.func.isRequired,
 isSelected: PropTypes.bool,
 t: PropTypes.func.isRequired
};

export default FileItem;