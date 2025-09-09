import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { 
  FiCheckSquare, 
  FiSquare, 
  FiMove, 
  FiTag, 
  FiTrash2, 
  FiDownload,
  FiX,
  FiFolder
} from 'react-icons/fi';
import styles from './BulkOperations.module.css';

const BulkOperations = ({
  files = [],
  folders = [],
  tags = [],
  selectedFiles = [],
  onSelectAll,
  onSelectNone,
  onSelectFiles,
  onMoveFiles,
  onTagFiles,
  onDeleteFiles,
  onDownloadFiles,
  isVisible = false,
  onClose
}) => {
  const { t } = useI18n();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagOperation, setTagOperation] = useState('add'); // 'add' or 'replace'

  const allFileIds = files.map(f => f.id);
  const isAllSelected = selectedFiles.length === files.length && files.length > 0;
  const isPartiallySelected = selectedFiles.length > 0 && selectedFiles.length < files.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectNone();
    } else {
      onSelectAll();
    }
  };

  const handleMoveFiles = () => {
    if (selectedFolder && selectedFiles.length > 0) {
      onMoveFiles(selectedFiles, selectedFolder);
      setShowMoveDialog(false);
      setSelectedFolder('');
    }
  };

  const handleTagFiles = () => {
    if (selectedTags.length > 0 && selectedFiles.length > 0) {
      onTagFiles(selectedFiles, selectedTags, tagOperation);
      setShowTagDialog(false);
      setSelectedTags([]);
    }
  };

  const handleDeleteFiles = () => {
    if (selectedFiles.length > 0) {
      const fileNames = files
        .filter(f => selectedFiles.includes(f.id))
        .map(f => f.name)
        .slice(0, 3)
        .join(', ');
      
      const message = selectedFiles.length > 3
        ? t('bulk.delete_confirm_multiple', `Delete ${fileNames} and ${selectedFiles.length - 3} more files?`)
        : t('bulk.delete_confirm', `Delete ${fileNames}?`);

      if (window.confirm(message)) {
        onDeleteFiles(selectedFiles);
      }
    }
  };

  const handleDownloadFiles = () => {
    if (selectedFiles.length > 0) {
      onDownloadFiles(selectedFiles);
    }
  };

  const toggleTagSelection = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  if (!isVisible || selectedFiles.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.bulkOperations}>
        <div className={styles.selectionInfo}>
          <button
            className={styles.selectAllButton}
            onClick={handleSelectAll}
            title={isAllSelected ? t('bulk.deselect_all', 'Deselect all') : t('bulk.select_all', 'Select all')}
          >
            {isAllSelected ? <FiCheckSquare /> : isPartiallySelected ? <FiCheckSquare className={styles.partial} /> : <FiSquare />}
          </button>
          <span className={styles.selectionCount}>
            {t('bulk.selected_count', `${selectedFiles.length} of ${files.length} selected`)}
          </span>
          <button
            className={styles.closeButton}
            onClick={onClose}
            title={t('common.close', 'Close')}
          >
            <FiX />
          </button>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.actionButton} ${styles.move}`}
            onClick={() => setShowMoveDialog(true)}
            disabled={folders.length === 0}
            title={t('bulk.move_files', 'Move files')}
          >
            <FiMove />
            {t('bulk.move', 'Move')}
          </button>

          <button
            className={`${styles.actionButton} ${styles.tag}`}
            onClick={() => setShowTagDialog(true)}
            disabled={tags.length === 0}
            title={t('bulk.tag_files', 'Tag files')}
          >
            <FiTag />
            {t('bulk.tag', 'Tag')}
          </button>

          <button
            className={`${styles.actionButton} ${styles.download}`}
            onClick={handleDownloadFiles}
            title={t('bulk.download_files', 'Download files')}
          >
            <FiDownload />
            {t('bulk.download', 'Download')}
          </button>

          <button
            className={`${styles.actionButton} ${styles.delete}`}
            onClick={handleDeleteFiles}
            title={t('bulk.delete_files', 'Delete files')}
          >
            <FiTrash2 />
            {t('bulk.delete', 'Delete')}
          </button>
        </div>
      </div>

      {/* Move Dialog */}
      {showMoveDialog && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialog}>
            <div className={styles.dialogHeader}>
              <h3>{t('bulk.move_dialog_title', 'Move Files')}</h3>
              <button
                className={styles.dialogClose}
                onClick={() => setShowMoveDialog(false)}
              >
                <FiX />
              </button>
            </div>

            <div className={styles.dialogContent}>
              <p>
                {t('bulk.move_dialog_message', `Move ${selectedFiles.length} selected files to:`)}
              </p>

              <div className={styles.folderList}>
                {folders.map(folder => (
                  <label key={folder.id} className={styles.folderOption}>
                    <input
                      type="radio"
                      name="targetFolder"
                      value={folder.id}
                      checked={selectedFolder === folder.id}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                    />
                    <FiFolder />
                    <span>{folder.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.dialogActions}>
              <button
                className={`${styles.dialogButton} ${styles.secondary}`}
                onClick={() => setShowMoveDialog(false)}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                className={`${styles.dialogButton} ${styles.primary}`}
                onClick={handleMoveFiles}
                disabled={!selectedFolder}
              >
                {t('bulk.move_confirm', 'Move Files')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Dialog */}
      {showTagDialog && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialog}>
            <div className={styles.dialogHeader}>
              <h3>{t('bulk.tag_dialog_title', 'Tag Files')}</h3>
              <button
                className={styles.dialogClose}
                onClick={() => setShowTagDialog(false)}
              >
                <FiX />
              </button>
            </div>

            <div className={styles.dialogContent}>
              <p>
                {t('bulk.tag_dialog_message', `Apply tags to ${selectedFiles.length} selected files:`)}
              </p>

              <div className={styles.tagOperationSelect}>
                <label>
                  <input
                    type="radio"
                    name="tagOperation"
                    value="add"
                    checked={tagOperation === 'add'}
                    onChange={(e) => setTagOperation(e.target.value)}
                  />
                  {t('bulk.add_tags', 'Add tags')}
                </label>
                <label>
                  <input
                    type="radio"
                    name="tagOperation"
                    value="replace"
                    checked={tagOperation === 'replace'}
                    onChange={(e) => setTagOperation(e.target.value)}
                  />
                  {t('bulk.replace_tags', 'Replace all tags')}
                </label>
              </div>

              <div className={styles.tagList}>
                {tags.map(tag => (
                  <label key={tag.id} className={styles.tagOption}>
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={() => toggleTagSelection(tag.id)}
                    />
                    <span 
                      className={styles.tagColor}
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className={styles.tagName}>{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.dialogActions}>
              <button
                className={`${styles.dialogButton} ${styles.secondary}`}
                onClick={() => setShowTagDialog(false)}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                className={`${styles.dialogButton} ${styles.primary}`}
                onClick={handleTagFiles}
                disabled={selectedTags.length === 0}
              >
                {t('bulk.apply_tags', 'Apply Tags')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkOperations;
