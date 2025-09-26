export const formatTaskStatus = (status) => {
  const statusMap = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'failed': 'Failed'
  };
  return statusMap[status] || status;
};

export const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString();
};

export const formatTaskType = (taskType) => {
  const typeMap = {
    'invoice_download': 'Invoice Download',
    'data_extraction': 'Data Extraction',
    'form_submission': 'Form Submission',
    'pdf_processing': 'PDF Processing',
    'web_scraping': 'Web Scraping'
  };
  return typeMap[taskType] || taskType;
};

export const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};