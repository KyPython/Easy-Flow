import React from 'react';
import styles from './AnalyticsPage.module.css';
import PropTypes from 'prop-types';

const UsageCharts = ({ data }) => {
  const trends = data?.trends || {};
  const metrics = data?.metrics || {};
  
  // Convert trends object to array for chart rendering
  const trendsArray = Object.entries(trends)
    .map(([date, stats]) => ({
      date,
      count: stats.count || 0,
      time_saved: stats.time_saved || 0,
      avg_execution_time: stats.avg_execution_time || 0
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30); // Last 30 days

  const chartHeight = 200;
  const maxCount = Math.max(...trendsArray.map(d => d.count), 1);
  const maxTimeSaved = Math.max(...trendsArray.map(d => d.time_saved), 1);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Usage Over Time</h2>
      
      {trendsArray.length > 0 ? (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Workflow Executions (Last 30 Days)
          </h3>
          <div className={styles.chartPlaceholder} style={{ minHeight: chartHeight, padding: '1rem', background: 'var(--bg-primary)' }}>
            <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
              {/* Grid lines */}
              {Array.from({ length: 5 }, (_, i) => {
                const y = (i * chartHeight) / 4;
                return (
                  <line
                    key={`grid-${i}`}
                    x1="0"
                    y1={y}
                    x2="100%"
                    y2={y}
                    stroke="var(--border-primary)"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                );
              })}

              {/* Data bars */}
              {trendsArray.map((item, index) => {
                const x = (index * 100) / trendsArray.length;
                const barWidth = 80 / trendsArray.length;
                const spacing = 2;
                const barHeight = maxCount > 0 ? (item.count / maxCount) * chartHeight * 0.8 : 0;

                return (
                  <g key={item.date}>
                    <rect
                      x={`${x + spacing}%`}
                      y={chartHeight - barHeight}
                      width={`${barWidth}%`}
                      height={barHeight}
                      fill="var(--color-primary)"
                      rx="2"
                      aria-label={`${item.count} executions on ${formatDate(item.date)}`}
                    />
                    
                    {/* Date label */}
                    {index % Math.ceil(trendsArray.length / 8) === 0 && (
                      <text
                        x={`${x + barWidth / 2}%`}
                        y={chartHeight + 20}
                        textAnchor="middle"
                        fontSize="10"
                        fill="var(--text-secondary)"
                      >
                        {formatDate(item.date)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        <div className={styles.chartPlaceholder}>
          <p>No usage data available for the selected time period</p>
        </div>
      )}

      <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: '1.5rem', marginTop: '2rem' }}>Success / Failure Rates</h2>
      {metrics.success_rate_percent !== undefined ? (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ 
              background: 'linear-gradient(to right, var(--color-success) 0%, var(--color-success) ' + metrics.success_rate_percent + '%, var(--color-error) ' + metrics.success_rate_percent + '%, var(--color-error) 100%)',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}>
              {metrics.success_rate_percent}% Success
            </div>
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                  {metrics.successful_executions || 0}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Successful</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-error)' }}>
                  {metrics.failed_executions || 0}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Failed</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  {metrics.total_executions || 0}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.chartPlaceholder}>
          <p>No success/failure data available</p>
        </div>
      )}

      <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: '1.5rem', marginTop: '2rem' }}>Time Saved</h2>
      {metrics.total_time_saved_minutes !== undefined ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            {Math.round(metrics.total_time_saved_minutes / 60 * 10) / 10}h
          </div>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {Math.round(metrics.total_time_saved_minutes)} minutes saved
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Across {metrics.total_executions || 0} workflow executions
          </div>
        </div>
      ) : (
        <div className={styles.chartPlaceholder}>
          <p>No time saved data available</p>
        </div>
      )}
    </section>
  );
};

UsageCharts.propTypes = {
  data: PropTypes.shape({
    trends: PropTypes.object,
    metrics: PropTypes.shape({
      success_rate_percent: PropTypes.number,
      successful_executions: PropTypes.number,
      failed_executions: PropTypes.number,
      total_executions: PropTypes.number,
      total_time_saved_minutes: PropTypes.number,
    }),
  }),
};

export default UsageCharts;
