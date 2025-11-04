import React, { useState, useEffect } from 'react';
import { FiDownload, FiFileText, FiBarChart3, FiCalendar, FiFilter, FiRefreshCw } from 'react-icons/fi';
import PropTypes from 'prop-types';
import './ReportsGenerator.module.css';

/**
 * ReportsGenerator - Analytics reports generation and export component
 * Features: Multiple report types, date filtering, export formats, scheduled reports
 */
const ReportsGenerator = React.memo(({ 
  data = {},
  analyticsData = {}, 
  onGenerateReport = () => Promise.resolve({}),
  onScheduleReport,
  availableReports = [],
  isLoading = false 
}) => {
  const [reportConfig, setReportConfig] = useState({
    type: 'workflow_performance',
    dateRange: 'last_30_days',
    startDate: '',
    endDate: '',
    format: 'csv',
    filters: {},
    includeCharts: true,
    groupBy: 'day'
  });

  const [generatingReports, setGeneratingReports] = useState(new Set());
  const [recentReports, setRecentReports] = useState([]);

  const defaultReportTypes = [
    {
      id: 'workflow_performance',
      name: 'Workflow Performance Report',
      description: 'Detailed analysis of workflow execution times, success rates, and bottlenecks',
      icon: FiBarChart3,
      fields: ['execution_time', 'success_rate', 'error_types', 'step_performance'],
      formats: ['csv', 'pdf', 'xlsx']
    },
    {
      id: 'usage_analytics',
      name: 'Usage Analytics Report',
      description: 'User activity, feature adoption, and system utilization metrics',
      icon: FiFileText,
      fields: ['user_activity', 'feature_usage', 'session_duration', 'page_views'],
      formats: ['csv', 'pdf', 'xlsx']
    },
    {
      id: 'error_analysis',
      name: 'Error Analysis Report',
      description: 'Comprehensive error tracking, failure patterns, and resolution times',
      icon: FiRefreshCw,
      fields: ['error_frequency', 'error_types', 'resolution_time', 'affected_workflows'],
      formats: ['csv', 'pdf']
    },
    {
      id: 'roi_analysis',
      name: 'ROI Analysis Report',
      description: 'Return on investment calculations and cost savings analysis',
      icon: FiBarChart3,
      fields: ['time_saved', 'cost_reduction', 'productivity_gains', 'roi_percentage'],
      formats: ['pdf', 'xlsx']
    }
  ];

  const reportTypes = availableReports.length > 0 ? availableReports : defaultReportTypes;

  const dateRangeOptions = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last_7_days', label: 'Last 7 Days' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'last_90_days', label: 'Last 90 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom', label: 'Custom Date Range' }
  ];

  const exportFormats = [
    { id: 'csv', label: 'CSV', description: 'Comma-separated values for spreadsheets' },
    { id: 'xlsx', label: 'Excel', description: 'Microsoft Excel format' },
    { id: 'pdf', label: 'PDF', description: 'Formatted document with charts' },
    { id: 'json', label: 'JSON', description: 'Raw data for developers' }
  ];

  useEffect(() => {
    // Set default date range
    if (reportConfig.dateRange !== 'custom') {
      const { startDate, endDate } = getDateRangeValues(reportConfig.dateRange);
      setReportConfig(prev => ({ ...prev, startDate, endDate }));
    }
  }, [reportConfig.dateRange]);

  const getDateRangeValues = (rangeId) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (rangeId) {
      case 'today':
        return { startDate: today.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startDate: yesterday.toISOString().split('T')[0], endDate: yesterday.toISOString().split('T')[0] };
      case 'last_7_days':
        const week = new Date(today);
        week.setDate(week.getDate() - 7);
        return { startDate: week.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
      case 'last_30_days':
        const month = new Date(today);
        month.setDate(month.getDate() - 30);
        return { startDate: month.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
      case 'last_90_days':
        const quarter = new Date(today);
        quarter.setDate(quarter.getDate() - 90);
        return { startDate: quarter.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] };
      default:
        return { startDate: '', endDate: '' };
    }
  };

  const handleConfigChange = (field, value) => {
    setReportConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateReport = async () => {
    const reportId = `${reportConfig.type}_${Date.now()}`;
    setGeneratingReports(prev => new Set([...prev, reportId]));

    try {
      const report = await onGenerateReport({
        ...reportConfig,
        id: reportId,
        timestamp: new Date().toISOString()
      });

      // Add to recent reports
      setRecentReports(prev => [report, ...prev.slice(0, 4)]);
      
      // Trigger download if it's a file
      if (report.downloadUrl) {
        const link = document.createElement('a');
        link.href = report.downloadUrl;
        link.download = report.filename;
        link.click();
      }
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const selectedReportType = reportTypes.find(type => type.id === reportConfig.type);
  const isGenerating = generatingReports.size > 0;
  const hasData = !!(data && Object.keys(data).length > 0);

  return (
    <div className="reports-generator">
      <div className="generator-header">
        <div className="header-content">
          <h2>Analytics Reports</h2>
          <p>Generate detailed reports and export analytics data</p>
        </div>
        
        <div className="quick-actions">
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || !hasData}
            className="btn btn-primary"
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : (
              <>
                <FiDownload />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>

      <div className="generator-content">
        <div className="config-panel">
          <div className="config-section">
            <h3>Report Configuration</h3>
            
            <div className="form-group">
              <label>Report Type</label>
              <div className="report-type-grid">
                {reportTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <div
                      key={type.id}
                      className={`report-type-card ${reportConfig.type === type.id ? 'selected' : ''}`}
                      onClick={() => handleConfigChange('type', type.id)}
                    >
                      <div className="card-icon">
                        <IconComponent />
                      </div>
                      <div className="card-content">
                        <h4>{type.name}</h4>
                        <p>{type.description}</p>
                        <div className="format-badges">
                          {type.formats.map(format => (
                            <span key={format} className="format-badge">
                              {format.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date Range</label>
                <select
                  value={reportConfig.dateRange}
                  onChange={(e) => handleConfigChange('dateRange', e.target.value)}
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Export Format</label>
                <select
                  value={reportConfig.format}
                  onChange={(e) => handleConfigChange('format', e.target.value)}
                >
                  {exportFormats.map(format => (
                    <option key={format.id} value={format.id}>
                      {format.label}
                    </option>
                  ))}
                </select>
                <small>{exportFormats.find(f => f.id === reportConfig.format)?.description}</small>
              </div>
            </div>

            {reportConfig.dateRange === 'custom' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={reportConfig.startDate}
                    onChange={(e) => handleConfigChange('startDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={reportConfig.endDate}
                    onChange={(e) => handleConfigChange('endDate', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={reportConfig.includeCharts}
                  onChange={(e) => handleConfigChange('includeCharts', e.target.checked)}
                />
                <span>Include visualizations and charts</span>
              </label>
            </div>

            {selectedReportType && (
              <div className="report-preview">
                <h4>Report Preview</h4>
                <div className="preview-content">
                  <div className="preview-header">
                    <strong>{selectedReportType.name}</strong>
                    <span className="preview-date">
                      {reportConfig.startDate} to {reportConfig.endDate}
                    </span>
                  </div>
                  <div className="preview-fields">
                    <span>Includes:</span>
                    {selectedReportType.fields.map(field => (
                      <span key={field} className="field-tag">
                        {field.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="recent-reports">
          <h3>Recent Reports</h3>
          {recentReports.length === 0 ? (
            <div className="empty-reports">
              <FiFileText className="empty-icon" />
              <p>No reports generated yet</p>
              <small>Generated reports will appear here</small>
            </div>
          ) : (
            <div className="reports-list">
              {recentReports.map((report, index) => (
                <div key={report.id || index} className="report-item">
                  <div className="report-info">
                    <div className="report-name">{report.name}</div>
                    <div className="report-details">
                      <span>{report.format?.toUpperCase()}</span>
                      <span>{new Date(report.timestamp).toLocaleDateString()}</span>
                      <span>{report.size}</span>
                    </div>
                  </div>
                  <div className="report-actions">
                    {report.downloadUrl && (
                      <a
                        href={report.downloadUrl}
                        download={report.filename}
                        className="download-btn"
                        title="Download report"
                      >
                        <FiDownload />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(analyticsData && Object.keys(analyticsData).length > 0) && (
        <div className="data-summary">
          <h3>Available Data Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-value">{analyticsData.totalWorkflows || 0}</div>
              <div className="summary-label">Total Workflows</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{analyticsData.totalExecutions || 0}</div>
              <div className="summary-label">Total Executions</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{analyticsData.successRate || 0}%</div>
              <div className="summary-label">Success Rate</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{analyticsData.avgExecutionTime || 0}s</div>
              <div className="summary-label">Avg Execution Time</div>
            </div>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="no-data-notice">
          <FiBarChart3 className="notice-icon" />
          <h4>No Data Available</h4>
          <p>Start running workflows to generate analytics data for reports.</p>
        </div>
      )}
    </div>
  );
};

ReportsGenerator.propTypes = {
  data: PropTypes.object,
  analyticsData: PropTypes.object,
  onGenerateReport: PropTypes.func,
  onScheduleReport: PropTypes.func,
  availableReports: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    fields: PropTypes.arrayOf(PropTypes.string).isRequired,
    formats: PropTypes.arrayOf(PropTypes.string).isRequired,
  })),
  isLoading: PropTypes.bool,
});

export default ReportsGenerator;
