import React from 'react';
import styles from './TaskResultModal.module.css';

import { useNavigate } from 'react-router-dom';

const TaskResultModal = ({ task, onClose }) => {
  const navigate = useNavigate();
  if (!task) return null;

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

    // Generic success/failure
    return {
      type: 'generic',
      success: data.success,
      message: data.message || (data.success ? 'Task completed successfully' : 'Task failed'),
      error: data.error,
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
                    href={task.artifact_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.downloadLink}
                    onClick={(e) => {
                      // Try to trigger download
                      e.preventDefault();
                      const link = document.createElement('a');
                      link.href = task.artifact_url;
                      link.download = formatted.filename || 'invoice.pdf';
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    📥 Download Invoice
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

