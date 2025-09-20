import React from 'react';
import styles from './AnalyticsPage.module.css';

const PerformanceMetrics = ({ data }) => {
  // Example: data.metrics.duration_avg, data.metrics.retry_count, etc.
  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Workflow Performance Metrics</h2>
      <div className={styles.chartPlaceholder}>
        {data?.metrics?.duration_avg !== undefined ? (
          <span>Avg Duration: {data.metrics.duration_avg} sec</span>
        ) : '[Performance Metrics Chart Here]'}
      </div>
    </section>
  );
};

export default PerformanceMetrics;
