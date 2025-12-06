import React from 'react';
import styles from './TaskResultModal.module.css';

const TaskResultModal = ({ task, onClose }) => {
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
        fileUrl: data.data?.file_path || data.data?.url
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

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>📋 {taskName}</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {!formatted ? (
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
              {formatted.fileUrl && (
                <a href={formatted.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>
                  📥 Download File
                </a>
              )}
            </div>
          ) : (
            <div className={styles.genericResult}>
              <div className={styles.statusBadge}>
                <span className={formatted.success ? styles.success : styles.failed}>
                  {formatted.success ? '✅ Success' : '❌ Failed'}
                </span>
              </div>
              <p>{formatted.message}</p>
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

