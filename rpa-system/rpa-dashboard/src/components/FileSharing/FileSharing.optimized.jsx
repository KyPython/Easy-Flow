// Performance optimized FileSharing component with React.memo and useMemo
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';
import { 
  FiShare2, 
  FiLink, 
  FiCopy, 
  FiEye, 
  FiDownload, 
  FiEdit3, 
  FiLock,
  FiUnlock,
  FiCalendar,
  FiUsers,
  FiTrash2,
  FiCheck,
  FiX,
  FiGlobe,
  FiMail
} from 'react-icons/fi';
import { 
  createFileShare, 
  updateFileShare, 
  deleteFileShare,
  getShareUrl 
} from '../../utils/api';
import styles from './FileSharing.module.css';

// Memoized permission button component
const PermissionButton = React.memo(({ 
  permission, 
  isActive, 
  onClick, 
  getPermissionIcon, 
  getPermissionLabel 
}) => (
  <button
    className={`${styles.permissionButton} ${isActive ? styles.active : ''}`}
    onClick={() => onClick(permission)}
    type="button"
  >
    {getPermissionIcon(permission)}
    {getPermissionLabel(permission)}
  </button>
));

PermissionButton.propTypes = {
  permission: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  getPermissionIcon: PropTypes.func.isRequired,
  getPermissionLabel: PropTypes.func.isRequired
};

// Memoized existing share item component
const ShareItem = React.memo(({ 
  share, 
  onCopyLink, 
  onDelete, 
  getPermissionIcon, 
  getPermissionLabel, 
  t 
}) => {
  const handleCopyClick = useCallback(() => {
    onCopyLink(share.shareUrl);
  }, [share.shareUrl, onCopyLink]);

  const handleDeleteClick = useCallback(() => {
    onDelete(share.id);
  }, [share.id, onDelete]);

  return (
    <div className={styles.shareItem}>
      <div className={styles.shareInfo}>
        <div className={styles.shareHeader}>
          <span className={styles.sharePermission}>
            {getPermissionIcon(share.permissions)}
            {getPermissionLabel(share.permissions)}
          </span>
          <span className={styles.shareDate}>
            {new Date(share.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className={styles.shareUrl}>
          {share.shareUrl}
        </div>
      </div>
      <div className={styles.shareActions}>
        <button
          onClick={handleCopyClick}
          className={styles.copyBtn}
          title={t('sharing.copy_link', 'Copy link')}
          type="button"
        >
          <FiCopy />
        </button>
        <button
          onClick={handleDeleteClick}
          className={styles.deleteBtn}
          title={t('sharing.delete_share', 'Delete share')}
          type="button"
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
});

ShareItem.propTypes = {
  share: PropTypes.object.isRequired,
  onCopyLink: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  getPermissionIcon: PropTypes.func.isRequired,
  getPermissionLabel: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired
};

const FileSharing = ({ 
  file, 
  isOpen = false, 
  onClose, 
  onCreateShare, 
  onUpdateShare, 
  onDeleteShare,
  existingShares = []
}) => {
  const { t } = useI18n();
  const [shareSettings, setShareSettings] = useState({
    permission: 'view',
    requirePassword: false,
    password: '',
    expiresAt: '',
    allowAnonymous: true,
    maxDownloads: null,
    notifyOnAccess: false
  });
  const [isCreating, setIsCreating] = useState(false);
  const [copiedLink, setCopiedLink] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Memoized permission handlers
  const getPermissionIcon = useMemo(() => (permission) => {
    switch (permission) {
      case 'view': return <FiEye />;
      case 'download': return <FiDownload />;
      case 'edit': return <FiEdit3 />;
      default: return <FiEye />;
    }
  }, []);

  const getPermissionLabel = useMemo(() => (permission) => {
    switch (permission) {
      case 'view': return t('sharing.permission_view', 'View only');
      case 'download': return t('sharing.permission_download', 'View & Download');
      case 'edit': return t('sharing.permission_edit', 'View & Edit');
      default: return t('sharing.permission_view', 'View only');
    }
  }, [t]);

  // Memoized file size formatter
  const formatFileSize = useMemo(() => {
    if (!file?.file_size) return '';
    const size = typeof file.file_size === 'string' ? parseInt(file.file_size) : file.file_size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, [file?.file_size]);

  // Optimized event handlers with useCallback
  const handlePermissionChange = useCallback((permission) => {
    setShareSettings(prev => ({ ...prev, permission }));
  }, []);

  const handleSettingsChange = useCallback((field, value) => {
    setShareSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCopyLink = useCallback(async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(''), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(''), 2000);
    }
  }, []);

  const handleDeleteShare = useCallback(async (shareId) => {
    if (!window.confirm(t('sharing.confirm_delete', 'Are you sure you want to delete this share?'))) {
      return;
    }
    
    try {
      await onDeleteShare(shareId);
    } catch (error) {
      console.error('Failed to delete share:', error);
    }
  }, [onDeleteShare, t]);

  const handleCreateShare = useCallback(async () => {
    if (!file) return;
    
    setIsCreating(true);
    try {
      const shareData = {
        fileId: file.id,
        ...shareSettings,
        expiresAt: shareSettings.expiresAt || null
      };
      
      const newShare = await onCreateShare(shareData);
      
      // Reset form
      setShareSettings({
        permission: 'view',
        requirePassword: false,
        password: '',
        expiresAt: '',
        allowAnonymous: true,
        maxDownloads: null,
        notifyOnAccess: false
      });
      
      // Copy the new share link automatically
      if (newShare?.shareUrl) {
        await handleCopyLink(newShare.shareUrl);
      }
      
    } catch (error) {
      console.error('Failed to create share:', error);
    } finally {
      setIsCreating(false);
    }
  }, [file, shareSettings, onCreateShare, handleCopyLink]);

  // Reset form when dialog opens - optimized
  useEffect(() => {
    if (isOpen) {
      setShareSettings({
        permission: 'view',
        requirePassword: false,
        password: '',
        expiresAt: '',
        allowAnonymous: true,
        maxDownloads: null,
        notifyOnAccess: false
      });
      setShowAdvanced(false);
      setCopiedLink('');
    }
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>
            <FiShare2 />
            {t('sharing.share_file', 'Share File')}
          </h3>
          <button onClick={onClose} className={styles.closeBtn} type="button">
            <FiX />
          </button>
        </div>

        <div className={styles.content}>
          {/* File Info */}
          <div className={styles.fileInfo}>
            <h4>{file.original_name || file.name}</h4>
            <div className={styles.fileMeta}>
              {file.file_size && (
                <span>{formatFileSize}</span>
              )}
              {file.mime_type && (
                <span>{file.mime_type}</span>
              )}
            </div>
          </div>

          {/* Create New Share */}
          <div className={styles.createSection}>
            <h4>{t('sharing.create_new', 'Create New Share Link')}</h4>
            
            {/* Permission Selection */}
            <div className={styles.formGroup}>
              <label>{t('sharing.permissions', 'Permissions')}</label>
              <div className={styles.permissionButtons}>
                {['view', 'download', 'edit'].map(perm => (
                  <PermissionButton
                    key={perm}
                    permission={perm}
                    isActive={shareSettings.permission === perm}
                    onClick={handlePermissionChange}
                    getPermissionIcon={getPermissionIcon}
                    getPermissionLabel={getPermissionLabel}
                  />
                ))}
              </div>
            </div>

            {/* Basic Settings */}
            <div className={styles.basicSettings}>
              <div className={styles.settingRow}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={shareSettings.requirePassword}
                    onChange={(e) => handleSettingsChange('requirePassword', e.target.checked)}
                  />
                  <FiLock />
                  {t('sharing.require_password', 'Require password')}
                </label>
                
                {shareSettings.requirePassword && (
                  <input
                    type="password"
                    className={styles.passwordInput}
                    placeholder={t('sharing.enter_password', 'Enter password')}
                    value={shareSettings.password}
                    onChange={(e) => handleSettingsChange('password', e.target.value)}
                  />
                )}
              </div>

              <div className={styles.settingRow}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={shareSettings.allowAnonymous}
                    onChange={(e) => handleSettingsChange('allowAnonymous', e.target.checked)}
                  />
                  <FiGlobe />
                  {t('sharing.allow_anonymous', 'Allow anonymous access')}
                </label>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              className={styles.advancedToggle}
              onClick={() => setShowAdvanced(!showAdvanced)}
              type="button"
            >
              <FiSettings />
              {t('sharing.advanced_settings', 'Advanced Settings')}
            </button>

            {showAdvanced && (
              <div className={styles.advancedSettings}>
                <div className={styles.settingRow}>
                  <label>
                    <FiCalendar />
                    {t('sharing.expires_at', 'Expires at')}
                  </label>
                  <input
                    type="datetime-local"
                    value={shareSettings.expiresAt}
                    onChange={(e) => handleSettingsChange('expiresAt', e.target.value)}
                    className={styles.dateInput}
                  />
                </div>

                <div className={styles.settingRow}>
                  <label>
                    <FiDownload />
                    {t('sharing.max_downloads', 'Max downloads')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={shareSettings.maxDownloads || ''}
                    onChange={(e) => handleSettingsChange('maxDownloads', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder={t('sharing.unlimited', 'Unlimited')}
                    className={styles.numberInput}
                  />
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={shareSettings.notifyOnAccess}
                      onChange={(e) => handleSettingsChange('notifyOnAccess', e.target.checked)}
                    />
                    <FiMail />
                    {t('sharing.notify_on_access', 'Notify me when accessed')}
                  </label>
                </div>
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreateShare}
              disabled={isCreating || (shareSettings.requirePassword && !shareSettings.password)}
              className={styles.createBtn}
              type="button"
            >
              {isCreating ? (
                <>
                  <div className={styles.spinner} />
                  {t('sharing.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <FiLink />
                  {t('sharing.create_link', 'Create Share Link')}
                </>
              )}
            </button>
          </div>

          {/* Existing Shares */}
          {existingShares.length > 0 && (
            <div className={styles.existingShares}>
              <h4>{t('sharing.existing_shares', 'Existing Shares')}</h4>
              <div className={styles.sharesList}>
                {existingShares.map(share => (
                  <ShareItem
                    key={share.id}
                    share={share}
                    onCopyLink={handleCopyLink}
                    onDelete={handleDeleteShare}
                    getPermissionIcon={getPermissionIcon}
                    getPermissionLabel={getPermissionLabel}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Copy notification */}
          {copiedLink && (
            <div className={styles.notification}>
              <FiCheck />
              {t('sharing.link_copied', 'Link copied to clipboard!')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

FileSharing.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.string.isRequired,
    original_name: PropTypes.string.isRequired,
    name: PropTypes.string,
    file_size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    mime_type: PropTypes.string
  }).isRequired,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onCreateShare: PropTypes.func.isRequired,
  onUpdateShare: PropTypes.func.isRequired,
  onDeleteShare: PropTypes.func.isRequired,
  existingShares: PropTypes.array
};

FileSharing.defaultProps = {
  isOpen: false,
  existingShares: []
};

// Export optimized component with React.memo
export default React.memo(FileSharing);
