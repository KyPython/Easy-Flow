import React from 'react';
import styles from './AnalyticsPage.module.css';
import PropTypes from 'prop-types';

const PerformanceMetrics = ({ data }) => {
  const metrics = data?.metrics || {};
  const taskBreakdown = data?.task_breakdown || {};
  const costAnalysis = data?.cost_analysis || {};

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  };

  const taskBreakdownArray = Object.entries(taskBreakdown)
    .map(([taskType, stats]) => ({
      taskType,
      ...stats
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Workflow Performance Metrics</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ 
          background: 'var(--bg-muted)', 
          padding: '1.5rem', 
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            {formatTime(metrics.average_execution_time_seconds || 0)}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Avg Execution Time</div>
        </div>

        <div style={{ 
          background: 'var(--bg-muted)', 
          padding: '1.5rem', 
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            {metrics.productivity_score || 0}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Productivity Score</div>
        </div>

        <div style={{ 
          background: 'var(--bg-muted)', 
          padding: '1.5rem', 
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            {metrics.total_executions || 0}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Executions</div>
        </div>
      </div>

      {taskBreakdownArray.length > 0 && (
        <>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Breakdown by Task Type
          </h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {taskBreakdownArray.map((item) => {
              const successRate = item.success_rate || 0;
              return (
                <div 
                  key={item.taskType}
                  style={{
                    background: 'var(--bg-muted)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{item.taskType}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {item.count} {item.count === 1 ? 'execution' : 'executions'}
                    </div>
                  </div>
                  <div style={{ 
                    background: 'var(--bg-primary)', 
                    height: '8px', 
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      background: successRate >= 80 ? 'var(--color-success)' : successRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                      height: '100%',
                      width: `${successRate}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>Success Rate: {successRate}%</span>
                    <span>Avg Time: {formatTime(item.avg_execution_time || 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {costAnalysis.period_cost !== undefined && (
        <>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>
            Cost Analysis
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div style={{ 
              background: 'var(--bg-muted)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                ${costAnalysis.period_cost?.toFixed(2) || '0.00'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Period Cost</div>
            </div>
            <div style={{ 
              background: 'var(--bg-muted)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                ${costAnalysis.monthly_cost?.toFixed(2) || '0.00'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monthly Cost</div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

PerformanceMetrics.propTypes = {
  data: PropTypes.shape({
    metrics: PropTypes.shape({
      average_execution_time_seconds: PropTypes.number,
      productivity_score: PropTypes.number,
      total_executions: PropTypes.number,
    }),
    task_breakdown: PropTypes.object,
    cost_analysis: PropTypes.shape({
      period_cost: PropTypes.number,
      monthly_cost: PropTypes.number,
    }),
  }),
};

export default PerformanceMetrics;
