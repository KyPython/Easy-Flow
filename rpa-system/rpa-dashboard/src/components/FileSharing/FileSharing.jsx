import React, { useState, useEffect } from 'react';
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
    permission: 'view', // 'view', 'download', 'edit'
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

  // Reset form when dialog opens
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
    }
  }, [isOpen]);

  const handleCreateShare = async () => {
    if (!file) return;
    
    setIsCreating(true);
    try {
      const shareData = {
        fileId: file.id,
        ...shareSettings,
        expiresAt: shareSettings.expiresAt || null
      };
      
      const newShare = await onCreateShare(shareData);
      
      // Copy link to clipboard
      if (newShare.shareUrl) {
        await navigator.clipboard.writeText(newShare.shareUrl);
        setCopiedLink(newShare.id);
        setTimeout(() => setCopiedLink(''), 2000);
      }
    } catch (error) {
      console.error('Failed to create share:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async (shareUrl, shareId) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(shareId);
      setTimeout(() => setCopiedLink(''), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleDeleteShare = async (shareId) => {
    if (window.confirm(t('sharing.confirm_delete', 'Are you sure you want to delete this share link?'))) {
      await onDeleteShare(shareId);
    }
  };

  const getPermissionIcon = (permission) => {
    switch (permission) {
      case 'view': return <FiEye />;
      case 'download': return <FiDownload />;
      case 'edit': return <FiEdit3 />;
      default: return <FiEye />;
    }
  };

  const getPermissionLabel = (permission) => {
    switch (permission) {
      case 'view': return t('sharing.permission_view', 'View only');
      case 'download': return t('sharing.permission_download', 'View & Download');
      case 'edit': return t('sharing.permission_edit', 'View & Edit');
      default: return t('sharing.permission_view', 'View only');
    }
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return t('sharing.no_expiry', 'No expiration');
    return new Date(dateString).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.sharingOverlay}>
      <div className={styles.sharingDialog}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <FiShare2 />
            <h3>{t('sharing.title', 'Share File')}</h3>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className={styles.content}>
          {/* File Info */}
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>{file?.original_name || file?.name}</div>
            <div className={styles.fileDetails}>
              {file?.file_size && (
                <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
              )}
              {file?.mime_type && (
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
                  <button
                    key={perm}
                    className={`${styles.permissionButton} ${
                      shareSettings.permission === perm ? styles.active : ''
                    }`}
                    onClick={() => setShareSettings(prev => ({ ...prev, permission: perm }))}
                  >
                    {getPermissionIcon(perm)}
                    {getPermissionLabel(perm)}
                  </button>
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
                    onChange={(e) => setShareSettings(prev => ({ 
                      ...prev, 
                      requirePassword: e.target.checked,
                      password: e.target.checked ? prev.password : ''
                    }))}
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
                    onChange={(e) => setShareSettings(prev => ({ ...prev, password: e.target.value }))}
                  />
                )}
              </div>

              <div className={styles.settingRow}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={!!shareSettings.expiresAt}
                    onChange={(e) => setShareSettings(prev => ({ 
                      ...prev, 
                      expiresAt: e.target.checked ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : ''
                    }))}
                  />
                  <FiCalendar />
                  {t('sharing.set_expiry', 'Set expiration date')}
                </label>
                
                {shareSettings.expiresAt && (
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={shareSettings.expiresAt}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setShareSettings(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                )}
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button 
              className={styles.advancedToggle}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼' : '▶'} {t('sharing.advanced_settings', 'Advanced Settings')}
            </button>

            {showAdvanced && (
              <div className={styles.advancedSettings}>
                <div className={styles.settingRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={shareSettings.allowAnonymous}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, allowAnonymous: e.target.checked }))}
                    />
                    <FiGlobe />
                    {t('sharing.allow_anonymous', 'Allow anonymous access')}
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={shareSettings.notifyOnAccess}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, notifyOnAccess: e.target.checked }))}
                    />
                    <FiMail />
                    {t('sharing.notify_access', 'Notify me when accessed')}
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label>{t('sharing.max_downloads', 'Maximum downloads (optional)')}</label>
                  <input
                    type="number"
                    className={styles.numberInput}
                    placeholder="Unlimited"
                    min="1"
                    value={shareSettings.maxDownloads || ''}
                    onChange={(e) => setShareSettings(prev => ({ 
                      ...prev, 
                      maxDownloads: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  />
                </div>
              </div>
            )}

            {/* Create Button */}
            <button 
              className={styles.createButton}
              onClick={handleCreateShare}
              disabled={isCreating || (shareSettings.requirePassword && !shareSettings.password)}
            >
              {isCreating ? (
                <span>{t('sharing.creating', 'Creating...')}</span>
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
              <h4>{t('sharing.existing_shares', 'Existing Share Links')}</h4>
              <div className={styles.sharesList}>
                {existingShares.map(share => (
                  <div key={share.id} className={styles.shareItem}>
                    <div className={styles.shareInfo}>
                      <div className={styles.sharePermission}>
                        {getPermissionIcon(share.permissions)}
                        {getPermissionLabel(share.permissions)}
                      </div>
                      <div className={styles.shareDetails}>
                        {share.requirePassword && (
                          <span className={styles.shareFeature}>
                            <FiLock /> {t('sharing.password_protected', 'Password protected')}
                          </span>
                        )}
                        <span className={styles.shareExpiry}>
                          <FiCalendar /> {formatExpiryDate(share.expiresAt)}
                        </span>
                        {share.accessCount > 0 && (
                          <span className={styles.shareAccess}>
                            <FiUsers /> {share.accessCount} {t('sharing.accesses', 'accesses')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.shareActions}>
                      <button
                        className={`${styles.actionButton} ${styles.copy}`}
                        onClick={() => handleCopyLink(share.shareUrl, share.id)}
                        title={t('sharing.copy_link', 'Copy link')}
                      >
                        {copiedLink === share.id ? <FiCheck /> : <FiCopy />}
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.delete}`}
                        onClick={() => handleDeleteShare(share.id)}
                        title={t('sharing.delete_share', 'Delete share')}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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

export default FileSharing;
