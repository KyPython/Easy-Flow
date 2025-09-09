import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import FolderBrowser from '../FolderBrowser/FolderBrowser';
import TagManager from '../TagManager/TagManager';
import DragDropFileManager from '../DragDropFileManager/DragDropFileManager';
import BulkOperations from '../BulkOperations/BulkOperations';
import BreadcrumbNavigation from '../BreadcrumbNavigation/BreadcrumbNavigation';
import styles from './FileOrganizationSystem.module.css';

const FileOrganizationSystem = () => {
  const { t } = useI18n();
  
  // State management for all components
  const [folders, setFolders] = useState([
    { id: '1', name: 'Documents', parentId: null, children: [] },
    { id: '2', name: 'Images', parentId: null, children: [] },
    { id: '3', name: 'Projects', parentId: null, children: [] }
  ]);
  
  const [tags, setTags] = useState([
    { id: '1', name: 'Important', color: '#ef4444', fileCount: 5 },
    { id: '2', name: 'Work', color: '#3b82f6', fileCount: 12 },
    { id: '3', name: 'Personal', color: '#10b981', fileCount: 8 }
  ]);
  
  const [files, setFiles] = useState([
    { id: '1', name: 'document1.pdf', folderId: '1', tags: ['1'], selected: false },
    { id: '2', name: 'image.jpg', folderId: '2', tags: ['3'], selected: false },
    { id: '3', name: 'project.zip', folderId: '3', tags: ['1', '2'], selected: true }
  ]);
  
  const [currentPath, setCurrentPath] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(['3']);
  const [currentView, setCurrentView] = useState('grid'); // 'grid' or 'list'

  // Event handlers
  const handleFolderCreate = (name, parentId = null) => {
    const newFolder = {
      id: Date.now().toString(),
      name,
      parentId,
      children: []
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleFolderRename = (folderId, newName) => {
    setFolders(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, name: newName } : folder
    ));
  };

  const handleFolderDelete = (folderId) => {
    setFolders(prev => prev.filter(folder => folder.id !== folderId));
    // Also move files from deleted folder to root
    setFiles(prev => prev.map(file => 
      file.folderId === folderId ? { ...file, folderId: null } : file
    ));
  };

  const handleTagCreate = (tag) => {
    const newTag = {
      id: Date.now().toString(),
      ...tag,
      fileCount: 0
    };
    setTags(prev => [...prev, newTag]);
  };

  const handleTagUpdate = (tagId, updates) => {
    setTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, ...updates } : tag
    ));
  };

  const handleTagDelete = (tagId) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId));
    // Remove tag from all files
    setFiles(prev => prev.map(file => ({
      ...file,
      tags: file.tags.filter(id => id !== tagId)
    })));
  };

  const handleFileMove = (fileIds, targetFolderId) => {
    setFiles(prev => prev.map(file => 
      fileIds.includes(file.id) ? { ...file, folderId: targetFolderId } : file
    ));
  };

  const handleFilesTagged = (fileIds, tagIds) => {
    setFiles(prev => prev.map(file => 
      fileIds.includes(file.id) 
        ? { ...file, tags: [...new Set([...file.tags, ...tagIds])] }
        : file
    ));
  };

  const handleFilesDeleted = (fileIds) => {
    setFiles(prev => prev.filter(file => !fileIds.includes(file.id)));
    setSelectedFiles(prev => prev.filter(id => !fileIds.includes(id)));
  };

  const handleBulkSelectionChange = (selectedIds) => {
    setSelectedFiles(selectedIds);
  };

  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

  const handleUploadFile = () => {
    // Trigger file upload dialog
    console.log('Upload file triggered');
  };

  const selectedFilesData = files.filter(file => selectedFiles.includes(file.id));

  return (
    <div className={styles.fileOrganizationSystem}>
      {/* Navigation breadcrumbs */}
      <BreadcrumbNavigation
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onCreateFolder={() => handleFolderCreate('New Folder')}
        onUploadFile={handleUploadFile}
      />

      <div className={styles.mainContent}>
        {/* Left sidebar with folders and tags */}
        <div className={styles.sidebar}>
          <div className={styles.folderSection}>
            <FolderBrowser
              folders={folders}
              currentPath={currentPath.map(p => p.name).join('/')}
              onFolderSelect={(folder) => console.log('Selected folder:', folder)}
              onFolderCreate={handleFolderCreate}
              onFolderRename={handleFolderRename}
              onFolderDelete={handleFolderDelete}
              onFolderMove={(folderId, newParentId) => console.log('Move folder:', folderId, newParentId)}
              compact={false}
            />
          </div>

          <div className={styles.tagSection}>
            <TagManager
              tags={tags}
              onCreateTag={handleTagCreate}
              onUpdateTag={handleTagUpdate}
              onDeleteTag={handleTagDelete}
              onApplyTags={(fileIds, tagIds) => handleFilesTagged(fileIds, tagIds)}
            />
          </div>
        </div>

        {/* Main file area */}
        <div className={styles.fileArea}>
          <DragDropFileManager
            files={files}
            folders={folders}
            selectedFiles={selectedFiles}
            onFileSelect={(fileId) => {
              setSelectedFiles(prev => 
                prev.includes(fileId) 
                  ? prev.filter(id => id !== fileId)
                  : [...prev, fileId]
              );
            }}
            onFileMove={handleFileMove}
            onFileDrop={(fileIds, folderId) => handleFileMove(fileIds, folderId)}
            onBulkSelectionChange={handleBulkSelectionChange}
            viewMode={currentView}
            onViewModeChange={setCurrentView}
          />
        </div>
      </div>

      {/* Bulk operations toolbar (appears when files are selected) */}
      {selectedFiles.length > 0 && (
        <BulkOperations
          selectedFiles={selectedFilesData}
          folders={folders}
          tags={tags}
          onMove={handleFileMove}
          onTag={handleFilesTagged}
          onDelete={handleFilesDeleted}
          onDownload={(fileIds) => console.log('Download files:', fileIds)}
          onSelectionChange={handleBulkSelectionChange}
        />
      )}
    </div>
  );
};

export default FileOrganizationSystem;
