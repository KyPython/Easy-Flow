import React from 'react';
import styles from './AnalyticsPage.module.css';

const UsageCharts = ({ data }) => {
  // Example: data.metrics, data.usage, etc.
  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Usage Over Time</h2>
      <div className={styles.chartPlaceholder}>
        {data?.usage_over_time ? (
          <pre style={{textAlign:'left'}}>{JSON.stringify(data.usage_over_time, null, 2)}</pre>
        ) : '[Usage Chart Here]'}
      </div>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Success / Failure Rates</h2>
      <div className={styles.chartPlaceholder}>
        {data?.metrics?.success_rate_percent !== undefined ? (
          <span>Success Rate: {data.metrics.success_rate_percent}%</span>
        ) : '[Success/Failure Chart Here]'}
      </div>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Storage Usage</h2>
      <div className={styles.chartPlaceholder}>
        {data?.metrics?.storage_gb !== undefined ? (
          <span>{data.metrics.storage_gb} GB used</span>
        ) : '[Storage Usage Chart Here]'}
      </div>
    </section>
  );
};

export default UsageCharts;
