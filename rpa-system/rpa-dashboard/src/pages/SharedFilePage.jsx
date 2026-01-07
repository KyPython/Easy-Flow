import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
 FiDownload, 
 FiEye, 
 FiLock, 
 FiAlertCircle,
 FiFile,
 FiImage,
 FiVideo,
 FiMusic,
 FiFileText
} from 'react-icons/fi';
import { getSharedFile } from '../utils/api';
import styles from './SharedFilePage.module.css';
import { validateUrl, sanitizeFilename } from '../utils/security';

const SharedFilePage = () => {
 const { shareToken } = useParams();
 const navigate = useNavigate();
 const [file, setFile] = useState(null);
 const [permission, setPermission] = useState(null);
 const [downloadUrl, setDownloadUrl] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [requirePassword, setRequirePassword] = useState(false);
 const [password, setPassword] = useState('');
 const [isAccessing, setIsAccessing] = useState(false);

 useEffect(() => {
 if (shareToken) {
 accessSharedFile();
 }
 }, [shareToken]);

 const accessSharedFile = async (passwordInput = null) => {
 setIsAccessing(true);
 setError('');
 
 try {
 const result = await getSharedFile(shareToken, passwordInput);
 setFile(result.file);
 setPermission(result.permission);
 setDownloadUrl(result.downloadUrl);
 setRequirePassword(false);
 } catch (err) {
 if (err.message.includes('Password required')) {
 setRequirePassword(true);
 } else if (err.message.includes('Invalid password')) {
 setError('Invalid password. Please try again.');
 setRequirePassword(true);
 } else if (err.message.includes('expired')) {
 setError('This share link has expired.');
 } else if (err.message.includes('limit reached')) {
 setError('This share link has reached its download limit.');
 } else {
 setError(err.message || 'Failed to access shared file');
 }
 } finally {
 setLoading(false);
 setIsAccessing(false);
 }
 };

 const handlePasswordSubmit = (e) => {
 e.preventDefault();
 if (password.trim()) {
 accessSharedFile(password);
 }
 };

 const handleDownload = () => {
 if (downloadUrl) {
 // ✅ SECURITY: Validate URL and sanitize filename to prevent XSS
 const urlValidation = validateUrl(downloadUrl);
 if (!urlValidation.valid) {
 console.error('[SharedFilePage] Invalid download URL:', urlValidation.error);
 return;
 }
 const safeFilename = sanitizeFilename(file.name);
 
 const link = document.createElement('a');
 link.href = urlValidation.url;
 link.download = safeFilename;
 link.target = '_blank';
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }
 };

 const getFileIcon = (mimeType) => {
 if (!mimeType) return <FiFile />;
 
 if (mimeType.startsWith('image/')) return <FiImage />;
 if (mimeType.startsWith('video/')) return <FiVideo />;
 if (mimeType.startsWith('audio/')) return <FiMusic />;
 if (mimeType.includes('text') || mimeType.includes('document')) return <FiFileText />;
 
 return <FiFile />;
 };

 const formatFileSize = (bytes) => {
 if (!bytes) return 'Unknown size';
 
 const units = ['B', 'KB', 'MB', 'GB'];
 let size = bytes;
 let unitIndex = 0;
 
 while (size >= 1024 && unitIndex < units.length - 1) {
 size /= 1024;
 unitIndex++;
 }
 
 return `${size.toFixed(1)} ${units[unitIndex]}`;
 };

 const getPermissionText = (perm) => {
 switch (perm) {
 case 'view': return 'View only';
 case 'download': return 'View & Download';
 case 'edit': return 'View & Edit';
 default: return 'View only';
 }
 };

 if (loading) {
 return (
 <div className={styles.sharedPage}>
 <div className={styles.container}>
 <div className={styles.loadingState}>
 <div className={styles.spinner}></div>
 <p>Loading shared file...</p>
 </div>
 </div>
 </div>
 );
 }

 if (requirePassword) {
 return (
 <div className={styles.sharedPage}>
 <div className={styles.container}>
 <div className={styles.passwordForm}>
 <div className={styles.lockIcon}>
 <FiLock />
 </div>
 <h2>Password Required</h2>
 <p>This shared file is password protected.</p>
 
 {error && (
 <div className={styles.errorMessage}>
 <FiAlertCircle />
 {error}
 </div>
 )}
 
 <form onSubmit={handlePasswordSubmit}>
 <input
 type="password"
 placeholder="Enter password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className={styles.passwordInput}
 autoFocus
 />
 <button 
 type="submit" 
 className={styles.accessButton}
 disabled={isAccessing || !password.trim()}
 >
 {isAccessing ? 'Accessing...' : 'Access File'}
 </button>
 </form>
 </div>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className={styles.sharedPage}>
 <div className={styles.container}>
 <div className={styles.errorState}>
 <FiAlertCircle />
 <h2>Unable to Access File</h2>
 <p>{error}</p>
 <button 
 className={styles.backButton}
 onClick={() => navigate('/')}
 >
 Go to Homepage
 </button>
 </div>
 </div>
 </div>
 );
 }

 if (!file) {
 return (
 <div className={styles.sharedPage}>
 <div className={styles.container}>
 <div className={styles.errorState}>
 <FiAlertCircle />
 <h2>File Not Found</h2>
 <p>The shared file could not be found or the link is invalid.</p>
 <button 
 className={styles.backButton}
 onClick={() => navigate('/')}
 >
 Go to Homepage
 </button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className={styles.sharedPage}>
 <div className={styles.container}>
 <div className={styles.fileCard}>
 <div className={styles.fileHeader}>
 <div className={styles.fileIcon}>
 {getFileIcon(file.mimeType)}
 </div>
 <div className={styles.fileInfo}>
 <h1 className={styles.fileName}>{file.name}</h1>
 <div className={styles.fileDetails}>
 <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
 <span className={styles.permission}>
 <FiEye />
 {getPermissionText(permission)}
 </span>
 </div>
 </div>
 </div>

 <div className={styles.fileActions}>
 {permission === 'view' && (
 <div className={styles.viewOnlyNotice}>
 <FiEye />
 <span>This file is shared for viewing only</span>
 </div>
 )}

 {(permission === 'download' || permission === 'edit') && downloadUrl && (
 <button 
 className={styles.downloadButton}
 onClick={handleDownload}
 >
 <FiDownload />
 Download File
 </button>
 )}

 {permission === 'edit' && (
 <div className={styles.editNotice}>
 <FiFileText />
 <span>This file can be viewed and downloaded</span>
 </div>
 )}
 </div>

 {/* File Preview (if applicable) */}
 {file.mimeType?.startsWith('image/') && downloadUrl && (() => {
 // ✅ SECURITY: Validate URL before using in img src to prevent XSS
 const urlValidation = validateUrl(downloadUrl);
 if (!urlValidation.valid) {
 return null; // Don't render image if URL is invalid
 }
 return (
 <div className={styles.filePreview}>
 <img 
 src={urlValidation.url} 
 alt={file.name}
 className={styles.imagePreview}
 onError={(e) => {
 e.target.style.display = 'none';
 }}
 />
 </div>
 );
 })()}

 {file.mimeType?.startsWith('video/') && downloadUrl && (
 <div className={styles.filePreview}>
 <video 
 controls
 className={styles.videoPreview}
 onError={(e) => {
 e.target.style.display = 'none';
 }}
 >
 <source src={downloadUrl} type={file.mimeType} />
 Your browser does not support video playback.
 </video>
 </div>
 )}

 {file.mimeType?.startsWith('audio/') && downloadUrl && (
 <div className={styles.filePreview}>
 <audio 
 controls
 className={styles.audioPreview}
 onError={(e) => {
 e.target.style.display = 'none';
 }}
 >
 <source src={downloadUrl} type={file.mimeType} />
 Your browser does not support audio playback.
 </audio>
 </div>
 )}
 </div>

 <div className={styles.poweredBy}>
 <span>Powered by EasyFlow</span>
 </div>
 </div>
 </div>
 );
};

export default SharedFilePage;
