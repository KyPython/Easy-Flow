import React, { useState } from 'react';
import styles from './TaskResultModal.module.css';
import { useNavigate } from 'react-router-dom';
import { validateUrl, sanitizeFilename, safeWindowOpen } from '../../utils/security';

const TaskResultModal = ({ task, onClose }) => {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  
  if (!task) return null;

  // ✅ OBSERVABILITY: Unified download handler that matches TaskList behavior
  const handleDownload = async (artifactUrl, filename) => {
    if (!artifactUrl) {
      console.error('[TaskResultModal] No artifact URL provided');
      return;
    }

    console.log('[TaskResultModal] Starting download', { 
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
        console.error('[TaskResultModal] Download failed', { 
          status: response.status, 
          statusText: response.statusText 
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('[TaskResultModal] Fetched blob, creating download link');
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
      
      console.log('[TaskResultModal] Download successful', { filename: downloadFilename });
      
    } catch (error) {
      console.error('[TaskResultModal] Download failed, trying fallback', error);
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

  // Convert technical error messages to user-friendly ones (environment-aware)
  const sanitizeErrorMessage = (error) => {
    if (!error) return null;
    
    const errorStr = typeof error === 'string' ? error : String(error);
    
    // Detect environment: development shows technical details, production shows user-friendly messages
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NODE_ENV !== 'production' ||
                         (typeof window !== 'undefined' && 
                          (window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1'));
    
    // In development: return the original error for debugging
    if (isDevelopment) {
      // Still clean up stack traces and very long errors, but keep technical details
      if (errorStr.includes('stack') || errorStr.includes('trace') || errorStr.length > 500) {
        // Truncate very long errors but keep technical info
        const truncated = errorStr.length > 500 ? errorStr.substring(0, 500) + '...' : errorStr;
        return truncated;
      }
      return errorStr; // Return original technical error in development
    }
    
    // Production: Map technical errors to user-friendly messages
    const errorMappings = {
      'Unknown task type': 'We encountered an issue processing this task type. Please try again or contact support if the problem persists.',
      'unknown task type': 'We encountered an issue processing this task type. Please try again or contact support if the problem persists.',
      'task type not supported': 'This task type is not currently supported. Please try a different task type.',
      'authentication failed': 'Authentication failed. Please check your credentials and try again.',
      'connection timeout': 'The request took too long to complete. Please try again.',
      'network error': 'A network error occurred. Please check your connection and try again.',
      'invalid url': 'The provided URL is invalid. Please check the URL and try again.',
      'permission denied': 'You do not have permission to perform this action. Please contact support if you believe this is an error.',
    };
    
    // Check for specific error patterns
    for (const [pattern, friendlyMessage] of Object.entries(errorMappings)) {
      if (errorStr.toLowerCase().includes(pattern.toLowerCase())) {
        return friendlyMessage;
      }
    }
    
    // For other errors, check if they look technical and provide a generic message
    // Technical errors often contain technical terms or have specific formats
    if (errorStr.includes(':') && (errorStr.includes('Error') || errorStr.includes('Exception') || errorStr.includes('TypeError'))) {
      return 'An unexpected error occurred while processing your task. Please try again or contact support if the problem continues.';
    }
    
    // If it's a short, readable message, return it as-is (might already be user-friendly)
    if (errorStr.length < 100 && !errorStr.includes('stack') && !errorStr.includes('trace')) {
      return errorStr;
    }
    
    // Default fallback for technical errors in production
    return 'An error occurred while processing your task. Please try again or contact support if the problem persists.';
  };

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
            
            const isStuck = queuedTime > 10; // More than 10 minutes = likely stuck
            
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
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default TaskResultModal;

