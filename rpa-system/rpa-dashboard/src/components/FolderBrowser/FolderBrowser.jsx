import React, { useState, useCallback, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useTheme } from '../../utils/ThemeContext';
import { 
  buildFolderTree, 
  findFolderByPath, 
  createFolderPath, 
  validateFolderName,
  isValidDrop,
  formatDate
} from '../../utils/folderManagement';
import styles from './FolderBrowser.module.css';
import PropTypes from 'prop-types';

const FolderBrowser = ({
  folders = [],
  currentPath = '/',
  onFolderSelect,
  onFolderCreate,
  onFolderRename,
  onFolderDelete,
  onFolderMove,
  showCreateButton = true,
  showContextMenu = true,
  compact = false,
  className = ''
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [folderTree, setFolderTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['/']));
  const [selectedFolder, setSelectedFolder] = useState(currentPath);
  const [contextMenu, setContextMenu] = useState(null);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState('/');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [dragOver, setDragOver] = useState(null);

  // Build folder tree when folders change
  useEffect(() => {
    const tree = buildFolderTree(folders);
    setFolderTree(tree);
  }, [folders]);

  // Update selected folder when currentPath changes
  useEffect(() => {
    setSelectedFolder(currentPath);
    
    // Auto-expand parent folders of current path
    const pathParts = currentPath.split('/').filter(Boolean);
    const newExpanded = new Set(expandedFolders);
    
    let buildPath = '';
    pathParts.forEach(part => {
      buildPath += '/' + part;
      newExpanded.add(buildPath);
    });
    newExpanded.add('/');
    
    setExpandedFolders(newExpanded);
  }, [currentPath]);

  const handleFolderToggle = useCallback((path) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handleFolderSelect = useCallback((folder) => {
    setSelectedFolder(folder.path);
    onFolderSelect?.(folder);
    setContextMenu(null);
  }, [onFolderSelect]);

  const handleContextMenu = useCallback((e, folder) => {
    if (!showContextMenu || folder.system) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folder
    });
  }, [showContextMenu]);

  const handleCreateFolder = useCallback((parentPath) => {
    setNewFolderParent(parentPath);
    setNewFolderName('');
    setShowNewFolderForm(true);
    setContextMenu(null);
  }, []);

  const handleSubmitNewFolder = useCallback(async (e) => {
    e.preventDefault();
    
    const validation = validateFolderName(newFolderName);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    try {
      const newPath = createFolderPath(newFolderParent, validation.name);
      await onFolderCreate?.(newPath, validation.name);
      
      // Expand parent folder
      setExpandedFolders(prev => new Set([...prev, newFolderParent]));
      
      setShowNewFolderForm(false);
      setNewFolderName('');
    } catch (error) {
      alert(error.message || 'Failed to create folder');
    }
  }, [newFolderName, newFolderParent, onFolderCreate]);

  const handleStartRename = useCallback((folder) => {
    setEditingFolder(folder.path);
    setEditingName(folder.name);
    setContextMenu(null);
  }, []);

  const handleSubmitRename = useCallback(async (e) => {
    e.preventDefault();
    
    const validation = validateFolderName(editingName);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    try {
      await onFolderRename?.(editingFolder, validation.name);
      setEditingFolder(null);
      setEditingName('');
    } catch (error) {
      alert(error.message || 'Failed to rename folder');
    }
  }, [editingFolder, editingName, onFolderRename]);

  const handleDelete = useCallback(async (folder) => {
    if (!confirm(`Are you sure you want to delete the folder "${folder.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await onFolderDelete?.(folder.path);
      setContextMenu(null);
    } catch (error) {
      alert(error.message || 'Failed to delete folder');
    }
  }, [onFolderDelete]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, folder) => {
    if (folder.system) {
      e.preventDefault();
      return;
    }
    
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'folder',
      path: folder.path,
      name: folder.name
    }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, folder) => {
    e.preventDefault();
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (isValidDrop(dragData, folder.path)) {
        e.dataTransfer.dropEffect = 'move';
        setDragOver(folder.path);
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    } catch {
      e.dataTransfer.dropEffect = 'none';
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Only clear drag over if we're leaving the folder entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  }, []);

  const handleDrop = useCallback(async (e, targetFolder) => {
    e.preventDefault();
    setDragOver(null);
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      
      if (dragData.type === 'folder' && isValidDrop(dragData, targetFolder.path)) {
        await onFolderMove?.(dragData.path, targetFolder.path);
      }
    } catch (error) {
      console.error('Drop failed:', error);
    }
  }, [onFolderMove]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Click outside to close context menu
  useEffect(() => {
    if (contextMenu) {
      const handleClickOutside = () => setContextMenu(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  const renderFolder = useCallback((folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.path);
    const isSelected = selectedFolder === folder.path;
    const isDragOver = dragOver === folder.path;
    const hasChildren = folder.children && folder.children.length > 0;
    const isEditing = editingFolder === folder.path;

    return (
      <div key={folder.path} className={styles.folderItem}>
        <div
          className={`${styles.folderRow} ${isSelected ? styles.selected : ''} ${isDragOver ? styles.dragOver : ''} ${compact ? styles.compact : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => handleFolderSelect(folder)}
          onContextMenu={(e) => handleContextMenu(e, folder)}
          onDragStart={(e) => handleDragStart(e, folder)}
          onDragOver={(e) => handleDragOver(e, folder)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder)}
          draggable={!folder.system}
        >
          {hasChildren && (
            <button
              className={styles.expandButton}
              onClick={(e) => {
                e.stopPropagation();
                handleFolderToggle(folder.path);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          <div className={styles.folderIcon}>
            {folder.icon}
          </div>
          
          <div className={styles.folderInfo}>
            {isEditing ? (
              <form onSubmit={handleSubmitRename} className={styles.editForm}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className={styles.editInput}
                  autoFocus
                  onBlur={() => setEditingFolder(null)}
                  title="Type a new name for this folder."
                />
                <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
                  <b>What is this?</b> Change the folder’s name to anything you want. Example: <code>2025 Projects</code>
                </div>
              </form>
            ) : (
              <>
                <span className={styles.folderName}>{folder.name}</span>
                {!compact && folder.fileCount > 0 && (
                  <span className={styles.fileCount}>
                    {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                  </span>
                )}
              </>
            )}
          </div>
          
          {folder.system && (
            <span className={styles.systemBadge}>System</span>
          )}
        </div>
        
        {isExpanded && hasChildren && (
          <div className={styles.folderChildren}>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [
    expandedFolders, selectedFolder, dragOver, editingFolder, editingName, compact,
    handleFolderSelect, handleContextMenu, handleDragStart, handleDragOver, 
    handleDragLeave, handleDrop, handleFolderToggle, handleSubmitRename
  ]);

  return (
    <div className={`${styles.folderBrowser} ${compact ? styles.compact : ''} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('folders.browser_title', 'Folders')}</h3>
        {showCreateButton && (
          <button
            className={styles.createButton}
            onClick={() => handleCreateFolder('/')}
            title={t('folders.create_folder', 'Create Folder')}
          >
            📁+
          </button>
        )}
      </div>
      
      <div className={styles.folderList}>
        {folderTree.map(folder => renderFolder(folder))}
      </div>
      
      {/* New Folder Form */}
      {showNewFolderForm && (
        <div className={styles.modalOverlay} onClick={() => setShowNewFolderForm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4>{t('folders.create_new_folder', 'Create New Folder')}</h4>
            <form onSubmit={handleSubmitNewFolder}>
              <div className={styles.formGroup}>
                <label>{t('folders.folder_name', 'Folder Name')}</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t('folders.enter_folder_name', 'Enter folder name...')}
                  className={styles.input}
                  autoFocus
                  required
                  title="Type a name for your new folder."
                />
                <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
                  <b>What is this?</b> Pick any name you like. Example: <code>Invoices</code> or <code>My Documents</code>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowNewFolderForm(false)} className={styles.cancelButton}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" className={styles.createButton}>
                  {t('folders.create', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => handleCreateFolder(contextMenu.folder.path)}>
            📁+ {t('folders.create_subfolder', 'Create Subfolder')}
          </button>
          <button onClick={() => handleStartRename(contextMenu.folder)}>
            ✏️ {t('folders.rename', 'Rename')}
          </button>
          <button 
            onClick={() => handleDelete(contextMenu.folder)}
            className={styles.deleteAction}
          >
            🗑️ {t('folders.delete', 'Delete')}
          </button>
        </div>
      )}
      
      {contextMenu && (
        <div className={styles.contextMenuOverlay} onClick={handleCloseContextMenu} />
      )}
    </div>
  );
};

FolderBrowser.propTypes = {
  folders: PropTypes.array,
  currentPath: PropTypes.string,
  onFolderSelect: PropTypes.func,
  onFolderCreate: PropTypes.func,
  onFolderRename: PropTypes.func,
  onFolderDelete: PropTypes.func,
  onFolderMove: PropTypes.func,
  showCreateButton: PropTypes.bool,
  showContextMenu: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string
};

export default FolderBrowser;