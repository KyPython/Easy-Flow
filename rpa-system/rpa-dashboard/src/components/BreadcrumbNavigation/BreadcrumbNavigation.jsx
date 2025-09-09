import React from 'react';
import { FiHome, FiChevronRight, FiFolderPlus, FiUpload } from 'react-icons/fi';
import { useI18n } from '../../hooks/useI18n';
import styles from './BreadcrumbNavigation.module.css';

const BreadcrumbNavigation = ({
  currentPath = [],
  onNavigate,
  onCreateFolder,
  onUploadFile,
  showActions = true,
  className = ''
}) => {
  const { t } = useI18n();

  const handleBreadcrumbClick = (index) => {
    if (onNavigate) {
      const newPath = currentPath.slice(0, index + 1);
      onNavigate(newPath);
    }
  };

  const handleGoHome = () => {
    if (onNavigate) {
      onNavigate([]);
    }
  };

  const handleCreateFolder = () => {
    if (onCreateFolder) {
      onCreateFolder();
    }
  };

  const handleUploadFile = () => {
    if (onUploadFile) {
      onUploadFile();
    }
  };

  return (
    <div className={`${styles.breadcrumbNavigation} ${className}`}>
      <div className={styles.breadcrumbPath}>
        <button
          className={`${styles.breadcrumbItem} ${styles.homeButton}`}
          onClick={handleGoHome}
          title={t('files.navigation.home', 'Home')}
        >
          <FiHome size={16} />
          <span className={styles.homeLabel}>
            {t('files.navigation.home', 'Home')}
          </span>
        </button>
        
        {currentPath.length > 0 && (
          <>
            <FiChevronRight className={styles.separator} size={14} />
            {currentPath.map((folder, index) => (
              <React.Fragment key={`${folder.id || folder.name}-${index}`}>
                <button
                  className={`${styles.breadcrumbItem} ${
                    index === currentPath.length - 1 ? styles.current : ''
                  }`}
                  onClick={() => handleBreadcrumbClick(index)}
                  title={folder.name}
                >
                  <span className={styles.folderName}>
                    {folder.name}
                  </span>
                </button>
                {index < currentPath.length - 1 && (
                  <FiChevronRight className={styles.separator} size={14} />
                )}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      {showActions && (
        <div className={styles.actions}>
          <button
            className={styles.actionButton}
            onClick={handleCreateFolder}
            title={t('files.actions.createFolder', 'Create Folder')}
          >
            <FiFolderPlus size={16} />
            <span className={styles.actionLabel}>
              {t('files.actions.createFolder', 'Create Folder')}
            </span>
          </button>
          
          <button
            className={styles.actionButton}
            onClick={handleUploadFile}
            title={t('files.actions.uploadFile', 'Upload File')}
          >
            <FiUpload size={16} />
            <span className={styles.actionLabel}>
              {t('files.actions.uploadFile', 'Upload')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default BreadcrumbNavigation;
