import React, { useState } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import PropTypes from 'prop-types';
import styles from './AnalyticsPage.module.css';

const ReportsGenerator = ({ data }) => {
 const { theme } = useTheme();
 const [generating, setGenerating] = useState(false);
 const [exporting, setExporting] = useState(false);
 const [message, setMessage] = useState(null);

 const handleGenerateReport = async () => {
 setGenerating(true);
 setMessage(null);
 
 try {
 // TODO: Implement report generation endpoint
 setMessage({ type: 'success', text: 'Report generation feature coming soon!' });
 } catch (error) {
 setMessage({ type: 'error', text: 'Failed to generate report. Please try again.' });
 } finally {
 setGenerating(false);
 }
 };

 const handleExportData = async (format = 'csv') => {
 setExporting(true);
 setMessage(null);
 
 try {
 const response = await api.get('/api/roi-analytics/export', {
 params: { format, timeframe: '30d' },
 responseType: format === 'csv' ? 'blob' : 'json'
 });
 
 if (format === 'csv') {
 // Create download link for CSV
 const url = window.URL.createObjectURL(new Blob([response.data]));
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `easyflow-analytics-${new Date().toISOString().split('T')[0]}.csv`);
 document.body.appendChild(link);
 link.click();
 link.remove();
 window.URL.revokeObjectURL(url);
 setMessage({ type: 'success', text: 'Data exported successfully!' });
 } else {
 // Handle JSON export
 const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
 const url = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `easyflow-analytics-${new Date().toISOString().split('T')[0]}.json`);
 document.body.appendChild(link);
 link.click();
 link.remove();
 window.URL.revokeObjectURL(url);
 setMessage({ type: 'success', text: 'Data exported successfully!' });
 }
 } catch (error) {
 setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
 } finally {
 setExporting(false);
 }
 };

 const handleScheduleReport = () => {
 setMessage({ type: 'info', text: 'Scheduled reports feature coming soon!' });
 };

 return (
 <section className={styles.section}>
 <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
 📊 Reports Generator
 </h2>

 {message && (
 <div style={{
 padding: '0.75rem 1rem',
 borderRadius: 'var(--radius-md)',
 marginBottom: '1rem',
 background: message.type === 'success' 
 ? 'var(--color-success-bg, #f0f9f0)' 
 : message.type === 'error'
 ? 'var(--color-error-bg, #fff0f0)'
 : 'var(--bg-muted)',
 color: message.type === 'success'
 ? 'var(--color-success)'
 : message.type === 'error'
 ? 'var(--color-error)'
 : 'var(--text-primary)',
 border: `1px solid ${
 message.type === 'success'
 ? 'var(--color-success, #4caf50)'
 : message.type === 'error'
 ? 'var(--color-error, #d32f2f)'
 : 'var(--border-primary)'
 }`
 }}>
 {message.text}
 </div>
 )}

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
 <button
 onClick={handleGenerateReport}
 disabled={generating}
 style={{
 padding: '1rem 1.5rem',
 background: 'var(--color-primary)',
 color: 'white',
 border: 'none',
 borderRadius: 'var(--radius-md)',
 fontSize: '1rem',
 fontWeight: '500',
 cursor: generating ? 'not-allowed' : 'pointer',
 opacity: generating ? 0.6 : 1,
 transition: 'opacity 0.2s'
 }}
 >
 {generating ? 'Generating...' : 'Generate Workflow Report'}
 </button>

 <button
 onClick={() => handleExportData('csv')}
 disabled={exporting}
 style={{
 padding: '1rem 1.5rem',
 background: 'var(--bg-muted)',
 color: 'var(--text-primary)',
 border: '1px solid var(--border-primary)',
 borderRadius: 'var(--radius-md)',
 fontSize: '1rem',
 fontWeight: '500',
 cursor: exporting ? 'not-allowed' : 'pointer',
 opacity: exporting ? 0.6 : 1,
 transition: 'opacity 0.2s'
 }}
 >
 {exporting ? 'Exporting...' : 'Export Data (CSV)'}
 </button>

 <button
 onClick={() => handleExportData('json')}
 disabled={exporting}
 style={{
 padding: '1rem 1.5rem',
 background: 'var(--bg-muted)',
 color: 'var(--text-primary)',
 border: '1px solid var(--border-primary)',
 borderRadius: 'var(--radius-md)',
 fontSize: '1rem',
 fontWeight: '500',
 cursor: exporting ? 'not-allowed' : 'pointer',
 opacity: exporting ? 0.6 : 1,
 transition: 'opacity 0.2s'
 }}
 >
 {exporting ? 'Exporting...' : 'Export Data (JSON)'}
 </button>

 <button
 onClick={handleScheduleReport}
 style={{
 padding: '1rem 1.5rem',
 background: 'var(--bg-muted)',
 color: 'var(--text-primary)',
 border: '1px solid var(--border-primary)',
 borderRadius: 'var(--radius-md)',
 fontSize: '1rem',
 fontWeight: '500',
 cursor: 'pointer',
 transition: 'opacity 0.2s'
 }}
 >
 Schedule Report
 </button>
 </div>

 <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
 <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
 <strong>Note:</strong> CSV exports include all workflow execution data for the last 30 days. 
 JSON exports include full analytics data in structured format.
 </p>
 </div>
 </section>
 );
};

ReportsGenerator.propTypes = {
 data: PropTypes.object,
};

export default ReportsGenerator;
