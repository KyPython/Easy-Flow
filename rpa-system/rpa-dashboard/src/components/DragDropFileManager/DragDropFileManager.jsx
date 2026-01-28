import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { FiFile, FiFolder, FiMove, FiTag } from 'react-icons/fi';
import styles from './DragDropFileManager.module.css';

const DragDropFileManager = ({
 files = [],
 folders = [],
 selectedFiles = [],
 onFileSelect,
 onFileMove,
 onFilesMove,
 onFolderSelect,
 onTagFiles,
 showTags = true,
 allowMultiSelect = true
}) => {
 const { t } = useI18n();
 const [draggedFiles, setDraggedFiles] = useState([]);
 const [dragOverFolder, setDragOverFolder] = useState(null);
 const [dragOverZone, setDragOverZone] = useState(null);

 const handleFileSelect = useCallback((file, isMultiSelect = false) => {
 if (allowMultiSelect && isMultiSelect) {
 onFileSelect(file, true);
 } else {
 onFileSelect(file, false);
 }
 }, [allowMultiSelect, onFileSelect]);

 const handleDragStart = useCallback((e, file) => {
 const filesToDrag = selectedFiles.length > 0 && selectedFiles.includes(file.id) 
 ? selectedFiles 
 : [file.id];
 
 setDraggedFiles(filesToDrag);
 e.dataTransfer.effectAllowed = 'move';
 e.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag));
 
 // Add visual feedback
 e.target.style.opacity = '0.5';
 }, [selectedFiles]);

 const handleDragEnd = useCallback((e) => {
 e.target.style.opacity = '1';
 setDraggedFiles([]);
 setDragOverFolder(null);
 setDragOverZone(null);
 }, []);

 const handleDragOver = useCallback((e) => {
 e.preventDefault();
 e.dataTransfer.dropEffect = 'move';
 }, []);

 const handleFolderDragEnter = useCallback((e, folder) => {
 e.preventDefault();
 setDragOverFolder(folder.id);
 }, []);

 const handleFolderDragLeave = useCallback((e, folder) => {
 e.preventDefault();
 // Only clear if we're actually leaving the folder element
 if (!e.currentTarget.contains(e.relatedTarget)) {
 setDragOverFolder(null);
 }
 }, []);

 const handleFolderDrop = useCallback((e, folder) => {
 e.preventDefault();
 setDragOverFolder(null);
 
 const draggedFileIds = JSON.parse(e.dataTransfer.getData('text/plain'));
 if (draggedFileIds.length > 0) {
 if (draggedFileIds.length === 1) {
 onFileMove(draggedFileIds[0], folder.id);
 } else {
 onFilesMove(draggedFileIds, folder.id);
 }
 }
 }, [onFileMove, onFilesMove]);

 const getFileIcon = useCallback((file) => {
 const extension = file.name.split('.').pop().toLowerCase();
 const iconMap = {
 'pdf': '📄',
 'doc': '📝',
 'docx': '📝',
 'txt': '📄',
 'xls': '📊',
 'xlsx': '📊',
 'ppt': '📽️',
 'pptx': '📽️',
 'jpg': '🖼️',
 'jpeg': '🖼️',
 'png': '🖼️',
 'gif': '🖼️',
 'zip': '🗜️',
 'rar': '🗜️',
 'mp4': '🎬',
 'avi': '🎬',
 'mp3': '🎵',
 'wav': '🎵'
 };
 return iconMap[extension] || '📄';
 }, []);

 const formatFileSize = useCallback((bytes) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
 }, []);

 const renderFile = useCallback((file) => {
 const isSelected = selectedFiles.includes(file.id);
 const isDragging = draggedFiles.includes(file.id);

 return (
 <div
 key={file.id}
 className={`${styles.fileItem} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
 onClick={(e) => handleFileSelect(file, e.ctrlKey || e.metaKey)}
 draggable
 onDragStart={(e) => handleDragStart(e, file)}
 onDragEnd={handleDragEnd}
 >
 <div className={styles.fileIcon}>
 {getFileIcon(file)}
 </div>
 
 <div className={styles.fileInfo}>
 <div className={styles.fileName} title={file.name}>
 {file.name}
 </div>
 <div className={styles.fileDetails}>
 <span className={styles.fileSize}>
 {formatFileSize(file.size)}
 </span>
 {file.modifiedAt && (
 <span className={styles.fileDate}>
 {new Date(file.modifiedAt).toLocaleDateString()}
 </span>
 )}
 </div>
 </div>

 {showTags && file.tags && file.tags.length > 0 && (
 <div className={styles.fileTags}>
 {file.tags.slice(0, 3).map(tag => (
 <span
 key={tag.id}
 className={styles.fileTag}
 style={{ backgroundColor: tag.color }}
 >
 {tag.name}
 </span>
 ))}
 {file.tags.length > 3 && (
 <span className={styles.moreTagsIndicator}>
 +{file.tags.length - 3}
 </span>
 )}
 </div>
 )}

 {isSelected && (
 <div className={styles.selectionIndicator}>
 ✓
 </div>
 )}
 </div>
 );
 }, [
 selectedFiles, 
 draggedFiles, 
 handleFileSelect, 
 handleDragStart, 
 handleDragEnd, 
 getFileIcon, 
 formatFileSize, 
 showTags
 ]);

 const renderFolder = useCallback((folder) => {
 const isDragOver = dragOverFolder === folder.id;

 return (
 <div
 key={folder.id}
 className={`${styles.folderDropZone} ${isDragOver ? styles.dragOver : ''}`}
 onDragOver={handleDragOver}
 onDragEnter={(e) => handleFolderDragEnter(e, folder)}
 onDragLeave={(e) => handleFolderDragLeave(e, folder)}
 onDrop={(e) => handleFolderDrop(e, folder)}
 onClick={() => onFolderSelect(folder)}
 >
 <FiFolder className={styles.folderIcon} />
 <span className={styles.folderName}>{folder.name}</span>
 <span className={styles.fileCount}>
 {folder.fileCount || 0} {t('files.files', 'files')}
 </span>
 
 {isDragOver && (
 <div className={styles.dropIndicator}>
 <FiMove />
 {t('files.drop_here', 'Drop files here')}
 </div>
 )}
 </div>
 );
 }, [
 dragOverFolder,
 handleDragOver,
 handleFolderDragEnter,
 handleFolderDragLeave,
 handleFolderDrop,
 onFolderSelect,
 t
 ]);

 return (
 <div className={styles.dragDropFileManager}>
 {folders.length > 0 && (
 <div className={styles.foldersSection}>
 <h3 className={styles.sectionTitle}>
 <FiFolder />
 {t('files.folders', 'Folders')}
 </h3>
 <div className={styles.foldersGrid}>
 {folders.map(renderFolder)}
 </div>
 </div>
 )}

 <div className={styles.filesSection}>
 <div className={styles.sectionHeader}>
 <h3 className={styles.sectionTitle}>
 <FiFile />
 {t('files.files', 'Files')}
 </h3>
 {selectedFiles.length > 0 && (
 <div className={styles.selectionInfo}>
 {t('files.selected_count', `${selectedFiles.length} selected`)}
 </div>
 )}
 </div>
 
 <div className={styles.filesGrid}>
 {files.map(renderFile)}
 </div>
 </div>

 {files.length === 0 && folders.length === 0 && (
 <div className={styles.emptyState}>
 <FiFile />
 <h3>{t('files.empty_title', 'No files yet')}</h3>
 <p>{t('files.empty_message', 'Upload some files to get started')}</p>
 </div>
 )}
 </div>
 );
};

export default DragDropFileManager;
