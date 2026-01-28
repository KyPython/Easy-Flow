import React, { useState, useEffect } from 'react';
import styles from './TaskResultModal.module.css';
import { useNavigate } from 'react-router-dom';
import { validateUrl, sanitizeFilename, safeWindowOpen } from '../../utils/security';
import { sanitizeErrorMessage as sanitizeError } from '../../utils/errorMessages';
import { createLogger } from '../../utils/logger';
import { getConfig } from '../../utils/dynamicConfig';

const TaskResultModal = ({ task, onClose }) => {
 // ✅ FIX: Early return must be BEFORE hooks to avoid "Rendered fewer hooks" error
 if (!task) return null;
 
 // All hooks must be called after early return check
 const navigate = useNavigate();
 const [downloading, setDownloading] = useState(false);
 const [autoRedirecting, setAutoRedirecting] = useState(false);
 const [redirectCountdown, setRedirectCountdown] = useState(5);
 const logger = createLogger('TaskResultModal');
 
 // ✅ AUTO-REDIRECT: After viewing results, auto-redirect to history
 useEffect(() => {
 // Only auto-redirect if task is completed or failed (not queued/running)
 const shouldAutoRedirect = task.status === 'completed' || task.status === 'failed';
 
 if (!shouldAutoRedirect) return;
 
 // Start countdown after 2 seconds of viewing
 const startTimer = setTimeout(() => {
 setAutoRedirecting(true);
 
 // Countdown from 5 to 0
 let countdown = 5;
 setRedirectCountdown(countdown);
 
 const countdownInterval = setInterval(() => {
 countdown--;
 setRedirectCountdown(countdown);
 
 if (countdown <= 0) {
 clearInterval(countdownInterval);
 // Redirect to history page
 navigate('/app/history');
 }
 }, 1000);
 
 // Store interval ID for cleanup
 window._taskResultModalInterval = countdownInterval;
 }, 2000);
 
 // Cleanup function
 return () => {
 clearTimeout(startTimer);
 if (window._taskResultModalInterval) {
 clearInterval(window._taskResultModalInterval);
 window._taskResultModalInterval = null;
 }
 };
 }, [task.status, navigate]);

 // ✅ OBSERVABILITY: Unified download handler that matches TaskList behavior
 const handleDownload = async (artifactUrl, filename) => {
 if (!artifactUrl) {
 logger.error('No artifact URL provided');
 return;
 }

 logger.debug('Starting download', { 
 url: artifactUrl,
 filename,
 task_id: task.id 
 });
 
 setDownloading(true);
 
 try {
 // Use the same safe download method as TaskList
 const response = await fetch(artifactUrl, {
 method: 'GET',
 headers: {
 'Accept': 'application/pdf,application/octet-stream,*/*'
 }
 });

 if (!response.ok) {
 logger.error('Download failed', { 
 status: response.status, 
 statusText: response.statusText 
 });
 throw new Error(`HTTP error! status: ${response.status}`);
 }

 logger.debug('Fetched blob, creating download link');
 const blob = await response.blob();
 const url = window.URL.createObjectURL(blob);
 
 // ✅ SECURITY: Validate URL and sanitize filename to prevent XSS
 const urlValidation = validateUrl(artifactUrl);
 if (!urlValidation.valid) {
 throw new Error(`Invalid artifact URL: ${urlValidation.error}`);
 }
 
 // Get filename from parameter or URL
 const downloadFilename = sanitizeFilename(filename || (() => {
 try {
 const urlPath = new URL(artifactUrl).pathname;
 return urlPath.split('/').pop() || `task-${task.id}-result.pdf`;
 } catch {
 return `task-${task.id}-result.pdf`;
 }
 })());
 
 // Create download link and trigger download
 const link = document.createElement('a');
 link.href = url;
 link.download = downloadFilename;
 link.style.display = 'none';
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 
 // Clean up the blob URL
 window.URL.revokeObjectURL(url);
 
 logger.info('Download successful', { filename: downloadFilename });
 
 } catch (error) {
 logger.error('Download failed, trying fallback', error);
 // ✅ SECURITY: Use safe window.open with URL validation
 safeWindowOpen(artifactUrl);
 } finally {
 setDownloading(false);
 }
 };

 // Parse the result - handle both string and object formats
 let resultData = null;
 try {
 if (typeof task.result === 'string') {
 // Try to parse as JSON
 resultData = JSON.parse(task.result);
 } else {
 resultData = task.result;
 }
 } catch (e) {
 // If parsing fails, treat as plain text
 resultData = { raw: task.result };
 }

 // Use shared utility for environment-aware error message sanitization
 const sanitizeErrorMessage = sanitizeError;

 // Extract key information in a user-friendly way
 const formatResult = (data) => {
 if (!data) return null;

 // Handle nested data structure (data.data for scraping results)
 const actualData = data.data || data;
 
 // Web scraping results
 if (actualData.url || actualData.title || actualData.paragraphs) {
 return {
 type: 'web_scraping',
 url: actualData.url,
 title: actualData.title || 'No title found',
 description: actualData.description || actualData.meta_description || 'No description',
 paragraphs: actualData.paragraphs || [],
 headings: actualData.headings || [],
 links: actualData.links || [],
 images: actualData.images || [],
 tables: actualData.tables || [],
 status: actualData.status || data.status || 'unknown'
 };
 }

 // Invoice download results
 if (data.message && data.message.includes('downloaded')) {
 return {
 type: 'invoice_download',
 message: data.message,
 success: data.success,
 fileUrl: data.data?.file_path || data.data?.url || data.data?.download_path,
 filename: data.data?.filename,
 fileSize: data.data?.file_size
 };
 }

 // Generic success/failure - sanitize error messages
 const sanitizedError = data.error ? sanitizeErrorMessage(data.error) : null;
 
 return {
 type: 'generic',
 success: data.success,
 message: data.message || (data.success ? 'Task completed successfully' : 'Task failed'),
 error: sanitizedError,
 details: data
 };
 };

 const formatted = formatResult(resultData);
 const taskName = task.automation_tasks?.name || 'Task';
 const taskType = task.automation_tasks?.task_type || 'unknown';

 // Determine actual status - check task.status first, then result
 let actualStatus = task.status; // 'running', 'completed', 'failed' from database
 let isQueued = false;
 
 // If task is 'running' but result says 'queued', it's actually queued
 if (task.status === 'running' && resultData) {
 if (resultData.status === 'queued' || resultData.queue_status === 'pending') {
 actualStatus = 'queued';
 isQueued = true;
 }
 }
 
 // If we have a result with status, use that for display
 if (resultData?.status && ['completed', 'failed', 'queued'].includes(resultData.status)) {
 actualStatus = resultData.status;
 isQueued = resultData.status === 'queued';
 }
 
 // ✅ DYNAMIC: Stuck task threshold from config (non-hardcoded)
 const STUCK_THRESHOLD_HOURS = getConfig('thresholds.stuckTaskHours', 24);
 const taskStartTime = task.started_at ? new Date(task.started_at).getTime() : null;
 const now = Date.now();
 const hoursSinceStart = taskStartTime ? (now - taskStartTime) / (1000 * 60 * 60) : 0;
 const isStuck = (actualStatus === 'running' || actualStatus === 'queued' || actualStatus === 'pending')
 && hoursSinceStart > STUCK_THRESHOLD_HOURS;
 
 // If task is stuck, override status to 'failed' for display
 if (isStuck) {
 actualStatus = 'failed';
 }

 return (
 <div className={styles.modalOverlay} onClick={onClose}>
 <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
 <div className={styles.modalHeader}>
 <h2>📋 {taskName}</h2>
 <button className={styles.closeButton} onClick={onClose}>×</button>
 </div>

 <div className={styles.modalBody}>
 {isQueued ? (() => {
 // Calculate how long the task has been queued
 const queuedTime = task.started_at 
 ? Math.floor((new Date() - new Date(task.started_at)) / 1000 / 60) // minutes
 : 0;
 
 const stuckThresholdMinutes = getConfig('thresholds.queueStuckMinutes', 10);
 const isStuck = queuedTime > stuckThresholdMinutes;
 
 return (
 <div className={styles.queuedState}>
 <div className={styles.statusBadge}>
 <span className={styles.queued}>
 ⏳ Queued {queuedTime > 0 ? `${queuedTime}m` : ''}
 </span>
 </div>
 <p>{resultData?.message || 'Task queued for processing'}</p>
 {isStuck ? (
 <div className={styles.stuckWarning}>
 <p><strong>⚠️ This task appears to be stuck</strong></p>
 <p className={styles.muted}>
 This task was submitted before system fixes were applied. It was already consumed from the queue but the result wasn't recorded properly.
 </p>
 <p className={styles.muted}>
 <strong>What to do:</strong> Submit a new task - it will process immediately with all fixes in place.
 </p>
 </div>
 ) : (
 <p className={styles.muted}>
 Your task is waiting to be processed. This usually takes a few seconds to a minute.
 </p>
 )}
 </div>
 );
 })() : !formatted ? (
 <div className={styles.emptyState}>
 <p>No result data available for this task.</p>
 </div>
 ) : formatted.type === 'web_scraping' ? (
 <div className={styles.scrapingResult}>
 <div className={styles.statusBadge}>
 <span className={formatted.status === 'success' ? styles.success : styles.failed}>
 {formatted.status === 'success' ? '✅ Success' : '❌ Failed'}
 </span>
 </div>

 <div className={styles.section}>
 <h3>🌐 Website Scraped</h3>
 <a href={formatted.url} target="_blank" rel="noopener noreferrer" className={styles.url}>
 {formatted.url}
 </a>
 </div>

 {formatted.title && formatted.title !== 'No title found' && (
 <div className={styles.section}>
 <h3>📄 Page Title</h3>
 <p>{formatted.title}</p>
 </div>
 )}

 {formatted.description && formatted.description !== 'No description' && formatted.description !== 'No meta description found' && (
 <div className={styles.section}>
 <h3>📝 Description</h3>
 <p>{formatted.description}</p>
 </div>
 )}

 {formatted.paragraphs && formatted.paragraphs.length > 0 && (
 <div className={styles.section}>
 <h3>📝 Text Found ({formatted.paragraphs.length} items)</h3>
 <div className={styles.textList}>
 {formatted.paragraphs.slice(0, 10).map((text, idx) => (
 <div key={idx} className={styles.textItem}>
 {text}
 </div>
 ))}
 {formatted.paragraphs.length > 10 && (
 <p className={styles.moreText}>... and {formatted.paragraphs.length - 10} more items</p>
 )}
 </div>
 </div>
 )}

 {formatted.headings && formatted.headings.length > 0 && (
 <div className={styles.section}>
 <h3>📌 Headings ({formatted.headings.length})</h3>
 <div className={styles.textList}>
 {formatted.headings.map((heading, idx) => (
 <div key={idx} className={styles.textItem}>{heading}</div>
 ))}
 </div>
 </div>
 )}

 {formatted.links && formatted.links.length > 0 && (
 <div className={styles.section}>
 <h3>🔗 Links Found ({formatted.links.length})</h3>
 <div className={styles.linkList}>
 {formatted.links.slice(0, 5).map((link, idx) => (
 <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className={styles.link}>
 {link}
 </a>
 ))}
 {formatted.links.length > 5 && (
 <p className={styles.moreText}>... and {formatted.links.length - 5} more links</p>
 )}
 </div>
 </div>
 )}

 {formatted.images && formatted.images.length > 0 && (
 <div className={styles.section}>
 <h3>🖼️ Images Found ({formatted.images.length})</h3>
 <p className={styles.muted}>Images were detected on the page</p>
 </div>
 )}

 {formatted.tables && formatted.tables.length > 0 && (
 <div className={styles.section}>
 <h3>📊 Tables Found ({formatted.tables.length})</h3>
 <p className={styles.muted}>Data tables were detected on the page</p>
 </div>
 )}
 </div>
 ) : formatted.type === 'invoice_download' ? (
 <div className={styles.invoiceResult}>
 <div className={styles.statusBadge}>
 <span className={formatted.success ? styles.success : styles.failed}>
 {formatted.success ? '✅ Downloaded' : '❌ Failed'}
 </span>
 </div>
 <p>{formatted.message}</p>
 
 {/* Check for artifact_url from task (database field) */}
 {task.artifact_url ? (
 <div className={styles.downloadSection}>
 <a 
 onClick={(e) => {
 e.preventDefault();
 handleDownload(task.artifact_url, formatted.filename || 'invoice.pdf');
 }}
 href="#"
 className={styles.downloadLink}
 style={{ cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.6 : 1 }}
 >
 {downloading ? '⏳ Downloading...' : '📥 Download Invoice'}
 </a>
 {formatted.filename && (
 <p className={styles.muted}>File: {formatted.filename}</p>
 )}
 {formatted.fileSize && (
 <p className={styles.muted}>Size: {(formatted.fileSize / 1024).toFixed(2)} KB</p>
 )}
 <div className={styles.navigationHint}>
 <p className={styles.hintText}>
 💡 <strong>Tip:</strong> Download your file here - it's saved for this automation task
 </p>
 </div>
 </div>
 ) : formatted.fileUrl ? (
 <div className={styles.downloadSection}>
 {formatted.fileUrl.startsWith('http') ? (
 <a 
 href={formatted.fileUrl} 
 target="_blank" 
 rel="noopener noreferrer" 
 className={styles.downloadLink}
 >
 📥 Download Invoice
 </a>
 ) : (
 <div className={styles.fileInfo}>
 <p className={styles.muted}>
 <strong>File saved:</strong> {formatted.fileUrl}
 </p>
 <p className={styles.muted}>
 The file was downloaded to the server. Contact support to retrieve it.
 </p>
 </div>
 )}
 {formatted.filename && (
 <p className={styles.muted}>File: {formatted.filename}</p>
 )}
 {formatted.fileSize && (
 <p className={styles.muted}>Size: {(formatted.fileSize / 1024).toFixed(2)} KB</p>
 )}
 </div>
 ) : (
 <div className={styles.fileInfo}>
 <p className={styles.muted}>
 <strong>✅ Invoice downloaded successfully!</strong>
 </p>
 {formatted.filename && (
 <p className={styles.muted}>
 <strong>File:</strong> {formatted.filename}
 </p>
 )}
 {formatted.fileSize && (
 <p className={styles.muted}>
 <strong>Size:</strong> {(formatted.fileSize / 1024).toFixed(2)} KB
 </p>
 )}
 <p className={styles.muted}>
 The file was downloaded to the server. In production, files will be automatically uploaded to cloud storage and accessible via download links.
 </p>
 </div>
 )}
 </div>
 ) : (
 <div className={styles.genericResult}>
 <div className={styles.statusBadge}>
 {actualStatus === 'completed' || formatted.success ? (
 <span className={styles.success}>
 ✅ Success
 </span>
 ) : actualStatus === 'failed' || formatted.error ? (
 <span className={styles.failed}>
 ❌ Failed
 </span>
 ) : actualStatus === 'queued' ? (
 <span className={styles.queued}>
 ⏳ Queued
 </span>
 ) : (
 <span className={styles.failed}>
 ❌ Failed
 </span>
 )}
 </div>
 <p>{formatted.message || resultData?.message || 'Task processing'}</p>
 {formatted.error && (
 <div className={styles.errorBox}>
 <strong>Error:</strong> {formatted.error}
 </div>
 )}
 {isStuck && (
 <div className={styles.stuckWarning}>
 <p><strong>⚠️ This task appears to be stuck</strong></p>
 <p className={styles.muted}>
 This task has been processing for over {Math.floor(hoursSinceStart)} hours. 
 It was likely submitted before system fixes were applied and won't process automatically.
 </p>
 <p className={styles.muted}>
 <strong>What to do:</strong> Submit a new task - it will process immediately with all fixes in place.
 </p>
 </div>
 )}
 </div>
 )}
 </div>

 <div className={styles.modalFooter}>
 {autoRedirecting && (
 <div className={styles.redirectNotice} style={{
 padding: '12px',
 background: 'var(--color-primary-50, #f0f4ff)',
 borderRadius: '6px',
 marginBottom: '12px',
 border: '1px solid var(--color-primary-200, #cbd5e1)',
 textAlign: 'center'
 }}>
 <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: 'var(--color-primary-700, #1e40af)' }}>
 ↪️ Redirecting to Automation History in {redirectCountdown} seconds...
 </p>
 <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted, #666)' }}>
 You can close this modal or wait to be redirected automatically.
 </p>
 </div>
 )}
 <button className={styles.closeBtn} onClick={onClose}>
 {autoRedirecting ? `Close Now (${redirectCountdown}s)` : 'Close'}
 </button>
 </div>
 </div>
 </div>
 );
};

export default TaskResultModal;

